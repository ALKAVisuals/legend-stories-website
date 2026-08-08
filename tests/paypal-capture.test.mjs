import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PayPalCaptureError,
  validatePayPalCaptureResult,
} from '../server/payments/paypal-capture.mjs';

const reference = 'a'.repeat(64);
const orderId = '5O190127TN364715T';

function completedCapture(overrides = {}) {
  return {
    id: orderId,
    status: 'COMPLETED',
    purchase_units: [{
      reference_id: reference,
      custom_id: reference,
      payments: {
        captures: [{
          id: '3C679366HH908993F',
          status: 'COMPLETED',
          amount: { currency_code: 'EUR', value: '44.95' },
          create_time: '2026-08-07T12:00:00Z',
        }],
      },
    }],
    ...overrides,
  };
}

test('completed PayPal capture is accepted only when identity and amount match', () => {
  const capture = validatePayPalCaptureResult(completedCapture(), {
    reference,
    orderId,
    amountTotal: 4495,
    currency: 'EUR',
    fallbackCapturedAt: 1_786_104_000,
  });

  assert.equal(capture.reference, reference);
  assert.equal(capture.orderId, orderId);
  assert.equal(capture.amountTotal, 4495);
  assert.equal(capture.currency, 'EUR');
  assert.deepEqual(capture.captureIds, ['3C679366HH908993F']);
});

test('PayPal capture rejects amount, reference and status mismatches', () => {
  const cases = [
    [completedCapture(), { amountTotal: 4494 }, 'PAYPAL_CAPTURE_AMOUNT_MISMATCH'],
    [completedCapture({ status: 'APPROVED' }), {}, 'PAYPAL_CAPTURE_NOT_COMPLETED'],
    [{
      ...completedCapture(),
      purchase_units: [{
        ...completedCapture().purchase_units[0],
        custom_id: 'b'.repeat(64),
      }],
    }, {}, 'PAYPAL_CAPTURE_REFERENCE_MISMATCH'],
  ];

  for (const [payload, options, code] of cases) {
    assert.throws(
      () => validatePayPalCaptureResult(payload, {
        reference,
        orderId,
        amountTotal: 4495,
        currency: 'EUR',
        fallbackCapturedAt: 1_786_104_000,
        ...options,
      }),
      (error) => error instanceof PayPalCaptureError && error.code === code,
    );
  }
});
