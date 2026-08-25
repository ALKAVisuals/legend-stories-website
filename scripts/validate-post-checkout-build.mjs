import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const errors = [];

async function readBuilt(path) {
  try {
    return await readFile(join(DIST, path), 'utf8');
  } catch (error) {
    errors.push(`${path}: missing or unreadable (${error.message}).`);
    return '';
  }
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) errors.push(label);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) errors.push(label);
}

const [successPage, cancelledPage, sharedCss, cancelledCss, returnRuntime] = await Promise.all([
  readBuilt('order-success.html'),
  readBuilt('order-cancelled.html'),
  readBuilt('css/order-experience.css'),
  readBuilt('css/order-cancelled.css'),
  readBuilt('js/order-return.js'),
]);

requireText(successPage, '<h1 id="order-status-title" class="order-status-title">Payment submitted</h1>',
  'order-success.html: safe pre-verification H1 is missing from the production build.');
requireText(successPage, 'css/order-experience.css',
  'order-success.html: premium order experience stylesheet is missing from the production build.');
requireText(successPage, '<script type="module" vite-ignore src="/js/order-return.js"></script>',
  'order-success.html: verified order-return runtime is missing from the production build.');
requireText(successPage, 'id="order-detail-status"',
  'order-success.html: dynamic order-detail status hook is missing from the production build.');
requireText(successPage, 'id="order-progress-payment-meta"',
  'order-success.html: dynamic payment-progress hook is missing from the production build.');
requireText(successPage, 'id="order-primary-action"',
  'order-success.html: dynamic primary-action hook is missing from the production build.');
forbidText(successPage, 'data-hide-on-error',
  'order-success.html: unsupported image fallback runtime attribute returned in the production build.');

requireText(cancelledPage, '<h1 class="order-status-title">Payment cancelled</h1>',
  'order-cancelled.html: expected cancellation H1 is missing from the production build.');
requireText(cancelledPage, 'Your cart remains saved in this browser',
  'order-cancelled.html: saved-cart safety message is missing from the production build.');
requireText(cancelledPage, 'css/order-experience.css',
  'order-cancelled.html: shared premium order stylesheet is missing from the production build.');
requireText(cancelledPage, 'css/order-cancelled.css',
  'order-cancelled.html: cancelled-state stylesheet is missing from the production build.');
requireText(cancelledPage, '>Review saved cart</a>',
  'order-cancelled.html: saved-cart recovery action is missing from the production build.');
forbidText(cancelledPage, 'order-return.js',
  'order-cancelled.html: cancellation page must remain static and must not execute order-return verification.');
forbidText(cancelledPage, 'checkout.html',
  'order-cancelled.html: production build must not link to a non-existent checkout.html page.');

requireText(sharedCss, "[data-order-status='paid'] .order-status-mark",
  'css/order-experience.css: paid-state visual contract is missing from the production build.');
requireText(sharedCss, "[data-order-status='payment_failed'] .order-status-mark",
  'css/order-experience.css: failed-state visual contract is missing from the production build.');
requireText(sharedCss, '@media (prefers-reduced-motion: reduce)',
  'css/order-experience.css: reduced-motion handling is missing from the production build.');
requireText(sharedCss, '@media (max-width: 640px)',
  'css/order-experience.css: mobile order-experience rules are missing from the production build.');

requireText(cancelledCss, '.order-cancelled .order-status-mark',
  'css/order-cancelled.css: cancelled status styling is missing from the production build.');
requireText(cancelledCss, '.order-cancelled__step--saved',
  'css/order-cancelled.css: saved-cart progress styling is missing from the production build.');

for (const state of ['payment_pending', 'payment_processing', 'payment_failed', 'expired', 'paid', 'unavailable']) {
  requireText(returnRuntime, `${state}: Object.freeze({`,
    `js/order-return.js: ${state} presentation is missing from the production build.`);
}
requireText(returnRuntime, "title: 'Your legend is on its way.'",
  'js/order-return.js: verified-paid premium confirmation copy is missing from the production build.');
requireText(returnRuntime, 'applyVerifiedOrderStatus(status,',
  'js/order-return.js: server-verified order status gate is missing from the production build.');

if (errors.length) {
  console.error('Post-checkout production build validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Post-checkout production build validation passed for success, cancelled, responsive styling and verified status presentation.');
