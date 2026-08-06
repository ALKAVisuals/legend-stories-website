import { access, readdir, readFile } from 'node:fs/promises';
import { extname, join, normalize, relative } from 'node:path';

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

function extractBuiltAssetReferences(html) {
  const references = [];
  const pattern = /(?:href|src|data-src|poster)=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(String(html)))) {
    const reference = match[1].split('#')[0].split('?')[0].trim();
    if (reference.includes('/assets/')) references.push(reference);
  }
  return references;
}

async function validateHtmlAssetReferences(basePath) {
  const files = await walk(DIST);
  const htmlFiles = files.filter((file) => extname(file) === '.html');
  if (htmlFiles.length < 100) {
    throw new Error(`Expected at least 100 GitHub Pages HTML files, found ${htmlFiles.length}.`);
  }

  let checkedReferences = 0;
  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    for (const source of extractBuiltAssetReferences(html)) {
      let decoded;
      try {
        decoded = decodeURIComponent(source);
      } catch {
        throw new Error(`${relative(DIST, htmlFile)} contains invalid asset URI encoding: ${source}`);
      }
      const relativePath = safeDistAssetPath(decoded, basePath);
      await access(join(DIST, relativePath));
      checkedReferences += 1;
    }
  }

  if (checkedReferences === 0) {
    throw new Error('GitHub Pages HTML contains no repository-prefixed built asset references.');
  }
  return { htmlFiles: htmlFiles.length, checkedReferences };
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

  const htmlValidation = await validateHtmlAssetReferences(basePath);
  await access(join(DIST, 'css/related-products.css'));
  await access(join(DIST, 'js/cart-controls.mjs'));
  await access(join(DIST, '.nojekyll'));

  console.log(
    `Validated GitHub Pages output for ${registry.products.length} products, ` +
    `${htmlValidation.htmlFiles} HTML pages and ${htmlValidation.checkedReferences} built asset references at ${basePath}.`,
  );
}

main().catch((error) => {
  console.error('GitHub Pages build validation failed:', error);
  process.exit(1);
});
