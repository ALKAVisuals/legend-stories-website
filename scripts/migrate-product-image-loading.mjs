import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PRODUCT_CARDS = 232;
const EXPECTED_PRESENTATION_MANIFESTS = 6;

function setAttribute(tag, name, value) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const clean = tag.replace(pattern, '');
  return clean.replace(/>$/, ` ${name}="${value}">`);
}

function updateHero(html, label) {
  const marker = html.indexOf('<!-- IMAGE -->');
  if (marker < 0) throw new Error(`${label}: image marker not found.`);
  const start = html.indexOf('<img', marker);
  const end = start < 0 ? -1 : html.indexOf('>', start);
  if (start < 0 || end < 0) throw new Error(`${label}: hero image not found.`);

  let tag = html.slice(start, end + 1);
  tag = setAttribute(tag, 'data-product-hero', 'true');
  tag = setAttribute(tag, 'decoding', 'async');
  tag = setAttribute(tag, 'fetchpriority', 'high');
  tag = setAttribute(tag, 'width', '900');
  tag = setAttribute(tag, 'height', '900');
  tag = tag.replace(/\sloading\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
  return `${html.slice(0, start)}${tag}${html.slice(end + 1)}`;
}

function updateProductCards(html, label) {
  let cards = 0;
  let images = 0;
  const output = html.replace(
    /<article\b(?=[^>]*\bclass=["'][^"']*\bproduct-card\b[^"']*["'])[^>]*>[\s\S]*?<\/article>/gi,
    (block) => {
      cards += 1;
      let changed = false;
      const next = block.replace(/<img\b[^>]*>/i, (tag) => {
        changed = true;
        images += 1;
        let updated = setAttribute(tag, 'loading', 'lazy');
        updated = setAttribute(updated, 'decoding', 'async');
        updated = setAttribute(updated, 'fetchpriority', 'low');
        return updated;
      });
      if (!changed) throw new Error(`${label}: product card ${cards} has no image.`);
      return next;
    },
  );
  return { output, cards, images };
}

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}.`);
  return source.replace(before, after);
}

const templatePath = join(ROOT, 'templates/product-page.html');
let template = await readFile(templatePath, 'utf8');
template = updateHero(template, 'templates/product-page.html');
await writeFile(templatePath, template, 'utf8');

const generatorPath = join(ROOT, 'scripts/product-page-generation.mjs');
let generator = await readFile(generatorPath, 'utf8');
generator = replaceExact(
  generator,
  String.raw`/<!-- IMAGE -->[\s\S]*?<img\s+src="[^"]*"\s+alt="([^"]*)"\s+class="w-full h-full object-contain">/`,
  String.raw`/<!-- IMAGE -->[\s\S]*?<img\s+src="[^"]*"\s+alt="([^"]*)"\s+class="w-full h-full object-contain"[^>]*>/`,
  'presentation image-alt parser',
);
generator = replaceExact(
  generator,
  String.raw`/(<!-- IMAGE -->[\s\S]*?<img\s+)src="[^"]*"\s+alt="[^"]*"(\s+class="w-full h-full object-contain">)/`,
  String.raw`/(<!-- IMAGE -->[\s\S]*?<img\s+)src="[^"]*"\s+alt="[^"]*"(\s+class="w-full h-full object-contain"[^>]*>)/`,
  'product-image templatizer',
);
await writeFile(generatorPath, generator, 'utf8');

const htmlFiles = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
  .map((entry) => entry.name)
  .sort();
let cardCount = 0;
let imageCount = 0;
for (const file of htmlFiles) {
  const path = join(ROOT, file);
  const html = await readFile(path, 'utf8');
  const result = updateProductCards(html, file);
  cardCount += result.cards;
  imageCount += result.images;
  if (result.output !== html) await writeFile(path, result.output, 'utf8');
}
if (cardCount !== EXPECTED_PRODUCT_CARDS || imageCount !== EXPECTED_PRODUCT_CARDS) {
  throw new Error(`Expected ${EXPECTED_PRODUCT_CARDS} product-card images, found ${cardCount} cards and ${imageCount} images.`);
}

const appPath = join(ROOT, 'js/app.js');
let app = await readFile(appPath, 'utf8');
app = replaceExact(
  app,
  `html += '<img src=\\"' + image + '\\" alt=\\"' + name + '\\" class=\\"w-full h-full object-contain group-hover:scale-105 transition-transform duration-500\\" loading=\\"lazy\\">';`,
  `html += '<img src=\\"' + image + '\\" alt=\\"' + name + '\\" class=\\"w-full h-full object-contain group-hover:scale-105 transition-transform duration-500\\" loading=\\"lazy\\" decoding=\\"async\\" fetchpriority=\\"low\\">';`,
  'related-product image loading',
);
app = replaceExact(
  app,
  `? '<img src=\\"' + item.image + '\\" alt=\\"' + item.name + '\\" class=\\"w-12 h-12 object-contain rounded\\">'`,
  `? '<img src=\\"' + item.image + '\\" alt=\\"' + item.name + '\\" class=\\"w-12 h-12 object-contain rounded\\" decoding=\\"async\\">'`,
  'cart thumbnail decoding',
);
await writeFile(appPath, app, 'utf8');

const packagePath = join(ROOT, 'package.json');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:product-image-loading'] = 'node scripts/validate-product-image-loading.mjs';
const qualityNeedle = 'npm run validate:dialog-accessibility && npm run validate:image-error-fallbacks';
const qualityReplacement = 'npm run validate:dialog-accessibility && npm run validate:product-image-loading && npm run validate:image-error-fallbacks';
if (!packageJson.scripts.quality.includes('validate:product-image-loading')) {
  if (!packageJson.scripts.quality.includes(qualityNeedle)) {
    throw new Error('package.json: quality insertion point was not found.');
  }
  packageJson.scripts.quality = packageJson.scripts.quality.replace(qualityNeedle, qualityReplacement);
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

const templateSha = createHash('sha256').update(template).digest('hex');
const productDataDirectory = join(ROOT, 'data/products');
const presentationFiles = (await readdir(productDataDirectory))
  .filter((name) => name.endsWith('-presentation.json'))
  .sort();
if (presentationFiles.length !== EXPECTED_PRESENTATION_MANIFESTS) {
  throw new Error(`Expected ${EXPECTED_PRESENTATION_MANIFESTS} presentation manifests, found ${presentationFiles.length}.`);
}
for (const file of presentationFiles) {
  const path = join(productDataDirectory, file);
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  if (!manifest.template || typeof manifest.template !== 'object') {
    throw new Error(`${file}: template metadata is missing.`);
  }
  manifest.template.sha256 = templateSha;
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

console.log(`Prepared product image loading contract: ${cardCount} card images, one shared hero template and ${presentationFiles.length} manifests.`);
