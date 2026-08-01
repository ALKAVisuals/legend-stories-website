import { readFile, writeFile } from 'node:fs/promises';

const target = new URL('./product-page-generation.mjs', import.meta.url);
let source = await readFile(target, 'utf8');

const replaceHelper = /function replaceRequired\(source, pattern, replacement, label, expectedCount = 1\) \{[\s\S]*?\n\}\n\nfunction matchRequired/;
const correctReplaceHelper = `function replaceRequired(source, pattern, replacement, label, expectedCount = 1) {
  let count = 0;
  if (pattern.global) {
    pattern.lastIndex = 0;
    count = [...source.matchAll(pattern)].length;
    pattern.lastIndex = 0;
  } else {
    pattern.lastIndex = 0;
    count = pattern.test(source) ? 1 : 0;
    pattern.lastIndex = 0;
  }
  if (count !== expectedCount) {
    throw new Error(\`${'${label}'}: expected ${'${expectedCount}'} match(es), found ${'${count}'}.\`);
  }
  return source.replace(pattern, replacement);
}

function matchRequired`;

const navClass = /function navClass\(category, activeCategory, mobile\) \{[\s\S]*?\n\}\n\nfunction breadcrumb/;
const correctNavClass = `function navClass(category, activeCategory, mobile) {
  if (category === activeCategory) {
    return mobile
      ? 'text-sm text-mint font-medium py-2'
      : 'text-sm text-mint font-medium';
  }
  return mobile
    ? 'text-sm text-text-secondary hover:text-mint transition-colors font-medium py-2'
    : 'text-sm text-text-secondary hover:text-mint transition-colors font-medium';
}

function breadcrumb`;

for (const [label, pattern, replacement] of [
  ['replaceRequired helper', replaceHelper, correctReplaceHelper],
  ['navClass helper', navClass, correctNavClass],
]) {
  if (!pattern.test(source)) throw new Error(`${label} was not found.`);
  source = source.replace(pattern, replacement);
}

const apostropheEscape = `.replaceAll('"', '&quot;')\n    .replaceAll("'", '&#039;');`;
const contextSafeEscape = `.replaceAll('"', '&quot;');`;
if (source.includes(apostropheEscape)) {
  source = source.replace(apostropheEscape, contextSafeEscape);
}

if (source.includes("return typeof replacement === 'function' ? replacement(...args) : replacement")) {
  throw new Error('The broken string replacement callback remains in the generator.');
}
if (source.includes(".replaceAll(\"'\", '&#039;')")) {
  throw new Error('Apostrophes are still unnecessarily escaped in generated product content.');
}

await writeFile(target, source, 'utf8');
console.log('Product page generation helpers repaired successfully.');
