import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyMarketingBackgroundDerivative,
  buildMarketingBackgroundDeclarations,
  calculateSizeRatio,
  parseSsimScore,
} from '../scripts/lib/marketing-image-derivatives.mjs';

const source = 'media/voorbeelden/Fightclub.png';
const derivative = 'media/voorbeelden/Fightclub.webp';

test('builds a WebP-first image-set with a PNG declaration fallback', () => {
  assert.equal(
    buildMarketingBackgroundDeclarations(source, derivative),
    "background-image:url('media/voorbeelden/Fightclub.png');background-image:image-set(url('media/voorbeelden/Fightclub.webp') type('image/webp'), url('media/voorbeelden/Fightclub.png') type('image/png'));",
  );
});

test('applies the derivative declaration exactly once and remains idempotent', () => {
  const html = `<div style="background-image:url('${source}');background-size:cover"></div>`;
  const migrated = applyMarketingBackgroundDerivative(html, { source, derivative });
  assert.match(migrated, /image-set\(/);
  assert.equal(
    applyMarketingBackgroundDerivative(migrated, { source, derivative }),
    migrated,
  );
});

test('rejects missing or duplicate homepage fallback references', () => {
  assert.throws(
    () => applyMarketingBackgroundDerivative('<div></div>', { source, derivative }),
    /expected exactly one homepage background reference/,
  );
  assert.throws(
    () => applyMarketingBackgroundDerivative(
      `<div style="background-image:url('${source}');"></div><div style="background-image:url('${source}');"></div>`,
      { source, derivative },
    ),
    /found 2/,
  );
});

test('parses FFmpeg SSIM output and validates file-size ratios', () => {
  assert.equal(parseSsimScore('SSIM Y:0.99 U:0.98 V:0.97 All:0.987654 (19.2)'), 0.987654);
  assert.equal(calculateSizeRatio(1000, 250), 0.25);
  assert.throws(() => parseSsimScore('no score'), /did not contain/);
  assert.throws(() => calculateSizeRatio(0, 10), /positive number/);
});
