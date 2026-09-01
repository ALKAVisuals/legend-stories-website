import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNeonPaidOrderFinalizer,
  NeonPaidOrderFinalizerError,
} from '../server/adapters/neon-paid-order-finalizer.mjs';

const REFERENCE = 'a'.repeat(64);

function clone(value) {
  return structuredClone(value);
}

function makeOrder({ profile = 1, status = 'payment_pending' } = {}) {
  return {
    reference: REFERENCE,
    status,
    amount_total: 2995,
    currency: 'EUR',
    mode: 'test',
    payment_session_id: 'TESTPAYPAL123',
    payment_provider: 'paypal',
    created_at: 1_800_000_000,
    updated_at: 1_800_000_000,
    paid_at: status === 'paid' ? 1_800_000_100 : null,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: 0,
    version: status === 'paid' ? 1 : 0,
    customer: {
      firstname: 'Test',
      lastname: 'Buyer',
      email: 'buyer@example.invalid',
      street: 'Shipping Street 1',
      line2: '',
      zip: '1234AB',
      city: 'Testville',
      country: 'NL',
    },
    items: [
      {
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
      },
    ],
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
    document_profile_version: profile,
    order_number: null,
    order_number_assigned_at: null,
    invoice_id: null,
  };
}

function makePayment() {
  return {
    reference: REFERENCE,
    provider: 'paypal',
    providerOrderId: 'TESTPAYPAL123',
    providerCaptureId: 'CAPTURE123',
    amountTotal: 2995,
    currency: 'EUR',
    mode: 'test',
    paidAt: 1_800_000_100,
    source: 'synthetic_paid_test',
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

function makeNumberingPolicy() {
  return {
    resolveSeriesKey({ documentType }) {
      return `test-${documentType}`;
    },
    format({ documentType, value, seriesKey }) {
      return `${seriesKey}-${String(value).padStart(6, '0')}`;
    },
  };
}

function createMemoryTransactionRunner({
  initialOrder = makeOrder(),
  failV3UpdateOnce = false,
} = {}) {
  const state = {
    order: clone(initialOrder),
    invoices: [],
    counters: new Map(),
    allocationLog: [],
    technicalInvoiceSequence: 1,
    v3UpdateFailuresRemaining: failV3UpdateOnce ? 1 : 0,
    commits: 0,
    rollbacks: 0,
  };

  let tail = Promise.resolve();

  async function runSerialized(work) {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  async function transact(work) {
    return runSerialized(async () => {
      let lastError;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const tx = {
          order: clone(state.order),
          invoices: clone(state.invoices),
          counters: new Map(state.counters),
          allocationLog: [...state.allocationLog],
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
              const id = state.technicalInvoiceSequence;
              state.technicalInvoiceSequence += 1;
              const snapshot = JSON.parse(params[6]);
              const row = {
                id,
                order_reference: params[0],
                order_number: params[1],
                invoice_number: params[2],
                status: 'issued',
                issued_at: params[3],
                currency: params[4],
                amount_total: params[5],
                schema_version: 1,
                snapshot,
                created_at: params[3],
              };
              tx.invoices.push(row);
              return { rows: [clone(row)] };
            }
            if (sql.includes("SET status = 'paid'") && sql.includes('order_number = $5')) {
              if (state.v3UpdateFailuresRemaining > 0) {
                state.v3UpdateFailuresRemaining -= 1;
                const error = new Error('Synthetic serialization conflict after invoice insert.');
                error.code = '40001';
                throw error;
              }
              if (tx.order.reference !== params[0] || tx.order.version !== params[1]) {
                return { rows: [] };
              }
              tx.order.status = 'paid';
              tx.order.updated_at = params[2];
              tx.order.paid_at = params[3];
              tx.order.order_number = params[4];
              tx.order.order_number_assigned_at = params[3];
              tx.order.invoice_id = params[5];
              tx.order.version += 1;
              return { rows: [clone(tx.order)] };
            }
            if (sql.includes("SET status = 'paid'") && sql.includes('paid_at = COALESCE')) {
              if (tx.order.reference !== params[0] || tx.order.version !== params[1]) {
                return { rows: [] };
              }
              tx.order.status = 'paid';
              tx.order.updated_at = params[2];
              tx.order.paid_at ??= params[2];
              tx.order.version += 1;
              return { rows: [clone(tx.order)] };
            }
            throw new Error(`Unexpected SQL in memory finalizer test: ${sql}`);
          },
        };

        const allocate = async ({ documentType, seriesKey }) => {
          const key = `${documentType}:${seriesKey}`;
          const value = tx.counters.get(key) ?? 1;
          tx.counters.set(key, value + 1);
          tx.allocationLog.push({ documentType, seriesKey, value });
          return { documentType, seriesKey, value, nextValue: value + 1 };
        };

        try {
          const result = await work({ client, allocate });
          state.order = clone(tx.order);
          state.invoices = clone(tx.invoices);
          state.counters = new Map(tx.counters);
          state.allocationLog = [...tx.allocationLog];
          state.commits += 1;
          return result;
        } catch (error) {
          state.rollbacks += 1;
          lastError = error;
          if (error?.code !== '40001' || attempt === 4) throw error;
        }
      }
      throw lastError;
    });
  }

  return {
    runner: { transact },
    state,
  };
}

function createFinalizer(memory, overrides = {}) {
  let contextCalls = 0;
  const finalizer = createNeonPaidOrderFinalizer({
    transactionRunner: memory.runner,
    numberingPolicy: makeNumberingPolicy(),
    documentContextProvider: () => {
      contextCalls += 1;
      return makeDocumentContext();
    },
    ...overrides,
  });
  return { finalizer, getContextCalls: () => contextCalls };
}

test('first profile-1 paid transition allocates both numbers and persists one immutable invoice identity', async () => {
  const memory = createMemoryTransactionRunner();
  const { finalizer, getContextCalls } = createFinalizer(memory);

  const result = await finalizer.finalizePaidOrder(makePayment());

  assert.equal(result.duplicate, false);
  assert.equal(result.legacy, false);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.orderNumber, 'test-order-000001');
  assert.equal(result.invoice.invoiceNumber, 'test-invoice-000001');
  assert.equal(result.invoice.snapshot.schemaVersion, 1);
  assert.equal(result.invoice.snapshot.document.orderNumber, result.order.orderNumber);
  assert.equal(result.invoice.snapshot.document.invoiceNumber, result.invoice.invoiceNumber);
  assert.equal(result.invoice.snapshot.totals.grandTotalCents, 2995);
  assert.equal(getContextCalls(), 1);
  assert.deepEqual(memory.state.allocationLog.map(({ documentType, value }) => ({ documentType, value })), [
    { documentType: 'order', value: 1 },
    { documentType: 'invoice', value: 1 },
  ]);
});

test('duplicate profile-1 finalization returns existing document identity without allocating again', async () => {
  const memory = createMemoryTransactionRunner();
  const { finalizer, getContextCalls } = createFinalizer(memory);

  const first = await finalizer.finalizePaidOrder(makePayment());
  const duplicate = await finalizer.finalizePaidOrder(makePayment());

  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.order.orderNumber, first.order.orderNumber);
  assert.equal(duplicate.invoice.invoiceNumber, first.invoice.invoiceNumber);
  assert.equal(memory.state.allocationLog.length, 2);
  assert.equal(memory.state.invoices.length, 1);
  assert.equal(getContextCalls(), 1);
});

test('two concurrent finalizations produce exactly one document set and one duplicate result', async () => {
  const memory = createMemoryTransactionRunner();
  const { finalizer } = createFinalizer(memory);

  const results = await Promise.all([
    finalizer.finalizePaidOrder(makePayment()),
    finalizer.finalizePaidOrder(makePayment()),
  ]);

  assert.equal(results.filter((result) => result.duplicate === false).length, 1);
  assert.equal(results.filter((result) => result.duplicate === true).length, 1);
  assert.equal(memory.state.invoices.length, 1);
  assert.equal(memory.state.counters.get('order:test-order'), 2);
  assert.equal(memory.state.counters.get('invoice:test-invoice'), 2);
  assert.equal(memory.state.order.order_number, 'test-order-000001');
});

test('serialization failure after invoice insert rolls back official counters and retries without burning numbers', async () => {
  const memory = createMemoryTransactionRunner({ failV3UpdateOnce: true });
  const { finalizer } = createFinalizer(memory);

  const result = await finalizer.finalizePaidOrder(makePayment());

  assert.equal(memory.state.rollbacks, 1);
  assert.equal(memory.state.commits, 1);
  assert.equal(result.order.orderNumber, 'test-order-000001');
  assert.equal(result.invoice.invoiceNumber, 'test-invoice-000001');
  assert.equal(memory.state.counters.get('order:test-order'), 2);
  assert.equal(memory.state.counters.get('invoice:test-invoice'), 2);
  assert.equal(memory.state.invoices.length, 1);
  assert.equal(result.invoice.id, 2, 'technical invoice sequence gaps are allowed after rollback');
});

test('paid profile-1 order with missing document identity hard-fails instead of repairing later', async () => {
  const corrupted = makeOrder({ profile: 1, status: 'paid' });
  const memory = createMemoryTransactionRunner({ initialOrder: corrupted });
  const { finalizer } = createFinalizer(memory);

  await assert.rejects(
    () => finalizer.finalizePaidOrder(makePayment()),
    (error) => error instanceof NeonPaidOrderFinalizerError
      && error.code === 'PAID_DOCUMENT_INVARIANT_BROKEN',
  );
  assert.equal(memory.state.allocationLog.length, 0);
  assert.equal(memory.state.invoices.length, 0);
});

test('profile-0 legacy order can become paid without allocating V3 document identity', async () => {
  const memory = createMemoryTransactionRunner({ initialOrder: makeOrder({ profile: 0 }) });
  const { finalizer, getContextCalls } = createFinalizer(memory);

  const result = await finalizer.finalizePaidOrder(makePayment());

  assert.equal(result.legacy, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.order.status, 'paid');
  assert.equal(result.order.orderNumber, null);
  assert.equal(result.order.invoiceId, null);
  assert.equal(memory.state.allocationLog.length, 0);
  assert.equal(getContextCalls(), 0);
});

test('payment identity mismatch fails before any number or invoice allocation', async () => {
  const memory = createMemoryTransactionRunner();
  const { finalizer } = createFinalizer(memory);
  const mismatched = { ...makePayment(), amountTotal: 2994 };

  await assert.rejects(
    () => finalizer.finalizePaidOrder(mismatched),
    (error) => error instanceof NeonPaidOrderFinalizerError
      && error.code === 'PAID_ORDER_IDENTITY_MISMATCH',
  );
  assert.equal(memory.state.allocationLog.length, 0);
  assert.equal(memory.state.invoices.length, 0);
});
