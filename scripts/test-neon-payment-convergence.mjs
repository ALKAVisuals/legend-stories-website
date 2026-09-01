import {
  createDefaultNeonClient,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import { createNeonPaidOrderFinalizer } from '../server/adapters/neon-paid-order-finalizer.mjs';
import { recordPayPalWebhookEventInTransaction } from '../server/adapters/neon-paypal-webhook-event-recorder.mjs';
import { createPendingOrderRecord } from '../server/orders/order-status.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Neon convergence proof.`);
  return validateNeonConnectionString(value);
}

const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');

const RACE_REFERENCE = 'e'.repeat(64);
const RACE_ORDER_ID = 'CONVERGEORDER001';
const RACE_CAPTURE_ID = 'CONVERGECAPTURE001';
const RACE_EVENT_ID = 'WH-GATE3-CONVERGENCE-001';
const LOSS_REFERENCE = '9'.repeat(64);
const LOSS_ORDER_ID = 'RESPONSELOSSORDER001';
const LOSS_CAPTURE_ID = 'RESPONSELOSSCAPTURE001';
const LOSS_EVENT_ID = 'WH-GATE3-RESPONSE-LOSS-001';
const CREATED_AT = 1_800_300_000;
const PAID_AT = 1_800_300_100;

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

function pendingOrder({ reference, orderId, createdAt }) {
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
      firstname: 'Convergence',
      lastname: 'Test',
      email: 'convergence@example.invalid',
      street: 'Shipping Street 1',
      line2: '',
      zip: '1234AB',
      city: 'Testville',
      country: 'NL',
    },
    items: [{
      productId: 'LM-2026-00001',
      slug: 'synthetic-convergence-product',
      page: '/synthetic-convergence-product.html',
      sku: 'SYNTHETIC-CONVERGENCE',
      name: 'Synthetic Convergence Product — Standard (45 cm)',
      image: '/media/synthetic-convergence-product.png',
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
    discount: { code: 'TEST20', percent: 20, amount: 5 },
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

function documentContext() {
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
      legalText: 'Synthetic isolated-Neon convergence fixture only.',
    },
  };
}

async function seedProfile1({ reference, orderId, createdAt }) {
  const store = createNeonOrderStore({ connectionString: runtimeUrl });
  const persisted = await store.persistPendingCheckout(pendingOrder({ reference, orderId, createdAt }));
  if (!persisted.created || persisted.order.status !== 'payment_pending') {
    throw new Error('Could not persist convergence checkout fixture.');
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
      throw new Error('Could not promote convergence fixture to profile 1.');
    }
  });
}

function createFinalizer(seriesPrefix) {
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
    documentContextProvider: documentContext,
    providerEventRecorder: recordPayPalWebhookEventInTransaction,
  });
}

function capturePayment({ reference, orderId, captureId, paidAt }) {
  return {
    reference,
    provider: 'paypal',
    providerOrderId: orderId,
    providerCaptureId: captureId,
    amountTotal: 2995,
    currency: 'EUR',
    mode: 'test',
    paidAt,
    source: 'isolated_neon_capture_convergence',
  };
}

function webhookPayment({ reference, orderId, captureId, eventId, paidAt, eventAt }) {
  return {
    ...capturePayment({ reference, orderId, captureId, paidAt }),
    providerEventId: eventId,
    providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
    providerEventCreatedAt: eventAt,
    providerEventProcessedAt: eventAt + 1,
    source: 'isolated_neon_webhook_convergence',
  };
}

async function readState({ reference, seriesPrefix, eventId }) {
  return withClient(migrationUrl, async (client) => {
    const [orderResult, invoiceResult, seriesResult, eventResult] = await Promise.all([
      client.query(
        `SELECT reference, status, paid_at, order_number, order_number_assigned_at,
                invoice_id, document_profile_version, version
         FROM legend_commerce.orders WHERE reference = $1`,
        [reference],
      ),
      client.query(
        `SELECT id, order_reference, order_number, invoice_number, status, issued_at,
                currency, amount_total, schema_version, snapshot
         FROM legend_commerce.invoices WHERE order_reference = $1 ORDER BY id`,
        [reference],
      ),
      client.query(
        `SELECT document_type, series_key, next_value
         FROM legend_commerce.document_number_series
         WHERE series_key IN ($1, $2)
         ORDER BY document_type`,
        [`${seriesPrefix}-order`, `${seriesPrefix}-invoice`],
      ),
      client.query(
        `SELECT event_id, event_type, order_reference, paypal_order_id,
                paypal_capture_id, mode, paypal_created_at
         FROM legend_commerce.paypal_webhook_events
         WHERE event_id = $1`,
        [eventId],
      ),
    ]);

    return {
      order: orderResult.rows?.[0] || null,
      invoices: invoiceResult.rows || [],
      series: seriesResult.rows || [],
      events: eventResult.rows || [],
    };
  });
}

function assertOneIdentity(state, { reference, eventId, orderId, captureId }) {
  const order = state.order;
  if (!order
    || order.reference !== reference
    || order.status !== 'paid'
    || Number(order.document_profile_version) !== 1
    || !order.order_number
    || !order.invoice_id
    || state.invoices.length !== 1) {
    throw new Error('Convergence proof did not leave exactly one durable profile-1 order/invoice identity.');
  }

  const invoice = state.invoices[0];
  if (Number(invoice.id) !== Number(order.invoice_id)
    || invoice.order_reference !== reference
    || invoice.order_number !== order.order_number
    || invoice.status !== 'issued'
    || Number(invoice.schema_version) !== 1
    || invoice.snapshot?.schemaVersion !== 1
    || invoice.snapshot?.document?.orderNumber !== order.order_number
    || invoice.snapshot?.document?.invoiceNumber !== invoice.invoice_number
    || invoice.snapshot?.order?.reference !== reference
    || Number(invoice.snapshot?.totals?.grandTotalCents) !== 2995) {
    throw new Error('Convergence invoice snapshot/linkage does not match durable order identity.');
  }

  if (state.series.length !== 2 || state.series.some((row) => Number(row.next_value) !== 2)) {
    throw new Error('Convergence proof allocated official document numbers more than once.');
  }

  if (state.events.length !== 1) {
    throw new Error('Convergence proof did not leave exactly one webhook ledger row.');
  }
  const event = state.events[0];
  if (event.event_id !== eventId
    || event.event_type !== 'PAYMENT.CAPTURE.COMPLETED'
    || event.order_reference !== reference
    || event.paypal_order_id !== orderId
    || event.paypal_capture_id !== captureId
    || event.mode !== 'test') {
    throw new Error('Convergence webhook ledger identity is inconsistent.');
  }

  return {
    orderNumber: order.order_number,
    invoiceNumber: invoice.invoice_number,
    invoiceId: Number(invoice.id),
  };
}

async function proveCaptureWebhookRaceAndDuplicate() {
  const seriesPrefix = 'gate3-convergence';
  await seedProfile1({
    reference: RACE_REFERENCE,
    orderId: RACE_ORDER_ID,
    createdAt: CREATED_AT,
  });

  const finalizer = createFinalizer(seriesPrefix);
  const capture = capturePayment({
    reference: RACE_REFERENCE,
    orderId: RACE_ORDER_ID,
    captureId: RACE_CAPTURE_ID,
    paidAt: PAID_AT,
  });
  const webhook = webhookPayment({
    reference: RACE_REFERENCE,
    orderId: RACE_ORDER_ID,
    captureId: RACE_CAPTURE_ID,
    eventId: RACE_EVENT_ID,
    paidAt: PAID_AT,
    eventAt: PAID_AT + 2,
  });

  const results = await Promise.all([
    finalizer.finalizePaidOrder(capture),
    finalizer.finalizePaidOrder(webhook),
  ]);

  if (results.filter((result) => result.duplicate === false).length !== 1
    || results.filter((result) => result.duplicate === true).length !== 1
    || results[0].order.orderNumber !== results[1].order.orderNumber
    || results[0].invoice.invoiceNumber !== results[1].invoice.invoiceNumber) {
    throw new Error('Capture-vs-webhook race did not converge on one V3 document identity.');
  }

  const firstState = await readState({
    reference: RACE_REFERENCE,
    seriesPrefix,
    eventId: RACE_EVENT_ID,
  });
  const identity = assertOneIdentity(firstState, {
    reference: RACE_REFERENCE,
    eventId: RACE_EVENT_ID,
    orderId: RACE_ORDER_ID,
    captureId: RACE_CAPTURE_ID,
  });

  const duplicateWebhook = await finalizer.finalizePaidOrder(webhook);
  if (!duplicateWebhook.duplicate
    || duplicateWebhook.order.orderNumber !== identity.orderNumber
    || duplicateWebhook.invoice.invoiceNumber !== identity.invoiceNumber) {
    throw new Error('Duplicate webhook retry did not return the existing V3 identity.');
  }

  const duplicateState = await readState({
    reference: RACE_REFERENCE,
    seriesPrefix,
    eventId: RACE_EVENT_ID,
  });
  const duplicateIdentity = assertOneIdentity(duplicateState, {
    reference: RACE_REFERENCE,
    eventId: RACE_EVENT_ID,
    orderId: RACE_ORDER_ID,
    captureId: RACE_CAPTURE_ID,
  });
  if (duplicateIdentity.orderNumber !== identity.orderNumber
    || duplicateIdentity.invoiceNumber !== identity.invoiceNumber
    || duplicateIdentity.invoiceId !== identity.invoiceId) {
    throw new Error('Duplicate webhook changed the durable V3 identity.');
  }

  return identity;
}

async function proveResponseLossAfterCommitRetry() {
  const seriesPrefix = 'gate3-response-loss';
  await seedProfile1({
    reference: LOSS_REFERENCE,
    orderId: LOSS_ORDER_ID,
    createdAt: CREATED_AT + 10,
  });

  const finalizer = createFinalizer(seriesPrefix);
  const webhook = webhookPayment({
    reference: LOSS_REFERENCE,
    orderId: LOSS_ORDER_ID,
    captureId: LOSS_CAPTURE_ID,
    eventId: LOSS_EVENT_ID,
    paidAt: PAID_AT + 10,
    eventAt: PAID_AT + 12,
  });

  let simulatedLossObserved = false;
  try {
    await finalizer.finalizePaidOrder(webhook);
    const error = new Error('Synthetic response loss after successful database commit.');
    error.code = 'SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT';
    throw error;
  } catch (error) {
    if (error?.code !== 'SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT') throw error;
    simulatedLossObserved = true;
  }
  if (!simulatedLossObserved) {
    throw new Error('Response-loss simulation did not execute after finalizer commit.');
  }

  const committedState = await readState({
    reference: LOSS_REFERENCE,
    seriesPrefix,
    eventId: LOSS_EVENT_ID,
  });
  const committedIdentity = assertOneIdentity(committedState, {
    reference: LOSS_REFERENCE,
    eventId: LOSS_EVENT_ID,
    orderId: LOSS_ORDER_ID,
    captureId: LOSS_CAPTURE_ID,
  });

  const retry = await finalizer.finalizePaidOrder(webhook);
  if (!retry.duplicate
    || retry.order.orderNumber !== committedIdentity.orderNumber
    || retry.invoice.invoiceNumber !== committedIdentity.invoiceNumber) {
    throw new Error('Retry after lost response did not return the committed V3 identity.');
  }

  const retryState = await readState({
    reference: LOSS_REFERENCE,
    seriesPrefix,
    eventId: LOSS_EVENT_ID,
  });
  const retryIdentity = assertOneIdentity(retryState, {
    reference: LOSS_REFERENCE,
    eventId: LOSS_EVENT_ID,
    orderId: LOSS_ORDER_ID,
    captureId: LOSS_CAPTURE_ID,
  });
  if (retryIdentity.orderNumber !== committedIdentity.orderNumber
    || retryIdentity.invoiceNumber !== committedIdentity.invoiceNumber
    || retryIdentity.invoiceId !== committedIdentity.invoiceId) {
    throw new Error('Retry after response loss changed the durable V3 identity.');
  }

  return committedIdentity;
}

try {
  await clearSyntheticRecords();
  const raceIdentity = await proveCaptureWebhookRaceAndDuplicate();
  const lossIdentity = await proveResponseLossAfterCommitRetry();

  console.log('Real Neon payment convergence proof passed.');
  console.log(`- capture/webhook race converged on ${raceIdentity.orderNumber} / ${raceIdentity.invoiceNumber}`);
  console.log('- duplicate webhook event reused the same durable identity and webhook ledger row');
  console.log(`- response-loss retry converged on ${lossIdentity.orderNumber} / ${lossIdentity.invoiceNumber}`);
  console.log('- each synthetic order has exactly one invoice and both document counters advanced once');
  console.log('- no production database or live PayPal endpoint was used');
} finally {
  await clearSyntheticRecords();
}
