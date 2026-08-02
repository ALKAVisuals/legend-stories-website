import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { PRODUCT_BROWSER_DERIVATIVE_MANIFEST } from './lib/product-browser-derivatives.mjs';

const ROOT = process.cwd();

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label}: ${result.stderr.trim()}`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'legendmural-product-webp-'));
try {
  for (const [index, image] of (PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images || []).entries()) {
    const source = join(ROOT, image.source);
    const derivative = join(ROOT, image.derivative);
    const quality = image.quality || PRODUCT_BROWSER_DERIVATIVE_MANIFEST.quality;
    await mkdir(dirname(derivative), { recursive: true });

    if (image.encoder === 'cwebp-sharp') {
      const scaledPng = join(temporaryDirectory, `${String(index).padStart(2, '0')}.png`);
      run('ffmpeg', [
        '-v', 'error',
        '-y',
        '-i', source,
        '-frames:v', '1',
        '-vf', `scale=${image.width}:${image.height}:flags=lanczos,format=rgba`,
        '-map_metadata', '-1',
        scaledPng,
      ], `${image.source} scaling`);
      run('cwebp', [
        '-quiet',
        '-q', String(quality),
        '-alpha_q', '100',
        '-m', String(PRODUCT_BROWSER_DERIVATIVE_MANIFEST.compressionLevel),
        '-mt',
        '-sharp_yuv',
        '-metadata', 'none',
        scaledPng,
        '-o', derivative,
      ], `${image.source} sharp WebP encoding`);
      console.log(
        `${image.source} -> ${image.derivative} (${image.width}x${image.height}, cwebp sharp YUV, quality ${quality})`,
      );
      continue;
    }

    run('ffmpeg', [
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
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log(
  `Generated ${PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images.length} transparent product browser derivatives.`,
);
