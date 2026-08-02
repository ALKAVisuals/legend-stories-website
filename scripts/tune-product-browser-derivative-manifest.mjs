import { readFile, writeFile } from 'node:fs/promises';

const path = 'data/media/product-browser-derivatives.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));

if (manifest.minimumDarkCompositeSsim !== 0.985 || manifest.minimumLightCompositeSsim !== 0.985) {
  throw new Error('Visible composite policy must be applied before derivative tuning.');
}

const SHARP_EDGE_OVERRIDES = new Map([
  ['combat-stone-face.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1600, width: 1104, height: 1600 }],
  ['combat-beast-within.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1500, width: 1500, height: 1278 }],
  ['combat-unstoppable-will.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1500, width: 1500, height: 1200 }],
  ['music-unwavering-spirit-music-legend-mural.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1600, width: 1600, height: 882 }],
  ['wisdom-unyielding-drive-combat-legend-mural.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1500, width: 1500, height: 926 }],
  ['music-heart-of-gold-music-legend-mural.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1650, width: 1650, height: 1064 }],
  ['music-eternal-will.html', { encoder: 'cwebp-sharp', quality: 98, maxDimension: 1500, width: 1434, height: 1500 }],
]);

const STANDARD_QUALITY_OVERRIDES = new Map([
  ['music-unapologetic-self-music-legend-mural.html', 96],
  ['combat-courageous-risk.html', 96],
]);

const STANDARD_DIMENSION_OVERRIDES = new Map([
  ['combat-dream-reality.html', { maxDimension: 1700, width: 1700, height: 1352 }],
  ['music-style-code.html', { maxDimension: 1700, width: 1700, height: 1348 }],
]);

for (const image of manifest.images || []) {
  const sharpOverride = SHARP_EDGE_OVERRIDES.get(image.productPage);
  if (sharpOverride) Object.assign(image, sharpOverride);
  const standardQuality = STANDARD_QUALITY_OVERRIDES.get(image.productPage);
  if (standardQuality) image.quality = standardQuality;
  const standardDimensions = STANDARD_DIMENSION_OVERRIDES.get(image.productPage);
  if (standardDimensions) Object.assign(image, standardDimensions);
}

const sharpCount = manifest.images.filter((image) => image.encoder === 'cwebp-sharp').length;
const quality98Count = manifest.images.filter((image) => image.quality === 98).length;
const quality96Count = manifest.images.filter((image) => image.quality === 96).length;
const dimension1500Count = manifest.images.filter((image) => image.maxDimension === 1500).length;
const dimension1600Count = manifest.images.filter((image) => image.maxDimension === 1600).length;
const dimension1650Count = manifest.images.filter((image) => image.maxDimension === 1650).length;
const dimension1700Count = manifest.images.filter((image) => image.maxDimension === 1700).length;

if (sharpCount !== 7 || quality98Count !== 7) {
  throw new Error(`Expected 7 sharp quality-98 derivatives, found ${sharpCount} sharp and ${quality98Count} quality-98.`);
}
if (quality96Count !== 2) {
  throw new Error(`Expected 2 standard quality-96 derivatives, found ${quality96Count}.`);
}
if (dimension1500Count !== 4 || dimension1600Count !== 2 || dimension1650Count !== 1 || dimension1700Count !== 2) {
  throw new Error(
    `Unexpected tuned dimensions: 1500=${dimension1500Count}, 1600=${dimension1600Count}, 1650=${dimension1650Count}, 1700=${dimension1700Count}.`,
  );
}

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Tuned ${sharpCount} sharp-edge, ${quality96Count} standard high-quality and ${STANDARD_DIMENSION_OVERRIDES.size} size-only derivatives.`,
);
