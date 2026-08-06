import { access, readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const BASE_PATH = process.env.GITHUB_PAGES_BASE_PATH || '/legend-stories-website/';

function validateBasePath(value) {
  const normalized = String(value || '').trim();
  if (!/^\/[A-Za-z0-9._~-]+\/$/.test(normalized)) {
    throw new Error('GITHUB_PAGES_BASE_PATH must be one safe repository path with leading and trailing slashes.');
  }
  return normalized;
}

function safeDistAssetPath(source, basePath) {
  const expectedPrefix = `${basePath}assets/`;
  if (!String(source || '').startsWith(expectedPrefix)) {
    throw new Error(`Built asset URL must start with ${expectedPrefix}: ${source || '<empty>'}`);
  }

  const relativePath = normalize(String(source).slice(basePath.length)).replaceAll('\\', '/');
  if (!relativePath.startsWith('assets/') || relativePath.includes('../')) {
    throw new Error(`Built asset URL resolves outside dist/assets: ${source}`);
  }
  return relativePath;
}

async function main() {
  const basePath = validateBasePath(BASE_PATH);
  const registryPath = join(DIST, 'data/product-registry.json');
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));

  if (!Array.isArray(registry.products) || registry.products.length === 0) {
    throw new Error('GitHub Pages runtime registry must contain products.');
  }

  for (const product of registry.products) {
    const image = product.browserImage || product.image;
    const relativePath = safeDistAssetPath(image, basePath);
    await access(join(DIST, relativePath));
  }

  await access(join(DIST, 'css/related-products.css'));
  await access(join(DIST, 'js/cart-controls.mjs'));
  await access(join(DIST, '.nojekyll'));

  console.log(`Validated GitHub Pages output for ${registry.products.length} products at ${basePath}.`);
}

main().catch((error) => {
  console.error('GitHub Pages build validation failed:', error);
  process.exit(1);
});
