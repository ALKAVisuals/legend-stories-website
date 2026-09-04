import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PaidOrderDeliveryRoutingError,
  createPaidOrderDeliveryRouter,
} from '../server/notifications/paid-order-delivery-router.mjs';

function order(overrides = {}) {
  return {
    reference: 'a'.repeat(64),
    status: 'paid',
    mode: 'live',
    ...overrides,
  };
}

test('legacy profile 0 delegates the original order to the existing legacy delivery handler', async () => {
  const input = order({ documentProfileVersion: 0 });
  const calls = [];
  const expected = Object.freeze({ path: 'legacy' });
  const route = createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder(received) {
      calls.push(received);
      return expected;
    },
    async deliverV3CustomerInvoice() {
      throw new Error('profile 0 must never enter V3 delivery');
    },
  });

  const result = await route(input);
  assert.equal(result, expected);
  assert.deepEqual(calls, [input]);
});

test('missing legacy document profile remains profile 0 for backward compatibility', async () => {
  const input = order();
  let legacyCalls = 0;
  const route = createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder(received) {
      legacyCalls += 1;
      assert.equal(received, input);
      return { path: 'legacy' };
    },
  });

  const result = await route(input);
  assert.equal(result.path, 'legacy');
  assert.equal(legacyCalls, 1);
});

test('profile 1 delegates only to the V3 customer invoice orchestrator boundary', async () => {
  const input = order({ documentProfileVersion: 1, invoiceId: 42 });
  let legacyCalls = 0;
  const v3Calls = [];
  const expected = Object.freeze({ path: 'v3' });
  const route = createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder() {
      legacyCalls += 1;
      throw new Error('profile 1 must not use legacy customer delivery');
    },
    async deliverV3CustomerInvoice(received) {
      v3Calls.push(received);
      return expected;
    },
  });

  const result = await route(input);
  assert.equal(result, expected);
  assert.equal(legacyCalls, 0);
  assert.deepEqual(v3Calls, [input]);
});

test('profile 1 fails closed when the V3 invoice delivery boundary is not configured', async () => {
  let legacyCalls = 0;
  const route = createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder() {
      legacyCalls += 1;
    },
  });

  await assert.rejects(
    route(order({ documentProfileVersion: 1 })),
    (error) => {
      assert.ok(error instanceof PaidOrderDeliveryRoutingError);
      assert.equal(error.code, 'V3_INVOICE_DELIVERY_NOT_CONFIGURED');
      assert.deepEqual(error.details, { documentProfileVersion: 1 });
      return true;
    },
  );
  assert.equal(legacyCalls, 0);
});

test('unsupported document profiles fail closed without calling either delivery path', async () => {
  let legacyCalls = 0;
  let v3Calls = 0;
  const route = createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder() {
      legacyCalls += 1;
    },
    async deliverV3CustomerInvoice() {
      v3Calls += 1;
    },
  });

  for (const documentProfileVersion of [2, -1, 'invalid']) {
    await assert.rejects(
      route(order({ documentProfileVersion })),
      (error) => {
        assert.ok(error instanceof PaidOrderDeliveryRoutingError);
        assert.equal(error.code, 'DOCUMENT_PROFILE_UNSUPPORTED');
        return true;
      },
    );
  }

  assert.equal(legacyCalls, 0);
  assert.equal(v3Calls, 0);
});

test('router construction requires the legacy delivery handler but not the future V3 handler', () => {
  assert.throws(
    () => createPaidOrderDeliveryRouter(),
    /Legacy paid-order delivery handler is required/,
  );

  assert.doesNotThrow(() => createPaidOrderDeliveryRouter({
    async deliverLegacyPaidOrder() {},
  }));
});
