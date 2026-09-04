import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const TEMPLATE_PATH = join(ROOT, 'templates', 'product-page.html');
const GENERATOR_PATH = join(ROOT, 'scripts', 'product-page-generation.mjs');
const MANAGED_CONFIG_PATH = join(ROOT, 'data', 'products', 'managed-page-batches.json');

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) throw new Error(`${label}: expected source marker was not found.`);
  if (source.indexOf(search, first + search.length) >= 0) {
    throw new Error(`${label}: source marker is not unique.`);
  }
  return `${source.slice(0, first)}${replacement}${source.slice(first + search.length)}`;
}

let template = await readFile(TEMPLATE_PATH, 'utf8');
if (template.includes('data-product-identity')) {
  throw new Error('GPSR product identity block already exists in the shared product template.');
}

const specsTail = `              <div class="p-3 rounded-xl bg-surface-light/30 border border-surface-border/20">
                <p class="text-text-muted text-xs mb-1">Made in</p>
                <p class="text-sm font-medium">Netherlands</p>
              </div>
            </div>
          </div>`;

const identityBlock = `              <div class="p-3 rounded-xl bg-surface-light/30 border border-surface-border/20">
                <p class="text-text-muted text-xs mb-1">Made in</p>
                <p class="text-sm font-medium">Netherlands</p>
              </div>
            </div>

            <!-- PRODUCT IDENTITY -->
            <section class="mt-5 rounded-xl border border-surface-border/20 bg-surface-light/20 p-4" aria-label="Product manufacturer information" data-product-identity>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">Product information</p>
              <dl class="space-y-2 text-sm">
                <div class="grid sm:grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
                  <dt class="text-text-muted">Product ID</dt>
                  <dd class="text-text-secondary font-medium" data-product-id>{{PRODUCT_ID}}</dd>
                </div>
                <div class="grid sm:grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
                  <dt class="text-text-muted">Manufacturer</dt>
                  <dd class="text-text-secondary">Alka Group, trading through LegendMural</dd>
                </div>
                <div class="grid sm:grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
                  <dt class="text-text-muted">Address</dt>
                  <dd class="text-text-secondary">Schutkolk 4 d 1, 6582 DB Heumen, The Netherlands</dd>
                </div>
                <div class="grid sm:grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
                  <dt class="text-text-muted">Email</dt>
                  <dd><a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a></dd>
                </div>
              </dl>
            </section>
          </div>`;

template = replaceOnce(template, specsTail, identityBlock, 'shared product identity insertion');
await writeFile(TEMPLATE_PATH, template, 'utf8');

let generator = await readFile(GENERATOR_PATH, 'utf8');

generator = replaceOnce(
  generator,
  `    brand: { '@type': 'Brand', name: 'LegendMural' },\n    offers: orderedVariants.map((variant) => ({`,
  `    brand: { '@type': 'Brand', name: 'LegendMural' },\n    productID: product.productId,\n    manufacturer: {\n      '@type': 'Organization',\n      name: 'Alka Group',\n      alternateName: 'LegendMural',\n      email: 'info@alkavisuals.nl',\n      address: {\n        '@type': 'PostalAddress',\n        streetAddress: 'Schutkolk 4 d 1',\n        postalCode: '6582 DB',\n        addressLocality: 'Heumen',\n        addressCountry: 'NL',\n      },\n    },\n    offers: orderedVariants.map((variant) => ({`,
  'Product JSON-LD identity',
);

generator = replaceOnce(
  generator,
  `  html = replaceRequired(\n    html,\n    /(<!-- FACT -->[\\s\\S]*?<p class="text-text-secondary text-base md:text-lg leading-relaxed italic">)[\\s\\S]*?(<\\/p>)/,\n    '$1{{STORY}}$2',\n    'product story',\n  );\n  html = replaceRequired(`,
  `  html = replaceRequired(\n    html,\n    /(<!-- FACT -->[\\s\\S]*?<p class="text-text-secondary text-base md:text-lg leading-relaxed italic">)[\\s\\S]*?(<\\/p>)/,\n    '$1{{STORY}}$2',\n    'product story',\n  );\n  html = replaceRequired(\n    html,\n    /(<dd class="text-text-secondary font-medium" data-product-id>)[^<]+(<\\/dd>)/,\n    '$1{{PRODUCT_ID}}$2',\n    'product identity ID',\n  );\n  html = replaceRequired(`,
  'product-page templatize Product ID',
);

generator = replaceOnce(
  generator,
  `    COLLECTION: escapeHtml(product.collection),\n    NAME: escapeHtml(product.name),\n    STORY: escapeHtml(presentation.story),`,
  `    COLLECTION: escapeHtml(product.collection),\n    NAME: escapeHtml(product.name),\n    PRODUCT_ID: escapeHtml(product.productId),\n    STORY: escapeHtml(presentation.story),`,
  'render Product ID value',
);

await writeFile(GENERATOR_PATH, generator, 'utf8');

const managed = JSON.parse(await readFile(MANAGED_CONFIG_PATH, 'utf8'));
const sha256 = createHash('sha256').update(template).digest('hex');
for (const batch of managed.batches) {
  const presentationPath = join(ROOT, batch.presentationFile);
  const presentation = JSON.parse(await readFile(presentationPath, 'utf8'));
  if (presentation.batchId !== batch.id) {
    throw new Error(`${batch.presentationFile}: batch mismatch.`);
  }
  if (!presentation.template || presentation.template.path !== managed.template) {
    throw new Error(`${batch.presentationFile}: shared template metadata is invalid.`);
  }
  presentation.template.sha256 = sha256;
  await writeFile(presentationPath, `${JSON.stringify(presentation, null, 2)}\n`, 'utf8');
}

console.log(`Applied centralized GPSR product identity fields.`);
console.log(`Updated managed presentation template hash to ${sha256}.`);