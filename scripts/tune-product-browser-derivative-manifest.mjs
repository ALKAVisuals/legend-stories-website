import { readFile, writeFile } from 'node:fs/promises';

const path = 'data/media/product-browser-derivatives.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));

if (manifest.minimumDarkCompositeSsim !== 0.985 || manifest.minimumLightCompositeSsim !== 0.985) {
  throw new Error('Visible composite policy must be applied before derivative tuning.');
}

manifest.wideDisplayMaxDimension = 900;
manifest.standardDisplayMaxDimension = 600;
manifest.minimumNativeCompositeSsim = 0.975;
manifest.minimumWideDisplayCompositeSsim = 0.98;
manifest.minimumStandardDisplayCompositeSsim = 0.985;
delete manifest.minimumDarkCompositeSsim;
delete manifest.minimumLightCompositeSsim;

const QUALITY_OVERRIDES = new Map([
  ['combat-stone-face.html', 96],
  ['combat-beast-within.html', 96],
  ['combat-unstoppable-will.html', 100],
  ['music-unwavering-spirit-music-legend-mural.html', 96],
  ['wisdom-unyielding-drive-combat-legend-mural.html', 96],
  ['music-unapologetic-self-music-legend-mural.html', 96],
  ['music-heart-of-gold-music-legend-mural.html', 96],
  ['combat-courageous-risk.html', 96],
]);

const DIMENSION_OVERRIDES = new Map([
  ['combat-unstoppable-will.html', { maxDimension: 1450, width: 1450, height: 1160 }],
  ['music-heart-of-gold-music-legend-mural.html', { maxDimension: 1700, width: 1700, height: 1096 }],
  ['music-eternal-will.html', { maxDimension: 1600, width: 1530, height: 1600 }],
  ['combat-dream-reality.html', { maxDimension: 1700, width: 1700, height: 1352 }],
  ['music-style-code.html', { maxDimension: 1700, width: 1700, height: 1348 }],
]);

for (const image of manifest.images || []) {
  delete image.encoder;
  const quality = QUALITY_OVERRIDES.get(image.productPage);
  if (quality) image.quality = quality;
  const dimensions = DIMENSION_OVERRIDES.get(image.productPage);
  if (dimensions) Object.assign(image, dimensions);
}

const quality100Count = manifest.images.filter((image) => image.quality === 100).length;
const quality96Count = manifest.images.filter((image) => image.quality === 96).length;
const dimension1450Count = manifest.images.filter((image) => image.maxDimension === 1450).length;
const dimension1600Count = manifest.images.filter((image) => image.maxDimension === 1600).length;
const dimension1700Count = manifest.images.filter((image) => image.maxDimension === 1700).length;
const customEncoderCount = manifest.images.filter((image) => image.encoder).length;

if (quality100Count !== 1 || quality96Count !== 7) {
  throw new Error(`Expected 1 quality-100 and 7 quality-96 derivatives, found ${quality100Count} and ${quality96Count}.`);
}
if (dimension1450Count !== 1 || dimension1600Count !== 1 || dimension1700Count !== 3) {
  throw new Error(
    `Expected 1 1450px, 1 1600px and 3 1700px derivatives, found ${dimension1450Count}, ${dimension1600Count} and ${dimension1700Count}.`,
  );
}
if (customEncoderCount !== 0) {
  throw new Error(`Expected no custom encoder overrides, found ${customEncoderCount}.`);
}

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Tuned ${quality100Count} quality-100, ${quality96Count} quality-96 and five size-sensitive derivatives with native, 900px and 600px validation.`,
);
