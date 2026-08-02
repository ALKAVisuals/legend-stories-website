import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PRODUCT_PAGES = 111;
const EXPECTED_PRODUCT_CARD_CONTAINERS = 233;
const EXPECTED_PRODUCT_CARD_IMAGES = 232;
const EXPECTED_IMAGELESS_CTA_CARDS = 1;

function parseAttributes(tag = '') {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return attributes;
}

function findProductHero(html, label, failures) {
  const match = String(html).match(/<!-- IMAGE -->[\s\S]*?(<img\b[^>]*>)/i);
  if (!match) {
    failures.push(`${label}: product hero image was not found`);
    return;
  }
  const attributes = parseAttributes(match[1]);
  const expectations = {
    'data-product-hero': 'true',
    decoding: 'async',
    fetchpriority: 'high',
    width: '900',
    height: '900',
  };
  for (const [name, value] of Object.entries(expectations)) {
    if (attributes[name] !== value) failures.push(`${label}: hero ${name} must be "${value}"`);
  }
  if (attributes.loading === 'lazy') failures.push(`${label}: above-the-fold hero must not be lazy-loaded`);
}

function productCardBlocks(html = '') {
  return [...String(html).matchAll(/<article\b(?=[^>]*\bclass=["'][^"']*\bproduct-card\b[^"']*["'])[^>]*>[\s\S]*?<\/article>/gi)]
    .map((match) => match[0]);
}

const failures = [];
const catalog = JSON.parse(await readFile(join(ROOT, 'data/products/catalog.json'), 'utf8'));
if (catalog.productCount !== EXPECTED_PRODUCT_PAGES || catalog.products?.length !== EXPECTED_PRODUCT_PAGES) {
  failures.push(`catalog: expected ${EXPECTED_PRODUCT_PAGES} products, found ${catalog.products?.length ?? 0}`);
}

const template = await readFile(join(ROOT, 'templates/product-page.html'), 'utf8');
findProductHero(template, 'templates/product-page.html', failures);

for (const product of catalog.products || []) {
  const html = await readFile(join(ROOT, product.page), 'utf8');
  findProductHero(html, product.page, failures);
}

const rootHtmlFiles = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
  .map((entry) => entry.name)
  .sort();

let cardCount = 0;
let imageCount = 0;
let imageLessCtaCount = 0;
for (const file of rootHtmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  for (const [index, block] of productCardBlocks(html).entries()) {
    cardCount += 1;
    const image = block.match(/<img\b[^>]*>/i)?.[0];
    if (!image) {
      imageLessCtaCount += 1;
      if (/\bdata-product-href\s*=/i.test(block)) {
        failures.push(`${file}: image-less card ${index + 1} must not have a product destination`);
      }
      if (/\badd-to-cart-btn\b/i.test(block)) {
        failures.push(`${file}: image-less card ${index + 1} must not have an add-to-cart action`);
      }
      continue;
    }

    imageCount += 1;
    const attributes = parseAttributes(image);
    for (const [name, value] of Object.entries({
      loading: 'lazy',
      decoding: 'async',
      fetchpriority: 'low',
    })) {
      if (attributes[name] !== value) {
        failures.push(`${file}: product card ${index + 1} ${name} must be "${value}"`);
      }
    }
  }
}
if (cardCount !== EXPECTED_PRODUCT_CARD_CONTAINERS) {
  failures.push(`expected ${EXPECTED_PRODUCT_CARD_CONTAINERS} product-card containers, found ${cardCount}`);
}
if (imageCount !== EXPECTED_PRODUCT_CARD_IMAGES) {
  failures.push(`expected ${EXPECTED_PRODUCT_CARD_IMAGES} product-card images, found ${imageCount}`);
}
if (imageLessCtaCount !== EXPECTED_IMAGELESS_CTA_CARDS) {
  failures.push(`expected ${EXPECTED_IMAGELESS_CTA_CARDS} image-less CTA card, found ${imageLessCtaCount}`);
}

const app = await readFile(join(ROOT, 'js/app.js'), 'utf8');
if (!app.includes('loading=\\"lazy\\" decoding=\\"async\\" fetchpriority=\\"low\\"')) {
  failures.push('js/app.js: related-product images must be lazy, async and low priority');
}
if (!app.includes('class=\\"w-12 h-12 object-contain rounded\\" decoding=\\"async\\"')) {
  failures.push('js/app.js: cart thumbnail images must decode asynchronously');
}

if (failures.length) {
  console.error(`Product image loading validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Product image loading validated: ${EXPECTED_PRODUCT_PAGES} product heroes, ${imageCount} lazy product-card images, ${imageLessCtaCount} image-less CTA, related products and cart thumbnails.`,
);
