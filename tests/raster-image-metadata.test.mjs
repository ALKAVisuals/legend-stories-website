import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateRasterMetrics,
  classifyRasterRole,
  isRasterImageExtension,
  pixelFormatSupportsAlpha,
} from '../scripts/lib/raster-image-metadata.mjs';

test('recognizes supported raster image extensions', () => {
  for (const extension of ['png', '.jpg', 'JPEG', '.webp', 'avif', '.gif']) {
    assert.equal(isRasterImageExtension(extension), true, extension);
  }
  for (const extension of ['.svg', '.mp4', '.pdf', '']) {
    assert.equal(isRasterImageExtension(extension), false, extension);
  }
});

test('classifies product, marketing, brand and hero media paths', () => {
  assert.equal(classifyRasterRole('media/stikkers/2026/Batch 6/image.png'), 'product-source');
  assert.equal(classifyRasterRole('media/voorbeelden/Fightclub.png'), 'marketing');
  assert.equal(classifyRasterRole('media/beforeafter/example.png'), 'marketing');
  assert.equal(classifyRasterRole('media/LOGO/logo.png'), 'brand');
  assert.equal(classifyRasterRole('media/welcome/poster.webp'), 'hero');
  assert.equal(classifyRasterRole('media/misc/image.png'), 'other');
});

test('detects alpha-capable ffmpeg pixel formats', () => {
  for (const format of ['rgba', 'bgra', 'yuva420p', 'gbrap10le', 'ya8', 'pal8']) {
    assert.equal(pixelFormatSupportsAlpha(format), true, format);
  }
  for (const format of ['rgb24', 'yuv420p', 'gray', '']) {
    assert.equal(pixelFormatSupportsAlpha(format), false, format);
  }
});

test('calculates raster density metrics deterministically', () => {
  assert.deepEqual(
    calculateRasterMetrics({ bytes: 2_000_000, width: 2000, height: 1000 }),
    {
      pixels: 2_000_000,
      megapixels: 2,
      bytesPerPixel: 1,
      bytesPerMegapixel: 1_000_000,
    },
  );
  assert.deepEqual(
    calculateRasterMetrics({ bytes: -1, width: 0, height: 100 }),
    {
      pixels: 0,
      megapixels: 0,
      bytesPerPixel: 0,
      bytesPerMegapixel: 0,
    },
  );
});
