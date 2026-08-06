import { createHash } from 'node:crypto';
import { cp, copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'js');
const TARGET = join(ROOT, 'dist/js');
const COLLECTION_VIDEO_MANIFEST_PATH = join(ROOT, 'data/video/collection-video-optimization.json');
const PRODUCT_DERIVATIVE_MANIFEST_PATH = join(ROOT, 'data/media/product-browser-derivatives.json');
const RELATED_PRODUCTS_STYLES_PATH = 'css/related-products.css';

function safeRepositoryPath(value, label) {
  const normalized = normalize(String(value || '')).replaceAll('\\', '/');
  if (!normalized
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.startsWith('/')
    || !normalized.startsWith('media/welcome/')) {
    throw new Error(`${label} is outside the approved media/welcome directory.`);
  }
  return normalized;
}

function safeDynamicAssetPath(value, label) {
  const normalized = normalize(String(value || '')).replaceAll('\\', '/');
  const approved = normalized === RELATED_PRODUCTS_STYLES_PATH
    || normalized.startsWith('media/browser-products/');
  if (!normalized
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.startsWith('/')
    || !approved) {
    throw new Error(`${label} is outside the approved dynamic storefront asset paths.`);
  }
  return normalized;
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function copyManifestAsset(path, expected) {
  const sourcePath = join(ROOT, path);
  const targetPath = join(ROOT, 'dist', path);
  const sourceInfo = await stat(sourcePath);

  if (!sourceInfo.isFile()) {
    throw new Error(`${path}: deferred delivery source is not a file.`);
  }
  if (sourceInfo.size !== expected.bytes) {
    throw new Error(`${path}: deferred delivery source size differs from the manifest.`);
  }
  if (await sha256(sourcePath) !== expected.sha256) {
    throw new Error(`${path}: deferred delivery source hash differs from the manifest.`);
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);

  const outputInfo = await stat(targetPath);
  if (outputInfo.size !== sourceInfo.size || await sha256(targetPath) !== expected.sha256) {
    throw new Error(`${path}: copied production asset failed integrity validation.`);
  }
  return relative(ROOT, targetPath).replaceAll('\\', '/');
}

async function copyRepositoryAsset(path) {
  const sourcePath = join(ROOT, path);
  const targetPath = join(ROOT, 'dist', path);
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) {
    throw new Error(`${path}: dynamic storefront asset is not a file.`);
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);

  const outputInfo = await stat(targetPath);
  const sourceHash = await sha256(sourcePath);
  if (outputInfo.size !== sourceInfo.size || await sha256(targetPath) !== sourceHash) {
    throw new Error(`${path}: copied dynamic storefront asset failed integrity validation.`);
  }
  return relative(ROOT, targetPath).replaceAll('\\', '/');
}

async function copyDeferredCollectionMedia() {
  const manifest = JSON.parse(await readFile(COLLECTION_VIDEO_MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(manifest.videos) || manifest.videos.length !== 2) {
    throw new Error('Collection video manifest must contain exactly two approved videos.');
  }

  const copied = [];
  for (const entry of manifest.videos) {
    const videoPath = safeRepositoryPath(entry.path, `${entry.id} video path`);
    const posterPath = safeRepositoryPath(entry.poster, `${entry.id} poster path`);
    copied.push(await copyManifestAsset(videoPath, entry.output));
    copied.push(await copyManifestAsset(posterPath, entry.posterOutput));
  }
  return copied;
}

async function copyDynamicStorefrontAssets() {
  const manifest = JSON.parse(await readFile(PRODUCT_DERIVATIVE_MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(manifest.images) || manifest.images.length < 100) {
    throw new Error('Product browser derivative manifest must contain the complete storefront catalog.');
  }

  const paths = new Set([RELATED_PRODUCTS_STYLES_PATH]);
  for (const entry of manifest.images) {
    paths.add(safeDynamicAssetPath(entry.derivative, `${entry.productPage || 'product'} derivative`));
  }

  const copied = [];
  for (const path of paths) {
    copied.push(await copyRepositoryAsset(path));
  }
  return copied;
}

async function main() {
  await mkdir(TARGET, { recursive: true });
  await cp(SOURCE, TARGET, { recursive: true, force: true });
  const copiedMedia = await copyDeferredCollectionMedia();
  const copiedDynamicAssets = await copyDynamicStorefrontAssets();

  console.log('Copied classic JavaScript and browser modules to dist/js/.');
  console.log(`Copied ${copiedMedia.length} manifest-approved deferred media assets:`);
  copiedMedia.forEach((path) => console.log(`- ${path}`));
  console.log(`Copied ${copiedDynamicAssets.length} dynamic storefront assets.`);
}

main().catch((error) => {
  console.error('Failed to copy browser runtime files:', error);
  process.exit(1);
});
