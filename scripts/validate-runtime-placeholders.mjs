import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const errors = [];

function count(source, needle) {
  return source.split(needle).length - 1;
}

const [appSource, packageSource] = await Promise.all([
  readFile(join(ROOT, 'js/app.js'), 'utf8'),
  readFile(join(ROOT, 'package.json'), 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

for (const signal of [
  'function initHoverExpandMobile',
  'function initVideoPlayer',
  'initHoverExpandMobile,',
  'initVideoPlayer,',
  "console.log('Play video:'",
  'Placeholder: show alert or expand to modal',
  'Future: open video modal or redirect',
]) {
  if (appSource.includes(signal)) {
    errors.push(`js/app.js still contains inert production runtime code: ${signal}`);
  }
}

const initializerMatch = appSource.match(/const fns = \[([\s\S]*?)\n    \];/);
if (!initializerMatch) {
  errors.push('js/app.js initialization list could not be inspected.');
} else {
  const entries = initializerMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.some((entry) => !new RegExp(`function\\s+${entry}\\s*\\(`).test(appSource))) {
    errors.push('Every initializer entry must resolve to a concrete function declaration.');
  }
}

if (packageJson.scripts?.['validate:runtime-placeholders'] !== 'node scripts/validate-runtime-placeholders.mjs') {
  errors.push('package.json must expose validate:runtime-placeholders.');
}
if (count(packageJson.scripts?.quality || '', 'npm run validate:runtime-placeholders') !== 1) {
  errors.push('The permanent quality chain must run validate:runtime-placeholders exactly once.');
}

if (errors.length) {
  console.error('Runtime placeholder validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Runtime placeholder validation passed with only concrete production initializers.');
