import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonPaidOrderFinalizer } from '../server/adapters/neon-paid-order-finalizer.mjs';
import { createNeonV3InvoiceDeliverySource } from '../server/adapters/neon-v3-invoice-delivery-source.mjs';
import { createPaidOrderNotificationRuntime } from '../server/netlify/paid-order-notification-runtime.mjs';
import { createResendPaidOrderNotifier } from '../server/notifications/resend-paid-order-notifier.mjs';

const REFERENCE = 'f'.repeat(64);
const DATABASE_URL = 'postgresql://synthetic:synthetic@proof.neon.tech/legendmural?sslmode=require';
const PAID_AT = 1_800_700_100;

function clone(value) {
  return structuredClone(value);
}

function makeOrder() {
  return {
    reference: REFERENCE,
    status: 'payment_pending',
    amount_total: 2995,
    currency: 'EUR',
    mode: 'live',
    payment_session_id: 'PAYPAL-PROVIDER-FAILURE-PROOF',
    payment_provider: 'paypal',
    created_at: 1_800_700_000,
    updated_at: 1_800_700_000,
    paid_at: null,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: 0,
    version: 0,
    customer: {
      firstname: 'Synthetic',
      lastname: 'Buyer',
      email: 'buyer@example.invalid',
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
    document_profile_version: 1,
    order_number: null,
    order_number_assigned_at: null,
    invoice_id: null,
  };
}

function makePayment() {
  return {
    reference: REFERENCE,
    provider: 'paypal',
    providerOrderId: 'PAYPAL-PROVIDER-FAILURE-PROOF',
    providerCaptureId: 'CAPTURE-PROVIDER-FAILURE-PROOF',
    amountTotal: 2995,
    currency: 'EUR',
    mode: 'live',
    paidAt: PAID_AT,
    source: 'provider_failure_payment_truth_integration_proof',
  };
}

function makeDocumentContext() {
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
      legalText: 'Synthetic test fixture only.',
    },
  };
}

function createDurableCommerceMemory() {
  const state = {
    order: clone(makeOrder()),
    invoices: [],
    counters: new Map(),
    technicalInvoiceSequence: 1,
    commits: 0,
  };

  const runner = {
    async transact(work) {
      const tx = {
        order: clone(state.order),
        invoices: clone(state.invoices),
        counters: new Map(state.counters),
      };
      const client = {
        async query(sql, params = []) {
          if (sql.includes('FROM legend_commerce.orders') && sql.includes('FOR UPDATE')) {
            return { rows: tx.order.reference === params[0] ? [clone(tx.order)] : [] };
          }
          if (sql.includes('FROM legend_commerce.invoices') && sql.includes('WHERE id = $1')) {
            const row = tx.invoices.find((invoice) => invoice.id === Number(params[0]));
            return { rows: row ? [clone(row)] : [] };
          }
          if (sql.includes('INSERT INTO legend_commerce.invoices')) {
            const row = {
              id: state.technicalInvoiceSequence,
              order_reference: params[0],
              order_number: params[1],
              invoice_number: params[2],
              status: 'issued',
              issued_at: params[3],
              currency: params[4],
              amount_total: params[5],
              schema_version: 1,
              snapshot: JSON.parse(params[6]),
              created_at: params[3],
            };
            state.technicalInvoiceSequence += 1;
            tx.invoices.push(row);
            return { rows: [clone(row)] };
          }
          if (sql.includes("SET status = 'paid'") && sql.includes('order_number = $5')) {
            if (tx.order.reference !== params[0] || tx.order.version !== params[1]) return { rows: [] };
            tx.order.status = 'paid';
            tx.order.updated_at = params[2];
            tx.order.paid_at = params[3];
            tx.order.order_number = params[4];
            tx.order.order_number_assigned_at = params[3];
            tx.order.invoice_id = params[5];
            tx.order.version += 1;
            return { rows: [clone(tx.order)] };
          }
          throw new Error(`Unexpected SQL in provider-failure proof: ${sql}`);
        },
      };
      const allocate = async ({ documentType, seriesKey }) => {
        const key = `${documentType}:${seriesKey}`;
        const value = tx.counters.get(key) ?? 1;
        tx.counters.set(key, value + 1);
        return { documentType, seriesKey, value, nextValue: value + 1 };
      };
      const result = await work({ client, allocate });
      state.order = clone(tx.order);
      state.invoices = clone(tx.invoices);
      state.counters = new Map(tx.counters);
      state.commits += 1;
      return result;
    },
  };

  return { state, runner };
}

function makeNumberingPolicy() {
  return {
    resolveSeriesKey({ documentType }) {
      return `proof-${documentType}`;
    },
    format({ documentType, value }) {
      return `PROOF-${documentType.toUpperCase()}-${String(value).padStart(6, '0')}`;
    },
  };
}

function createInvoiceDeliveryClientFactory(state) {
  return async function clientFactory() {
    return {
      async connect() {},
      async end() {},
      async query(_sql, params = []) {
        const [reference, invoiceId] = params;
        if (state.order.reference !== reference) return { rows: [] };
        const invoice = state.invoices.find((candidate) => candidate.id === Number(invoiceId));
        return {
          rows: [{
            order_reference: state.order.reference,
            order_status: state.order.status,
            order_paid_at: state.order.paid_at,
            durable_order_number: state.order.order_number,
            durable_invoice_id: state.order.invoice_id,
            document_profile_version: state.order.document_profile_version,
            order_currency: state.order.currency,
            order_amount_total: state.order.amount_total,
            invoice_id: invoice?.id ?? null,
            invoice_order_reference: invoice?.order_reference ?? null,
            invoice_order_number: invoice?.order_number ?? null,
            invoice_number: invoice?.invoice_number ?? null,
            invoice_status: invoice?.status ?? null,
            invoice_issued_at: invoice?.issued_at ?? null,
            invoice_currency: invoice?.currency ?? null,
            invoice_amount_total: invoice?.amount_total ?? null,
            invoice_schema_version: invoice?.schema_version ?? null,
            invoice_snapshot: invoice ? clone(invoice.snapshot) : null,
          }],
        };
      },
    };
  };
}

function createMemoryNotificationStore() {
  const records = new Map();
  const key = ({ orderReference, notificationType }) => `${orderReference}:${notificationType}`;
  return {
    records,
    async ensureNotification(args) {
      const recordKey = key(args);
      if (!records.has(recordKey)) {
        records.set(recordKey, {
          orderReference: args.orderReference,
          notificationType: args.notificationType,
          deliveryStatus: 'pending',
          deliveryAttempts: 0,
          invoiceId: args.invoiceId ?? null,
          snapshotSchemaVersion: args.snapshotSchemaVersion ?? null,
          rendererVersion: null,
          pdfSha256: null,
          pdfByteLength: null,
          attachmentFilename: null,
          claimToken: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          providerMessageId: null,
        });
      }
      return { created: false, notification: clone(records.get(recordKey)) };
    },
    async claimNotification(args) {
      const record = records.get(key(args));
      if (!record) throw new Error('Notification missing.');
      if (!['pending', 'failed'].includes(record.deliveryStatus)) {
        return { claimed: false, notification: clone(record) };
      }
      record.deliveryStatus = 'sending';
      record.deliveryAttempts += 1;
      record.claimToken = `claim-${record.notificationType}-${record.deliveryAttempts}`;
      record.lastErrorCode = null;
      record.nextAttemptAt = null;
      return { claimed: true, notification: clone(record) };
    },
    async prepareV3InvoiceArtifact(args) {
      const record = records.get(`${args.orderReference}:customer_v3_invoice`);
      if (!record || record.deliveryStatus !== 'sending' || record.claimToken !== args.claimToken) {
        throw new Error('V3 artifact claim mismatch.');
      }
      record.rendererVersion = args.rendererVersion;
      record.pdfSha256 = args.pdfSha256;
      record.pdfByteLength = args.pdfByteLength;
      record.attachmentFilename = args.attachmentFilename;
      return clone(record);
    },
    async recordDelivery(args) {
      const record = records.get(key(args));
      if (!record || record.deliveryStatus !== 'sending') throw new Error('Notification state conflict.');
      if (record.notificationType === 'customer_v3_invoice' && record.claimToken !== args.claimToken) {
        throw new Error('V3 delivery claim mismatch.');
      }
      record.deliveryStatus = args.status;
      record.providerMessageId = args.status === 'sent' ? args.providerMessageId : null;
      record.lastErrorCode = args.status === 'failed' ? args.errorCode : null;
      record.claimToken = null;
      record.nextAttemptAt = args.nextAttemptAt ?? null;
      return clone(record);
    },
  };
}

function response({ ok, status, id = null }) {
  return {
    ok,
    status,
    async json() {
      return id ? { id } : { message: 'synthetic provider rejection' };
    },
  };
}

test('post-commit V3 provider rejection changes only delivery state and leaves paid order/invoice truth immutable', async () => {
  const memory = createDurableCommerceMemory();
  const finalizer = createNeonPaidOrderFinalizer({
    transactionRunner: memory.runner,
    numberingPolicy: makeNumberingPolicy(),
    documentContextProvider: makeDocumentContext,
  });

  const finalized = await finalizer.finalizePaidOrder(makePayment());
  assert.equal(memory.state.commits, 1);
  assert.equal(finalized.order.status, 'paid');
  assert.equal(finalized.invoice.status, 'issued');

  const committedOrder = clone(memory.state.order);
  const committedInvoices = clone(memory.state.invoices);
  const committedSnapshot = clone(finalized.invoice.snapshot);
  const notificationStore = createMemoryNotificationStore();
  const providerRequests = [];

  const reconcile = createPaidOrderNotificationRuntime({
    env: {
      ORDER_EMAILS_ENABLED: 'true',
      ORDER_NOTIFICATION_TO: 'merchant@example.invalid',
      NEON_DATABASE_URL: DATABASE_URL,
      RESEND_API_KEY: 'synthetic-api-key',
      RESEND_FROM: 'LegendMural <orders@example.invalid>',
      RESEND_REPLY_TO: 'support@example.invalid',
    },
    notificationStoreFactory() {
      return notificationStore;
    },
    invoiceDeliverySourceFactory({ connectionString }) {
      return createNeonV3InvoiceDeliverySource({
        connectionString,
        clientFactory: createInvoiceDeliveryClientFactory(memory.state),
      });
    },
    notifierFactory(options) {
      return createResendPaidOrderNotifier({
        ...options,
        fetchImpl: async (_url, request) => {
          const idempotencyKey = request.headers['idempotency-key'];
          providerRequests.push({ idempotencyKey, body: JSON.parse(request.body) });
          if (idempotencyKey.startsWith('paid-order-')) {
            return response({ ok: true, status: 200, id: 'merchant-message-proof' });
          }
          return response({ ok: false, status: 503 });
        },
      });
    },
  });

  const firstDelivery = await reconcile(finalized.order);
  assert.equal(firstDelivery.documentProfileVersion, 1);
  assert.equal(firstDelivery.failed, true);
  assert.equal(firstDelivery.merchant.deliveries[0].status, 'sent');
  assert.equal(firstDelivery.customer.status, 'failed');
  assert.equal(firstDelivery.customer.errorCode, 'RESEND_PAID_ORDER_DELIVERY_REJECTED');

  const v3Notification = notificationStore.records.get(`${REFERENCE}:customer_v3_invoice`);
  assert.equal(v3Notification.deliveryStatus, 'failed');
  assert.equal(v3Notification.deliveryAttempts, 1);
  assert.equal(v3Notification.invoiceId, finalized.invoice.id);
  assert.equal(v3Notification.snapshotSchemaVersion, 1);
  assert.equal(v3Notification.lastErrorCode, 'RESEND_PAID_ORDER_DELIVERY_REJECTED');
  assert.equal(v3Notification.nextAttemptAt, null, 'no retry cadence is invented by this slice');
  assert.equal(typeof v3Notification.pdfSha256, 'string');
  assert.equal(v3Notification.pdfSha256.length, 64);
  assert.equal(v3Notification.pdfByteLength > 0, true);
  assert.equal(v3Notification.attachmentFilename.endsWith('.pdf'), true);
  assert.equal(notificationStore.records.has(`${REFERENCE}:customer_paid_order`), false);

  assert.deepEqual(memory.state.order, committedOrder);
  assert.deepEqual(memory.state.invoices, committedInvoices);
  assert.deepEqual(memory.state.invoices[0].snapshot, committedSnapshot);
  assert.equal(memory.state.order.status, 'paid');
  assert.equal(memory.state.order.order_number, finalized.order.orderNumber);
  assert.equal(memory.state.order.invoice_id, finalized.invoice.id);
  assert.equal(memory.state.invoices[0].invoice_number, finalized.invoice.invoiceNumber);

  assert.equal(providerRequests.length, 2);
  assert.equal(providerRequests[0].idempotencyKey, `paid-order-${REFERENCE}-merchant_paid_order`);
  assert.equal(providerRequests[1].idempotencyKey, `v3-invoice-${REFERENCE}-customer_v3_invoice`);
  assert.equal(providerRequests[1].body.attachments[0].content_type, 'application/pdf');

  const duplicateFinalization = await finalizer.finalizePaidOrder(makePayment());
  assert.equal(duplicateFinalization.duplicate, true);
  assert.equal(duplicateFinalization.order.status, 'paid');
  assert.equal(duplicateFinalization.order.orderNumber, finalized.order.orderNumber);
  assert.equal(duplicateFinalization.invoice.id, finalized.invoice.id);
  assert.equal(duplicateFinalization.invoice.invoiceNumber, finalized.invoice.invoiceNumber);
  assert.deepEqual(duplicateFinalization.invoice.snapshot, committedSnapshot);
  assert.deepEqual(memory.state.order, committedOrder);
  assert.deepEqual(memory.state.invoices, committedInvoices);
});
