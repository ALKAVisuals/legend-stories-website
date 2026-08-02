import { readFile, writeFile } from 'node:fs/promises';

const path = 'data/media/product-browser-derivatives.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));

if (manifest.minimumDarkCompositeSsim !== 0.985 || manifest.minimumLightCompositeSsim !== 0.985) {
  throw new Error('Visible composite policy must be applied before derivative tuning.');
}

const QUALITY_OVERRIDES = new Map([
  ['combat-stone-face.html', 100],
  ['combat-beast-within.html', 100],
  ['combat-unstoppable-will.html', 100],
  ['music-unwavering-spirit-music-legend-mural.html', 100],
  ['wisdom-unyielding-drive-combat-legend-mural.html', 100],
  ['music-unapologetic-self-music-legend-mural.html', 96],
  ['music-heart-of-gold-music-legend-mural.html', 96],
  ['combat-courageous-risk.html', 96],
]);

const DIMENSION_OVERRIDES = new Map([
  ['combat-stone-face.html', { maxDimension: 1600, width: 1104, height: 1600 }],
  ['combat-beast-within.html', { maxDimension: 1600, width: 1600, height: 1362 }],
  ['combat-unstoppable-will.html', { maxDimension: 1600, width: 1600, height: 1280 }],
  ['music-unwavering-spirit-music-legend-mural.html', { maxDimension: 1600, width: 1600, height: 882 }],
  ['wisdom-unyielding-drive-combat-legend-mural.html', { maxDimension: 1600, width: 1600, height: 988 }],
  ['music-eternal-will.html', { maxDimension: 1600, width: 1530, height: 1600 }],
  ['music-heart-of-gold-music-legend-mural.html', { maxDimension: 1700, width: 1700, height: 1096 }],
  ['combat-dream-reality.html', { maxDimension: 1700, width: 1700, height: 1352 }],
  ['music-style-code.html', { maxDimension: 1700, width: 1700, height: 1348 }],
]);

for (const image of manifest.images || []) {
  const quality = QUALITY_OVERRIDES.get(image.productPage);
  if (quality) image.quality = quality;
  const dimensions = DIMENSION_OVERRIDES.get(image.productPage);
  if (dimensions) Object.assign(image, dimensions);
}

const quality100Count = manifest.images.filter((image) => image.quality === 100).length;
const quality96Count = manifest.images.filter((image) => image.quality === 96).length;
const dimension1600Count = manifest.images.filter((image) => image.maxDimension === 1600).length;
const dimension1700Count = manifest.images.filter((image) => image.maxDimension === 1700).length;

if (quality100Count !== 5) {
  throw new Error(`Expected 5 quality-100 derivatives, found ${quality100Count}.`);
}
if (quality96Count !== 3) {
  throw new Error(`Expected 3 quality-96 derivatives, found ${quality96Count}.`);
}
if (dimension1600Count !== 6) {
  throw new Error(`Expected 6 1600px derivatives, found ${dimension1600Count}.`);
}
if (dimension1700Count !== 3) {
  throw new Error(`Expected 3 1700px derivatives, found ${dimension1700Count}.`);
}

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Tuned ${quality100Count} quality-100, ${quality96Count} quality-96, ${dimension1600Count} 1600px and ${dimension1700Count} 1700px derivatives.`,
);
