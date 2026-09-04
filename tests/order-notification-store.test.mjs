import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MAX_V3_AUTOMATIC_CLAIMS,
  NeonOrderNotificationStoreError,
  createNeonOrderNotificationStore,
} from '../server/adapters/neon-order-notification-store.mjs';

const DATABASE_URL = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const REFERENCE = 'a'.repeat(64);
const CLAIM_TOKEN = 'claim-token-1';
const PDF_SHA256 = 'b'.repeat(64);
const PDF_BYTE_LENGTH = 1234;
const ATTACHMENT_FILENAME = 'LM-INVOICE-000001.pdf';

function row(overrides = {}) {
  return {
    order_reference: REFERENCE,
    notification_type: 'merchant_paid_order',
    delivery_status: 'pending',
    delivery_attempts: 0,
    claimed_at: null,
    last_attempt_at: null,
    sent_at: null,
    provider_message_id: null,
    last_error_code: null,
    invoice_id: null,
    snapshot_schema_version: null,
    renderer_version: null,
    pdf_sha256: null,
    pdf_byte_length: null,
    attachment_filename: null,
    claim_token: null,
    lease_expires_at: null,
    next_attempt_at: null,
    created_at: 100,
    updated_at: 100,
    ...overrides,
  };
}

function createClientFactory(queryHandler) {
  return async () => ({
    async connect() {},
    async query(statement, values) {
      return queryHandler(String(statement), values);
    },
    async end() {},
  });
}

function createStore(queryHandler) {
  return createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: createClientFactory(queryHandler),
    claimTokenFactory: () => CLAIM_TOKEN,
  });
}

function artifactInput(overrides = {}) {
  return {
    orderReference: REFERENCE,
    invoiceId: 42,
    claimToken: CLAIM_TOKEN,
    rendererVersion: 1,
    pdfSha256: PDF_SHA256,
    pdfByteLength: PDF_BYTE_LENGTH,
    attachmentFilename: ATTACHMENT_FILENAME,
    updatedAt: 300,
    ...overrides,
  };
}

function preparedRow(overrides = {}) {
  return row({
    notification_type: 'customer_v3_invoice',
    delivery_status: 'sending',
    delivery_attempts: 1,
    claimed_at: 200,
    last_attempt_at: 200,
    invoice_id: 42,
    snapshot_schema_version: 1,
    renderer_version: 1,
    pdf_sha256: PDF_SHA256,
    pdf_byte_length: PDF_BYTE_LENGTH,
    attachment_filename: ATTACHMENT_FILENAME,
    claim_token: CLAIM_TOKEN,
    lease_expires_at: 500,
    updated_at: 300,
    ...overrides,
  });
}

function expectStoreCode(code) {
  return (error) => error instanceof NeonOrderNotificationStoreError && error.code === code;
}

test('notification types reject unsupported values before database access', async () => {
  let connected = false;
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      connected = true;
      throw new Error('should not connect');
    },
  });

  await assert.rejects(
    store.ensureNotification({
      orderReference: REFERENCE,
      notificationType: 'unknown_type',
      createdAt: 100,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION_TYPE',
  );
  assert.equal(connected, false);
});

test('legacy ensureNotification remains backward compatible', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /INSERT INTO legend_commerce\.order_notifications/);
    assert.deepEqual(values, [REFERENCE, 'merchant_paid_order', 100, null, null]);
    return { rows: [row()] };
  });

  const result = await store.ensureNotification({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    createdAt: 100,
  });

  assert.equal(result.created, true);
  assert.equal(result.notification.invoiceId, null);
  assert.equal(result.notification.deliveryStatus, 'pending');
});

test('customer_v3_invoice requires immutable invoice binding before database access', async () => {
  let connected = false;
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      connected = true;
      throw new Error('should not connect');
    },
  });

  await assert.rejects(
    store.ensureNotification({
      orderReference: REFERENCE,
      notificationType: 'customer_v3_invoice',
      createdAt: 100,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION_DELIVERY',
  );
  assert.equal(connected, false);
});

test('customer_v3_invoice persists invoice identity and snapshot schema version', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /invoice_id, snapshot_schema_version/);
    assert.deepEqual(values, [REFERENCE, 'customer_v3_invoice', 100, 42, 1]);
    return {
      rows: [row({
        notification_type: 'customer_v3_invoice',
        invoice_id: 42,
        snapshot_schema_version: 1,
      })],
    };
  });

  const result = await store.ensureNotification({
    orderReference: REFERENCE,
    notificationType: 'customer_v3_invoice',
    createdAt: 100,
    invoiceId: 42,
    snapshotSchemaVersion: 1,
  });

  assert.equal(result.created, true);
  assert.equal(result.notification.invoiceId, 42);
  assert.equal(result.notification.snapshotSchemaVersion, 1);
});

test('duplicate V3 ensure refuses a different invoice identity', async () => {
  let call = 0;
  const store = createStore((statement) => {
    call += 1;
    if (call === 1) return { rows: [] };
    assert.match(statement, /SELECT/);
    return {
      rows: [row({
        notification_type: 'customer_v3_invoice',
        invoice_id: 41,
        snapshot_schema_version: 1,
      })],
    };
  });

  await assert.rejects(
    store.ensureNotification({
      orderReference: REFERENCE,
      notificationType: 'customer_v3_invoice',
      createdAt: 100,
      invoiceId: 42,
      snapshotSchemaVersion: 1,
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'ORDER_NOTIFICATION_IDENTITY_MISMATCH',
  );
});

test('claimNotification preserves legacy retry behavior while hardening V3 retry eligibility and attempt limits', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /delivery_status = 'pending'/);
    assert.match(statement, /notification_type <> 'customer_v3_invoice'[\s\S]*delivery_attempts < \$7/);
    assert.match(statement, /notification_type = 'customer_v3_invoice'[\s\S]*next_attempt_at IS NOT NULL[\s\S]*next_attempt_at <= \$3/);
    assert.match(statement, /notification_type <> 'customer_v3_invoice'[\s\S]*next_attempt_at IS NULL OR next_attempt_at <= \$3/);
    assert.match(statement, /delivery_status = 'sending'/);
    assert.match(statement, /COALESCE\(lease_expires_at, claimed_at \+ \$6\) <= \$3/);
    assert.deepEqual(values, [
      REFERENCE,
      'customer_paid_order',
      200,
      CLAIM_TOKEN,
      500,
      300,
      MAX_V3_AUTOMATIC_CLAIMS,
    ]);
    return {
      rows: [row({
        notification_type: 'customer_paid_order',
        delivery_status: 'sending',
        delivery_attempts: 1,
        claimed_at: 200,
        last_attempt_at: 200,
        claim_token: CLAIM_TOKEN,
        lease_expires_at: 500,
        updated_at: 200,
      })],
    };
  });

  const result = await store.claimNotification({
    orderReference: REFERENCE,
    notificationType: 'customer_paid_order',
    attemptedAt: 200,
  });

  assert.equal(result.claimed, true);
  assert.equal(result.notification.claimToken, CLAIM_TOKEN);
  assert.equal(result.notification.leaseExpiresAt, 500);
});

test('customer_v3_invoice terminal NULL schedule and exhausted claims remain unclaimed', async (t) => {
  const cases = [
    ['terminal failed row', row({
      notification_type: 'customer_v3_invoice',
      delivery_status: 'failed',
      delivery_attempts: 1,
      invoice_id: 42,
      snapshot_schema_version: 1,
      last_error_code: 'RESEND_PAID_ORDER_INVALID_MESSAGE',
      next_attempt_at: null,
    })],
    ['exhausted stale row', row({
      notification_type: 'customer_v3_invoice',
      delivery_status: 'sending',
      delivery_attempts: MAX_V3_AUTOMATIC_CLAIMS,
      claimed_at: 100,
      last_attempt_at: 100,
      invoice_id: 42,
      snapshot_schema_version: 1,
      claim_token: 'old-claim',
      lease_expires_at: 150,
    })],
  ];

  for (const [name, currentRow] of cases) {
    await t.test(name, async () => {
      let call = 0;
      const store = createStore((statement, values) => {
        call += 1;
        if (call === 1) {
          assert.match(statement, /delivery_attempts < \$7/);
          assert.match(statement, /next_attempt_at IS NOT NULL/);
          assert.equal(values[6], MAX_V3_AUTOMATIC_CLAIMS);
          return { rows: [] };
        }
        assert.match(statement, /SELECT/);
        assert.deepEqual(values, [REFERENCE, 'customer_v3_invoice']);
        return { rows: [currentRow] };
      });

      const result = await store.claimNotification({
        orderReference: REFERENCE,
        notificationType: 'customer_v3_invoice',
        attemptedAt: 200,
      });

      assert.equal(result.claimed, false);
      assert.equal(result.notification.deliveryAttempts, currentRow.delivery_attempts);
      assert.equal(result.notification.nextAttemptAt, currentRow.next_attempt_at ?? null);
    });
  }
});

test('prepareV3InvoiceArtifact atomically persists metadata only for an active V3 claim', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /UPDATE legend_commerce\.order_notifications/);
    assert.match(statement, /notification_type = 'customer_v3_invoice'/);
    assert.match(statement, /invoice_id = \$2/);
    assert.match(statement, /snapshot_schema_version = 1/);
    assert.match(statement, /delivery_status = 'sending'/);
    assert.match(statement, /claim_token = \$3/);
    assert.match(statement, /claimed_at <= \$8/);
    assert.match(statement, /lease_expires_at > \$8/);
    assert.match(statement, /renderer_version = COALESCE\(renderer_version, \$4\)/);
    assert.deepEqual(values, [
      REFERENCE,
      42,
      CLAIM_TOKEN,
      1,
      PDF_SHA256,
      PDF_BYTE_LENGTH,
      ATTACHMENT_FILENAME,
      300,
    ]);
    return { rows: [preparedRow()] };
  });

  const notification = await store.prepareV3InvoiceArtifact(artifactInput());
  assert.equal(notification.rendererVersion, 1);
  assert.equal(notification.pdfSha256, PDF_SHA256);
  assert.equal(notification.pdfByteLength, PDF_BYTE_LENGTH);
  assert.equal(notification.attachmentFilename, ATTACHMENT_FILENAME);
  assert.equal(notification.claimToken, CLAIM_TOKEN);
});

test('prepareV3InvoiceArtifact accepts an exact repeated artifact identity idempotently', async () => {
  const store = createStore((statement) => {
    assert.match(statement, /renderer_version = \$4/);
    assert.match(statement, /pdf_sha256 = \$5/);
    assert.match(statement, /pdf_byte_length = \$6/);
    assert.match(statement, /attachment_filename = \$7/);
    return { rows: [preparedRow({ updated_at: 250 })] };
  });

  const notification = await store.prepareV3InvoiceArtifact(artifactInput({ updatedAt: 300 }));
  assert.equal(notification.updatedAt, 250);
  assert.equal(notification.pdfSha256, PDF_SHA256);
});

test('prepareV3InvoiceArtifact hard-fails metadata drift after first preparation', async () => {
  let call = 0;
  const store = createStore((statement, values) => {
    call += 1;
    if (call === 1) {
      assert.match(statement, /UPDATE legend_commerce\.order_notifications/);
      return { rows: [] };
    }
    assert.match(statement, /SELECT/);
    assert.deepEqual(values, [REFERENCE, 'customer_v3_invoice']);
    return { rows: [preparedRow()] };
  });

  await assert.rejects(
    store.prepareV3InvoiceArtifact(artifactInput({ pdfSha256: 'c'.repeat(64) })),
    expectStoreCode('ORDER_NOTIFICATION_ARTIFACT_MISMATCH'),
  );
});

test('prepareV3InvoiceArtifact hard-fails wrong invoice, wrong token and stale lease', async (t) => {
  const cases = [
    [
      'wrong invoice',
      artifactInput({ invoiceId: 43 }),
      preparedRow(),
      'ORDER_NOTIFICATION_IDENTITY_MISMATCH',
    ],
    [
      'wrong token',
      artifactInput({ claimToken: 'other-token' }),
      preparedRow(),
      'ORDER_NOTIFICATION_CLAIM_CONFLICT',
    ],
    [
      'expired lease',
      artifactInput({ updatedAt: 500 }),
      preparedRow({ lease_expires_at: 500 }),
      'ORDER_NOTIFICATION_CLAIM_CONFLICT',
    ],
    [
      'backdated attempt',
      artifactInput({ updatedAt: 199 }),
      preparedRow({ claimed_at: 200, lease_expires_at: 500 }),
      'ORDER_NOTIFICATION_CLAIM_CONFLICT',
    ],
  ];

  for (const [name, input, currentRow, expectedCode] of cases) {
    await t.test(name, async () => {
      let call = 0;
      const store = createStore(() => {
        call += 1;
        return call === 1 ? { rows: [] } : { rows: [currentRow] };
      });
      await assert.rejects(
        store.prepareV3InvoiceArtifact(input),
        expectStoreCode(expectedCode),
      );
    });
  }
});

test('prepareV3InvoiceArtifact rejects unsafe artifact identity before database access', async () => {
  let connected = false;
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      connected = true;
      throw new Error('should not connect');
    },
  });

  for (const overrides of [
    { claimToken: ' claim-token-1 ' },
    { rendererVersion: 0 },
    { pdfSha256: 'ABC' },
    { pdfByteLength: 0 },
    { attachmentFilename: '../invoice.pdf' },
    { attachmentFilename: 'invoice.txt' },
  ]) {
    await assert.rejects(store.prepareV3InvoiceArtifact(artifactInput(overrides)));
  }
  assert.equal(connected, false);
});

test('failed delivery clears the lease and persists durable retry scheduling', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /delivery_status = 'failed'/);
    assert.match(statement, /lease_expires_at = NULL/);
    assert.match(statement, /next_attempt_at = \$5/);
    assert.deepEqual(values, [REFERENCE, 'customer_v3_invoice', 300, 'RESEND_TIMEOUT', 600, CLAIM_TOKEN]);
    return {
      rows: [row({
        notification_type: 'customer_v3_invoice',
        delivery_status: 'failed',
        delivery_attempts: 1,
        invoice_id: 42,
        snapshot_schema_version: 1,
        last_error_code: 'RESEND_TIMEOUT',
        next_attempt_at: 600,
        updated_at: 300,
      })],
    };
  });

  const notification = await store.recordDelivery({
    orderReference: REFERENCE,
    notificationType: 'customer_v3_invoice',
    status: 'failed',
    attemptedAt: 300,
    errorCode: 'RESEND_TIMEOUT',
    nextAttemptAt: 600,
    claimToken: CLAIM_TOKEN,
  });

  assert.equal(notification.deliveryStatus, 'failed');
  assert.equal(notification.nextAttemptAt, 600);
  assert.equal(notification.claimToken, null);
});

test('V3 completion requires the current claim token', async () => {
  const store = createNeonOrderNotificationStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      throw new Error('should not connect');
    },
  });

  await assert.rejects(
    store.recordDelivery({
      orderReference: REFERENCE,
      notificationType: 'customer_v3_invoice',
      status: 'sent',
      attemptedAt: 300,
      providerMessageId: 're_123',
    }),
    (error) => error instanceof NeonOrderNotificationStoreError
      && error.code === 'INVALID_ORDER_NOTIFICATION_CLAIM_TOKEN',
  );
});

test('legacy sent delivery remains compatible without a claim token', async () => {
  const store = createStore((statement, values) => {
    assert.match(statement, /delivery_status = 'sent'/);
    assert.deepEqual(values, [REFERENCE, 'merchant_paid_order', 300, 're_123', null]);
    return {
      rows: [row({
        delivery_status: 'sent',
        delivery_attempts: 1,
        claimed_at: 250,
        last_attempt_at: 250,
        sent_at: 300,
        provider_message_id: 're_123',
        updated_at: 300,
      })],
    };
  });

  const notification = await store.recordDelivery({
    orderReference: REFERENCE,
    notificationType: 'merchant_paid_order',
    status: 'sent',
    attemptedAt: 300,
    providerMessageId: 're_123',
  });

  assert.equal(notification.deliveryStatus, 'sent');
  assert.equal(notification.providerMessageId, 're_123');
});

test('migration 013 adds V3 invoice binding, claim lease and retry scheduling without changing primary logical key', async () => {
  const baseMigration = await readFile(
    new URL('../server/db/migrations/009_create_order_notifications.sql', import.meta.url),
    'utf8',
  );
  const migration = await readFile(
    new URL('../server/db/migrations/013_extend_order_notifications_for_v3_invoice_delivery.sql', import.meta.url),
    'utf8',
  );

  assert.match(baseMigration, /PRIMARY KEY \(order_reference, notification_type\)/);
  assert.match(migration, /customer_v3_invoice/);
  assert.match(migration, /invoice_id bigint/);
  assert.match(migration, /snapshot_schema_version smallint/);
  assert.match(migration, /claim_token text/);
  assert.match(migration, /lease_expires_at bigint/);
  assert.match(migration, /next_attempt_at bigint/);
  assert.match(migration, /FOREIGN KEY \(invoice_id, order_reference\)/);
  assert.match(migration, /REFERENCES legend_commerce\.invoices\(id, order_reference\)/);
  assert.match(migration, /order_notifications_v3_invoice_binding_required/);
  assert.match(migration, /order_notifications_delivery_due_idx/);
});

test('migration 014 makes V3 PDF artifact identity all-null or complete and safe', async () => {
  const migration = await readFile(
    new URL('../server/db/migrations/014_harden_v3_invoice_artifact_identity.sql', import.meta.url),
    'utf8',
  );
  const migrationRunner = await readFile(
    new URL('../scripts/run-neon-test-migrations.mjs', import.meta.url),
    'utf8',
  );

  assert.match(migration, /order_notifications_v3_artifact_identity_complete/);
  assert.match(
    migration,
    /renderer_version IS NULL[\s\S]*pdf_sha256 IS NULL[\s\S]*pdf_byte_length IS NULL[\s\S]*attachment_filename IS NULL/,
  );
  assert.match(migration, /notification_type = 'customer_v3_invoice'/);
  assert.match(migration, /renderer_version >= 1/);
  assert.match(migration, /pdf_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /pdf_byte_length > 0/);
  assert.match(migration, /length\(attachment_filename\) BETWEEN 1 AND 200/);
  assert.match(migration, /attachment_filename = btrim\(attachment_filename\)/);
  assert.ok(migration.includes("attachment_filename !~ '[[:cntrl:]]'"));
  assert.match(migration, /position\('\/' in attachment_filename\) = 0/);
  assert.match(migration, /position\(chr\(92\) in attachment_filename\) = 0/);
  assert.match(migration, /lower\(attachment_filename\) LIKE '%\.pdf'/);
  assert.match(migrationRunner, /014_harden_v3_invoice_artifact_identity\.sql/);
});