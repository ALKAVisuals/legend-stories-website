import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NeonV3InvoiceDeliverySourceError,
  createNeonV3InvoiceDeliverySource,
} from '../server/adapters/neon-v3-invoice-delivery-source.mjs';

const DATABASE_URL = 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require';
const REFERENCE = 'a'.repeat(64);
const INVOICE_ID = 42;
const PAID_AT = 1_800_200_100;
const ISSUED_AT = 1_800_200_100;
const ORDER_NUMBER = 'LM-ORDER-000001';
const INVOICE_NUMBER = 'LM-INVOICE-000001';

function validSnapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    document: {
      orderNumber: ORDER_NUMBER,
      invoiceNumber: INVOICE_NUMBER,
      issuedAt: ISSUED_AT,
      currency: 'EUR',
      ...(overrides.document || {}),
    },
    order: {
      reference: REFERENCE,
      createdAt: PAID_AT - 100,
      paidAt: PAID_AT,
      ...(overrides.order || {}),
    },
    totals: {
      grandTotalCents: 2995,
      ...(overrides.totals || {}),
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => !['document', 'order', 'totals'].includes(key)),
    ),
  };
}

function validRow(overrides = {}) {
  return {
    order_reference: REFERENCE,
    order_status: 'paid',
    order_paid_at: PAID_AT,
    durable_order_number: ORDER_NUMBER,
    durable_invoice_id: INVOICE_ID,
    document_profile_version: 1,
    order_currency: 'EUR',
    order_amount_total: 2995,
    invoice_id: INVOICE_ID,
    invoice_order_reference: REFERENCE,
    invoice_order_number: ORDER_NUMBER,
    invoice_number: INVOICE_NUMBER,
    invoice_status: 'issued',
    invoice_issued_at: ISSUED_AT,
    invoice_currency: 'EUR',
    invoice_amount_total: 2995,
    invoice_schema_version: 1,
    invoice_snapshot: validSnapshot(),
    ...overrides,
  };
}

function createClientFactory(rowFactory, onQuery = () => {}) {
  return async () => ({
    async connect() {},
    async query(statement, values) {
      onQuery(String(statement), values);
      return { rows: [rowFactory()] };
    },
    async end() {},
  });
}

function createSource(rowFactory, onQuery = () => {}) {
  return createNeonV3InvoiceDeliverySource({
    connectionString: DATABASE_URL,
    clientFactory: createClientFactory(rowFactory, onQuery),
  });
}

function expectCode(code) {
  return (error) => error instanceof NeonV3InvoiceDeliverySourceError && error.code === code;
}

test('loadIssuedInvoiceForDelivery uses one read-only durable order/invoice query', async () => {
  let queryCount = 0;
  const source = createSource(
    () => validRow(),
    (statement, values) => {
      queryCount += 1;
      assert.match(statement, /FROM legend_commerce\.orders AS o/);
      assert.match(statement, /LEFT JOIN legend_commerce\.invoices AS i/);
      assert.doesNotMatch(statement, /FOR UPDATE|\bUPDATE\b|\bINSERT\b|\bDELETE\b/i);
      assert.deepEqual(values, [REFERENCE, INVOICE_ID]);
    },
  );

  const result = await source.loadIssuedInvoiceForDelivery({
    orderReference: REFERENCE,
    invoiceId: INVOICE_ID,
  });

  assert.equal(queryCount, 1);
  assert.deepEqual(
    {
      orderReference: result.orderReference,
      invoiceId: result.invoiceId,
      orderNumber: result.orderNumber,
      invoiceNumber: result.invoiceNumber,
      issuedAt: result.issuedAt,
      currency: result.currency,
      amountTotal: result.amountTotal,
      snapshotSchemaVersion: result.snapshotSchemaVersion,
    },
    {
      orderReference: REFERENCE,
      invoiceId: INVOICE_ID,
      orderNumber: ORDER_NUMBER,
      invoiceNumber: INVOICE_NUMBER,
      issuedAt: ISSUED_AT,
      currency: 'EUR',
      amountTotal: 2995,
      snapshotSchemaVersion: 1,
    },
  );
  assert.equal(result.snapshot.document.invoiceNumber, INVOICE_NUMBER);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.snapshot), true);
});

test('delivery source rejects invalid request identity before database access', async () => {
  let connected = false;
  const source = createNeonV3InvoiceDeliverySource({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      connected = true;
      throw new Error('should not connect');
    },
  });

  await assert.rejects(
    source.loadIssuedInvoiceForDelivery({ orderReference: 'bad', invoiceId: INVOICE_ID }),
    expectCode('INVALID_V3_INVOICE_DELIVERY_REQUEST'),
  );
  await assert.rejects(
    source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: 0 }),
    expectCode('INVALID_V3_INVOICE_DELIVERY_REQUEST'),
  );
  assert.equal(connected, false);
});

test('delivery source requires a durable paid Profile-1 order', async (t) => {
  for (const [name, overrides] of [
    ['not paid', { order_status: 'payment_pending' }],
    ['legacy profile', { document_profile_version: 0 }],
    ['missing paid timestamp', { order_paid_at: null }],
  ]) {
    await t.test(name, async () => {
      const source = createSource(() => validRow(overrides));
      await assert.rejects(
        source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
        expectCode('V3_INVOICE_DELIVERY_STATE_MISMATCH'),
      );
    });
  }
});

test('delivery source hard-fails durable order/invoice identity drift', async (t) => {
  const cases = [
    ['order invoice link', { durable_invoice_id: 41 }],
    ['invoice id', { invoice_id: 41 }],
    ['invoice order reference', { invoice_order_reference: 'b'.repeat(64) }],
    ['invoice order number', { invoice_order_number: 'OTHER-ORDER' }],
    ['currency', { invoice_currency: 'USD' }],
    ['amount', { invoice_amount_total: 2994 }],
  ];

  for (const [name, overrides] of cases) {
    await t.test(name, async () => {
      const source = createSource(() => validRow(overrides));
      await assert.rejects(
        source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
        expectCode('V3_INVOICE_DELIVERY_IDENTITY_MISMATCH'),
      );
    });
  }
});

test('delivery source requires an issued schema-v1 invoice', async (t) => {
  await t.test('missing requested invoice', async () => {
    const source = createSource(() => validRow({ invoice_id: null }));
    await assert.rejects(
      source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
      expectCode('V3_INVOICE_DELIVERY_INVOICE_NOT_FOUND'),
    );
  });

  await t.test('invoice not issued', async () => {
    const source = createSource(() => validRow({ invoice_status: 'draft' }));
    await assert.rejects(
      source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
      expectCode('V3_INVOICE_DELIVERY_STATE_MISMATCH'),
    );
  });

  await t.test('unsupported durable schema version', async () => {
    const source = createSource(() => validRow({ invoice_schema_version: 2 }));
    await assert.rejects(
      source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
      expectCode('V3_INVOICE_DELIVERY_SNAPSHOT_MISMATCH'),
    );
  });
});

test('delivery source hard-fails immutable snapshot identity drift', async (t) => {
  const cases = [
    ['schema', validSnapshot({ schemaVersion: 2 })],
    ['order number', validSnapshot({ document: { orderNumber: 'OTHER-ORDER' } })],
    ['invoice number', validSnapshot({ document: { invoiceNumber: 'OTHER-INVOICE' } })],
    ['issued timestamp', validSnapshot({ document: { issuedAt: ISSUED_AT + 1 } })],
    ['currency', validSnapshot({ document: { currency: 'USD' } })],
    ['reference', validSnapshot({ order: { reference: 'b'.repeat(64) } })],
    ['paid timestamp', validSnapshot({ order: { paidAt: PAID_AT + 1 } })],
    ['grand total', validSnapshot({ totals: { grandTotalCents: 2994 } })],
  ];

  for (const [name, snapshot] of cases) {
    await t.test(name, async () => {
      const source = createSource(() => validRow({ invoice_snapshot: snapshot }));
      await assert.rejects(
        source.loadIssuedInvoiceForDelivery({ orderReference: REFERENCE, invoiceId: INVOICE_ID }),
        expectCode('V3_INVOICE_DELIVERY_SNAPSHOT_MISMATCH'),
      );
    });
  }
});

test('delivery source returns a cloned snapshot rather than the database row object', async () => {
  const storedSnapshot = validSnapshot();
  const source = createSource(() => validRow({ invoice_snapshot: storedSnapshot }));
  const result = await source.loadIssuedInvoiceForDelivery({
    orderReference: REFERENCE,
    invoiceId: INVOICE_ID,
  });

  assert.notEqual(result.snapshot, storedSnapshot);
  assert.equal(storedSnapshot.document.invoiceNumber, INVOICE_NUMBER);
});
