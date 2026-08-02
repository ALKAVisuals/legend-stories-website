import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PURCHASE_SURFACES = 118;
const EXPECTED_LABELS_PER_SURFACE = 3;
const PRESENTATION_MANIFEST = /2026-batch-\d+-presentation\.json$/;
const HEADING_PATTERN = /<h3 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary mb-4">([\s\S]*?)<\/h3>/g;
const LABEL_REPLACEMENT = '<p class="font-display font-bold text-sm uppercase tracking-wider text-text-primary mb-4">$1</p>';

function replaceLabels(html, name) {
  const matches = [...html.matchAll(HEADING_PATTERN)];
  if (matches.length !== EXPECTED_LABELS_PER_SURFACE) {
    throw new Error(`${name}: expected ${EXPECTED_LABELS_PER_SURFACE} footer navigation headings, found ${matches.length}`);
  }
  return html.replace(HEADING_PATTERN, LABEL_REPLACEMENT);
}

async function main() {
  const files = (await readdir(ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => entry.name)
    .sort();

  let surfaces = 0;
  for (const file of files) {
    const path = join(ROOT, file);
    const html = await readFile(path, 'utf8');
    if (!/id=["']checkout-drawer["']/i.test(html)) continue;
    surfaces += 1;
    await writeFile(path, replaceLabels(html, file), 'utf8');
  }
  if (surfaces !== EXPECTED_PURCHASE_SURFACES) {
    throw new Error(`Expected ${EXPECTED_PURCHASE_SURFACES} purchase surfaces, found ${surfaces}`);
  }

  const templatePath = join(ROOT, 'templates', 'product-page.html');
  const template = replaceLabels(await readFile(templatePath, 'utf8'), 'templates/product-page.html');
  await writeFile(templatePath, template, 'utf8');

  const templateHash = createHash('sha256').update(template).digest('hex');
  const productDir = join(ROOT, 'data', 'products');
  const manifests = (await readdir(productDir)).filter((name) => PRESENTATION_MANIFEST.test(name)).sort();
  if (manifests.length !== 6) throw new Error(`Expected six presentation manifests, found ${manifests.length}`);
  for (const name of manifests) {
    const path = join(productDir, name);
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.template.sha256 = templateHash;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  console.log(`Converted ${surfaces * EXPECTED_LABELS_PER_SURFACE} footer navigation headings to labels across ${surfaces} purchase surfaces; template hash ${templateHash}.`);
}

main().catch((error) => {
  console.error('Footer navigation label normalization failed:', error);
  process.exit(1);
});
