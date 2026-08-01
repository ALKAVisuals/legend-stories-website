import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTemplateStructure } from '../scripts/product-page-template.mjs';

test('known empty cart icon variants preserve the surrounding drawer contract', () => {
  const current = [
    '<div id="cart-items">',
    '<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light flex items-center justify-center">',
    '<svg class="w-8 h-8 text-text-muted"><path d="current-empty-cart" /></svg>',
    '</div><p class="text-text-secondary font-medium">Your cart is empty</p>',
    '</div>',
  ].join('');
  const legacy = current.replace('current-empty-cart', 'legacy-empty-cart');

  const normalized = normalizeTemplateStructure(current);
  assert.equal(normalized, normalizeTemplateStructure(legacy));
  assert.match(normalized, /data-template-icon="empty-cart"/);
  assert.match(normalized, /Your cart is empty/);
});
