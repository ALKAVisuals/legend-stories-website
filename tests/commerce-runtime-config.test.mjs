import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createCommerceRuntimeConfig,
  normalizePublicCommerceEndpoint,
  renderCommerceRuntimeConfig,
  writeCommerceRuntimeConfig,
} from '../scripts/generate-commerce-runtime-config.mjs';

test('commerce runtime config is disabled by default', () => {
  assert.deepEqual(createCommerceRuntimeConfig({}), {
    hostedCheckoutEndpoint: '',
    orderStatusEndpoint: '',
  });
});

test('commerce runtime config accepts only public same-origin paths', () => {
  assert.equal(normalizePublicCommerceEndpoint('/api/checkout'), '/api/checkout');
  assert.equal(normalizePublicCommerceEndpoint('  /api/order-status  '), '/api/order-status');

  for (const endpoint of [
    'https://payments.example/api/checkout',
    '//payments.example/api/checkout',
    '/api/checkout?token=secret',
    '/api/checkout#fragment',
    '/api\\checkout',
  ]) {
    assert.throws(
      () => normalizePublicCommerceEndpoint(endpoint),
      /same-origin absolute path|must not contain/,
    );
  }
});

test('generated runtime module contains endpoints and no server secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'legendmural-runtime-config-'));
  const targetPath = join(directory, 'runtime-config.mjs');
  const secret = 'postgresql://runtime:private@ep-example-pooler.eu-central-1.aws.neon.tech/neondb';

  try {
    const config = await writeCommerceRuntimeConfig({
      env: {
        LEGENDMURAL_HOSTED_CHECKOUT_ENDPOINT: '/api/checkout',
        LEGENDMURAL_ORDER_STATUS_ENDPOINT: '/api/order-status',
        NEON_DATABASE_URL: secret,
        STRIPE_SECRET_KEY: 'sk_test_private',
      },
      targetPath,
    });
    const source = await readFile(targetPath, 'utf8');

    assert.deepEqual(config, {
      hostedCheckoutEndpoint: '/api/checkout',
      orderStatusEndpoint: '/api/order-status',
    });
    assert.match(source, /hostedCheckoutEndpoint.*\/api\/checkout/s);
    assert.match(source, /orderStatusEndpoint.*\/api\/order-status/s);
    assert.doesNotMatch(source, /postgresql:|sk_test_|private@/);
    assert.equal(source, renderCommerceRuntimeConfig(config));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
