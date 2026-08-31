import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('premium order return keeps verified-status presentation hooks intact', () => {
  const html = read('order-success.html');
  const runtime = read('js/order-return.js');
  const css = read('css/order-experience.css');
  const paidCss = read('css/order-paid-experience.css');

  for (const id of [
    'order-status-card',
    'order-status-label',
    'order-status-title',
    'order-status-message',
    'order-detail-status',
    'order-progress-payment-dot',
    'order-progress-payment-meta',
    'order-progress-production-meta',
    'order-progress-shipping-meta',
    'order-id-block',
    'order-id-value',
    'order-primary-action',
    'order-paid-shop-action',
    'order-withdraw-link',
    'order-installation-guides',
    'order-installation-title',
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }

  assert.doesNotMatch(html, /data-hide-on-error/);
  assert.match(html, /css\/order-paid-experience\.css/);
  assert.match(html, /PL69xq-QQTVxjbY7es-YDCGee06GruiRMW/);
  assert.match(runtime, /ORDER_RETURN_PRESENTATION/);
  assert.match(runtime, /paid:\s*Object\.freeze/);
  assert.match(runtime, /title:\s*'Your legend is officially yours\.'/);
  assert.match(runtime, /actionLabel:\s*'View installation guides'/);
  assert.match(runtime, /applyVerifiedOrderStatus\(status/);
  assert.match(css, /\[data-order-status='paid'\]/);
  assert.match(css, /\[data-order-status='payment_failed'\]/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(paidCss, /\.order-paid-only/);
  assert.match(paidCss, /\[data-order-status='paid'\] \.order-installation/);
});
