import { spawnSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import {
  buildMarketingBackgroundDeclarations,
  calculateSizeRatio,
  parseSsimScore,
} from './lib/marketing-image-derivatives.mjs';

const ROOT = process.cwd();
const REPORT_ROOT = join(ROOT, 'reports');
const manifest = JSON.parse(
  await readFile(join(ROOT, 'data/media/homepage-marketing-derivatives.json'), 'utf8'),
);
const html = await readFile(join(ROOT, manifest.page), 'utf8');
const errors = [];
const records = [];

function formatBytes(bytes) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
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

function measureSsim(source, derivative) {
  const result = run('ffmpeg', [
    '-v', 'info',
    '-i', source,
    '-i', derivative,
    '-filter_complex', '[0:v]format=yuv444p[reference];[1:v]format=yuv444p[derivative];[reference][derivative]ssim',
    '-f', 'null',
    '-',
  ], `${source} SSIM`);
  return parseSsimScore(`${result.stdout}\n${result.stderr}`);
}

for (const image of manifest.images || []) {
  try {
    const [sourceInfo, derivativeInfo, sourceStat, derivativeStat] = await Promise.all([
      Promise.resolve(inspectImage(image.source)),
      Promise.resolve(inspectImage(image.derivative)),
      stat(join(ROOT, image.source)),
      stat(join(ROOT, image.derivative)),
    ]);
    const sizeRatio = calculateSizeRatio(sourceStat.size, derivativeStat.size);
    const ssim = measureSsim(image.source, image.derivative);
    const expectedMarkup = buildMarketingBackgroundDeclarations(image.source, image.derivative);
    const markupCount = html.split(expectedMarkup).length - 1;

    if (sourceInfo.width !== image.width || sourceInfo.height !== image.height) {
      errors.push(`${image.source}: source dimensions changed from ${image.width}x${image.height}.`);
    }
    if (derivativeInfo.width !== image.width || derivativeInfo.height !== image.height) {
      errors.push(`${image.derivative}: derivative dimensions are ${derivativeInfo.width}x${derivativeInfo.height}.`);
    }
    if (derivativeInfo.codec !== 'webp') {
      errors.push(`${image.derivative}: expected WebP codec, found ${derivativeInfo.codec || 'unknown'}.`);
    }
    if (sizeRatio > manifest.maximumSizeRatio) {
      errors.push(`${image.derivative}: size ratio ${sizeRatio.toFixed(4)} exceeds ${manifest.maximumSizeRatio}.`);
    }
    if (ssim < manifest.minimumSsim) {
      errors.push(`${image.derivative}: SSIM ${ssim.toFixed(6)} is below ${manifest.minimumSsim}.`);
    }
    if (markupCount !== 1) {
      errors.push(`${manifest.page}: expected one WebP-first fallback declaration for ${image.source}, found ${markupCount}.`);
    }

    records.push({
      ...image,
      sourceBytes: sourceStat.size,
      derivativeBytes: derivativeStat.size,
      savedBytes: sourceStat.size - derivativeStat.size,
      sizeRatio,
      reductionPercent: (1 - sizeRatio) * 100,
      ssim,
      sourcePixelFormat: sourceInfo.pixelFormat,
      derivativePixelFormat: derivativeInfo.pixelFormat,
      markupCount,
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
  '# Homepage Marketing WebP Validation',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Summary',
  '',
  `- Images: ${records.length}`,
  `- PNG fallback bytes: ${formatBytes(sourceBytes)}`,
  `- Preferred WebP bytes: ${formatBytes(derivativeBytes)}`,
  `- Potential browser transfer reduction: ${formatBytes(savedBytes)} (${sourceBytes ? ((savedBytes / sourceBytes) * 100).toFixed(2) : '0.00'}%)`,
  `- Minimum required SSIM: ${manifest.minimumSsim}`,
  `- Maximum allowed derivative ratio: ${manifest.maximumSizeRatio}`,
  `- Validation errors: ${errors.length}`,
  '',
  '## Files',
  '',
  '| Source | WebP | PNG size | WebP size | Reduction | SSIM | Dimensions |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...records.map((record) => `| \`${record.source}\` | \`${record.derivative}\` | ${formatBytes(record.sourceBytes)} | ${formatBytes(record.derivativeBytes)} | ${record.reductionPercent.toFixed(2)}% | ${record.ssim.toFixed(6)} | ${record.width}×${record.height} |`),
  '',
  '## Policy',
  '',
  '- Original PNG files remain available as CSS fallbacks and source assets.',
  '- WebP derivatives must retain the source dimensions and pass the SSIM threshold.',
  '- The homepage must contain exactly one WebP-first image-set declaration per source.',
  '- Any future regeneration must use the committed manifest and generator.',
  '',
  ...(errors.length ? ['## Errors', '', ...errors.map((error) => `- ${error}`), ''] : []),
].join('\n');

await mkdir(REPORT_ROOT, { recursive: true });
await Promise.all([
  writeFile(join(REPORT_ROOT, 'homepage-marketing-webp.md'), markdown, 'utf8'),
  writeFile(join(REPORT_ROOT, 'homepage-marketing-webp.json'), JSON.stringify({
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
      quality: manifest.quality,
      compressionLevel: manifest.compressionLevel,
      minimumSsim: manifest.minimumSsim,
      maximumSizeRatio: manifest.maximumSizeRatio,
    },
    images: records,
    errors,
  }, null, 2), 'utf8'),
]);

if (errors.length) {
  console.error('Homepage marketing WebP validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Homepage marketing WebP validation passed for ${records.length} images: ${formatBytes(sourceBytes)} -> ${formatBytes(derivativeBytes)} (${((savedBytes / sourceBytes) * 100).toFixed(2)}% reduction).`,
);
for (const record of records) {
  console.log(`- ${record.source}: ${record.reductionPercent.toFixed(2)}% smaller, SSIM=${record.ssim.toFixed(6)}.`);
}
