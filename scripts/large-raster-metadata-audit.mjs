import { spawnSync } from 'node:child_process';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import {
  calculateRasterMetrics,
  classifyRasterRole,
  isRasterImageExtension,
  pixelFormatSupportsAlpha,
} from './lib/raster-image-metadata.mjs';

const ROOT = process.cwd();
const MEDIA_ROOT = join(ROOT, 'media');
const REPORT_ROOT = join(ROOT, 'reports');
const CONFIG = JSON.parse(
  await readFile(join(ROOT, 'config/media-budgets.json'), 'utf8'),
);
const LARGE_BYTES = CONFIG.repositoryWarnings.largeFileBytes;
const TEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.html', '.js', '.json', '.mjs', '.xml',
]);
const ACTIVE_PREFIXES = ['css/', 'data/', 'js/'];
const IGNORED_DIRECTORIES = new Set([
  '.git', 'dist', 'generated', 'node_modules', 'reports',
]);

function normalizePath(path) {
  return path.split(sep).join('/');
}

function isActiveReferenceSource(path) {
  if (!path.includes('/') && extname(path).toLowerCase() === '.html') return true;
  return ACTIVE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function walk(directory, { ignoreDirectories = true } = {}) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirectories && entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path, { ignoreDirectories }));
    else output.push(path);
  }
  return output;
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function referenceVariants(mediaPath) {
  const encoded = encodeURI(mediaPath);
  const encodedSegments = mediaPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return [...new Set([
    mediaPath,
    encoded,
    encodedSegments,
    mediaPath.replaceAll(' ', '%20'),
  ])];
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let position = 0;
  while (true) {
    const match = source.indexOf(needle, position);
    if (match < 0) return count;
    count += 1;
    position = match + needle.length;
  }
}

function inspectRaster(file) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,width,height,pix_fmt',
    '-of', 'json',
    file,
  ], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`ffprobe is unavailable: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${file}: ${result.stderr.trim()}`);
  }

  const probe = JSON.parse(result.stdout);
  const stream = probe.streams?.[0];
  if (!stream?.width || !stream?.height) {
    throw new Error(`No raster dimensions were detected for ${file}.`);
  }
  return {
    codec: stream.codec_name || '',
    width: Number(stream.width),
    height: Number(stream.height),
    pixelFormat: stream.pix_fmt || '',
  };
}

const [mediaFiles, repositoryFiles] = await Promise.all([
  walk(MEDIA_ROOT, { ignoreDirectories: false }),
  walk(ROOT),
]);

const sourceRecords = [];
for (const file of repositoryFiles) {
  const extension = extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) continue;
  const path = normalizePath(relative(ROOT, file));
  if (!isActiveReferenceSource(path)) continue;
  sourceRecords.push({
    path,
    source: await readFile(file, 'utf8'),
  });
}

const candidates = [];
for (const file of mediaFiles) {
  const extension = extname(file).toLowerCase();
  if (!isRasterImageExtension(extension)) continue;
  const info = await stat(file);
  if (info.size < LARGE_BYTES) continue;

  const path = normalizePath(relative(ROOT, file));
  const variants = referenceVariants(path);
  const activeReferences = [];
  for (const sourceRecord of sourceRecords) {
    let count = 0;
    for (const variant of variants) count += countOccurrences(sourceRecord.source, variant);
    if (count) activeReferences.push({ source: sourceRecord.path, count });
  }
  if (!activeReferences.length) continue;

  const metadata = inspectRaster(resolve(ROOT, path));
  const metrics = calculateRasterMetrics({
    bytes: info.size,
    width: metadata.width,
    height: metadata.height,
  });
  candidates.push({
    path,
    extension: extension.slice(1),
    bytes: info.size,
    role: classifyRasterRole(path),
    activeReferences,
    ...metadata,
    alphaCapable: pixelFormatSupportsAlpha(metadata.pixelFormat),
    ...metrics,
  });
}

candidates.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));
if (!candidates.length) {
  throw new Error('No actively referenced raster images exceed the configured large-file threshold.');
}

const roleCounts = candidates.reduce((result, image) => {
  result[image.role] = (result[image.role] || 0) + 1;
  return result;
}, {});
const totalBytes = candidates.reduce((sum, image) => sum + image.bytes, 0);
const totalMegapixels = candidates.reduce((sum, image) => sum + image.megapixels, 0);
const alphaCapableFiles = candidates.filter((image) => image.alphaCapable).length;
const highDensity = [...candidates]
  .sort((left, right) => right.bytesPerMegapixel - left.bytesPerMegapixel)
  .slice(0, 10);

function referencesLabel(image) {
  return image.activeReferences
    .map((reference) => `${reference.source} (${reference.count})`)
    .join('<br>');
}

const generatedAt = new Date().toISOString();
const markdown = [
  '# Large Active Raster Metadata Audit',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Summary',
  '',
  `- Threshold: ${formatBytes(LARGE_BYTES)}`,
  `- Active raster files above threshold: ${candidates.length}`,
  `- Combined size: ${formatBytes(totalBytes)}`,
  `- Combined decoded pixels: ${totalMegapixels.toFixed(2)} MP`,
  `- Alpha-capable pixel formats: ${alphaCapableFiles}`,
  `- Product source files: ${roleCounts['product-source'] || 0}`,
  `- Marketing files: ${roleCounts.marketing || 0}`,
  `- Brand files: ${roleCounts.brand || 0}`,
  `- Hero files: ${roleCounts.hero || 0}`,
  `- Other files: ${roleCounts.other || 0}`,
  '',
  '## Active files above threshold',
  '',
  '| File | Role | Size | Dimensions | MP | Pixel format | Alpha capable | Bytes/MP | Active references |',
  '|---|---|---:|---:|---:|---|---|---:|---|',
  ...candidates.map((image) => `| \`${image.path}\` | ${image.role} | ${formatBytes(image.bytes)} | ${image.width}×${image.height} | ${image.megapixels.toFixed(2)} | ${image.pixelFormat || image.codec} | ${image.alphaCapable ? 'Yes' : 'No'} | ${formatBytes(image.bytesPerMegapixel)} | ${referencesLabel(image)} |`),
  '',
  '## Highest encoded bytes per megapixel',
  '',
  '| File | Role | Size | MP | Bytes/MP |',
  '|---|---|---:|---:|---:|',
  ...highDensity.map((image) => `| \`${image.path}\` | ${image.role} | ${formatBytes(image.bytes)} | ${image.megapixels.toFixed(2)} | ${formatBytes(image.bytesPerMegapixel)} |`),
  '',
  '## Interpretation',
  '',
  '- These are source files, not automatic deletion or replacement candidates.',
  '- Product and transparent artwork should keep the original asset while browsers receive reviewed WebP/AVIF derivatives.',
  '- Marketing images without alpha are usually the safest first candidates for lossy responsive derivatives.',
  '- Conversion decisions require visual comparison, exact reference updates, and production-output validation.',
  '',
].join('\n');

const json = {
  generatedAt,
  thresholdBytes: LARGE_BYTES,
  summary: {
    activeLargeRasterFiles: candidates.length,
    totalBytes,
    totalMegapixels,
    alphaCapableFiles,
    roleCounts,
  },
  images: candidates,
  highestBytesPerMegapixel: highDensity.map((image) => image.path),
};

await mkdir(REPORT_ROOT, { recursive: true });
await Promise.all([
  writeFile(join(REPORT_ROOT, 'large-raster-metadata.md'), markdown, 'utf8'),
  writeFile(join(REPORT_ROOT, 'large-raster-metadata.json'), JSON.stringify(json, null, 2), 'utf8'),
]);

console.log(
  `Large raster metadata audit completed: ${candidates.length} active files, ${formatBytes(totalBytes)}, ${totalMegapixels.toFixed(2)} MP, alpha-capable=${alphaCapableFiles}.`,
);
for (const image of candidates) {
  console.log(
    `- ${image.path}: ${formatBytes(image.bytes)}, ${image.width}x${image.height}, ${image.megapixels.toFixed(2)} MP, ${image.pixelFormat}, role=${image.role}, alpha=${image.alphaCapable ? 'yes' : 'no'}, refs=${image.activeReferences.length}`,
  );
}
