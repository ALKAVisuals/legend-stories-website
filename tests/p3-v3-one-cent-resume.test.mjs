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

test('recovery client validates the owner code before restoring browser return context', () => {
  assert.match(client, /EXPECTED_KEY_SHA256 = '[a-f0-9]{64}'/);
  assert.match(client, /INVALID_TEST_CODE/);
  assert.match(client, /\^LMR1:/);
  assert.match(client, /legendCheckoutSessionId/);
  assert.match(client, /legendCheckoutReference/);
  assert.match(client, /order-success\.html\?token=/);
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
