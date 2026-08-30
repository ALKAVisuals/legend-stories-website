import {
  createDefaultNeonClient,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import { createNeonDocumentNumberAllocator } from '../server/adapters/neon-document-number-allocator.mjs';
import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';
import { createNeonWithdrawalStore } from '../server/adapters/neon-withdrawal-store.mjs';
import { createPendingOrderRecord } from '../server/orders/order-status.mjs';
import { runOrderStoreConformance } from '../server/orders/store-conformance.mjs';
import { WITHDRAWAL_DECLARATION } from '../server/withdrawals/statement.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the Neon integration workflow.`);
  }
  return validateNeonConnectionString(value);
}

const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const PAYPAL_REFERENCE = 'f'.repeat(64);
const PAYPAL_ORDER_ID = '5O190127TN364715T';
const PAYPAL_CAPTURE_ID = '3Y662965014333303';
const PAYPAL_EVENT_ID = 'WH-SYNTHETIC-PAYPAL-001';
const PAYPAL_CUSTOMER_EMAIL = 'paypal-integration@example.invalid';
const WITHDRAWAL_CONSUMER_NAME = 'PayPal Integration';
const WITHDRAWAL_AT = 1_800_100_020;
const DOCUMENT_NUMBER_AT = 1_800_100_030;

async function withClient(connectionString, action) {
  const client = await createDefaultNeonClient(connectionString);
  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.end();
  }
}

async function clearSyntheticRecords() {
  await withClient(migrationUrl, (client) => client.query(`
    TRUNCATE TABLE
      legend_commerce.withdrawal_acknowledgements,
      legend_commerce.withdrawal_requests,
      legend_commerce.order_notifications,
      legend_commerce.paypal_webhook_events,
      legend_commerce.stripe_events,
      legend_commerce.invoices,
      legend_commerce.document_number_series,
      legend_commerce.orders
  `));
}

function paypalPendingOrder() {
  const createdAt = 1_800_100_000;
  return {
    ...createPendingOrderRecord({
      reference: PAYPAL_REFERENCE,
      amountTotal: 4500,
      currency: 'EUR',
      mode: 'test',
      paymentSessionId: PAYPAL_ORDER_ID,
      createdAt,
    }),
    customer: {
      firstname: 'PayPal',
      lastname: 'Integration',
      email: PAYPAL_CUSTOMER_EMAIL,
      street: 'Teststraat 1',
      line2: '',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    items: [{
      slug: 'paypal-schema-fixture',
      page: 'paypal-schema-fixture.html',
      sku: 'PAYPAL-SCHEMA-FIXTURE',
      name: 'PayPal schema fixture',
      image: 'media/stikkers/paypal-schema-fixture.png',
      variantId: 'statement',
      variantLabel: 'Statement',
      sizeLabel: '50 × 50 cm',
      widthCm: 50,
      heightCm: 50,
      longestSideCm: 50,
      sizeCm: 50,
      unitPrice: 45,
      quantity: 1,
      lineTotal: 45,
    }],
    discount: { code: null, percent: 0, amount: 0 },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 0,
      freeFrom: 69,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 4500,
      discount: 0,
      discountedSubtotal: 4500,
      shipping: 0,
      grandTotal: 4500,
    },
  };
}

async function verifyPaypalProviderCompatibilityAndReconciliation() {
  const orderStore = createNeonOrderStore({ connectionString: runtimeUrl });
  const webhookStore = createNeonPayPalWebhookStore({ connectionString: runtimeUrl });
  const persisted = await orderStore.persistPendingCheckout(paypalPendingOrder());
  if (!persisted.created || persisted.order.paymentSessionId !== PAYPAL_ORDER_ID) {
    throw new Error('PayPal pending order could not be persisted through the runtime store.');
  }

  await withClient(runtimeUrl, async (client) => {
    const providerResult = await client.query(
      'SELECT payment_provider FROM legend_commerce.orders WHERE reference = $1',
      [PAYPAL_REFERENCE],
    );
    if (providerResult.rows?.[0]?.payment_provider !== 'paypal') {
      throw new Error('Neon did not derive payment_provider=paypal for the PayPal order ID.');
    }
  });

  const webhookEvent = {
    eventId: PAYPAL_EVENT_ID,
    eventType: 'PAYMENT.CAPTURE.COMPLETED',
    reference: PAYPAL_REFERENCE,
    orderId: PAYPAL_ORDER_ID,
    captureId: PAYPAL_CAPTURE_ID,
    mode: 'test',
    createdAt: 1_800_100_010,
    mutationAt: 1_800_100_009,
    amountTotal: 4500,
    currency: 'EUR',
    targetStatus: 'paid',
  };
  const first = await webhookStore.processPaypalWebhookEvent(webhookEvent);
  if (first.duplicate || first.order.status !== 'paid' || first.order.version !== 1) {
    throw new Error('PayPal completed webhook did not reconcile the pending order to paid.');
  }
  const duplicate = await webhookStore.processPaypalWebhookEvent(webhookEvent);
  if (!duplicate.duplicate || duplicate.order.status !== 'paid' || duplicate.order.version !== 1) {
    throw new Error('Duplicate PayPal webhook was not idempotent.');
  }

  await withClient(runtimeUrl, async (client) => {
    const eventResult = await client.query(
      'SELECT event_id FROM legend_commerce.paypal_webhook_events WHERE event_id = $1',
      [PAYPAL_EVENT_ID],
    );
    if (eventResult.rows?.[0]?.event_id !== PAYPAL_EVENT_ID) {
      throw new Error('Runtime role could not persist the PayPal webhook event reservation.');
    }
  });
}

async function verifyWithdrawalPersistence() {
  const withdrawalStore = createNeonWithdrawalStore({ connectionString: runtimeUrl });
  const first = await withdrawalStore.createWithdrawal({
    orderId: PAYPAL_ORDER_ID,
    email: PAYPAL_CUSTOMER_EMAIL,
    consumerName: WITHDRAWAL_CONSUMER_NAME,
    withdrawnAt: WITHDRAWAL_AT,
  });
  if (!first.created || first.withdrawal.orderId !== PAYPAL_ORDER_ID
    || !/^LM-WD-[A-F0-9]{16}$/.test(first.withdrawal.confirmationCode)) {
    throw new Error('Runtime role could not create a valid withdrawal record.');
  }
  if (first.acknowledgement.consumerName !== WITHDRAWAL_CONSUMER_NAME
    || first.acknowledgement.confirmationEmail !== PAYPAL_CUSTOMER_EMAIL
    || first.acknowledgement.declaration !== WITHDRAWAL_DECLARATION
    || first.acknowledgement.deliveryStatus !== 'pending') {
    throw new Error('Runtime role could not persist the durable withdrawal acknowledgement snapshot.');
  }

  const failed = await withdrawalStore.recordAcknowledgementDelivery({
    confirmationCode: first.withdrawal.confirmationCode,
    status: 'failed',
    attemptedAt: WITHDRAWAL_AT + 1,
    errorCode: 'SYNTHETIC_PROVIDER_FAILURE',
  });
  if (failed.deliveryStatus !== 'failed' || failed.deliveryAttempts !== 1) {
    throw new Error('Runtime role could not persist acknowledgement delivery failure metadata.');
  }

  const duplicate = await withdrawalStore.createWithdrawal({
    orderId: PAYPAL_ORDER_ID,
    email: PAYPAL_CUSTOMER_EMAIL,
    consumerName: 'Changed Consumer',
    withdrawnAt: WITHDRAWAL_AT + 100,
  });
  if (duplicate.created
    || duplicate.withdrawal.confirmationCode !== first.withdrawal.confirmationCode
    || duplicate.acknowledgement.consumerName !== WITHDRAWAL_CONSUMER_NAME
    || duplicate.acknowledgement.withdrawnAt !== WITHDRAWAL_AT) {
    throw new Error('Duplicate withdrawal did not preserve the original durable acknowledgement snapshot.');
  }
}

async function verifyDocumentNumberAllocator() {
  const allocator = createNeonDocumentNumberAllocator({ connectionString: runtimeUrl });
  const concurrentKey = 'gate2-concurrent';

  const allocations = await Promise.all([
    allocator.transact(({ allocate }) => allocate({
      documentType: 'order',
      seriesKey: concurrentKey,
      updatedAt: DOCUMENT_NUMBER_AT,
    })),
    allocator.transact(({ allocate }) => allocate({
      documentType: 'order',
      seriesKey: concurrentKey,
      updatedAt: DOCUMENT_NUMBER_AT + 1,
    })),
  ]);
  const allocatedValues = allocations.map(({ value }) => value).sort((a, b) => a - b);
  if (allocatedValues[0] !== 1 || allocatedValues[1] !== 2) {
    throw new Error(`Concurrent document allocation returned ${allocatedValues.join(',')} instead of 1,2.`);
  }

  await withClient(runtimeUrl, async (client) => {
    const seriesResult = await client.query(
      `SELECT next_value
       FROM legend_commerce.document_number_series
       WHERE document_type = 'order' AND series_key = $1`,
      [concurrentKey],
    );
    if (Number(seriesResult.rows?.[0]?.next_value) !== 3) {
      throw new Error('Concurrent document allocation did not persist next_value=3.');
    }
  });

  const rollbackKey = 'gate2-rollback';
  try {
    await allocator.transact(async ({ allocate }) => {
      const allocation = await allocate({
        documentType: 'invoice',
        seriesKey: rollbackKey,
        updatedAt: DOCUMENT_NUMBER_AT + 2,
      });
      if (allocation.value !== 1) {
        throw new Error('Rollback precondition did not allocate value 1.');
      }
      const rollback = new Error('Synthetic rollback after document number allocation.');
      rollback.code = 'EXPECTED_DOCUMENT_NUMBER_ROLLBACK';
      throw rollback;
    });
    throw new Error('Document number rollback transaction unexpectedly committed.');
  } catch (error) {
    if (error?.code !== 'EXPECTED_DOCUMENT_NUMBER_ROLLBACK') throw error;
  }

  const afterRollback = await allocator.transact(({ allocate }) => allocate({
    documentType: 'invoice',
    seriesKey: rollbackKey,
    updatedAt: DOCUMENT_NUMBER_AT + 3,
  }));
  if (afterRollback.value !== 1 || afterRollback.nextValue !== 2) {
    throw new Error('Rolled-back document number was burned instead of becoming reusable.');
  }
}

async function inspectRuntimePrivilegeBoundary() {
  return withClient(runtimeUrl, async (client) => {
    let leastPrivilegeVerified = true;

    for (const statement of [
      'DELETE FROM legend_commerce.orders WHERE false',
      'TRUNCATE TABLE legend_commerce.orders',
      'DELETE FROM legend_commerce.paypal_webhook_events WHERE false',
      'TRUNCATE TABLE legend_commerce.paypal_webhook_events',
      "UPDATE legend_commerce.paypal_webhook_events SET event_type = event_type WHERE event_id = 'none'",
      'DELETE FROM legend_commerce.withdrawal_requests WHERE false',
      'TRUNCATE TABLE legend_commerce.withdrawal_requests',
      `UPDATE legend_commerce.withdrawal_requests SET confirmation_code = confirmation_code WHERE order_reference = '${PAYPAL_REFERENCE}'`,
      'DELETE FROM legend_commerce.withdrawal_acknowledgements WHERE false',
      'TRUNCATE TABLE legend_commerce.withdrawal_acknowledgements',
      `UPDATE legend_commerce.withdrawal_acknowledgements SET consumer_name = consumer_name WHERE order_reference = '${PAYPAL_REFERENCE}'`,
      `UPDATE legend_commerce.withdrawal_acknowledgements SET confirmation_email = confirmation_email WHERE order_reference = '${PAYPAL_REFERENCE}'`,
      `UPDATE legend_commerce.withdrawal_acknowledgements SET declaration = declaration WHERE order_reference = '${PAYPAL_REFERENCE}'`,
    ]) {
      try {
        await client.query(statement);
        leastPrivilegeVerified = false;
      } catch (error) {
        if (error?.code === '42501') continue;
        throw error;
      }
    }

    return leastPrivilegeVerified;
  });
}

try {
  const report = await runOrderStoreConformance(async () => {
    await clearSyntheticRecords();
    return createNeonOrderStore({ connectionString: runtimeUrl });
  });

  await clearSyntheticRecords();
  await verifyPaypalProviderCompatibilityAndReconciliation();
  await verifyWithdrawalPersistence();
  await verifyDocumentNumberAllocator();
  const leastPrivilegeVerified = await inspectRuntimePrivilegeBoundary();

  console.log(
    `Real Neon order-store integration passed ${report.checkCount} conformance checks.`,
  );
  for (const check of report.checks) {
    console.log(`- ${check}`);
  }
  console.log('- PayPal order IDs persist with derived payment_provider=paypal');
  console.log('- PayPal completed webhook reconciles pending -> paid');
  console.log('- duplicate PayPal webhook remains idempotent');
  console.log('- PayPal webhook event ledger accepts immutable runtime reservations');
  console.log('- withdrawal registration persists with a durable acknowledgement snapshot');
  console.log('- acknowledgement delivery metadata is retryable without mutating the withdrawal statement snapshot');
  console.log('- V3 document number allocator serializes concurrent allocations without duplicates');
  console.log('- V3 document number allocation rolls back without burning a number');

  if (leastPrivilegeVerified) {
    console.log('- least-privilege runtime role');
  } else {
    console.warn(
      '::warning::The isolated Neon runtime role is Neon-managed and has broader privileges than the order-store contract. The integration is operational, but a dedicated least-privilege production role is still required before live payments are enabled.',
    );
  }
} finally {
  await clearSyntheticRecords();
}
