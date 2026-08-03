import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function count(source, needle) {
  return source.split(needle).length - 1;
}

test('production runtime contains no inert video or mobile placeholder initializer', () => {
  assert.doesNotMatch(appSource, /function initHoverExpandMobile/);
  assert.doesNotMatch(appSource, /function initVideoPlayer/);
  assert.doesNotMatch(appSource, /\binitHoverExpandMobile\b/);
  assert.doesNotMatch(appSource, /\binitVideoPlayer\b/);
  assert.doesNotMatch(appSource, /console\.log\('Play video:'/);
  assert.doesNotMatch(appSource, /Placeholder: show alert or expand to modal/);
});

test('initializer list references concrete functions only', () => {
  const initializerMatch = appSource.match(/const fns = \[([\s\S]*?)\n    \];/);
  assert.ok(initializerMatch);
  const entries = initializerMatch[1]
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.match(appSource, new RegExp(`function\\s+${entry}\\s*\\(`));
  }
});

test('the permanent quality chain validates runtime placeholders once', () => {
  assert.equal(
    packageJson.scripts['validate:runtime-placeholders'],
    'node scripts/validate-runtime-placeholders.mjs',
  );
  assert.equal(count(packageJson.scripts.quality, 'npm run validate:runtime-placeholders'), 1);
});
