import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../returns.html', import.meta.url), 'utf8');

test('returns page describes the current statutory online withdrawal statement fields', () => {
  assert.match(html, /asks for your name, the Order ID identifying the purchase, and the order email address/i);
  assert.match(html, /electronic address to which LegendMural sends the acknowledgement/i);
  assert.match(html, /content of the statement and the date and time it was submitted/i);
  assert.doesNotMatch(html, /asks only for the Order ID and the email address/i);
});

test('returns page states the statutory reimbursement method and standard-delivery boundary', () => {
  assert.match(html, /cheapest standard outbound delivery/i);
  assert.match(html, /same payment method as the original transaction unless you expressly agree to a different method/i);
  assert.match(html, /will not incur fees because of that reimbursement/i);
});
