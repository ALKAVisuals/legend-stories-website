import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTemplateStructure } from '../scripts/product-page-template.mjs';

test('known cart drawer close icon variants share one template contract', () => {
  const current = [
    '<aside id="cart-drawer">',
    '<button class="close" aria-label="Close cart"><svg viewBox="0 0 24 24"><path d="current-close" /></svg></button>',
    '</aside>',
  ].join('');
  const legacy = [
    '<aside id="cart-drawer">',
    '<button class="close" aria-label="Close cart"><svg viewBox="0 0 24 24"><path d="legacy-close" /></svg></button>',
    '</aside>',
  ].join('');

  const normalized = normalizeTemplateStructure(current);
  assert.equal(normalized, normalizeTemplateStructure(legacy));
  assert.match(normalized, /data-template-icon="close-cart"/);
});
