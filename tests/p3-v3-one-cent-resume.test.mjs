import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const htmlUrl = new URL('../p3-v3-one-cent-resume.html', import.meta.url);
const clientUrl = new URL('../js/p3-v3-one-cent-resume.mjs', import.meta.url);
const startClientUrl = new URL('../js/p3-v3-one-cent-test.mjs', import.meta.url);

const html = await readFile(htmlUrl, 'utf8');
const client = await readFile(clientUrl, 'utf8');
const startClient = await readFile(startClientUrl, 'utf8');

test('temporary recovery page is noindex and explicitly does not create a second order', () => {
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /does not create a second order/i);
  assert.match(html, /p3-v3-one-cent-resume\.mjs/);
});

test('recovery client validates the owner code and finalizes only the decoded existing PayPal order', () => {
  assert.match(client, /EXPECTED_KEY_SHA256 = '[a-f0-9]{64}'/);
  assert.match(client, /INVALID_TEST_CODE/);
  assert.match(client, /\^LMR1:/);
  assert.match(client, /legendCheckoutSessionId/);
  assert.match(client, /legendCheckoutReference/);
  assert.match(client, /fetch\('\/api\/paypal\/capture'/);
  assert.match(client, /JSON\.stringify\(\{ reference, orderId \}\)/);
  assert.match(client, /result\?\.status !== 'paid'/);
  assert.match(client, /result\?\.paid !== true/);
  assert.match(client, /Payment confirmation completed\. Do not submit again\./);
  assert.doesNotMatch(client, /p3-v3-one-cent-start/);
});

test('recovery parser normalizes common clipboard artifacts while preserving strict identity shape', () => {
  assert.match(client, /\.normalize\('NFKC'\)/);
  assert.match(client, /\\u200B-\\u200D\\u2060\\uFEFF/);
  assert.match(client, /replace\(\/\\s\+\/g, ''\)/);
  assert.match(client, /\^LMR1:\(\[a-f0-9\]\{64\}\):\(\[a-z0-9\]\{1,36\}\)\$\/i/);
  assert.match(client, /reference: match\[1\]\.toLowerCase\(\)/);
  assert.match(client, /orderId: match\[2\]\.toUpperCase\(\)/);
});

test('recovery client contains no concrete Production order identity', () => {
  assert.doesNotMatch(client, /0b5c1de03fee2545b5567fd02e7473bd2f7cf0c544deedf3f3eed8920385d357/);
  assert.doesNotMatch(client, /3E34290805196632L/);
});

test('temporary P3 start client now preserves normal PayPal return context before redirect', () => {
  assert.match(startClient, /legendCheckoutSessionId/);
  assert.match(startClient, /legendCheckoutReference/);
  assert.match(startClient, /sessionStorage\.setItem/);
  assert.match(startClient, /window\.location\.assign\(result\.url\)/);
});
