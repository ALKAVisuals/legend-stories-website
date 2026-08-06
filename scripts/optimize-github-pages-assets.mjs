import { spawn } from 'node:child_process';
import {
  access,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  extname,
  join,
  relative,
} from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');
const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.json']);
const MIN_SOURCE_BYTES = 64 * 1024;
const MIN_SAVING_RATIO = 0.08;
const MAX_PAGES_OUTPUT_BYTES = 50 * 1024 * 1024;

export function validatePagesBasePath(value) {
  const normalized = String(value || '').trim();
  if (!/^\/[A-Za-z0-9._~-]+\/$/.test(normalized)) {
    throw new Error('GITHUB_PAGES_BASE_PATH must contain one safe repository path.');
  }
  return normalized;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolutePath));
    else if (entry.isFile()) files.push(absolutePath);
  }

  return files;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

async function outputBytes(directory) {
  const files = await walk(directory);
  let bytes = 0;
  for (const file of files) bytes += (await stat(file)).size;
  return bytes;
}

function replacementTargetName(sourceName, suffix = '') {
  const extension = extname(sourceName);
  return `${sourceName.slice(0, -extension.length)}${suffix}.webp`;
}

async function convertAsset(sourcePath) {
  const sourceInfo = await stat(sourcePath);
  if (sourceInfo.size < MIN_SOURCE_BYTES) return null;

  const sourceName = basename(sourcePath);
  let targetName = replacementTargetName(sourceName);
  let targetPath = join(ASSETS, targetName);
  if (await fileExists(targetPath)) {
    targetName = replacementTargetName(sourceName, '-pages');
    targetPath = join(ASSETS, targetName);
  }

  await run('cwebp', [
    '-quiet',
    '-mt',
    '-m', '6',
    '-q', '86',
    '-alpha_q', '100',
    '-sharp_yuv',
    '-metadata', 'none',
    sourcePath,
    '-o', targetPath,
  ]);

  const targetInfo = await stat(targetPath);
  const savingRatio = 1 - (targetInfo.size / sourceInfo.size);
  if (savingRatio < MIN_SAVING_RATIO) {
    await unlink(targetPath);
    return null;
  }

  return Object.freeze({
    sourcePath,
    sourceName,
    sourceBytes: sourceInfo.size,
    targetPath,
    targetName,
    targetBytes: targetInfo.size,
    savingRatio,
  });
}

export function rewriteAssetReferences(source, replacements) {
  let updated = String(source);
  for (const replacement of replacements) {
    updated = updated.replaceAll(replacement.sourceName, replacement.targetName);
  }
  return updated;
}

async function rewriteTextReferences(replacements) {
  const textFiles = (await walk(DIST)).filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()));
  let changedFiles = 0;

  for (const file of textFiles) {
    const source = await readFile(file, 'utf8');
    const updated = rewriteAssetReferences(source, replacements);
    if (updated !== source) {
      await writeFile(file, updated, 'utf8');
      changedFiles += 1;
    }
  }

  for (const file of textFiles) {
    const source = await readFile(file, 'utf8');
    for (const replacement of replacements) {
      if (source.includes(replacement.sourceName)) {
        throw new Error(`${relative(DIST, file)} still references ${replacement.sourceName}.`);
      }
    }
  }

  return changedFiles;
}

async function main() {
  const basePath = validatePagesBasePath(process.env.GITHUB_PAGES_BASE_PATH);
  await access(ASSETS);
  await run('cwebp', ['-version']);

  const beforeBytes = await outputBytes(DIST);
  const assetFiles = (await walk(ASSETS)).filter((file) => SOURCE_EXTENSIONS.has(extname(file).toLowerCase()));
  const replacements = [];

  for (const assetFile of assetFiles) {
    const replacement = await convertAsset(assetFile);
    if (replacement) replacements.push(replacement);
  }

  if (replacements.length === 0) {
    throw new Error('GitHub Pages optimization did not produce any useful WebP replacements.');
  }

  const changedTextFiles = await rewriteTextReferences(replacements);
  for (const replacement of replacements) await unlink(replacement.sourcePath);

  const afterBytes = await outputBytes(DIST);
  const savedBytes = beforeBytes - afterBytes;
  if (savedBytes <= 0) {
    throw new Error('GitHub Pages optimization did not reduce the output size.');
  }
  if (afterBytes > MAX_PAGES_OUTPUT_BYTES) {
    throw new Error(
      `Optimized GitHub Pages output is ${(afterBytes / 1024 / 1024).toFixed(1)} MiB; maximum is 50 MiB.`,
    );
  }

  console.log(`Optimized GitHub Pages output for ${basePath}.`);
  console.log(`Converted ${replacements.length} raster assets and rewrote ${changedTextFiles} text files.`);
  console.log(
    `Output reduced from ${(beforeBytes / 1024 / 1024).toFixed(1)} MiB to ${(afterBytes / 1024 / 1024).toFixed(1)} MiB ` +
    `(${(savedBytes / 1024 / 1024).toFixed(1)} MiB saved).`,
  );
}

const executedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  main().catch((error) => {
    console.error('GitHub Pages asset optimization failed:', error);
    process.exit(1);
  });
}
