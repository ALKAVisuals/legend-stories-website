import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);

test('product image loading contract validates the managed storefront', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-product-image-loading.mjs'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );

  assert.equal(
    result.status,
    0,
    `validator failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.match(result.stdout, /111 product heroes/);
  assert.match(result.stdout, /232 lazy product-card images/);
  assert.match(result.stdout, /1 image-less CTA/);
});
