import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createResendPaidOrderNotifier,
  ResendPaidOrderNotifierError,
} from '../server/notifications/resend-paid-order-notifier.mjs';

function paidOrder(overrides = {}) {
  return {
    reference: 'b'.repeat(64),
    status: 'paid',
    mode: 'live',
    paidAt: 1_787_750_000,
    paymentSessionId: '5O190127TN364715T',
    amountTotal: 5495,
    customer: {
      firstname: '<Ada>',
      lastname: 'Lovelace',
      email: 'ada@example.com',
      street: 'Schansweg 1',
      line2: '',
      zip: '1234 AB',
      city: 'Nijmegen',
      country: 'NL',
    },
    items: [{
      name: 'LegendMural Test',
      sku: 'LM-TEST-45',
      variantLabel: 'Statement',
      sizeLabel: '45 cm',
      unitPrice: 45,
      quantity: 1,
      lineTotal: 45,
    }],
    discount: { code: '', percent: 0, amount: 0 },
    shipping: { deliveryCountry: 'NL', zone: 'Netherlands', cost: 9.95 },
    totals: {
      subtotal: 4500,
      discount: 0,
      discountedSubtotal: 4500,
      shipping: 995,
      grandTotal: 5495,
    },
    ...overrides,
  };
}

function renderedV3Email(overrides = {}) {
  return {
    subject: 'Your LegendMural order ORDER-42 is confirmed — invoice INVOICE-77',
    text: 'Payment received.\nYour PDF invoice is attached.',
    html: '<!doctype html><html><body><h1>Payment received</h1></body></html>',
    rendererVersion: 1,
    ...overrides,
  };
}

function acceptedFetch(calls) {
  return async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return { id: `email-${calls.length}` };
      },
    };
  };
}

test('merchant email uses stable Resend idempotency and correct euro units', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    replyTo: 'info@legendmural.com',
    fetchImpl: acceptedFetch(calls),
  });
  const order = paidOrder();

  const result = await notifier.sendPaidOrderEmail({
    notificationType: 'merchant_paid_order',
    to: 'owner@example.com',
    order,
  });

  assert.equal(result.providerMessageId, 'email-1');
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].options.headers['idempotency-key'],
    `paid-order-${order.reference}-merchant_paid_order`,
  );
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.to, ['owner@example.com']);
  assert.equal(body.reply_to, 'info@legendmural.com');
  assert.deepEqual(body.tags, [{ name: 'category', value: 'merchant_paid_order' }]);
  assert.match(body.subject, /New paid order/);
  assert.match(body.text, /PayPal order ID: 5O190127TN364715T/);
  assert.match(body.text, /€45\.00 each — €45\.00/);
  assert.match(body.text, /Total paid: €54\.95/);
  assert.doesNotMatch(body.text, /€0\.45 each/);
  assert.match(body.html, /&lt;Ada&gt;/);
  assert.doesNotMatch(body.html, /<Ada>/);
});

test('customer confirmation contains the PayPal order ID needed for order support flows', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    replyTo: 'info@legendmural.com',
    fetchImpl: acceptedFetch(calls),
  });
  const order = paidOrder();

  await notifier.sendPaidOrderEmail({
    notificationType: 'customer_paid_order',
    to: 'ada@example.com',
    order,
  });

  const body = JSON.parse(calls[0].options.body);
  assert.match(body.subject, /Your LegendMural order is confirmed/);
  assert.match(body.text, /Order ID: 5O190127TN364715T/);
  assert.match(body.text, /Total paid: €54\.95/);
  assert.deepEqual(body.tags, [{ name: 'category', value: 'customer_paid_order' }]);
  assert.equal(
    calls[0].options.headers['idempotency-key'],
    `paid-order-${order.reference}-customer_paid_order`,
  );
});

test('V3 invoice email sends one Base64 PDF attachment with stable attempt-independent idempotency', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    replyTo: 'info@legendmural.com',
    fetchImpl: acceptedFetch(calls),
  });
  const orderReference = 'c'.repeat(64);
  const pdfBytes = Buffer.from('%PDF-1.4\nsynthetic-v3-invoice\n', 'utf8');
  const message = {
    to: 'ada@example.com',
    orderReference,
    renderedEmail: renderedV3Email(),
    attachment: {
      filename: 'invoice-INVOICE-77.pdf',
      bytes: pdfBytes,
    },
  };

  const first = await notifier.sendV3InvoiceEmail(message);
  const second = await notifier.sendV3InvoiceEmail(message);

  assert.equal(first.providerMessageId, 'email-1');
  assert.equal(second.providerMessageId, 'email-2');
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].options.headers['idempotency-key'],
    `v3-invoice-${orderReference}-customer_v3_invoice`,
  );
  assert.equal(calls[1].options.headers['idempotency-key'], calls[0].options.headers['idempotency-key']);
  assert.equal(calls[1].options.body, calls[0].options.body);

  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body.to, ['ada@example.com']);
  assert.equal(body.reply_to, 'info@legendmural.com');
  assert.equal(body.subject, message.renderedEmail.subject);
  assert.equal(body.text, message.renderedEmail.text);
  assert.equal(body.html, message.renderedEmail.html);
  assert.deepEqual(body.tags, [{ name: 'category', value: 'customer_v3_invoice' }]);
  assert.deepEqual(body.attachments, [{
    filename: 'invoice-INVOICE-77.pdf',
    content: pdfBytes.toString('base64'),
    content_type: 'application/pdf',
  }]);
  assert.equal(body.attachments[0].content.includes('%PDF'), false);
});

test('V3 invoice email rejects invalid reference, renderer payload or PDF attachment before Resend', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    fetchImpl: acceptedFetch(calls),
  });
  const base = {
    to: 'ada@example.com',
    orderReference: 'c'.repeat(64),
    renderedEmail: renderedV3Email(),
    attachment: {
      filename: 'invoice-INVOICE-77.pdf',
      bytes: Buffer.from('pdf'),
    },
  };

  await assert.rejects(
    notifier.sendV3InvoiceEmail({ ...base, orderReference: 'not-a-reference' }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE'
      && error.details.field === 'orderReference',
  );
  await assert.rejects(
    notifier.sendV3InvoiceEmail({
      ...base,
      renderedEmail: renderedV3Email({ rendererVersion: 2 }),
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE'
      && error.details.field === 'renderedEmail.rendererVersion',
  );
  await assert.rejects(
    notifier.sendV3InvoiceEmail({
      ...base,
      attachment: { filename: 'invoice-INVOICE-77.pdf', bytes: 'not-a-buffer' },
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE'
      && error.details.field === 'attachment.bytes',
  );
  await assert.rejects(
    notifier.sendV3InvoiceEmail({
      ...base,
      attachment: { filename: '../invoice-INVOICE-77.pdf', bytes: Buffer.from('pdf') },
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE'
      && error.details.field === 'attachment.filename',
  );
  assert.equal(calls.length, 0);
});

test('notifier rejects non-live or non-paid orders before calling Resend', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    fetchImpl: acceptedFetch(calls),
  });

  await assert.rejects(
    notifier.sendPaidOrderEmail({
      notificationType: 'customer_paid_order',
      to: 'ada@example.com',
      order: paidOrder({ mode: 'test' }),
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE',
  );
  await assert.rejects(
    notifier.sendPaidOrderEmail({
      notificationType: 'customer_paid_order',
      to: 'ada@example.com',
      order: paidOrder({ status: 'payment_pending' }),
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_MESSAGE',
  );
  assert.equal(calls.length, 0);
});

test('notifier rejects an invalid recipient before calling Resend', async () => {
  const calls = [];
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    fetchImpl: acceptedFetch(calls),
  });

  await assert.rejects(
    notifier.sendPaidOrderEmail({
      notificationType: 'merchant_paid_order',
      to: 'not-an-email',
      order: paidOrder(),
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_INVALID_CONFIG',
  );
  assert.equal(calls.length, 0);
});

test('Resend rejection returns a delivery error without exposing provider payloads', async () => {
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async json() {
        return { message: 'provider detail that must not propagate' };
      },
    }),
  });

  await assert.rejects(
    notifier.sendPaidOrderEmail({
      notificationType: 'customer_paid_order',
      to: 'ada@example.com',
      order: paidOrder(),
    }),
    (error) => error instanceof ResendPaidOrderNotifierError
      && error.code === 'RESEND_PAID_ORDER_DELIVERY_REJECTED'
      && error.details.status === 503
      && !error.message.includes('provider detail'),
  );
});

test('V3 Resend rejection is sanitized and does not expose provider payloads or attachment bytes', async () => {
  const pdfBytes = Buffer.from('sensitive-synthetic-pdf-bytes');
  const notifier = createResendPaidOrderNotifier({
    apiKey: 'resend-test-token',
    from: 'LegendMural <orders@legendmural.com>',
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async json() {
        return { message: 'provider detail that must not propagate' };
      },
    }),
  });

  await assert.rejects(
    notifier.sendV3InvoiceEmail({
      to: 'ada@example.com',
      orderReference: 'c'.repeat(64),
      renderedEmail: renderedV3Email(),
      attachment: {
        filename: 'invoice-INVOICE-77.pdf',
        bytes: pdfBytes,
      },
    }),
    (error) => {
      assert.equal(error instanceof ResendPaidOrderNotifierError, true);
      assert.equal(error.code, 'RESEND_PAID_ORDER_DELIVERY_REJECTED');
      assert.equal(error.details.status, 503);
      const serialized = JSON.stringify({
        message: error.message,
        code: error.code,
        details: error.details,
      });
      assert.equal(serialized.includes('provider detail'), false);
      assert.equal(serialized.includes(pdfBytes.toString('utf8')), false);
      assert.equal(serialized.includes('ada@example.com'), false);
      return true;
    },
  );
});
