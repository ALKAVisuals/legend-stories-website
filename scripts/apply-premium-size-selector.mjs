import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const templateUrl = new URL('../templates/product-page.html', import.meta.url);
const appUrl = new URL('../js/app.js', import.meta.url);
const stylesUrl = new URL('../css/shared.css', import.meta.url);
const testUrl = new URL('../tests/product-variants-contract.test.mjs', import.meta.url);
const productsDirectoryUrl = new URL('../data/products/', import.meta.url);

const oldSelector = `            <fieldset class="mb-6" data-product-variant-selector>
              <legend class="text-sm font-semibold text-text-primary mb-3">Choose your size</legend>
              <div class="grid sm:grid-cols-2 gap-3">
                <label data-variant-card class="relative cursor-pointer rounded-xl border border-surface-border/40 bg-surface-light/20 p-4 transition-colors hover:border-mint/40">
                  <input class="sr-only" type="radio" name="product-size" value="compact-30">
                  <span class="flex items-start justify-between gap-3">
                    <span>
                      <span class="block text-sm font-semibold text-text-primary">Compact</span>
                      <span class="block text-xs text-text-muted mt-1">30 cm · subtle wall accent</span>
                    </span>
                    <span class="font-display text-xl font-bold">€35</span>
                  </span>
                </label>
                <label data-variant-card class="relative cursor-pointer rounded-xl border border-mint/60 bg-mint/10 p-4 transition-colors">
                  <input class="sr-only" type="radio" name="product-size" value="statement-45" checked>
                  <span class="flex items-start justify-between gap-3">
                    <span class="min-w-0">
                      <span class="block text-sm font-semibold text-text-primary">Statement</span>
                      <span class="block text-xs text-text-muted mt-1">45 cm · maximum visual impact</span>
                    </span>
                    <span class="flex shrink-0 flex-col items-end gap-2">
                      <span data-variant-badge class="rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-void">Most chosen</span>
                      <span data-variant-price class="font-display text-xl font-bold">€45</span>
                    </span>
                  </span>
                </label>
              </div>
              <p class="mt-3 text-xs text-text-muted">Size is measured along the longest side. The original proportions of the design are preserved.</p>
            </fieldset>`;

const newSelector = `            <fieldset class="product-variant-selector mb-6" data-product-variant-selector>
              <legend class="product-variant-legend">Choose your size</legend>
              <div class="product-variant-grid">
                <label data-variant-card class="product-variant-card">
                  <input class="sr-only" type="radio" name="product-size" value="compact-30">
                  <span class="product-variant-layout">
                    <span class="product-variant-copy">
                      <span class="product-variant-title-row">
                        <span class="product-variant-choice" aria-hidden="true"></span>
                        <span class="product-variant-name">Compact</span>
                      </span>
                      <span class="product-variant-description">30 cm · subtle wall accent</span>
                    </span>
                    <span class="product-variant-meta">
                      <span class="product-variant-price">€35</span>
                    </span>
                  </span>
                </label>
                <label data-variant-card class="product-variant-card is-selected">
                  <input class="sr-only" type="radio" name="product-size" value="statement-45" checked>
                  <span class="product-variant-layout">
                    <span class="product-variant-copy">
                      <span class="product-variant-title-row">
                        <span class="product-variant-choice" aria-hidden="true"></span>
                        <span class="product-variant-name">Statement</span>
                      </span>
                      <span class="product-variant-description">45 cm · maximum visual impact</span>
                    </span>
                    <span class="product-variant-meta">
                      <span class="product-variant-recommendation"><span class="product-variant-recommendation-dot" aria-hidden="true"></span>Recommended</span>
                      <span class="product-variant-price">€45</span>
                    </span>
                  </span>
                </label>
              </div>
              <p class="product-variant-note">Size is measured along the longest side. The original proportions of the design are preserved.</p>
            </fieldset>`;

const oldSelectionClasses = `        cards.forEach((card) => {
          const selected = card.contains(input);
          card.classList.toggle('border-mint/60', selected);
          card.classList.toggle('bg-mint/10', selected);
          card.classList.toggle('border-surface-border/40', !selected);
          card.classList.toggle('bg-surface-light/20', !selected);
        });`;

const newSelectionClasses = `        cards.forEach((card) => {
          const selected = card.contains(input);
          card.classList.toggle('is-selected', selected);
        });`;

const styleMarker = '/* PRODUCT VARIANT SELECTOR — Premium size choice */';
const selectorStyles = `

${styleMarker}
.product-variant-legend {
  margin-bottom: 0.75rem;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

.product-variant-grid {
  display: grid;
  gap: 0.75rem;
}

.product-variant-card {
  position: relative;
  display: block;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.product-variant-card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.product-variant-card.is-selected {
  border-color: rgba(42, 138, 74, 0.72);
  background: linear-gradient(145deg, rgba(42, 138, 74, 0.13), rgba(42, 138, 74, 0.035) 62%, rgba(255, 255, 255, 0.018));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 1px rgba(42, 138, 74, 0.08),
    0 14px 36px rgba(0, 0, 0, 0.18);
}

.product-variant-layout {
  display: grid;
  min-height: 82px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 13px;
}

.product-variant-card input:focus-visible + .product-variant-layout {
  box-shadow: inset 0 0 0 2px rgba(42, 138, 74, 0.85);
}

.product-variant-copy {
  min-width: 0;
}

.product-variant-title-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.product-variant-choice {
  position: relative;
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 999px;
  transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.product-variant-card.is-selected .product-variant-choice {
  border-color: var(--color-mint);
  background: rgba(42, 138, 74, 0.12);
  box-shadow: 0 0 0 3px rgba(42, 138, 74, 0.08);
}

.product-variant-card.is-selected .product-variant-choice::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--color-mint);
}

.product-variant-name {
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.product-variant-description {
  display: block;
  margin-top: 0.375rem;
  padding-left: 1.5625rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.product-variant-meta {
  display: flex;
  min-width: 5.75rem;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.5rem;
  text-align: right;
}

.product-variant-recommendation {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-mint);
  font-size: 0.5625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}

.product-variant-recommendation-dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 8px rgba(42, 138, 74, 0.55);
}

.product-variant-price {
  color: var(--color-text-primary);
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1;
}

.product-variant-note {
  margin-top: 0.75rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.55;
}

@media (min-width: 640px) {
  .product-variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

[data-theme="light"] .product-variant-card,
.light-mode .product-variant-card {
  border-color: rgba(17, 17, 17, 0.10);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(17, 17, 17, 0.018));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

[data-theme="light"] .product-variant-card:hover,
.light-mode .product-variant-card:hover {
  border-color: rgba(17, 17, 17, 0.18);
}

[data-theme="light"] .product-variant-card.is-selected,
.light-mode .product-variant-card.is-selected {
  border-color: rgba(181, 148, 91, 0.75);
  background: linear-gradient(145deg, rgba(181, 148, 91, 0.10), rgba(255, 255, 255, 0.96));
  box-shadow: 0 0 0 1px rgba(181, 148, 91, 0.08), 0 14px 32px rgba(17, 17, 17, 0.08);
}

[data-theme="light"] .product-variant-choice,
.light-mode .product-variant-choice {
  border-color: rgba(17, 17, 17, 0.28);
}

[data-theme="light"] .product-variant-card.is-selected .product-variant-choice,
.light-mode .product-variant-card.is-selected .product-variant-choice {
  border-color: #9A7D48;
  background: rgba(181, 148, 91, 0.10);
  box-shadow: 0 0 0 3px rgba(181, 148, 91, 0.08);
}

[data-theme="light"] .product-variant-card.is-selected .product-variant-choice::after,
.light-mode .product-variant-card.is-selected .product-variant-choice::after,
[data-theme="light"] .product-variant-recommendation-dot,
.light-mode .product-variant-recommendation-dot {
  background: #9A7D48;
}

[data-theme="light"] .product-variant-recommendation,
.light-mode .product-variant-recommendation {
  color: #8A6D3B;
}
`;

let templateSource = await readFile(templateUrl, 'utf8');
if (templateSource.includes(oldSelector)) {
  templateSource = templateSource.replace(oldSelector, newSelector);
} else if (!templateSource.includes('product-variant-card is-selected')) {
  throw new Error('Expected current size selector markup was not found.');
}
await writeFile(templateUrl, templateSource);

let appSource = await readFile(appUrl, 'utf8');
if (appSource.includes(oldSelectionClasses)) {
  appSource = appSource.replace(oldSelectionClasses, newSelectionClasses);
} else if (!appSource.includes("card.classList.toggle('is-selected', selected)")) {
  throw new Error('Expected current variant selection class logic was not found.');
}
await writeFile(appUrl, appSource);

let stylesSource = await readFile(stylesUrl, 'utf8');
if (!stylesSource.includes(styleMarker)) {
  stylesSource = stylesSource.trimEnd() + selectorStyles + '\n';
  await writeFile(stylesUrl, stylesSource);
}

let testSource = await readFile(testUrl, 'utf8');
const templateReadLine = "const templateSource = await readFile(new URL('../templates/product-page.html', import.meta.url), 'utf8');\n";
const stylesReadLine = "const sharedStylesSource = await readFile(new URL('../css/shared.css', import.meta.url), 'utf8');\n";
if (!testSource.includes(stylesReadLine)) {
  if (!testSource.includes(templateReadLine)) throw new Error('Variant test template read insertion point was not found.');
  testSource = testSource.replace(templateReadLine, templateReadLine + stylesReadLine);
}

const oldTestAssertions = `  assert.match(templateSource, /Most chosen/);
  assert.match(templateSource, /data-variant-badge/);
  assert.match(templateSource, /flex shrink-0 flex-col items-end gap-2/);
  assert.doesNotMatch(templateSource, /absolute -top-2\\.5 right-3/);`;
const newTestAssertions = `  assert.match(templateSource, /product-variant-card is-selected/);
  assert.match(templateSource, /product-variant-recommendation/);
  assert.match(templateSource, />Recommended</);
  assert.doesNotMatch(templateSource, /Most chosen|data-variant-badge/);
  assert.match(appSource, /classList\\.toggle\\('is-selected', selected\\)/);
  assert.match(sharedStylesSource, /\\.product-variant-card\\.is-selected/);
  assert.match(sharedStylesSource, /\\.product-variant-recommendation/);`;
if (testSource.includes(oldTestAssertions)) {
  testSource = testSource.replace(oldTestAssertions, newTestAssertions);
} else if (!testSource.includes('sharedStylesSource, /\\.product-variant-card\\.is-selected/')) {
  throw new Error('Expected current variant assertions were not found.');
}
await writeFile(testUrl, testSource);

const templateHash = createHash('sha256').update(templateSource).digest('hex');
const productFiles = await readdir(productsDirectoryUrl);
const presentationFiles = productFiles.filter((file) => /^2026-batch-\d+-presentation\.json$/.test(file));
if (presentationFiles.length !== 6) {
  throw new Error(`Expected 6 presentation manifests, found ${presentationFiles.length}.`);
}
for (const file of presentationFiles) {
  const manifestUrl = new URL(file, productsDirectoryUrl);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  manifest.template.sha256 = templateHash;
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
}

console.log(`Applied premium size selector and synchronized ${presentationFiles.length} template hashes.`);
