import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const loaderSource = await readFile(new URL('../js/google-places-loader.mjs', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function count(source, needle) {
  return source.split(needle).length - 1;
}

test('app uses one retryable Google Places loader', () => {
  assert.equal(count(appSource, "import('./google-places-loader.mjs')"), 1);
  assert.equal(count(appSource, 'createGooglePlacesLoader({'), 1);
  assert.doesNotMatch(appSource, /window\.initGooglePlacesAutocomplete/);
  assert.doesNotMatch(appSource, /function validateAddressWithGoogle[\s\S]*?setInterval\(/);
  assert.doesNotMatch(appSource, /streetInput\.addEventListener\('focus',[\s\S]*?once:\s*true/);
});

test('loader keeps a single in-flight request and recovers from failure', () => {
  assert.match(loaderSource, /if \(loadPromise\) return loadPromise/);
  assert.match(loaderSource, /staleScript\?\.remove\?\.\(\)/);
  assert.match(loaderSource, /script\?\.remove\?\.\(\)/);
  assert.match(loaderSource, /Google Places loading timed out/);
  assert.match(loaderSource, /loadPromise = null/);
});

test('the permanent quality chain validates the loader once', () => {
  assert.equal(
    packageJson.scripts['validate:google-places-loader'],
    'node scripts/validate-google-places-loader.mjs',
  );
  assert.equal(count(packageJson.scripts.quality, 'npm run validate:google-places-loader'), 1);
});
