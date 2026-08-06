import { createHash } from 'node:crypto';
import { cp, copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'js');
const TARGET = join(ROOT, 'dist/js');
const COLLECTION_VIDEO_MANIFEST_PATH = join(ROOT, 'data/video/collection-video-optimization.json');
const PRODUCT_REGISTRY_PATH = join(ROOT, 'generated/public/data/product-registry.json');
const RELATED_PRODUCTS_STYLES_PATH = 'css/related-products.css';
const BUILT_ASSET_PATH_PATTERN = /^(?:assets\/(?!\/)|\.\/assets\/(?!\/)|\/(?:[A-Za-z0-9._~-]+\/)*assets\/(?!\/))/;

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

function safeProductPagePath(value, label) {
  const normalized = normalize(String(value || '')).replaceAll('\\', '/');
  if (!normalized
    || normalized.startsWith('../')
    || normalized.includes('/../')
    || normalized.startsWith('/')
    || normalized.includes('/')
    || !normalized.endsWith('.html')) {
    throw new Error(`${label} is not an approved root product page.`);
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
    throw new Error(`${path}: runtime asset is not a file.`);
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);

  const outputInfo = await stat(targetPath);
  const sourceHash = await sha256(sourcePath);
  if (outputInfo.size !== sourceInfo.size || await sha256(targetPath) !== sourceHash) {
    throw new Error(`${path}: copied runtime asset failed integrity validation.`);
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

function readAttribute(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}=(['\"])(.*?)\\1`, 'i'));
  return match?.[2] || '';
}

function replaceAttribute(tag, name, value) {
  const escaped = String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const pattern = new RegExp(`(\\b${name}=)(['\"])(.*?)\\2`, 'i');
  if (!pattern.test(tag)) {
    throw new Error(`Built product button is missing ${name}.`);
  }
  return tag.replace(pattern, `$1"${escaped}"`);
}

function builtHeroImageSource(html, page) {
  const heroTag = Array.from(String(html).matchAll(/<img\b[^>]*>/gi))
    .map((match) => match[0])
    .find((tag) => /\bdata-product-hero=(['\"])true\1/i.test(tag));
  const source = readAttribute(heroTag || '', 'src');
  if (!source || !BUILT_ASSET_PATH_PATTERN.test(source)) {
    throw new Error(`${page}: Vite did not produce a valid same-origin built hero image URL.`);
  }
  return source;
}

function rewriteBuiltCartImage(html, image, page) {
  let replaced = false;
  const updated = String(html).replace(/<button\b[^>]*>/gi, (tag) => {
    if (replaced || !/\badd-to-cart-btn\b/.test(tag)) return tag;
    replaced = true;
    return replaceAttribute(tag, 'data-img', image);
  });
  if (!replaced) {
    throw new Error(`${page}: built product page is missing its add-to-cart button.`);
  }
  return updated;
}

async function finalizeRuntimeProductRegistry() {
  const registry = JSON.parse(await readFile(PRODUCT_REGISTRY_PATH, 'utf8'));
  if (!Array.isArray(registry.products) || registry.products.length === 0) {
    throw new Error('Runtime product registry must contain at least one product.');
  }

  const finalizedProducts = [];
  for (const product of registry.products) {
    const page = safeProductPagePath(product.page, `${product.name || 'product'} page`);
    const outputPath = join(ROOT, 'dist', page);
    const html = await readFile(outputPath, 'utf8');
    const builtImage = builtHeroImageSource(html, page);
    await writeFile(outputPath, rewriteBuiltCartImage(html, builtImage, page), 'utf8');
    finalizedProducts.push({
      ...product,
      image: builtImage,
      browserImage: builtImage,
    });
  }

  const outputPath = join(ROOT, 'dist/data/product-registry.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...registry, products: finalizedProducts }, null, 2)}\n`, 'utf8');
  return finalizedProducts.length;
}

async function main() {
  await mkdir(TARGET, { recursive: true });
  await cp(SOURCE, TARGET, { recursive: true, force: true });
  const copiedMedia = await copyDeferredCollectionMedia();
  const copiedStyles = await copyRepositoryAsset(RELATED_PRODUCTS_STYLES_PATH);
  const finalizedProducts = await finalizeRuntimeProductRegistry();

  console.log('Copied classic JavaScript and browser modules to dist/js/.');
  console.log(`Copied ${copiedMedia.length} manifest-approved deferred media assets:`);
  copiedMedia.forEach((path) => console.log(`- ${path}`));
  console.log(`Copied runtime stylesheet: ${copiedStyles}.`);
  console.log(`Finalized built image URLs for ${finalizedProducts} products.`);
}

main().catch((error) => {
  console.error('Failed to copy browser runtime files:', error);
  process.exit(1);
});
