import { spawn } from 'node:child_process';
import { readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');
const TEXT_EXTENSIONS = new Set(['.html', '.json', '.css', '.js', '.mjs']);
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 84;
const WEBP_COMPRESSION_LEVEL = 1;
const CONCURRENCY = 8;

export const MIN_PNG_BYTES = 500_000;
export const MAX_ASSET_BYTES = 45_000_000;

export function isPagesOptimizationCandidate(name = '', bytes = 0) {
  return /\.png$/i.test(String(name)) && Number(bytes) >= MIN_PNG_BYTES;
}

export function replacementVariants(fromName, toName) {
  const source = String(fromName || '');
  const target = String(toName || '');
  if (!source || !target) throw new Error('Asset replacement names must be non-empty.');
  return [
    { from: source, to: target },
    { from: encodeURIComponent(source), to: encodeURIComponent(target) },
  ];
}

export function rewriteAssetReferences(content, replacements = []) {
  let updated = String(content);
  for (const replacement of replacements) {
    for (const variant of replacementVariants(replacement.from, replacement.to)) {
      updated = updated.split(variant.from).join(variant.to);
    }
  }
  return updated;
}

export function assertAssetBudget(bytes, limit = MAX_ASSET_BYTES) {
  const total = Number(bytes);
  const maximum = Number(limit);
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(maximum) || maximum <= 0) {
    throw new Error('GitHub Pages asset budget requires valid positive byte values.');
  }
  if (total > maximum) {
    throw new Error(
      `GitHub Pages assets exceed the ${maximum}-byte budget: ${total} bytes.`,
    );
  }
  return total;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

function runFfmpeg(source, output) {
  const scaleFilter =
    `scale=if(gt(iw\\,ih)\\,min(iw\\,${MAX_DIMENSION})\\,-2):` +
    `if(gt(iw\\,ih)\\,-2\\,min(ih\\,${MAX_DIMENSION})):flags=lanczos`;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('ffmpeg', [
      '-v', 'error',
      '-y',
      '-i', source,
      '-frames:v', '1',
      '-vf', scaleFilter,
      '-c:v', 'libwebp',
      '-quality', String(WEBP_QUALITY),
      '-compression_level', String(WEBP_COMPRESSION_LEVEL),
      '-preset', 'drawing',
      '-pix_fmt', 'yuva420p',
      '-map_metadata', '-1',
      output,
    ], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 1024 * 1024) stderr = stderr.slice(-1024 * 1024);
    });
    child.on('error', (error) => rejectPromise(error));
    child.on('close', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(stderr.trim() || `ffmpeg exited with code ${code}.`));
    });
  });
}

async function mapWithConcurrency(items, worker, concurrency = CONCURRENCY) {
  let cursor = 0;
  const results = new Array(items.length);
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function optimizeAsset(candidate) {
  const sourcePath = join(ASSETS, candidate.name);
  const outputName = candidate.name.replace(/\.png$/i, '.webp');
  const outputPath = join(ASSETS, outputName);

  await runFfmpeg(sourcePath, outputPath);
  const outputInfo = await stat(outputPath);
  if (!outputInfo.isFile() || outputInfo.size <= 0) {
    throw new Error(`${candidate.name}: WebP output is missing or empty.`);
  }

  if (outputInfo.size >= candidate.bytes) {
    await unlink(outputPath);
    return null;
  }

  await unlink(sourcePath);
  return {
    from: candidate.name,
    to: outputName,
    sourceBytes: candidate.bytes,
    outputBytes: outputInfo.size,
  };
}

async function rewriteBuiltReferences(replacements) {
  const files = (await walk(DIST)).filter((file) => TEXT_EXTENSIONS.has(extname(file)));
  let changedFiles = 0;

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const updated = rewriteAssetReferences(source, replacements);
    if (updated !== source) {
      await writeFile(file, updated, 'utf8');
      changedFiles += 1;
    }
  }

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const replacement of replacements) {
      for (const variant of replacementVariants(replacement.from, replacement.to)) {
        if (source.includes(variant.from)) {
          throw new Error(`${file}: stale Pages asset reference remains: ${variant.from}`);
        }
      }
    }
  }

  return changedFiles;
}

async function totalAssetBytes() {
  const files = await walk(ASSETS);
  let total = 0;
  for (const file of files) total += (await stat(file)).size;
  return total;
}

async function main() {
  const entries = await readdir(ASSETS, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    const info = await stat(join(ASSETS, entry.name));
    if (isPagesOptimizationCandidate(entry.name, info.size)) {
      candidates.push({ name: entry.name, bytes: info.size });
    }
  }

  const optimized = (await mapWithConcurrency(candidates, optimizeAsset)).filter(Boolean);
  const changedFiles = await rewriteBuiltReferences(optimized);
  const bytes = assertAssetBudget(await totalAssetBytes());
  const sourceBytes = optimized.reduce((sum, item) => sum + item.sourceBytes, 0);
  const outputBytes = optimized.reduce((sum, item) => sum + item.outputBytes, 0);

  console.log(
    `Optimized ${optimized.length} GitHub Pages PNG assets to WebP, ` +
    `rewrote ${changedFiles} built files and saved ${sourceBytes - outputBytes} bytes.`,
  );
  console.log(`GitHub Pages assets total ${bytes} bytes within the ${MAX_ASSET_BYTES}-byte budget.`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error('GitHub Pages asset optimization failed:', error);
    process.exit(1);
  });
}
