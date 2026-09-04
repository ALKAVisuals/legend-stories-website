import {
  createDefaultNeonClient,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import { createNeonDocumentNumberAllocator } from '../server/adapters/neon-document-number-allocator.mjs';
import { createNeonOrderNotificationStore } from '../server/adapters/neon-order-notification-store.mjs';
import { createNeonPaidOrderFinalizer } from '../server/adapters/neon-paid-order-finalizer.mjs';
import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';
import { createNeonV3InvoiceDeliverySource } from '../server/adapters/neon-v3-invoice-delivery-source.mjs';
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
const FINALIZER_FIRST_REFERENCE = 'a'.repeat(64);
const FINALIZER_RACE_REFERENCE = 'b'.repeat(64);
const FINALIZER_ROLLBACK_REFERENCE = 'c'.repeat(64);
const FINALIZER_FIRST_ORDER_ID = 'FINALIZERFIRST001';
const FINALIZER_RACE_ORDER_ID = 'FINALIZERRACE001';
const FINALIZER_ROLLBACK_ORDER_ID = 'FINALIZERROLLBACK001';
const FINALIZER_CREATED_AT = 1_800_200_000;
const FINALIZER_PAID_AT = 1_800_200_100;
const V3_DELIVERY_CLAIM_AT = FINALIZER_PAID_AT + 50;
const V3_DELIVERY_PDF_SHA256 = 'd'.repeat(64);
const V3_DELIVERY_PDF_BYTE_LENGTH = 4321;
const V3_DELIVERY_FILENAME = 'TEST-GATE3-V3-INVOICE.pdf';

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

function finalizerPendingOrder({ reference, orderId, createdAt }) {
  return {
    ...createPendingOrderRecord({
      reference,
      amountTotal: 2995,
      currency: 'EUR',
      mode: 'test',
      paymentSessionId: orderId,
      createdAt,
    }),
    customer: {
      firstname: 'Neon',
      lastname: 'Finalizer',
      email: 'finalizer-buyer@example.invalid',
      street: 'Shipping Street 1',
      line2: '',
      zip: '1234AB',
      city: 'Testville',
      country: 'NL',
    },
    items: [{
      productId: 'LM-2026-00001',
      slug: 'synthetic-test-product',
      page: '/synthetic-test-product.html',
      sku: 'SYNTHETIC-45',
      name: 'Synthetic Test Product — Standard (45 cm)',
      image: '/media/synthetic-test-product.png',
      variantId: 'standard-45',
      variantLabel: 'Standard',
      sizeLabel: '45 cm',
      widthCm: 45,
      heightCm: 45,
      longestSideCm: 45,
      sizeCm: 45,
      unitPrice: 12.5,
      quantity: 2,
      lineTotal: 25,
    }],
    discount: {
      code: 'TEST20',
      percent: 20,
      amount: 5,
    },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Synthetic Netherlands',
      cost: 9.95,
      freeFrom: null,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 2500,
      discount: 500,
      discountedSubtotal: 2000,
      shipping: 995,
      grandTotal: 2995,
    },
  };
}

function finalizerPayment({ reference, orderId, paidAt }) {
  return {
    reference,
    provider: 'paypal',
    providerOrderId: orderId,
    providerCaptureId: `CAPTURE-${orderId}`,
    amountTotal: 2995,
    currency: 'EUR',
    mode: 'test',
    paidAt,
    source: 'isolated_neon_finalizer_test',
  };
}

function finalizerDocumentContext() {
  return {
    seller: {
      legalName: 'Synthetic Seller B.V.',
      tradingName: 'Synthetic Seller',
      registrationNumber: 'TEST-REGISTRATION',
      vatIdentificationNumber: 'TEST-VAT-ID',
      invoiceEmail: 'invoices@example.invalid',
      supportEmail: 'support@example.invalid',
      website: 'https://example.invalid',
      address: {
        street: 'Seller Street 1',
        postalCode: '5678CD',
        city: 'Seller City',
        countryCode: 'NL',
      },
    },
    billingAddress: {
      street: 'Billing Street 9',
      postalCode: '9999ZZ',
      city: 'Billing City',
      countryCode: 'NL',
    },
    tax: {
      treatmentCode: 'synthetic-test-treatment',
      jurisdictionCode: 'TEST-NL',
      pricingBasis: 'not_applicable',
      taxableAmountCents: 0,
      taxAmountCents: 0,
      rateBasisPoints: null,
      legalText: 'Synthetic isolated-Neon test fixture only.',
    },
  };
}

function createFinalizer(seriesPrefix, documentContextProvider = finalizerDocumentContext) {
  return createNeonPaidOrderFinalizer({
    connectionString: runtimeUrl,
    numberingPolicy: {
      resolveSeriesKey({ documentType }) {
        return `${seriesPrefix}-${documentType}`;
      },
      format({ documentType, value }) {
        return `TEST-${seriesPrefix.toUpperCase()}-${documentType.toUpperCase()}-${String(value).padStart(6, '0')}`;
      },
    },
    documentContextProvider,
  });
}

async function seedProfile1PendingOrder({ reference, orderId, createdAt }) {
  const orderStore = createNeonOrderStore({ connectionString: runtimeUrl });
  const persisted = await orderStore.persistPendingCheckout(finalizerPendingOrder({
    reference,
    orderId,
    createdAt,
  }));
  if (!persisted.created || persisted.order.status !== 'payment_pending') {
    throw new Error('Could not persist the synthetic profile-1 finalizer checkout fixture.');
  }

  await withClient(migrationUrl, async (client) => {
    const result = await client.query(
      `UPDATE legend_commerce.orders
       SET document_profile_version = 1
       WHERE reference = $1
         AND status = 'payment_pending'
         AND document_profile_version = 0
       RETURNING reference`,
      [reference],
    );
    if (result.rows?.[0]?.reference !== reference) {
      throw new Error('Could not promote the isolated fixture to document profile 1.');
    }
  });
}

async function readFinalizerState({ reference, seriesPrefix }) {
  return withClient(migrationUrl, async (client) => {
    const orderResult = await client.query(
      `SELECT reference, status, paid_at, order_number, order_number_assigned_at,
              invoice_id, document_profile_version, version
       FROM legend_commerce.orders
       WHERE reference = $1`,
      [reference],
    );
    const invoicesResult = await client.query(
      `SELECT id, order_reference, order_number, invoice_number, status, issued_at,
              currency, amount_total, schema_version, snapshot
       FROM legend_commerce.invoices
       WHERE order_reference = $1
       ORDER BY id`,
      [reference],
    );
    const seriesResult = await client.query(
      `SELECT document_type, series_key, next_value
       FROM legend_commerce.document_number_series
       WHERE series_key IN ($1, $2)
       ORDER BY document_type`,
      [`${seriesPrefix}-order`, `${seriesPrefix}-invoice`],
    );
    return {
      order: orderResult.rows?.[0] || null,
      invoices: invoicesResult.rows || [],
      series: seriesResult.rows || [],
    };
  });
}

function assertSingleDurableFinalizerIdentity(state, { reference, expectedValue = 1 }) {
  if (!state.order
    || state.order.reference !== reference
    || state.order.status !== 'paid'
    || Number(state.order.document_profile_version) !== 1
    || !state.order.order_number
    || !state.order.invoice_id
    || state.invoices.length !== 1) {
    throw new Error('Profile-1 finalizer did not persist exactly one durable paid identity.');
  }

  const invoice = state.invoices[0];
  if (Number(invoice.id) !== Number(state.order.invoice_id)
    || invoice.order_reference !== reference
    || invoice.order_number !== state.order.order_number
    || invoice.status !== 'issued'
    || Number(invoice.schema_version) !== 1
    || invoice.snapshot?.schemaVersion !== 1
    || invoice.snapshot?.document?.orderNumber !== state.order.order_number
    || invoice.snapshot?.document?.invoiceNumber !== invoice.invoice_number
    || invoice.snapshot?.order?.reference !== reference
    || Number(invoice.snapshot?.totals?.grandTotalCents) !== 2995) {
    throw new Error('Persisted invoice snapshot/linkage does not match the paid order identity.');
  }

  if (state.series.length !== 2
    || state.series.some((row) => Number(row.next_value) !== expectedValue + 1)) {
    throw new Error('Finalizer document counters did not advance exactly once.');
  }
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

async function verifyProfile1PaidFinalizerOnRealNeon() {
  await seedProfile1PendingOrder({
    reference: FINALIZER_FIRST_REFERENCE,
    orderId: FINALIZER_FIRST_ORDER_ID,
    createdAt: FINALIZER_CREATED_AT,
  });
  const firstFinalizer = createFinalizer('gate3-first');
  const firstPayment = finalizerPayment({
    reference: FINALIZER_FIRST_REFERENCE,
    orderId: FINALIZER_FIRST_ORDER_ID,
    paidAt: FINALIZER_PAID_AT,
  });
  const first = await firstFinalizer.finalizePaidOrder(firstPayment);
  if (first.duplicate || first.legacy || first.order.status !== 'paid') {
    throw new Error('First real-Neon profile-1 finalization did not create a new paid V3 identity.');
  }
  const firstState = await readFinalizerState({
    reference: FINALIZER_FIRST_REFERENCE,
    seriesPrefix: 'gate3-first',
  });
  assertSingleDurableFinalizerIdentity(firstState, {
    reference: FINALIZER_FIRST_REFERENCE,
  });

  const duplicate = await firstFinalizer.finalizePaidOrder(firstPayment);
  if (!duplicate.duplicate
    || duplicate.order.orderNumber !== first.order.orderNumber
    || duplicate.invoice.invoiceNumber !== first.invoice.invoiceNumber) {
    throw new Error('Duplicate real-Neon finalization did not return the existing durable identity.');
  }
  const duplicateState = await readFinalizerState({
    reference: FINALIZER_FIRST_REFERENCE,
    seriesPrefix: 'gate3-first',
  });
  assertSingleDurableFinalizerIdentity(duplicateState, {
    reference: FINALIZER_FIRST_REFERENCE,
  });

  await seedProfile1PendingOrder({
    reference: FINALIZER_RACE_REFERENCE,
    orderId: FINALIZER_RACE_ORDER_ID,
    createdAt: FINALIZER_CREATED_AT + 10,
  });
  const raceFinalizer = createFinalizer('gate3-race');
  const racePayment = finalizerPayment({
    reference: FINALIZER_RACE_REFERENCE,
    orderId: FINALIZER_RACE_ORDER_ID,
    paidAt: FINALIZER_PAID_AT + 10,
  });
  const raceResults = await Promise.all([
    raceFinalizer.finalizePaidOrder(racePayment),
    raceFinalizer.finalizePaidOrder(racePayment),
  ]);
  if (raceResults.filter((result) => result.duplicate === false).length !== 1
    || raceResults.filter((result) => result.duplicate === true).length !== 1
    || raceResults[0].order.orderNumber !== raceResults[1].order.orderNumber
    || raceResults[0].invoice.invoiceNumber !== raceResults[1].invoice.invoiceNumber) {
    throw new Error('Concurrent real-Neon finalizations did not converge on one durable identity.');
  }
  const raceState = await readFinalizerState({
    reference: FINALIZER_RACE_REFERENCE,
    seriesPrefix: 'gate3-race',
  });
  assertSingleDurableFinalizerIdentity(raceState, {
    reference: FINALIZER_RACE_REFERENCE,
  });

  await seedProfile1PendingOrder({
    reference: FINALIZER_ROLLBACK_REFERENCE,
    orderId: FINALIZER_ROLLBACK_ORDER_ID,
    createdAt: FINALIZER_CREATED_AT + 20,
  });
  const rollbackPayment = finalizerPayment({
    reference: FINALIZER_ROLLBACK_REFERENCE,
    orderId: FINALIZER_ROLLBACK_ORDER_ID,
    paidAt: FINALIZER_PAID_AT + 20,
  });
  const failingFinalizer = createFinalizer('gate3-rollback', () => ({
    ...finalizerDocumentContext(),
    tax: null,
  }));
  let rollbackFailed = false;
  try {
    await failingFinalizer.finalizePaidOrder(rollbackPayment);
  } catch {
    rollbackFailed = true;
  }
  if (!rollbackFailed) {
    throw new Error('Invalid snapshot context unexpectedly committed the rollback finalizer fixture.');
  }

  const rolledBackState = await readFinalizerState({
    reference: FINALIZER_ROLLBACK_REFERENCE,
    seriesPrefix: 'gate3-rollback',
  });
  if (!rolledBackState.order
    || rolledBackState.order.status !== 'payment_pending'
    || rolledBackState.order.order_number !== null
    || rolledBackState.order.invoice_id !== null
    || rolledBackState.invoices.length !== 0
    || rolledBackState.series.length !== 0) {
    throw new Error('Failed real-Neon finalization did not roll back order, invoice, and counters atomically.');
  }

  const recovered = await createFinalizer('gate3-rollback').finalizePaidOrder(rollbackPayment);
  if (recovered.duplicate
    || !recovered.order.orderNumber.endsWith('-000001')
    || !recovered.invoice.invoiceNumber.endsWith('-000001')) {
    throw new Error('Post-rollback finalization burned an official document number.');
  }
  const recoveredState = await readFinalizerState({
    reference: FINALIZER_ROLLBACK_REFERENCE,
    seriesPrefix: 'gate3-rollback',
  });
  assertSingleDurableFinalizerIdentity(recoveredState, {
    reference: FINALIZER_ROLLBACK_REFERENCE,
  });
}

async function verifyV3InvoiceDeliveryApplicationOnRealNeon() {
  const state = await readFinalizerState({
    reference: FINALIZER_FIRST_REFERENCE,
    seriesPrefix: 'gate3-first',
  });
  assertSingleDurableFinalizerIdentity(state, {
    reference: FINALIZER_FIRST_REFERENCE,
  });

  const invoice = state.invoices[0];
  const invoiceId = Number(invoice.id);
  const deliverySource = createNeonV3InvoiceDeliverySource({ connectionString: runtimeUrl });
  const loaded = await deliverySource.loadIssuedInvoiceForDelivery({
    orderReference: FINALIZER_FIRST_REFERENCE,
    invoiceId,
  });
  if (loaded.invoiceId !== invoiceId
    || loaded.orderNumber !== state.order.order_number
    || loaded.invoiceNumber !== invoice.invoice_number
    || loaded.snapshotSchemaVersion !== 1
    || loaded.amountTotal !== 2995
    || loaded.snapshot?.document?.invoiceNumber !== invoice.invoice_number) {
    throw new Error('V3 delivery source did not return the immutable issued invoice identity.');
  }

  try {
    await deliverySource.loadIssuedInvoiceForDelivery({
      orderReference: FINALIZER_FIRST_REFERENCE,
      invoiceId: invoiceId + 1,
    });
    throw new Error('V3 delivery source unexpectedly accepted a different invoice id.');
  } catch (error) {
    if (error?.code !== 'V3_INVOICE_DELIVERY_IDENTITY_MISMATCH') throw error;
  }

  const notificationStore = createNeonOrderNotificationStore({ connectionString: runtimeUrl });
  const ensured = await notificationStore.ensureNotification({
    orderReference: FINALIZER_FIRST_REFERENCE,
    notificationType: 'customer_v3_invoice',
    createdAt: V3_DELIVERY_CLAIM_AT - 1,
    invoiceId,
    snapshotSchemaVersion: 1,
  });
  if (!ensured.created
    || ensured.notification.invoiceId !== invoiceId
    || ensured.notification.snapshotSchemaVersion !== 1) {
    throw new Error('Could not persist the isolated V3 invoice delivery notification identity.');
  }

  const claimed = await notificationStore.claimNotification({
    orderReference: FINALIZER_FIRST_REFERENCE,
    notificationType: 'customer_v3_invoice',
    attemptedAt: V3_DELIVERY_CLAIM_AT,
    leaseSeconds: 300,
  });
  if (!claimed.claimed
    || claimed.notification.deliveryStatus !== 'sending'
    || !claimed.notification.claimToken
    || claimed.notification.leaseExpiresAt !== V3_DELIVERY_CLAIM_AT + 300) {
    throw new Error('Could not acquire an active isolated V3 invoice delivery claim.');
  }

  const artifact = {
    orderReference: FINALIZER_FIRST_REFERENCE,
    invoiceId,
    claimToken: claimed.notification.claimToken,
    rendererVersion: 1,
    pdfSha256: V3_DELIVERY_PDF_SHA256,
    pdfByteLength: V3_DELIVERY_PDF_BYTE_LENGTH,
    attachmentFilename: V3_DELIVERY_FILENAME,
    updatedAt: V3_DELIVERY_CLAIM_AT + 1,
  };
  const prepared = await notificationStore.prepareV3InvoiceArtifact(artifact);
  if (prepared.rendererVersion !== 1
    || prepared.pdfSha256 !== V3_DELIVERY_PDF_SHA256
    || prepared.pdfByteLength !== V3_DELIVERY_PDF_BYTE_LENGTH
    || prepared.attachmentFilename !== V3_DELIVERY_FILENAME
    || prepared.claimToken !== claimed.notification.claimToken) {
    throw new Error('First V3 invoice artifact preparation did not persist deterministic metadata.');
  }

  const repeated = await notificationStore.prepareV3InvoiceArtifact({
    ...artifact,
    updatedAt: V3_DELIVERY_CLAIM_AT + 2,
  });
  if (repeated.pdfSha256 !== prepared.pdfSha256
    || repeated.attachmentFilename !== prepared.attachmentFilename) {
    throw new Error('Exact V3 invoice artifact preparation was not idempotent.');
  }

  for (const [name, input, expectedCode] of [
    [
      'artifact drift',
      { ...artifact, pdfSha256: 'e'.repeat(64), updatedAt: V3_DELIVERY_CLAIM_AT + 3 },
      'ORDER_NOTIFICATION_ARTIFACT_MISMATCH',
    ],
    [
      'wrong claim token',
      { ...artifact, claimToken: 'wrong-claim-token', updatedAt: V3_DELIVERY_CLAIM_AT + 3 },
      'ORDER_NOTIFICATION_CLAIM_CONFLICT',
    ],
    [
      'wrong invoice id',
      { ...artifact, invoiceId: invoiceId + 1, updatedAt: V3_DELIVERY_CLAIM_AT + 3 },
      'ORDER_NOTIFICATION_IDENTITY_MISMATCH',
    ],
    [
      'expired lease',
      { ...artifact, updatedAt: claimed.notification.leaseExpiresAt },
      'ORDER_NOTIFICATION_CLAIM_CONFLICT',
    ],
  ]) {
    try {
      await notificationStore.prepareV3InvoiceArtifact(input);
      throw new Error(`V3 artifact preparation unexpectedly accepted ${name}.`);
    } catch (error) {
      if (error?.code !== expectedCode) throw error;
    }
  }

  await withClient(migrationUrl, async (client) => {
    const result = await client.query(
      `SELECT delivery_status, invoice_id, snapshot_schema_version, renderer_version,
              pdf_sha256, pdf_byte_length, attachment_filename, claim_token, lease_expires_at
       FROM legend_commerce.order_notifications
       WHERE order_reference = $1 AND notification_type = 'customer_v3_invoice'`,
      [FINALIZER_FIRST_REFERENCE],
    );
    const stored = result.rows?.[0];
    if (!stored
      || stored.delivery_status !== 'sending'
      || Number(stored.invoice_id) !== invoiceId
      || Number(stored.snapshot_schema_version) !== 1
      || Number(stored.renderer_version) !== 1
      || stored.pdf_sha256 !== V3_DELIVERY_PDF_SHA256
      || Number(stored.pdf_byte_length) !== V3_DELIVERY_PDF_BYTE_LENGTH
      || stored.attachment_filename !== V3_DELIVERY_FILENAME
      || stored.claim_token !== claimed.notification.claimToken
      || Number(stored.lease_expires_at) !== claimed.notification.leaseExpiresAt) {
      throw new Error('Rejected V3 artifact writes corrupted the durable prepared identity.');
    }
  });
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
  await verifyProfile1PaidFinalizerOnRealNeon();
  await verifyV3InvoiceDeliveryApplicationOnRealNeon();
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
  console.log('- V3 profile-1 paid finalizer creates one durable order/invoice identity on real Neon');
  console.log('- duplicate V3 paid finalization reuses the existing durable identity without reallocating');
  console.log('- concurrent V3 paid finalizations converge on exactly one durable invoice/order identity');
  console.log('- failed V3 finalization rolls back order, invoice, and document counters atomically');
  console.log('- retry after V3 rollback reuses document value 1 without burning an official number');
  console.log('- V3 delivery source reads only the durable issued schema-v1 invoice identity');
  console.log('- V3 artifact preparation persists deterministic metadata under the active claim lease');
  console.log('- exact V3 artifact preparation repeats idempotently');
  console.log('- V3 artifact drift, wrong invoice/token and expired lease fail closed without corruption');

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
