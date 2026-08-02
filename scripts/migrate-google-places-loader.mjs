import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(source, pattern, replacement, label) {
  const flags = pattern instanceof RegExp
    ? (pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
    : '';
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, flags))].length;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}.`);
  }
  return source.replace(pattern, replacement);
}

const appPath = 'js/app.js';
let app = await readFile(appPath, 'utf8');

app = replaceRequired(
  app,
  'let cartControlsModule = null;\n',
  `let googlePlacesLoaderModule = null;\nlet googlePlacesLoaderModulePromise = null;\nlet googlePlacesLoader = null;\n\nfunction loadGooglePlacesLoaderModule() {\n  if (!googlePlacesLoaderModulePromise) {\n    googlePlacesLoaderModulePromise = import('./google-places-loader.mjs')\n      .then((module) => {\n        googlePlacesLoaderModule = module;\n        return module;\n      });\n  }\n  return googlePlacesLoaderModulePromise;\n}\n\nlet cartControlsModule = null;\n`,
  'insert Google Places loader module',
);

app = replaceRequired(
  app,
  /  let placeAutocomplete = null;\n  let placeAutocompleteInitialized = false;\n\n  const GP_API_KEY = 'V5yqGyVnJ1IFk3fpZojBuvxMAic=';\n\n  function loadGooglePlaces\(\) \{[\s\S]*?  \}\n\n  function initGooglePlacesAutocomplete\(\) \{/,
  `  let placeAutocomplete = null;\n  let placeAutocompleteInitialized = false;\n\n  const GP_API_KEY = 'V5yqGyVnJ1IFk3fpZojBuvxMAic=';\n\n  async function loadGooglePlaces() {\n    if (placeAutocompleteInitialized) return;\n    if (!googlePlacesLoader) {\n      throw new Error('Google Places loader is not initialized.');\n    }\n    await googlePlacesLoader.load();\n    initGooglePlacesAutocomplete();\n  }\n\n  function initGooglePlacesAutocomplete() {`,
  'replace direct Google script injection',
);

app = replaceRequired(
  app,
  '    placeAutocomplete = new google.maps.places.Autocomplete(streetInput, {\n',
  '    placeAutocomplete = new window.google.maps.places.Autocomplete(streetInput, {\n',
  'use explicit window Google autocomplete',
);

app = replaceRequired(
  app,
  '  // Global callback for Google script\n  window.initGooglePlacesAutocomplete = initGooglePlacesAutocomplete;\n\n',
  '',
  'remove permanent Google callback global',
);

app = replaceRequired(
  app,
  /    const streetInput = document\.getElementById\('checkout-street'\);\n    if \(streetInput\) \{\n      streetInput\.addEventListener\('focus', function\(\) \{[\s\S]*?      \}, \{ once: true \}\);\n    \}/,
  `    const streetInput = document.getElementById('checkout-street');\n    if (streetInput) {\n      streetInput.addEventListener('focus', async function() {\n        const fn = document.getElementById('checkout-firstname')?.value.trim();\n        const ln = document.getElementById('checkout-lastname')?.value.trim();\n        const email = document.getElementById('checkout-email')?.value.trim();\n        if (!fn || !ln || !email) {\n          const firstMissing = !fn\n            ? document.getElementById('checkout-firstname')\n            : !ln\n              ? document.getElementById('checkout-lastname')\n              : document.getElementById('checkout-email');\n          announcePurchaseFeedback('Fill in your first name, last name and email before entering the address.', {\n            assertive: true,\n            focusTarget: firstMissing,\n          });\n          return;\n        }\n\n        try {\n          await loadGooglePlaces();\n        } catch (error) {\n          console.warn('Google Places autocomplete could not be loaded:', error);\n          announcePurchaseFeedback(\n            'Google address suggestions are temporarily unavailable. You can try focusing the address field again.',\n            { assertive: true, focusTarget: streetInput },\n          );\n        }\n      });\n    }`,
  'make street focus loading retryable',
);

app = replaceRequired(
  app,
  /  function validateAddressWithGoogle\(street, zip, city, country, callback\) \{[\s\S]*?  \}\n\n  function doGoogleValidation/,
  `  function validateAddressWithGoogle(street, zip, city, country, callback) {\n    loadGooglePlaces().then(() => {\n      doGoogleValidation(street, zip, city, country, callback);\n    }).catch((error) => {\n      console.warn('Google address validation could not start:', error);\n      callback('Address verification is temporarily unavailable. Please try again.');\n    });\n  }\n\n  function doGoogleValidation`,
  'replace polling address validation',
);

app = replaceRequired(
  app,
  '    var service = new google.maps.places.PlacesService(document.createElement(\'div\'));\n',
  '    var service = new window.google.maps.places.PlacesService(document.createElement(\'div\'));\n',
  'use explicit window Google places service',
);
app = replaceRequired(
  app,
  '      if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {\n',
  '      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {\n',
  'use explicit window Google service status',
);

app = replaceRequired(
  app,
  '    await loadCartControlsModule();\n',
  `    await loadCartControlsModule();\n    await loadGooglePlacesLoaderModule();\n    googlePlacesLoader = googlePlacesLoader || googlePlacesLoaderModule.createGooglePlacesLoader({\n      apiKey: GP_API_KEY,\n      windowRef: window,\n      documentRef: document,\n    });\n`,
  'initialize the shared Google Places loader',
);

await writeFile(appPath, app, 'utf8');

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:google-places-loader'] = 'node scripts/validate-google-places-loader.mjs';
const qualityMarker = 'npm run validate:cart-controls &&';
if (!packageJson.scripts.quality.includes(qualityMarker)) {
  throw new Error('package quality chain is missing the cart-controls marker.');
}
if (!packageJson.scripts.quality.includes('npm run validate:google-places-loader')) {
  packageJson.scripts.quality = packageJson.scripts.quality.replace(
    qualityMarker,
    `${qualityMarker} npm run validate:google-places-loader &&`,
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Google Places loader migration completed.');
