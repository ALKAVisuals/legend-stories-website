import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { PRODUCT_BROWSER_DERIVATIVE_MANIFEST } from './lib/product-browser-derivatives.mjs';

const ROOT = process.cwd();

function runFfmpeg(args, label) {
  const result = spawnSync('ffmpeg', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.trim()}`);
}

for (const image of PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images || []) {
  const source = join(ROOT, image.source);
  const derivative = join(ROOT, image.derivative);
  const quality = image.quality || PRODUCT_BROWSER_DERIVATIVE_MANIFEST.quality;
  await mkdir(dirname(derivative), { recursive: true });

  runFfmpeg([
    '-v', 'error',
    '-y',
    '-i', source,
    '-frames:v', '1',
    '-vf', `scale=${image.width}:${image.height}:flags=lanczos`,
    '-c:v', 'libwebp',
    '-quality', String(quality),
    '-compression_level', String(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.compressionLevel),
    '-preset', 'drawing',
    '-pix_fmt', 'yuva420p',
    '-map_metadata', '-1',
    derivative,
  ], image.source);

  console.log(`${image.source} -> ${image.derivative} (${image.width}x${image.height}, quality ${quality})`);
}

console.log(
  `Generated ${PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images.length} transparent product browser derivatives.`,
);
