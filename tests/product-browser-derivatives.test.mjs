import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_BROWSER_DERIVATIVE_MANIFEST,
  PRODUCT_BROWSER_DERIVATIVES,
  browserProductImageFor,
  calculateDerivativeDimensions,
  calculateSizeRatio,
  normalizeProductImagePath,
  parseSsimScore,
  productDerivativeRecordFor,
  sourceProductImageFor,
} from '../scripts/lib/product-browser-derivatives.mjs';

test('product browser derivative manifest is exact and unique', () => {
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.schemaVersion, 1);
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.format, 'webp');
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.length, 21);
  assert.equal(new Set(PRODUCT_BROWSER_DERIVATIVES.map((image) => image.source)).size, 21);
  assert.equal(new Set(PRODUCT_BROWSER_DERIVATIVES.map((image) => image.derivative)).size, 21);
  assert.equal(new Set(PRODUCT_BROWSER_DERIVATIVES.map((image) => image.productPage)).size, 21);
});

test('product browser derivative quality policy matches the validated layout contract', () => {
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.maxDimension, 1800);
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.wideDisplayMaxDimension, 900);
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.minimumNativeCompositeSsim, 0.975);
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.minimumWideDisplayCompositeSsim, 0.98);
  assert.equal(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.maximumSizeRatio, 0.35);
  assert.equal('minimumColorSsim' in PRODUCT_BROWSER_DERIVATIVE_MANIFEST, false);
  assert.equal('minimumAlphaSsim' in PRODUCT_BROWSER_DERIVATIVE_MANIFEST, false);
  assert.equal('standardDisplayMaxDimension' in PRODUCT_BROWSER_DERIVATIVE_MANIFEST, false);

  assert.equal(PRODUCT_BROWSER_DERIVATIVES.filter((image) => image.quality === 100).length, 1);
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.filter((image) => image.quality === 96).length, 7);
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.filter((image) => image.maxDimension === 1440).length, 1);
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.filter((image) => image.maxDimension === 1600).length, 1);
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.filter((image) => image.maxDimension === 1700).length, 3);

  const unstoppableWill = PRODUCT_BROWSER_DERIVATIVES.find(
    (image) => image.productPage === 'combat-unstoppable-will.html',
  );
  assert.deepEqual(
    {
      quality: unstoppableWill?.quality,
      maxDimension: unstoppableWill?.maxDimension,
      width: unstoppableWill?.width,
      height: unstoppableWill?.height,
    },
    {
      quality: 100,
      maxDimension: 1440,
      width: 1440,
      height: 1152,
    },
  );
});

test('product image paths normalize absolute, encoded and legacy URLs', () => {
  const expected = 'media/stikkers/2026/batch 3/Sport Legends/lions-pride-sport-legend-mural.png';
  assert.equal(
    normalizeProductImagePath('https://example.com/legend-stories-website/media/stikkers/2026/batch%203/Sport%20Legends/lions-pride-sport-legend-mural.png'),
    expected,
  );
  assert.equal(normalizeProductImagePath(`./${expected}`), expected);
});

test('browser and source product image resolvers are reversible', () => {
  const record = PRODUCT_BROWSER_DERIVATIVES[0];
  assert.equal(browserProductImageFor(record.source), record.derivative);
  assert.equal(sourceProductImageFor(record.derivative), record.source);
  assert.equal(productDerivativeRecordFor(record.source)?.productPage, record.productPage);
  assert.equal(browserProductImageFor('media/other/product.png'), 'media/other/product.png');
});

test('derivative dimensions preserve aspect ratio and even output dimensions', () => {
  assert.deepEqual(calculateDerivativeDimensions(5892, 8536, 1800), {
    width: 1242,
    height: 1800,
  });
  assert.deepEqual(calculateDerivativeDimensions(9040, 4976, 1800), {
    width: 1800,
    height: 992,
  });
  assert.deepEqual(calculateDerivativeDimensions(7928, 6344, 1440), {
    width: 1440,
    height: 1152,
  });
});

test('size ratios and SSIM output parse deterministically', () => {
  assert.equal(calculateSizeRatio(1000, 250), 0.25);
  assert.equal(parseSsimScore('SSIM Y:0.99 U:0.98 V:0.98 All:0.987654 (18.0)'), 0.987654);
  assert.throws(() => parseSsimScore('no score'));
});
