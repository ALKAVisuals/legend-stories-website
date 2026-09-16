import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { handleActiveCheckout } from '../cloudflare/api-runtime.mjs';
import {
  resolveCloudflareOrderCreationDocumentProfile,
} from '../cloudflare/runtime-core.mjs';
import {
  resolveCloudflareV3PaidFinalizationConfig,
} from '../cloudflare/v3-paid-finalization-config.mjs';

const apiRuntimeUrl = new URL('../cloudflare/api-runtime.mjs', import.meta.url);
const databaseUrl = 'postgresql://test:test@ep-test.neon.tech/neondb?sslmode=require';

function completeSyntheticConfig() {
  return {
    enabled: true,
    numberingPolicy: {
      resolveSeriesKey() { return 'synthetic-cloudflare-series'; },
      format({ documentType, value }) { return `TEST-${documentType.toUpperCase()}-${value}`; },
    },
    async documentContextProvider() {
      return {
        seller: { synthetic: true },
        billingAddress: { synthetic: true },
        tax: { synthetic: true },
      };
    },
  };
}

test('Cloudflare approved Profile-1 business/legal config remains fail-closed by default', () => {
  assert.equal(resolveCloudflareV3PaidFinalizationConfig(), null);
});

test('Cloudflare checkout rejects Profile-1 activation before durable mutation when approved config is absent', async () => {
  const request = new Request('https://legendmural.com/api/paypal/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://legendmural.com',
    },
    body: JSON.stringify({ items: [] }),
  });
  const response = await handleActiveCheckout(request, {
    V3_PROFILE1_ORDER_CREATION_ENABLED: 'true',
    NEON_DATABASE_URL: databaseUrl,
  }, {
    successUrl: 'https://legendmural.com/order-success.html',
    cancelUrl: 'https://legendmural.com/order-cancelled.html',
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.error.code, 'V3_ORDER_CREATION_NOT_CONFIGURED');
});

test('complete synthetic config satisfies the shared Profile-1 creation gate', () => {
  const documentProfileVersion = resolveCloudflareOrderCreationDocumentProfile({
    env: {
      V3_PROFILE1_ORDER_CREATION_ENABLED: 'true',
      NEON_DATABASE_URL: databaseUrl,
    },
    v3PaidFinalization: completeSyntheticConfig(),
  });

  assert.equal(documentProfileVersion, 1);
});

test('checkout, capture and webhook compose through the same resolved V3 finalization config', async () => {
  const source = await readFile(apiRuntimeUrl, 'utf8');

  assert.match(
    source,
    /resolveCloudflareOrderCreationDocumentProfile\(\{\s*env,\s*v3PaidFinalization: resolvedV3PaidFinalization,\s*\}\)/s,
  );
  const finalizerCompositions = source.match(
    /createCloudflareV3PaidFinalizationRuntime\(\{\s*env,\s*config: resolvedV3PaidFinalization,\s*\}\)/gs,
  ) || [];
  assert.equal(finalizerCompositions.length, 2);
});
