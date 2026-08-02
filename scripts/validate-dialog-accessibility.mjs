import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PURCHASE_SURFACES = 118;
const EXPECTED_DIALOGS_PER_SURFACE = 2;

function parseAttributes(source = '') {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return attributes;
}

function headingLevels(html = '') {
  return [...html.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
}

function headingJumps(levels = []) {
  return levels.flatMap((level, index) => {
    if (index === 0 || level <= levels[index - 1] + 1) return [];
    return [{ from: levels[index - 1], to: level, index }];
  });
}

function dialogAttributes(html = '') {
  return [...html.matchAll(/<aside\b([^>]*\brole=["']dialog["'][^>]*)>/gi)]
    .map((match) => parseAttributes(match[1]));
}

function validateSurface(name, html, failures) {
  const dialogs = dialogAttributes(html);
  if (dialogs.length !== EXPECTED_DIALOGS_PER_SURFACE) {
    failures.push(`${name}: expected ${EXPECTED_DIALOGS_PER_SURFACE} dialogs, found ${dialogs.length}`);
  }

  for (const [index, attributes] of dialogs.entries()) {
    const id = attributes.id || `dialog-${index + 1}`;
    if (attributes['aria-modal'] !== 'true') failures.push(`${name}#${id}: missing aria-modal="true"`);
    if (attributes['aria-hidden'] !== 'true') failures.push(`${name}#${id}: initial aria-hidden must be "true"`);
    if (attributes['data-focus-managed'] !== 'true') failures.push(`${name}#${id}: missing data-focus-managed="true"`);
    if (attributes.tabindex !== '-1') failures.push(`${name}#${id}: missing tabindex="-1" fallback`);
  }

  const feedback = html.match(/<[^>]+\bid=["']purchase-feedback["'][^>]*>/i);
  if (!feedback) {
    failures.push(`${name}: missing #purchase-feedback live region`);
  } else {
    const attributes = parseAttributes(feedback[0]);
    if (attributes.role !== 'status') failures.push(`${name}: #purchase-feedback must start with role="status"`);
    if (attributes['aria-live'] !== 'polite') failures.push(`${name}: #purchase-feedback must start with aria-live="polite"`);
    if (attributes['aria-atomic'] !== 'true') failures.push(`${name}: #purchase-feedback must use aria-atomic="true"`);
  }

  for (const jump of headingJumps(headingLevels(html))) {
    failures.push(`${name}: heading level jumps from h${jump.from} to h${jump.to} at heading ${jump.index}`);
  }
}

async function main() {
  const failures = [];
  const files = (await readdir(ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => entry.name)
    .sort();

  const purchaseSurfaces = [];
  for (const file of files) {
    const html = await readFile(join(ROOT, file), 'utf8');
    if (!/id=["']checkout-drawer["']/i.test(html)) continue;
    purchaseSurfaces.push(file);
    validateSurface(file, html, failures);
  }

  if (purchaseSurfaces.length !== EXPECTED_PURCHASE_SURFACES) {
    failures.push(`Expected ${EXPECTED_PURCHASE_SURFACES} purchase surfaces, found ${purchaseSurfaces.length}`);
  }

  const templatePath = join(ROOT, 'templates', 'product-page.html');
  validateSurface('templates/product-page.html', await readFile(templatePath, 'utf8'), failures);

  const app = await readFile(join(ROOT, 'js', 'app.js'), 'utf8');
  const runtimeContracts = [
    ['dialog module loader', /loadDialogAccessibilityModule/],
    ['cart dialog controller', /cartDialogController\s*=\s*dialogAccessibilityModule\.createDialogController/],
    ['checkout dialog controller', /checkoutDialogController\s*=\s*dialogAccessibilityModule\.createDialogController/],
    ['focus-safe cart transition', /closeCart\(\{\s*restoreFocus:\s*false\s*\}\)/],
    ['purchase feedback helper', /function announcePurchaseFeedback\(/],
  ];
  for (const [label, pattern] of runtimeContracts) {
    if (!pattern.test(app)) failures.push(`js/app.js: missing ${label}`);
  }

  const dialogModule = await readFile(join(ROOT, 'js', 'dialog-accessibility.mjs'), 'utf8');
  for (const [label, pattern] of [
    ['Tab containment', /event\.key !== 'Tab'/],
    ['Escape request handling', /event\.key === 'Escape'/],
    ['focus restoration', /restoreFocus && focusTarget/],
  ]) {
    if (!pattern.test(dialogModule)) failures.push(`js/dialog-accessibility.mjs: missing ${label}`);
  }

  if (failures.length) {
    console.error(`Dialog accessibility validation failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`Dialog accessibility validated: ${purchaseSurfaces.length} purchase surfaces, ${purchaseSurfaces.length * EXPECTED_DIALOGS_PER_SURFACE} modal dialogs, zero heading jumps.`);
}

main().catch((error) => {
  console.error('Dialog accessibility validation failed unexpectedly:', error);
  process.exit(1);
});
