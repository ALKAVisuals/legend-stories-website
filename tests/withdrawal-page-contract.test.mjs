import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../withdraw.html', import.meta.url), 'utf8');
const client = await readFile(new URL('../js/withdrawal.js', import.meta.url), 'utf8');

test('withdrawal page requires only purchase-locating fields and explicit confirmation', () => {
  assert.match(html, /id="withdrawal-order-id"[^>]*required/);
  assert.match(html, /id="withdrawal-email"[^>]*required/);
  assert.match(html, /id="withdrawal-confirm"[^>]*required/);
  assert.match(html, /id="withdrawal-submit"[^>]*>Confirm withdrawal<\/button>/);
  assert.doesNotMatch(html, /name="reason"|id="withdrawal-reason"/);
});

test('withdrawal confirmation exposes purchase, confirmation code and timestamp with save action', () => {
  assert.match(html, /id="withdrawal-receipt-order-id"/);
  assert.match(html, /id="withdrawal-receipt-code"/);
  assert.match(html, /id="withdrawal-receipt-time"/);
  assert.match(html, /id="withdrawal-download"/);
  assert.match(client, /withdrawnAtIso/);
  assert.match(client, /LegendMural — Withdrawal confirmation/);
});

test('withdrawal page does not claim automatic refund or completed return', () => {
  assert.match(html, /does not automatically mean a refund has already been processed/i);
  assert.match(client, /does not by itself confirm that goods have been returned or that a refund has already been processed/i);
});
