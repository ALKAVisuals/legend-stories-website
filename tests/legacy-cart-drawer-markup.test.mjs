import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyProductPageMarkup } from '../scripts/product-page-template.mjs';

test('legacy cart drawer total label and duplicate aside normalize to the canonical contract', () => {
  const legacy = [
    '<div class="flex items-center justify-between mb-4">',
    '<span class="text-text-secondary">Copied Product Name</span>',
    '<span id="cart-total" class="font-display text-xl font-bold">€0,00</span>',
    '</div>',
    '</aside></aside>',
    '<!-- CHECKOUT DRAWER -->',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.match(
    normalized,
    /<span class="text-text-secondary">Total<\/span><span id="cart-total"/,
  );
  assert.doesNotMatch(normalized, /<\/aside><\/aside>/);
  assert.match(normalized, /<\/aside><!-- CHECKOUT DRAWER -->/);
});
