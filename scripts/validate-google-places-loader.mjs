import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const errors = [];

function count(source, needle) {
  return source.split(needle).length - 1;
}

const [appSource, loaderSource, packageSource] = await Promise.all([
  readFile(join(ROOT, 'js/app.js'), 'utf8'),
  readFile(join(ROOT, 'js/google-places-loader.mjs'), 'utf8'),
  readFile(join(ROOT, 'package.json'), 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

if (count(appSource, "import('./google-places-loader.mjs')") !== 1) {
  errors.push('js/app.js must load the Google Places loader exactly once.');
}
if (count(appSource, 'createGooglePlacesLoader({') !== 1) {
  errors.push('js/app.js must create one Google Places loader.');
}
if (appSource.includes('window.initGooglePlacesAutocomplete')) {
  errors.push('The permanent initGooglePlacesAutocomplete browser global must be removed.');
}
if (/function validateAddressWithGoogle[\s\S]*?setInterval\(/.test(appSource)) {
  errors.push('Address validation must not poll Google Places with setInterval.');
}
if (/streetInput\.addEventListener\('focus',[\s\S]*?\{ once: true \}/.test(appSource)) {
  errors.push('Street focus loading must remain retryable after missing prerequisite fields.');
}
for (const signal of [
  'await googlePlacesLoader.load()',
  "Address verification is temporarily unavailable. Please try again.",
  "Google address suggestions are temporarily unavailable. You can try focusing the address field again.",
  'loadGooglePlaces().then(() =>',
]) {
  if (!appSource.includes(signal)) errors.push(`js/app.js is missing resilient Places behavior: ${signal}`);
}

for (const signal of [
  'if (loadPromise) return loadPromise',
  'staleScript?.remove?.()',
  "script.onerror = () => fail('Google Places could not be loaded.')",
  "() => fail('Google Places loading timed out.')",
  'deleteTemporaryCallback(windowRef, callbackName)',
  "loading: 'async'",
]) {
  if (!loaderSource.includes(signal)) errors.push(`js/google-places-loader.mjs is missing required behavior: ${signal}`);
}

if (packageJson.scripts?.['validate:google-places-loader'] !== 'node scripts/validate-google-places-loader.mjs') {
  errors.push('package.json must expose validate:google-places-loader.');
}
if (count(packageJson.scripts?.quality || '', 'npm run validate:google-places-loader') !== 1) {
  errors.push('The permanent quality chain must run validate:google-places-loader exactly once.');
}

if (errors.length) {
  console.error('Google Places loader validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Google Places loader validation passed with deduplication, retry and timeout recovery.');
