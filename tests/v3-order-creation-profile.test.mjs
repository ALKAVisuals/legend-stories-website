import test from 'node:test';
import assert from 'node:assert/strict';

import {
  V3OrderCreationProfileError,
  isV3Profile1OrderCreationEnabled,
  resolveV3OrderCreationDocumentProfile,
} from '../server/netlify/v3-order-creation-profile.mjs';

const databaseUrl = 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require';

function completeConfig() {
  return {
    enabled: true,
    numberingPolicy: {
      resolveSeriesKey() { return '2026'; },
      format({ documentType, value }) { return `TEST-${documentType}-${value}`; },
    },
    documentContextProvider: async () => ({
      seller: { synthetic: true },
      billingAddress: { synthetic: true },
      tax: { synthetic: true },
    }),
  };
}

test('Profile-1 order creation is disabled unless the server flag is explicitly true', () => {
  assert.equal(isV3Profile1OrderCreationEnabled({}), false);
  assert.equal(isV3Profile1OrderCreationEnabled({ V3_PROFILE1_ORDER_CREATION_ENABLED: 'false' }), false);
  assert.equal(isV3Profile1OrderCreationEnabled({ V3_PROFILE1_ORDER_CREATION_ENABLED: 'TRUE' }), true);
  assert.equal(isV3Profile1OrderCreationEnabled({ V3_PROFILE1_ORDER_CREATION_ENABLED: ' true ' }), true);
});

test('disabled server gate always resolves Profile 0 without requiring V3 config', () => {
  assert.equal(resolveV3OrderCreationDocumentProfile({
    env: {},
    v3PaidFinalization: null,
  }), 0);
});

test('enabled server gate fails closed when paid-finalization config is incomplete', () => {
  for (const input of [
    { env: { V3_PROFILE1_ORDER_CREATION_ENABLED: 'true' }, v3PaidFinalization: completeConfig() },
    {
      env: { V3_PROFILE1_ORDER_CREATION_ENABLED: 'true', NEON_DATABASE_URL: databaseUrl },
      v3PaidFinalization: null,
    },
    {
      env: { V3_PROFILE1_ORDER_CREATION_ENABLED: 'true', NEON_DATABASE_URL: databaseUrl },
      v3PaidFinalization: { enabled: true },
    },
  ]) {
    assert.throws(
      () => resolveV3OrderCreationDocumentProfile(input),
      (error) => error instanceof V3OrderCreationProfileError
        && error.code === 'V3_ORDER_CREATION_NOT_CONFIGURED',
    );
  }
});

test('enabled server gate resolves Profile 1 only with complete server-side V3 config', () => {
  assert.equal(resolveV3OrderCreationDocumentProfile({
    env: {
      V3_PROFILE1_ORDER_CREATION_ENABLED: 'true',
      NEON_DATABASE_URL: databaseUrl,
    },
    v3PaidFinalization: completeConfig(),
  }), 1);
});
