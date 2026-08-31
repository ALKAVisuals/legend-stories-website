import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNeonPaidOrderFinalizer,
  NeonPaidOrderFinalizerError,
} from '../server/adapters/neon-paid-order-finalizer.mjs';

const reference = 'e'.repeat(64);
const paidAt = 1_787_100_100;

function payment() {
  return {
    reference,
    provider: 'paypal',
    providerOrderId: '5O190127TN364715T',
    providerCaptureId: '3Y662965014333303',
    providerEventId: 'WH-ATOMIC-1',
    providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
    providerEventCreatedAt: paidAt,
    providerEventProcessedAt: paidAt + 1,
    source: 'paypal_webhook_capture_completed',
    amountTotal: 4500,
    currency: 'EUR',
    mode: 'test',
    paidAt,
  };
}

function orderRow(status = 'paid') {
  return {
    reference,
    status,
    amount_total: 4500,
    currency: 'EUR',
    mode: 'test',
    payment_session_id: '5O190127TN364715T',
    payment_provider: 'paypal',
    created_at: paidAt - 100,
    updated_at: paidAt,
    paid_at: status === 'paid' ? paidAt : null,
    version: status === 'paid' ? 1 : 0,
    customer: {},
    items: [],
    discount: {},
    shipping: {},
    totals: {},
    document_profile_version: 1,
    order_number: status === 'paid' ? 'TEST-ORDER-1' : null,
    order_number_assigned_at: status === 'paid' ? paidAt : null,
    invoice_id: status === 'paid' ? 11 : null,
  };
}

function invoiceRow() {
  return {
    id: 11,
    order_reference: reference,
    order_number: 'TEST-ORDER-1',
    invoice_number: 'TEST-INVOICE-1',
    status: 'issued',
    issued_at: paidAt,
    currency: 'EUR',
    amount_total: 4500,
    schema_version: 1,
    snapshot: {
      schemaVersion: 1,
      document: {
        orderNumber: 'TEST-ORDER-1',
        invoiceNumber: 'TEST-INVOICE-1',
      },
      order: { reference, paidAt },
    },
    created_at: paidAt,
  };
}

function runnerFor(status = 'paid') {
  const client = {
    async query(sql) {
      if (sql.includes('FROM legend_commerce.orders') && sql.includes('FOR UPDATE')) {
        return { rows: [orderRow(status)] };
      }
      if (sql.includes('FROM legend_commerce.invoices')) {
        return { rows: [invoiceRow()] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  let allocateCalls = 0;
  return {
    client,
    getAllocateCalls: () => allocateCalls,
    transactionRunner: {
      async transact(work) {
        return work({
          client,
          allocate: async () => {
            allocateCalls += 1;
            throw new Error('allocation must not occur in this test');
          },
        });
      },
    },
  };
}

test('already-paid profile-1 webhook records its event on the same transaction client and returns existing identity', async () => {
  const runtime = runnerFor('paid');
  let recorderClient;
  let recorderPayment;
  const finalizer = createNeonPaidOrderFinalizer({
    transactionRunner: runtime.transactionRunner,
    providerEventRecorder: async ({ client, payment: receivedPayment }) => {
      recorderClient = client;
      recorderPayment = receivedPayment;
      return { duplicate: false };
    },
  });

  const result = await finalizer.finalizePaidOrder(payment());

  assert.equal(recorderClient, runtime.client);
  assert.equal(recorderPayment.providerEventId, 'WH-ATOMIC-1');
  assert.equal(result.duplicate, true);
  assert.equal(result.order.orderNumber, 'TEST-ORDER-1');
  assert.equal(result.invoice.invoiceNumber, 'TEST-INVOICE-1');
  assert.equal(runtime.getAllocateCalls(), 0);
});

test('duplicate webhook ledger entry without durable paid state hard-fails before number allocation', async () => {
  const runtime = runnerFor('payment_pending');
  const finalizer = createNeonPaidOrderFinalizer({
    transactionRunner: runtime.transactionRunner,
    providerEventRecorder: async () => ({ duplicate: true }),
  });

  await assert.rejects(
    () => finalizer.finalizePaidOrder(payment()),
    (error) => error instanceof NeonPaidOrderFinalizerError
      && error.code === 'PAYPAL_WEBHOOK_EVENT_STATE_CONFLICT',
  );
  assert.equal(runtime.getAllocateCalls(), 0);
});

test('webhook payment evidence fails closed when no transaction-local event recorder is configured', async () => {
  const runtime = runnerFor('paid');
  const finalizer = createNeonPaidOrderFinalizer({ transactionRunner: runtime.transactionRunner });

  await assert.rejects(
    () => finalizer.finalizePaidOrder(payment()),
    (error) => error instanceof NeonPaidOrderFinalizerError
      && error.code === 'PAYPAL_WEBHOOK_EVENT_RECORDER_NOT_CONFIGURED',
  );
});
