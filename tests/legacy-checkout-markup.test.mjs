import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyProductPageMarkup } from '../scripts/product-page-template.mjs';

test('legacy floating CTA comments do not define a separate page template', () => {
  const legacy = '<script src="js/app.js"></script><!-- FLOATING CTA --><a class="floating-cta">Contact</a>';
  assert.equal(
    normalizeLegacyProductPageMarkup(legacy),
    '<script src="js/app.js"></script><a class="floating-cta">Contact</a>',
  );
});

test('redundant checkout discount input is removed while central cart discount remains authoritative', () => {
  const legacy = [
    '<div><label class="label">Discount code</label>',
    '<div class="flex gap-2">',
    '<input type="text" id="checkout-discount" placeholder="LEGEND10" />',
    '<button type="button" id="apply-discount-btn">Apply</button>',
    '</div>',
    '<p id="discount-message" class="hidden"></p>',
    '</div>',
    '<div id="checkout-summary">Summary</div>',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.doesNotMatch(normalized, /checkout-discount/);
  assert.doesNotMatch(normalized, /apply-discount-btn/);
  assert.doesNotMatch(normalized, /discount-message/);
  assert.match(normalized, /<div id="checkout-summary">Summary<\/div>/);
});
