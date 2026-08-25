import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('cancelled checkout remains premium, static and non-destructive', () => {
  const html = read('order-cancelled.html');
  const css = read('css/order-cancelled.css');

  assert.match(html, /css\/order-experience\.css/);
  assert.match(html, /css\/order-cancelled\.css/);
  assert.match(html, /data-order-status=["']cancelled["']/);
  assert.match(html, />Payment cancelled<\/h1>/);
  assert.match(html, /Your cart is still here\./);
  assert.match(html, /Your cart remains saved in this browser/);
  assert.match(html, /href=["']shop\.html["'][^>]*>Review saved cart</);
  assert.match(html, /This page does not mark an order as paid/i);

  assert.doesNotMatch(html, /order-return\.js/);
  assert.doesNotMatch(html, /paypal-capture/i);
  assert.doesNotMatch(html, /data-hide-on-error/);
  assert.doesNotMatch(html, /href=["']checkout\.html["']/);

  assert.match(css, /\.order-cancelled \.order-status-mark/);
  assert.match(css, /\.order-cancelled__step--saved/);
  assert.match(css, /@media \(max-width: 820px\)/);
});
