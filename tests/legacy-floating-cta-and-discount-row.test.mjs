import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyProductPageMarkup } from '../scripts/product-page-template.mjs';

test('legacy floating CTA copy and comments normalize to the canonical markup', () => {
  const legacy = [
    '<!-- FLOATING CTA -->',
    '<a href="index.html#contact" class="floating-cta hidden" style="position:fixed;">',
    '<span>✨</span> Custom Mural\n  </a>',
    '<!-- WHATSAPP BUTTON -->',
    '<a href="https://wa.me/example">WhatsApp</a>',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.doesNotMatch(normalized, /FLOATING CTA|WHATSAPP BUTTON/);
  assert.match(normalized, /<span>✨<\/span> Custom mural<\/a>/);
  assert.match(normalized, /https:\/\/wa\.me\/example/);
});

test('redundant static checkout discount row is removed for runtime injection', () => {
  const legacy = [
    '<div class="flex justify-between text-sm hidden" id="discount-row">',
    '<span class="text-text-muted">Discount</span>',
    '<span class="text-red-400" id="checkout-discount-amount">€0,00</span>',
    '</div>',
    '<div class="flex justify-between text-sm"><span>Shipping</span></div>',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.doesNotMatch(normalized, /discount-row|checkout-discount-amount/);
  assert.match(normalized, /<span>Shipping<\/span>/);
});
