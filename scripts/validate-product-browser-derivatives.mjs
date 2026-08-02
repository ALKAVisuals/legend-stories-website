import { spawnSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { extname, join } from 'node:path';

import {
  PRODUCT_BROWSER_DERIVATIVE_MANIFEST,
  browserProductImageFor,
  calculateDerivativeDimensions,
  calculateSizeRatio,
  normalizeProductImagePath,
  parseSsimScore,
} from './lib/product-browser-derivatives.mjs';
import { pixelFormatSupportsAlpha } from './lib/raster-image-metadata.mjs';

const ROOT = process.cwd();
const REPORT_ROOT = join(ROOT, 'reports');
const manifest = PRODUCT_BROWSER_DERIVATIVE_MANIFEST;
const errors = [];
const records = [];
const COMPOSITE_BACKGROUNDS = Object.freeze({
  dark: '0x09090b',
  light: '0xf5f5f5',
});

function formatBytes(bytes) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.trim()}`);
  return result;
}

function inspectImage(path) {
  const result = run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,pix_fmt',
    '-of', 'json',
    path,
  ], path);
  const stream = JSON.parse(result.stdout).streams?.[0];
  if (!stream) throw new Error(`${path}: ffprobe returned no image stream.`);
  return {
    codec: stream.codec_name || '',
    width: Number(stream.width),
    height: Number(stream.height),
    pixelFormat: stream.pix_fmt || '',
  };
}

function measureCompositeSsim(source, derivative, width, height, background, label) {
  const filter = [
    `color=c=${background}:s=${width}x${height}:d=1[background]`,
    '[background]split=2[sourceBackground][derivativeBackground]',
    `[0:v]scale=${width}:${height}:flags=lanczos,format=rgba[source]`,
    '[1:v]format=rgba[derivative]',
    '[sourceBackground][source]overlay=shortest=1:format=auto,format=yuv444p[sourceComposite]',
    '[derivativeBackground][derivative]overlay=shortest=1:format=auto,format=yuv444p[derivativeComposite]',
    '[sourceComposite][derivativeComposite]ssim',
  ].join(';');
  const result = run('ffmpeg', [
    '-v', 'info',
    '-i', source,
    '-i', derivative,
    '-filter_complex', filter,
    '-frames:v', '1',
    '-f', 'null',
    '-',
  ], `${source} ${label} composite SSIM`);
  return parseSsimScore(`${result.stdout}\n${result.stderr}`);
}

if (manifest.schemaVersion !== 1) errors.push('Product browser derivative schemaVersion must be 1.');
if (manifest.format !== 'webp') errors.push('Product browser derivatives must use WebP.');
if (!Number.isFinite(manifest.minimumDarkCompositeSsim)) {
  errors.push('Product browser derivative manifest requires minimumDarkCompositeSsim.');
}
if (!Number.isFinite(manifest.minimumLightCompositeSsim)) {
  errors.push('Product browser derivative manifest requires minimumLightCompositeSsim.');
}
if (!Array.isArray(manifest.images) || manifest.images.length !== 21) {
  errors.push(`Product browser derivative manifest must contain exactly 21 images; found ${manifest.images?.length || 0}.`);
}

const sourceSet = new Set();
const derivativeSet = new Set();
const pageSet = new Set();
for (const image of manifest.images || []) {
  const source = normalizeProductImagePath(image.source);
  const derivative = normalizeProductImagePath(image.derivative);
  if (!source || !derivative || !image.productPage) {
    errors.push('Every product browser derivative entry requires source, derivative and productPage.');
    continue;
  }
  if (sourceSet.has(source)) errors.push(`${source}: duplicate derivative source.`);
  if (derivativeSet.has(derivative)) errors.push(`${derivative}: duplicate derivative output.`);
  if (pageSet.has(image.productPage)) errors.push(`${image.productPage}: duplicate derivative product page.`);
  sourceSet.add(source);
  derivativeSet.add(derivative);
  pageSet.add(image.productPage);

  const expectedDimensions = calculateDerivativeDimensions(
    image.sourceWidth,
    image.sourceHeight,
    image.maxDimension || manifest.maxDimension,
  );
  if (expectedDimensions.width !== image.width || expectedDimensions.height !== image.height) {
    errors.push(`${source}: manifest target ${image.width}x${image.height} differs from calculated ${expectedDimensions.width}x${expectedDimensions.height}.`);
  }
  if (browserProductImageFor(source) !== derivative) {
    errors.push(`${source}: central browser image resolver does not return ${derivative}.`);
  }
}

const htmlFiles = (await readdir(ROOT))
  .filter((file) => extname(file).toLowerCase() === '.html')
  .sort();
const htmlByFile = new Map(
  await Promise.all(htmlFiles.map(async (file) => [file, await readFile(join(ROOT, file), 'utf8')])),
);
let runtimeRegistry = null;
try {
  runtimeRegistry = JSON.parse(
    await readFile(join(ROOT, 'generated/public/data/product-registry.json'), 'utf8'),
  );
} catch (error) {
  errors.push(`Runtime product registry is unavailable: ${error.message}`);
}
const runtimeByPage = new Map(
  (runtimeRegistry?.products || []).map((product) => [product.page, product]),
);

for (const image of manifest.images || []) {
  try {
    const sourcePath = normalizeProductImagePath(image.source);
    const derivativePath = normalizeProductImagePath(image.derivative);
    const [sourceInfo, derivativeInfo, sourceStat, derivativeStat] = await Promise.all([
      Promise.resolve(inspectImage(sourcePath)),
      Promise.resolve(inspectImage(derivativePath)),
      stat(join(ROOT, sourcePath)),
      stat(join(ROOT, derivativePath)),
    ]);
    const sizeRatio = calculateSizeRatio(sourceStat.size, derivativeStat.size);
    const darkCompositeSsim = measureCompositeSsim(
      sourcePath,
      derivativePath,
      image.width,
      image.height,
      COMPOSITE_BACKGROUNDS.dark,
      'dark',
    );
    const lightCompositeSsim = measureCompositeSsim(
      sourcePath,
      derivativePath,
      image.width,
      image.height,
      COMPOSITE_BACKGROUNDS.light,
      'light',
    );
    const maximumSizeRatio = image.maximumSizeRatio || manifest.maximumSizeRatio;

    if (sourceInfo.width !== image.sourceWidth || sourceInfo.height !== image.sourceHeight) {
      errors.push(`${sourcePath}: source dimensions changed from ${image.sourceWidth}x${image.sourceHeight}.`);
    }
    if (derivativeInfo.width !== image.width || derivativeInfo.height !== image.height) {
      errors.push(`${derivativePath}: derivative dimensions are ${derivativeInfo.width}x${derivativeInfo.height}; expected ${image.width}x${image.height}.`);
    }
    if (derivativeInfo.codec !== 'webp') {
      errors.push(`${derivativePath}: expected WebP codec, found ${derivativeInfo.codec || 'unknown'}.`);
    }
    if (!pixelFormatSupportsAlpha(sourceInfo.pixelFormat)) {
      errors.push(`${sourcePath}: source pixel format ${sourceInfo.pixelFormat || 'unknown'} is not alpha-capable.`);
    }
    if (!pixelFormatSupportsAlpha(derivativeInfo.pixelFormat)) {
      errors.push(`${derivativePath}: derivative pixel format ${derivativeInfo.pixelFormat || 'unknown'} is not alpha-capable.`);
    }
    if (sizeRatio > maximumSizeRatio) {
      errors.push(`${derivativePath}: size ratio ${sizeRatio.toFixed(4)} exceeds ${maximumSizeRatio}.`);
    }
    if (darkCompositeSsim < manifest.minimumDarkCompositeSsim) {
      errors.push(`${derivativePath}: dark composite SSIM ${darkCompositeSsim.toFixed(6)} is below ${manifest.minimumDarkCompositeSsim}.`);
    }
    if (lightCompositeSsim < manifest.minimumLightCompositeSsim) {
      errors.push(`${derivativePath}: light composite SSIM ${lightCompositeSsim.toFixed(6)} is below ${manifest.minimumLightCompositeSsim}.`);
    }

    const productHtml = htmlByFile.get(image.productPage) || '';
    if (!productHtml) errors.push(`${image.productPage}: product page is missing.`);
    const sourceCount = countOccurrences(productHtml, sourcePath);
    if (sourceCount !== 1) {
      errors.push(`${image.productPage}: expected exactly one original source reference in Product JSON-LD, found ${sourceCount}.`);
    }
    const heroPattern = new RegExp(`<img\\b[^>]*\\bsrc="${escapeRegExp(derivativePath)}"[^>]*\\bdata-product-hero="true"`, 'i');
    if (!heroPattern.test(productHtml)) {
      errors.push(`${image.productPage}: product hero does not use ${derivativePath}.`);
    }
    const cartPattern = new RegExp(`\\bdata-img="${escapeRegExp(derivativePath)}"`, 'i');
    if (!cartPattern.test(productHtml)) {
      errors.push(`${image.productPage}: add-to-cart image does not use ${derivativePath}.`);
    }
    const socialPattern = new RegExp(`<meta\\s+(?:property="og:image"|name="twitter:image")\\s+content="[^"]*${escapeRegExp(derivativePath)}"`, 'gi');
    const socialCount = [...productHtml.matchAll(socialPattern)].length;
    if (socialCount !== 2) {
      errors.push(`${image.productPage}: expected two social image references to ${derivativePath}, found ${socialCount}.`);
    }

    let sourceBrowserReferences = 0;
    let derivativeBrowserReferences = 0;
    for (const html of htmlByFile.values()) {
      sourceBrowserReferences += [...html.matchAll(new RegExp(`(?:src|data-img)="${escapeRegExp(sourcePath)}"`, 'g'))].length;
      derivativeBrowserReferences += [...html.matchAll(new RegExp(`(?:src|data-img)="${escapeRegExp(derivativePath)}"`, 'g'))].length;
    }
    if (sourceBrowserReferences !== 0) {
      errors.push(`${sourcePath}: ${sourceBrowserReferences} browser-delivered src/data-img reference(s) remain.`);
    }
    if (derivativeBrowserReferences < 2) {
      errors.push(`${derivativePath}: expected at least hero and cart browser references, found ${derivativeBrowserReferences}.`);
    }

    const runtimeProduct = runtimeByPage.get(image.productPage);
    if (!runtimeProduct) {
      errors.push(`${image.productPage}: product is missing from the runtime registry.`);
    } else if (normalizeProductImagePath(runtimeProduct.image) !== derivativePath) {
      errors.push(`${image.productPage}: runtime image is ${runtimeProduct.image}; expected ${derivativePath}.`);
    }

    records.push({
      ...image,
      sourceBytes: sourceStat.size,
      derivativeBytes: derivativeStat.size,
      savedBytes: sourceStat.size - derivativeStat.size,
      sizeRatio,
      maximumSizeRatio,
      reductionPercent: (1 - sizeRatio) * 100,
      darkCompositeSsim,
      lightCompositeSsim,
      sourcePixelFormat: sourceInfo.pixelFormat,
      derivativePixelFormat: derivativeInfo.pixelFormat,
      derivativeBrowserReferences,
    });
  } catch (error) {
    errors.push(`${image.source}: ${error.message}`);
  }
}

const sourceBytes = records.reduce((sum, record) => sum + record.sourceBytes, 0);
const derivativeBytes = records.reduce((sum, record) => sum + record.derivativeBytes, 0);
const savedBytes = sourceBytes - derivativeBytes;
const generatedAt = new Date().toISOString();
const markdown = [
  '# Product Browser Derivative Validation',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Summary',
  '',
  `- Transparent product sources: ${records.length}`,
  `- Original source bytes: ${formatBytes(sourceBytes)}`,
  `- Browser WebP bytes: ${formatBytes(derivativeBytes)}`,
  `- Potential transfer reduction: ${formatBytes(savedBytes)} (${sourceBytes ? ((savedBytes / sourceBytes) * 100).toFixed(2) : '0.00'}%)`,
  `- Default maximum browser dimension: ${manifest.maxDimension}px`,
  `- Minimum dark-background composite SSIM: ${manifest.minimumDarkCompositeSsim}`,
  `- Minimum light-background composite SSIM: ${manifest.minimumLightCompositeSsim}`,
  `- Validation errors: ${errors.length}`,
  '',
  '## Files',
  '',
  '| Source | Browser derivative | Source size | Browser size | Reduction | Dark SSIM | Light SSIM | Dimensions | Browser refs |',
  '|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ...records.map((record) => `| \`${record.source}\` | \`${record.derivative}\` | ${formatBytes(record.sourceBytes)} | ${formatBytes(record.derivativeBytes)} | ${record.reductionPercent.toFixed(2)}% | ${record.darkCompositeSsim.toFixed(6)} | ${record.lightCompositeSsim.toFixed(6)} | ${record.width}×${record.height} | ${record.derivativeBrowserReferences} |`),
  '',
  '## Policy',
  '',
  '- Original transparent PNG files remain committed as print/source assets and Product JSON-LD references.',
  '- Browser-facing product heroes, cards, cart thumbnails, social previews and related products use reviewed WebP derivatives when available.',
  '- Visual similarity is measured after compositing source and derivative over dark and light backgrounds, matching actual browser rendering and ignoring hidden RGB beneath fully transparent pixels.',
  '- Derivatives must retain an alpha-capable pixel format, stay within the size ratio budget and pass both composite SSIM thresholds.',
  '- Regeneration must use the committed manifest and generator.',
  '',
  ...(errors.length ? ['## Errors', '', ...errors.map((error) => `- ${error}`), ''] : []),
].join('\n');

await mkdir(REPORT_ROOT, { recursive: true });
await Promise.all([
  writeFile(join(REPORT_ROOT, 'product-browser-derivatives.md'), markdown, 'utf8'),
  writeFile(join(REPORT_ROOT, 'product-browser-derivatives.json'), `${JSON.stringify({
    generatedAt,
    summary: {
      images: records.length,
      sourceBytes,
      derivativeBytes,
      savedBytes,
      reductionPercent: sourceBytes ? (savedBytes / sourceBytes) * 100 : 0,
      errors: errors.length,
    },
    manifest: {
      maxDimension: manifest.maxDimension,
      quality: manifest.quality,
      compressionLevel: manifest.compressionLevel,
      minimumDarkCompositeSsim: manifest.minimumDarkCompositeSsim,
      minimumLightCompositeSsim: manifest.minimumLightCompositeSsim,
      maximumSizeRatio: manifest.maximumSizeRatio,
    },
    backgrounds: COMPOSITE_BACKGROUNDS,
    images: records,
    errors,
  }, null, 2)}\n`, 'utf8'),
]);

if (errors.length) {
  console.error('Product browser derivative validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Product browser derivative validation passed for ${records.length} images: ${formatBytes(sourceBytes)} -> ${formatBytes(derivativeBytes)} (${((savedBytes / sourceBytes) * 100).toFixed(2)}% reduction).`,
);
for (const record of records) {
  console.log(
    `- ${record.source}: ${record.reductionPercent.toFixed(2)}% smaller, dark SSIM=${record.darkCompositeSsim.toFixed(6)}, light SSIM=${record.lightCompositeSsim.toFixed(6)}.`,
  );
}
