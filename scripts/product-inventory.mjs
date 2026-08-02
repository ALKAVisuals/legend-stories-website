import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { browserProductImageFor } from './lib/product-browser-derivatives.mjs';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const LEGACY_BASE_PATH = '/legend-stories-website/';

function normalizeWhitespace(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCollection(value = '') {
  return normalizeWhitespace(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeLocalAsset(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';

  let pathname = raw;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    // Relative path; keep it as-is.
  }

  pathname = decodePath(pathname).replace(/^\.\//, '').replace(/^\//, '');
  if (pathname.startsWith(LEGACY_BASE_PATH.slice(1))) {
    pathname = pathname.slice(LEGACY_BASE_PATH.length - 1);
  }

  const mediaIndex = pathname.indexOf('media/');
  return mediaIndex >= 0 ? pathname.slice(mediaIndex) : pathname;
}

export function extractBatchMetadata(imagePath = '') {
  const normalized = normalizeLocalAsset(imagePath);
  const match = normalized.match(/^media\/stikkers\/(\d{4})\/batch\s*(\d+)\/([^/]+)\//i);
  if (!match) return null;

  const collection = normalizeCollection(match[3]);
  return {
    id: `${match[1]}-batch-${Number(match[2])}`,
    year: Number(match[1]),
    number: Number(match[2]),
    collection,
    category: collection.replace(/\s+Legends$/i, '').trim().toLowerCase().replace(/\s+/g, '-'),
  };
}

function productCandidates(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(productCandidates);
  if (typeof value !== 'object') return [];

  const candidates = [value];
  if (Array.isArray(value['@graph'])) candidates.push(...value['@graph'].flatMap(productCandidates));
  return candidates;
}

function parseProductJsonLd(html) {
  const products = [];
  const invalidBlocks = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const source = match[1].trim();
    if (!source) continue;
    try {
      const parsed = JSON.parse(source);
      for (const candidate of productCandidates(parsed)) {
        const type = candidate['@type'];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((entry) => String(entry).toLowerCase() === 'product')) products.push(candidate);
      }
    } catch (error) {
      invalidBlocks.push(error.message);
    }
  }

  return { products, invalidBlocks };
}

function firstOffer(product) {
  const offers = Array.isArray(product.offers) ? product.offers : [product.offers];
  return offers.find((offer) => offer && typeof offer === 'object') || {};
}

function extractAttribute(tag = '', name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  return tag.match(pattern)?.[2] || '';
}

function extractCartButton(html) {
  const tags = html.match(/<button\b[^>]*>/gi) || [];
  const tag = tags.find((entry) => /\badd-to-cart-btn\b/i.test(extractAttribute(entry, 'class')));
  if (!tag) return null;

  return {
    name: extractAttribute(tag, 'data-name'),
    price: Number(extractAttribute(tag, 'data-price')),
    image: normalizeLocalAsset(extractAttribute(tag, 'data-img')),
  };
}

function extractCanonical(html) {
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  const tag = tags.find((entry) => /\bcanonical\b/i.test(extractAttribute(entry, 'rel')));
  return tag ? extractAttribute(tag, 'href') : '';
}

function extractH1(html) {
  return normalizeWhitespace(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

export function extractProductFromHtml(file, html) {
  const { products, invalidBlocks } = parseProductJsonLd(html);
  if (products.length === 0) return { product: null, invalidBlocks };

  const source = products[0];
  const offer = firstOffer(source);
  const imageValue = Array.isArray(source.image) ? source.image[0] : source.image;
  const image = normalizeLocalAsset(imageValue);
  const browserImage = browserProductImageFor(image);
  const batch = extractBatchMetadata(image);
  const cart = extractCartButton(html);
  const price = Number(offer.price);
  const name = normalizeWhitespace(source.name);
  const h1 = extractH1(html);
  const warnings = [];
  const errors = [];

  if (products.length > 1) warnings.push(`${file}: multiple Product JSON-LD objects found; using the first.`);
  if (!name) errors.push(`${file}: Product JSON-LD is missing a name.`);
  if (!Number.isFinite(price) || price < 0) errors.push(`${file}: Product JSON-LD has an invalid price.`);
  if (!image) errors.push(`${file}: Product JSON-LD is missing an image.`);
  if (!batch) warnings.push(`${file}: image path does not expose year, batch and collection metadata.`);
  if (!h1) errors.push(`${file}: product page is missing an H1.`);
  if (name && h1 && name !== h1) warnings.push(`${file}: H1 differs from Product JSON-LD name.`);
  if (!cart) {
    warnings.push(`${file}: no add-to-cart button was detected.`);
  } else {
    if (cart.name && name && cart.name !== name) errors.push(`${file}: cart name differs from Product JSON-LD name.`);
    if (Number.isFinite(cart.price) && Number.isFinite(price) && Math.abs(cart.price - price) > 0.001) {
      errors.push(`${file}: cart price differs from Product JSON-LD price.`);
    }
    if (cart.image && browserImage && cart.image !== browserImage) errors.push(`${file}: cart image differs from the expected browser product image.`);
  }

  const offeredPage = String(offer.url || '').split('#')[0].split('?')[0];
  if (offeredPage && basename(offeredPage) !== file) warnings.push(`${file}: Offer URL points to ${basename(offeredPage)}.`);

  return {
    invalidBlocks,
    product: {
      slug: file.replace(/\.html$/i, ''),
      page: file,
      name,
      description: normalizeWhitespace(source.description),
      image,
      browserImage,
      price,
      currency: String(offer.priceCurrency || ''),
      availability: String(offer.availability || ''),
      canonical: extractCanonical(html),
      batchId: batch?.id || null,
      batchYear: batch?.year || null,
      batchNumber: batch?.number || null,
      collection: batch?.collection || null,
      category: batch?.category || null,
      cart,
      warnings,
      errors,
    },
  };
}

function groupCounts(products, key) {
  const counts = new Map();
  for (const product of products) {
    const value = product[key] || 'unclassified';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function markdownReport(products, invalidJsonLd, missingAssets) {
  const errorCount = products.reduce((total, product) => total + product.errors.length, 0) + missingAssets.length;
  const warningCount = products.reduce((total, product) => total + product.warnings.length, 0) + invalidJsonLd.length;
  const lines = [
    '# Product Catalog Inventory',
    '',
    `Product pages detected: ${products.length}`,
    `Errors: ${errorCount}`,
    `Warnings: ${warningCount}`,
    '',
    '## Batches',
    '',
    '| Batch | Products |',
    '|---|---:|',
    ...groupCounts(products, 'batchId').map(([value, count]) => `| ${value} | ${count} |`),
    '',
    '## Collections',
    '',
    '| Collection | Products |',
    '|---|---:|',
    ...groupCounts(products, 'collection').map(([value, count]) => `| ${value} | ${count} |`),
    '',
    '## Products',
    '',
    '| Page | Product | Batch | Collection | Price |',
    '|---|---|---|---|---:|',
    ...products.map((product) => `| ${product.page} | ${product.name || '—'} | ${product.batchId || '—'} | ${product.collection || '—'} | ${Number.isFinite(product.price) ? `${product.currency || 'EUR'} ${product.price.toFixed(2)}` : '—'} |`),
  ];

  const errors = [
    ...products.flatMap((product) => product.errors),
    ...missingAssets.map((asset) => `${asset.page}: missing product image ${asset.image}`),
  ];
  const warnings = [
    ...products.flatMap((product) => product.warnings),
    ...invalidJsonLd.map((entry) => `${entry.file}: invalid JSON-LD block (${entry.error})`),
  ];

  if (errors.length) lines.push('', '## Errors', '', ...errors.map((entry) => `- ${entry}`));
  if (warnings.length) lines.push('', '## Warnings', '', ...warnings.map((entry) => `- ${entry}`));
  lines.push('');
  return lines.join('\n');
}

export async function buildProductInventory(root = ROOT) {
  const files = (await readdir(root)).filter((file) => extname(file).toLowerCase() === '.html').sort();
  const products = [];
  const invalidJsonLd = [];

  for (const file of files) {
    const html = await readFile(join(root, file), 'utf8');
    const result = extractProductFromHtml(file, html);
    invalidJsonLd.push(...result.invalidBlocks.map((error) => ({ file, error })));
    if (result.product) products.push(result.product);
  }

  const missingAssets = [];
  for (const product of products) {
    for (const image of new Set([product.image, product.browserImage].filter(Boolean))) {
      try {
        await access(join(root, image));
      } catch {
        missingAssets.push({ page: product.page, image });
      }
    }
  }

  const duplicatePages = products.filter((product, index) => products.findIndex((item) => item.page === product.page) !== index);
  for (const product of duplicatePages) product.errors.push(`${product.page}: duplicate page entry in product inventory.`);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      htmlPagesScanned: files.length,
      productPages: products.length,
      errors: products.reduce((total, product) => total + product.errors.length, 0) + missingAssets.length,
      warnings: products.reduce((total, product) => total + product.warnings.length, 0) + invalidJsonLd.length,
    },
    products,
    invalidJsonLd,
    missingAssets,
  };
}

async function main() {
  const inventory = await buildProductInventory(ROOT);
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'product-inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  await writeFile(
    join(REPORT_DIR, 'product-inventory.md'),
    markdownReport(inventory.products, inventory.invalidJsonLd, inventory.missingAssets),
    'utf8',
  );

  console.log(
    `Product inventory completed: ${inventory.summary.productPages} product pages, ${inventory.summary.errors} errors, ${inventory.summary.warnings} warnings.`,
  );

  if (inventory.summary.productPages === 0) {
    console.error('Product inventory failed: no Product JSON-LD pages were detected.');
    process.exitCode = 1;
  } else if (inventory.summary.errors > 0) {
    console.error('Product inventory failed: resolve the reported product-data mismatches.');
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Product inventory failed unexpectedly:', error);
  process.exitCode = 1;
});
