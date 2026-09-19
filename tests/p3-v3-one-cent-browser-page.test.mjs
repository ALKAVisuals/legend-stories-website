import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlUrl = new URL('../p3-v3-one-cent-test.html', import.meta.url);
const clientUrl = new URL('../js/p3-v3-one-cent-test.mjs', import.meta.url);
const workerUrl = new URL('../cloudflare/worker.mjs', import.meta.url);

const html = await readFile(htmlUrl, 'utf8');
const client = await readFile(clientUrl, 'utf8');
const worker = await readFile(workerUrl, 'utf8');

test('temporary P3 page is unlinked-style, noindex and explains the one-click boundary', () => {
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive">/);
  assert.match(html, /Click Start only once/);
  assert.match(html, /Do not pay until the pending Profile-1 order has been checked/);
  assert.match(html, /type="password"/);
  assert.match(html, /p3-v3-one-cent-test\.mjs/);
});

test('temporary browser client posts only to the internal start endpoint and redirects to PayPal response', () => {
  assert.match(client, /fetch\('\/api\/internal\/p3-v3-one-cent-start'/);
  assert.match(client, /window\.location\.assign\(result\.url\)/);
  assert.match(client, /button\.disabled = true/);
  assert.doesNotMatch(client, /P3_TEST_CHECKOUT_TOKEN/);
  assert.doesNotMatch(client, /x-legendmural-p3-test-token/);
});

test('Worker keeps the real P3 token server-side and commits only a SHA-256 one-time-code digest', () => {
  assert.match(worker, /P3_V3_WINDOW_KEY_SHA256 = '[a-f0-9]{64}'/);
  assert.match(worker, /env\.P3_TEST_CHECKOUT_TOKEN/);
  assert.match(worker, /x-legendmural-p3-test-token/);
  assert.doesNotMatch(worker, /N6oauNCqQi-kxlgJKye-0bnwhGxPP_uP/);
});

test('temporary start endpoint is production/P3 gated and same-origin restricted', () => {
  assert.match(worker, /!productionContext\(env\) \|\| !enabled\(env\.P3_TEST_CHECKOUT_ENABLED\)/);
  assert.match(worker, /requestOrigin !== 'https:\/\/legendmural\.com'/);
  assert.match(worker, /P3_TEST_WINDOW_UNAUTHORIZED/);
  assert.match(worker, /__p3-controlled-payment-test__/);
});
