import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const files = [
  'shop.html',
  'combat-legends.html',
  'music-legends.html',
  'sport-legends.html',
  'wisdom-legends.html',
];
const expectedExplicitCards = 232;
const expectedTotalCards = 233;
const errors = [];
let explicitCardCount = 0;
let totalCardCount = 0;

const articlePattern = /<article\b([^>]*)>([\s\S]*?)<\/article>/gi;
const attribute = (source, name) => {
  const match = source.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
  return match?.[1] || '';
};

for (const file of files) {
  const html = await readFile(resolve(root, file), 'utf8');
  for (const match of html.matchAll(articlePattern)) {
    const attributes = match[1];
    const body = match[2];
    if (!/\bproduct-card\b/.test(attribute(attributes, 'class'))) continue;
    totalCardCount += 1;

    const href = attribute(attributes, 'data-product-href');
    if (!href) {
      if (/\bonclick\s*=/.test(attributes)) {
        errors.push(`${file}: legacy product card still has inline onclick`);
      }
      if (/class=["'][^"']*add-to-cart-btn[^"']*["'][^>]*\bonclick\s*=/i.test(body)) {
        errors.push(`${file}: legacy add-to-cart button still has inline onclick`);
      }
      continue;
    }
    explicitCardCount += 1;
    if (attribute(attributes, 'role') !== 'link') {
      errors.push(`${file}: product card ${href || explicitCardCount} must use role=link`);
    }
    if (attribute(attributes, 'tabindex') !== '0') {
      errors.push(`${file}: product card ${href || explicitCardCount} must use tabindex=0`);
    }
    if (!attribute(attributes, 'aria-label').trim()) {
      errors.push(`${file}: product card ${href || explicitCardCount} has no accessible name`);
    }
    if (/\bonclick\s*=/.test(attributes)) {
      errors.push(`${file}: product card ${href || explicitCardCount} still has inline onclick`);
    }
    if (/class=["'][^"']*add-to-cart-btn[^"']*["'][^>]*\bonclick\s*=/i.test(body)) {
      errors.push(`${file}: add-to-cart button inside ${href || explicitCardCount} still has inline onclick`);
    }
  }
}

if (explicitCardCount !== expectedExplicitCards) {
  errors.push(`Expected ${expectedExplicitCards} explicit product cards, found ${explicitCardCount}`);
}
if (totalCardCount !== expectedTotalCards) {
  errors.push(`Expected ${expectedTotalCards} total product cards, found ${totalCardCount}`);
}

const app = await readFile(resolve(root, 'js/app.js'), 'utf8');
const moduleSource = await readFile(resolve(root, 'js/product-card-navigation.mjs'), 'utf8');
if (!app.includes("import('./product-card-navigation.mjs')")) {
  errors.push('js/app.js does not load the product-card navigation module');
}
if (!app.includes('initProductCardNavigation')) {
  errors.push('js/app.js does not initialize centralized product-card navigation');
}
if (!moduleSource.includes("key === 'Enter'")) {
  errors.push('Product-card navigation module has no Enter-key contract');
}
if (!moduleSource.includes('shouldIgnoreProductCardClick')) {
  errors.push('Product-card navigation module does not protect nested controls');
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Validated ${explicitCardCount} centralized cards across ${totalCardCount} product cards.`);
