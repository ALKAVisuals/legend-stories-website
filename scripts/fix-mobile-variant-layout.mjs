import { readFile, writeFile } from 'node:fs/promises';

const templateUrl = new URL('../templates/product-page.html', import.meta.url);
const testUrl = new URL('../tests/product-variants-contract.test.mjs', import.meta.url);

const oldBlock = `                <label data-variant-card class="relative cursor-pointer rounded-xl border border-mint/60 bg-mint/10 p-4 transition-colors">
                  <input class="sr-only" type="radio" name="product-size" value="statement-45" checked>
                  <span class="absolute -top-2.5 right-3 rounded-full bg-mint px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-void">Most chosen</span>
                  <span class="flex items-start justify-between gap-3">
                    <span>
                      <span class="block text-sm font-semibold text-text-primary">Statement</span>
                      <span class="block text-xs text-text-muted mt-1">45 cm · maximum visual impact</span>
                    </span>
                    <span class="font-display text-xl font-bold">€45</span>
                  </span>
                </label>`;

const newBlock = `                <label data-variant-card class="relative cursor-pointer rounded-xl border border-mint/60 bg-mint/10 p-4 transition-colors">
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
                </label>`;

const template = await readFile(templateUrl, 'utf8');
if (!template.includes(oldBlock)) {
  throw new Error('Expected statement variant block was not found exactly once.');
}
const updatedTemplate = template.replace(oldBlock, newBlock);
if (updatedTemplate === template || updatedTemplate.includes('absolute -top-2.5 right-3')) {
  throw new Error('Mobile-safe statement variant layout was not applied.');
}
await writeFile(templateUrl, updatedTemplate);

const testSource = await readFile(testUrl, 'utf8');
const testNeedle = "  assert.match(templateSource, /Most chosen/);\n";
const testAddition = "  assert.match(templateSource, /data-variant-badge/);\n  assert.match(templateSource, /flex shrink-0 flex-col items-end gap-2/);\n  assert.doesNotMatch(templateSource, /absolute -top-2\\.5 right-3/);\n";
if (!testSource.includes(testNeedle)) {
  throw new Error('Product variant contract insertion point was not found.');
}
if (!testSource.includes('data-variant-badge')) {
  await writeFile(testUrl, testSource.replace(testNeedle, `${testNeedle}${testAddition}`));
}

console.log('Applied mobile-safe product variant badge and price layout.');
