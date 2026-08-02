import { readFile, writeFile } from 'node:fs/promises';

const path = 'data/media/product-browser-derivatives.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));

if (manifest.minimumDarkCompositeSsim !== 0.985 || manifest.minimumLightCompositeSsim !== 0.985) {
  throw new Error('Visible composite policy must be applied before derivative tuning.');
}

const HIGH_QUALITY_PAGES = new Set([
  'combat-stone-face.html',
  'music-unapologetic-self-music-legend-mural.html',
  'combat-beast-within.html',
  'combat-unstoppable-will.html',
  'music-unwavering-spirit-music-legend-mural.html',
  'wisdom-unyielding-drive-combat-legend-mural.html',
  'music-heart-of-gold-music-legend-mural.html',
  'combat-courageous-risk.html',
]);

const DIMENSION_OVERRIDES = new Map([
  ['combat-dream-reality.html', { maxDimension: 1700, width: 1700, height: 1352 }],
  ['music-eternal-will.html', { maxDimension: 1700, width: 1624, height: 1700 }],
  ['music-style-code.html', { maxDimension: 1700, width: 1700, height: 1348 }],
]);

for (const image of manifest.images || []) {
  if (HIGH_QUALITY_PAGES.has(image.productPage)) image.quality = 96;
  const dimensions = DIMENSION_OVERRIDES.get(image.productPage);
  if (dimensions) Object.assign(image, dimensions);
}

const highQualityCount = manifest.images.filter((image) => image.quality === 96).length;
const resizedCount = manifest.images.filter((image) => image.maxDimension === 1700).length;
if (highQualityCount !== HIGH_QUALITY_PAGES.size) {
  throw new Error(`Expected ${HIGH_QUALITY_PAGES.size} high-quality derivatives, found ${highQualityCount}.`);
}
if (resizedCount !== DIMENSION_OVERRIDES.size) {
  throw new Error(`Expected ${DIMENSION_OVERRIDES.size} 1700px derivatives, found ${resizedCount}.`);
}

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Tuned ${highQualityCount} quality-sensitive and ${resizedCount} size-sensitive derivatives.`);
