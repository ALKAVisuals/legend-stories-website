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

function requirePattern(source, pattern, label) {
  if (!pattern.test(source)) errors.push(label);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) errors.push(label);
}

function builtAssetReference(html, assetStem) {
  const escapedStem = assetStem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`href=["']([^"']*${escapedStem}-[^"']+\\.css)["']`, 'i'));
  return match?.[1]?.replace(/^\//, '') || '';
}

const [successPage, cancelledPage, returnRuntime] = await Promise.all([
  readBuilt('order-success.html'),
  readBuilt('order-cancelled.html'),
  readBuilt('js/order-return.js'),
]);

const sharedCssPath = builtAssetReference(successPage, 'order-experience');
const cancelledCssPath = builtAssetReference(cancelledPage, 'order-cancelled');

if (!sharedCssPath) {
  errors.push('order-success.html: hashed premium order experience stylesheet reference is missing from the production build.');
}
if (!cancelledCssPath) {
  errors.push('order-cancelled.html: hashed cancelled-state stylesheet reference is missing from the production build.');
}
requireText(cancelledPage, sharedCssPath,
  'order-cancelled.html: shared premium order stylesheet does not match the production asset used by the success page.');

const [sharedCss, cancelledCss] = await Promise.all([
  sharedCssPath ? readBuilt(sharedCssPath) : Promise.resolve(''),
  cancelledCssPath ? readBuilt(cancelledCssPath) : Promise.resolve(''),
]);

requirePattern(successPage,
  /<h1\s+id=["']order-status-title["']\s+class=["']order-status-title["']>Payment submitted<\/h1>/i,
  'order-success.html: safe pre-verification H1 is missing from the production build.');
requirePattern(successPage, /src=["']\/js\/order-return\.js["']/i,
  'order-success.html: verified order-return runtime is missing from the production build.');
requireText(successPage, 'id="order-detail-status"',
  'order-success.html: dynamic order-detail status hook is missing from the production build.');
requireText(successPage, 'id="order-progress-payment-meta"',
  'order-success.html: dynamic payment-progress hook is missing from the production build.');
requireText(successPage, 'id="order-primary-action"',
  'order-success.html: dynamic primary-action hook is missing from the production build.');
forbidText(successPage, 'data-hide-on-error',
  'order-success.html: unsupported image fallback runtime attribute returned in the production build.');

requirePattern(cancelledPage,
  /<h1\s+class=["']order-status-title["']>Payment cancelled<\/h1>/i,
  'order-cancelled.html: expected cancellation H1 is missing from the production build.');
requireText(cancelledPage, 'Your cart remains saved in this browser',
  'order-cancelled.html: saved-cart safety message is missing from the production build.');
requirePattern(cancelledPage, />Review saved cart<\/a>/i,
  'order-cancelled.html: saved-cart recovery action is missing from the production build.');
forbidText(cancelledPage, 'order-return.js',
  'order-cancelled.html: cancellation page must remain static and must not execute order-return verification.');
forbidText(cancelledPage, 'checkout.html',
  'order-cancelled.html: production build must not link to a non-existent checkout.html page.');

requirePattern(sharedCss, /\[data-order-status=['"]?paid['"]?\]\s*\.order-status-mark/i,
  'premium order CSS: paid-state visual contract is missing from the production build.');
requirePattern(sharedCss, /\[data-order-status=['"]?payment_failed['"]?\]\s*\.order-status-mark/i,
  'premium order CSS: failed-state visual contract is missing from the production build.');
requirePattern(sharedCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/i,
  'premium order CSS: reduced-motion handling is missing from the production build.');
requirePattern(sharedCss, /@media\s*\(max-width:\s*640px\)/i,
  'premium order CSS: mobile order-experience rules are missing from the production build.');

requirePattern(cancelledCss, /\.order-cancelled\s+\.order-status-mark/i,
  'cancelled order CSS: cancelled status styling is missing from the production build.');
requirePattern(cancelledCss, /\.order-cancelled__step--saved/i,
  'cancelled order CSS: saved-cart progress styling is missing from the production build.');

for (const state of ['payment_pending', 'payment_processing', 'payment_failed', 'expired', 'paid', 'unavailable']) {
  requireText(returnRuntime, `${state}: Object.freeze({`,
    `js/order-return.js: ${state} presentation is missing from the production build.`);
}
requireText(returnRuntime, "title: 'Your legend is officially yours.'",
  'js/order-return.js: verified-paid premium confirmation copy is missing from the production build.');
requireText(returnRuntime, 'applyVerifiedOrderStatus(status,',
  'js/order-return.js: server-verified order status gate is missing from the production build.');

if (errors.length) {
  console.error('Post-checkout production build validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Post-checkout production build validation passed using ${sharedCssPath} and ${cancelledCssPath}.`);
