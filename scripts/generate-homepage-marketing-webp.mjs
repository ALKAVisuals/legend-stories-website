import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { applyMarketingBackgroundDerivative } from './lib/marketing-image-derivatives.mjs';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'data/media/homepage-marketing-derivatives.json');
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

function runFfmpeg(args, label) {
  const result = spawnSync('ffmpeg', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${label}: ${result.stderr.trim()}`);
  }
}

for (const image of manifest.images || []) {
  const source = join(ROOT, image.source);
  const derivative = join(ROOT, image.derivative);
  await mkdir(dirname(derivative), { recursive: true });

  runFfmpeg([
    '-v', 'error',
    '-y',
    '-i', source,
    '-frames:v', '1',
    '-c:v', 'libwebp',
    '-quality', String(manifest.quality),
    '-compression_level', String(manifest.compressionLevel),
    '-preset', 'picture',
    '-map_metadata', '-1',
    derivative,
  ], image.source);
  console.log(`${image.source} -> ${image.derivative}`);
}

const pagePath = join(ROOT, manifest.page);
let html = await readFile(pagePath, 'utf8');
for (const image of manifest.images || []) {
  html = applyMarketingBackgroundDerivative(html, image);
}
await writeFile(pagePath, html, 'utf8');
console.log(`Updated ${manifest.page} with WebP-first image-set backgrounds and PNG fallbacks.`);
