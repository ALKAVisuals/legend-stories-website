import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../scripts/verify-neon-runtime-privileges.mjs', import.meta.url),
  'utf8',
);

test('Neon privilege proof explicitly types dynamic object-name parameters', () => {
  const typedFormatCalls = source.match(/format\('legend_commerce\.%I', \$2::text\)/g) || [];

  assert.equal(typedFormatCalls.length, 11);
  assert.doesNotMatch(source, /format\('legend_commerce\.%I', \$2\)/);
  assert.match(source, /table_name = \$2::text/);
});
