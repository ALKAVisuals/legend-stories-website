import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { PRODUCT_BROWSER_DERIVATIVE_MANIFEST } from './lib/product-browser-derivatives.mjs';

const ROOT = process.cwd();
const EXPECTED_BROWSER_REFERENCE_REPLACEMENTS = 138;

function replaceExact(source, search, replacement, label, expectedCount = 1) {
  const count = source.split(search).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}.`);
  }
  return source.replaceAll(search, replacement);
}

function replacePattern(source, pattern, replacement, label, expectedCount = 1) {
  let count;
  pattern.lastIndex = 0;
  if (pattern.global) {
    count = [...source.matchAll(pattern)].length;
    pattern.lastIndex = 0;
  } else {
    count = pattern.test(source) ? 1 : 0;
    pattern.lastIndex = 0;
  }
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} match(es), found ${count}.`);
  }
  return source.replace(pattern, replacement);
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function updateTextFile(path, transform) {
  const absolute = join(ROOT, path);
  const before = await readFile(absolute, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: migration made no changes.`);
  await writeFile(absolute, after, 'utf8');
}

await updateTextFile('data/media/product-browser-derivatives.json', (input) => {
  const policy = JSON.parse(input);
  if (policy.minimumColorSsim !== 0.985 || policy.minimumAlphaSsim !== 0.995) {
    throw new Error('Product browser derivative policy: unexpected legacy SSIM thresholds.');
  }
  policy.minimumDarkCompositeSsim = 0.985;
  policy.minimumLightCompositeSsim = 0.985;
  delete policy.minimumColorSsim;
  delete policy.minimumAlphaSsim;
  return `${JSON.stringify(policy, null, 2)}\n`;
});

await updateTextFile('scripts/product-page-generation.mjs', (input) => {
  let source = input;
  source = replaceExact(
    source,
    "import { createHash } from 'node:crypto';\n",
    "import { createHash } from 'node:crypto';\n\nimport { browserProductImageFor } from './lib/product-browser-derivatives.mjs';\n",
    'product page derivative import',
  );
  source = replaceExact(
    source,
    'function absoluteImageUrl(product) {',
    'function absoluteImageUrl(product, image = product.image) {',
    'absolute image function signature',
  );
  source = replaceExact(
    source,
    '  if (slash < 0) return product.image;',
    '  if (slash < 0) return image;',
    'absolute image fallback',
  );
  source = replaceExact(
    source,
    '  return `${canonical.slice(0, slash + 1)}${product.image}`;',
    '  return `${canonical.slice(0, slash + 1)}${image}`;',
    'absolute image path',
  );
  source = replaceExact(
    source,
    "export function renderProductPage(template, product, presentation) {\n  const title = presentation.pageTitle || `${product.name} — ${product.collection} | Legend Stories`;",
    "export function renderProductPage(template, product, presentation) {\n  const title = presentation.pageTitle || `${product.name} — ${product.collection} | Legend Stories`;\n  const browserImage = browserProductImageFor(product.image);",
    'browser image resolution',
  );
  source = replaceExact(
    source,
    '    ABSOLUTE_IMAGE: escapeHtml(absoluteImageUrl(product)),',
    '    ABSOLUTE_IMAGE: escapeHtml(absoluteImageUrl(product, browserImage)),',
    'social browser image',
  );
  source = replaceExact(
    source,
    '    IMAGE: escapeHtml(product.image),',
    '    IMAGE: escapeHtml(browserImage),',
    'rendered browser image',
  );
  return source;
});

await updateTextFile('scripts/product-inventory.mjs', (input) => {
  let source = input;
  source = replaceExact(
    source,
    "import { fileURLToPath } from 'node:url';\n",
    "import { fileURLToPath } from 'node:url';\n\nimport { browserProductImageFor } from './lib/product-browser-derivatives.mjs';\n",
    'inventory derivative import',
  );
  source = replaceExact(
    source,
    '  const image = normalizeLocalAsset(imageValue);\n  const batch = extractBatchMetadata(image);',
    '  const image = normalizeLocalAsset(imageValue);\n  const browserImage = browserProductImageFor(image);\n  const batch = extractBatchMetadata(image);',
    'inventory browser image resolution',
  );
  source = replaceExact(
    source,
    '    if (cart.image && image && cart.image !== image) errors.push(`${file}: cart image differs from Product JSON-LD image.`);',
    '    if (cart.image && browserImage && cart.image !== browserImage) errors.push(`${file}: cart image differs from the expected browser product image.`);',
    'inventory cart image comparison',
  );
  source = replaceExact(
    source,
    '      image,\n      price,',
    '      image,\n      browserImage,\n      price,',
    'inventory browser image field',
  );
  source = replacePattern(
    source,
    /  const missingAssets = \[\];\n  for \(const product of products\) \{\n    if \(!product\.image\) continue;\n    try \{\n      await access\(join\(root, product\.image\)\);\n    \} catch \{\n      missingAssets\.push\(\{ page: product\.page, image: product\.image \}\);\n    \}\n  \}/,
    `  const missingAssets = [];
  for (const product of products) {
    for (const image of new Set([product.image, product.browserImage].filter(Boolean))) {
      try {
        await access(join(root, image));
      } catch {
        missingAssets.push({ page: product.page, image });
      }
    }
  }`,
    'inventory source and browser asset checks',
  );
  return source;
});

await updateTextFile('scripts/generate-runtime-product-registry.mjs', (input) => replaceExact(
  input,
  '    image: product.image,',
  '    image: product.browserImage || product.image,',
  'runtime browser image',
));

await updateTextFile('scripts/validate-runtime-product-registry.mjs', (input) => replaceExact(
  input,
  '  for (const field of REQUIRED_FIELDS) {\n    compare(errors, product.page, field, inventoryProduct[field], product[field]);\n  }',
  "  for (const field of REQUIRED_FIELDS) {\n    const expected = field === 'image'\n      ? inventoryProduct.browserImage || inventoryProduct.image\n      : inventoryProduct[field];\n    compare(errors, product.page, field, expected, product[field]);\n  }",
  'runtime inventory image comparison',
));

const htmlFiles = (await readdir(ROOT))
  .filter((file) => extname(file).toLowerCase() === '.html')
  .sort();
let browserReferenceReplacements = 0;
for (const file of htmlFiles) {
  const path = join(ROOT, file);
  let html = await readFile(path, 'utf8');
  const before = html;
  for (const image of PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images) {
    const variants = [...new Set([
      image.source,
      encodeURI(image.source),
      image.source.replaceAll(' ', '%20'),
    ])];
    for (const variant of variants) {
      const pattern = new RegExp(`((?:src|data-img)=["'])${escapeRegExp(variant)}(["'])`, 'g');
      const count = [...html.matchAll(pattern)].length;
      if (!count) continue;
      browserReferenceReplacements += count;
      html = html.replace(pattern, `$1${image.derivative}$2`);
    }
  }
  if (html !== before) await writeFile(path, html, 'utf8');
}

if (browserReferenceReplacements !== EXPECTED_BROWSER_REFERENCE_REPLACEMENTS) {
  throw new Error(
    `Browser image references: expected ${EXPECTED_BROWSER_REFERENCE_REPLACEMENTS} replacements, found ${browserReferenceReplacements}.`,
  );
}

for (const file of htmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  for (const image of PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images) {
    const stale = new RegExp(`(?:src|data-img)=["']${escapeRegExp(image.source)}["']`);
    if (stale.test(html)) throw new Error(`${file}: stale browser reference to ${image.source}.`);
  }
}

await updateTextFile('package.json', (input) => {
  const packageJson = JSON.parse(input);
  packageJson.scripts['generate:product-browser-derivatives'] = 'node scripts/generate-product-browser-derivatives.mjs';
  packageJson.scripts['validate:product-browser-derivatives'] = 'node scripts/validate-product-browser-derivatives.mjs';
  const marker = 'npm run generate:runtime-products && npm run validate:runtime-products';
  const replacement = `${marker} && npm run validate:product-browser-derivatives`;
  const count = packageJson.scripts.quality.split(marker).length - 1;
  if (count !== 1) throw new Error(`package quality chain: expected one runtime marker, found ${count}.`);
  packageJson.scripts.quality = packageJson.scripts.quality.replace(marker, replacement);
  return `${JSON.stringify(packageJson, null, 2)}\n`;
});

console.log(
  `Prepared product browser delivery: ${PRODUCT_BROWSER_DERIVATIVE_MANIFEST.images.length} derivatives and ${browserReferenceReplacements} static browser reference replacements.`,
);
