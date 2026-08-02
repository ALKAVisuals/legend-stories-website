import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPage,
  findHeadingJumps,
  hasAccessibleName,
  headingLevels,
} from '../scripts/accessibility-purchase-flow-audit.mjs';

test('detects accessible names from aria, text and input value', () => {
  assert.equal(hasAccessibleName({ 'aria-label': 'Open cart' }, '', 'button'), true);
  assert.equal(hasAccessibleName({}, '<span>Buy now</span>', 'button'), true);
  assert.equal(hasAccessibleName({ type: 'submit', value: 'Continue' }, '', 'input'), true);
  assert.equal(hasAccessibleName({}, '<svg></svg>', 'button'), false);
});

test('extracts heading levels outside scripts and styles', () => {
  const html = '<h1>Title</h1><script>const x = "<h6>fake</h6>";</script><h3>Section</h3>';
  assert.deepEqual(headingLevels(html), [1, 3]);
});

test('finds heading level jumps', () => {
  assert.deepEqual(findHeadingJumps([1, 2, 4, 3, 5]), [
    { from: 2, to: 4, index: 2 },
    { from: 3, to: 5, index: 4 },
  ]);
});

test('classifies checkout and product pages', () => {
  assert.equal(classifyPage('checkout-overview.html', ''), 'purchase-flow');
  assert.equal(classifyPage('legend.html', '<main data-product-id="abc"></main>'), 'product');
  assert.equal(classifyPage('sport-collection.html', ''), 'collection');
  assert.equal(classifyPage('about.html', ''), 'general');
});
