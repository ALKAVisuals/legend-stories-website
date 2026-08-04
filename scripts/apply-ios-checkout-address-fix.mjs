import { readFile, writeFile } from 'node:fs/promises';

const APP_PATH = 'js/app.js';
const CSS_PATH = 'css/shared.css';
const TEST_PATH = 'tests/checkout-address-runtime-contract.test.mjs';

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing ${label} anchor.`);
  const updated = source.replace(search, replacement);
  if (updated === source) throw new Error(`Failed to replace ${label}.`);
  return updated;
}

let app = await readFile(APP_PATH, 'utf8');

app = replaceOnce(
  app,
  `let cartControlsModule = null;`,
  `let checkoutAddressModule = null;\nlet checkoutAddressModulePromise = null;\n\nfunction loadCheckoutAddressModule() {\n  if (!checkoutAddressModulePromise) {\n    checkoutAddressModulePromise = import('./checkout-address-entry.mjs')\n      .then((module) => {\n        checkoutAddressModule = module;\n        return module;\n      });\n  }\n  return checkoutAddressModulePromise;\n}\n\nlet cartControlsModule = null;`,
  'checkout address module loader',
);

app = replaceOnce(
  app,
  `    await loadGooglePlacesLoaderModule();\n    googlePlacesLoader = googlePlacesLoader || googlePlacesLoaderModule.createGooglePlacesLoader({`,
  `    await loadGooglePlacesLoaderModule();\n    await loadCheckoutAddressModule();\n    googlePlacesLoader = googlePlacesLoader || googlePlacesLoaderModule.createGooglePlacesLoader({`,
  'checkout address module initialization',
);

app = replaceOnce(
  app,
  `  let placeAutocomplete = null;\n  let placeAutocompleteInitialized = false;`,
  `  let placeAutocomplete = null;\n  let placeAutocompleteInitialized = false;\n  let googlePlacesUnavailable = false;`,
  'Google Places state',
);

app = replaceOnce(
  app,
  `  async function loadGooglePlaces() {`,
  `  function ensureCheckoutAddressStatus() {\n    const streetInput = document.getElementById('checkout-street');\n    if (!streetInput?.parentElement) return null;\n    let status = document.getElementById('checkout-address-status');\n    if (!status) {\n      status = document.createElement('p');\n      status.id = 'checkout-address-status';\n      status.className = 'hidden text-[11px] leading-relaxed mt-1.5 text-text-muted';\n      status.setAttribute('role', 'status');\n      status.setAttribute('aria-live', 'polite');\n      streetInput.parentElement.appendChild(status);\n    }\n    streetInput.setAttribute('aria-describedby', status.id);\n    return status;\n  }\n\n  function setCheckoutAddressStatus(message, { warning = false } = {}) {\n    const status = ensureCheckoutAddressStatus();\n    if (!status) return;\n    status.textContent = message || '';\n    status.classList.toggle('hidden', !message);\n    status.classList.toggle('text-amber-300', Boolean(message) && warning);\n    status.classList.toggle('text-text-muted', !warning);\n  }\n\n  function manualAddressFallback(street, zip, city, country) {\n    if (!checkoutAddressModule) {\n      return { address: null, error: 'Address entry is temporarily unavailable. Please reload the page.' };\n    }\n    return checkoutAddressModule.createManualAddress({\n      street,\n      postalCode: zip,\n      city,\n      country,\n    });\n  }\n\n  async function loadGooglePlaces() {`,
  'checkout address status helpers',
);

app = replaceOnce(
  app,
  `    await googlePlacesLoader.load();\n    initGooglePlacesAutocomplete();`,
  `    await googlePlacesLoader.load();\n    initGooglePlacesAutocomplete();\n    googlePlacesUnavailable = false;`,
  'Google Places success state',
);

const oldStreetWatcher = `    // Watch for street field being cleared — re-enable fields\n    const streetField = document.getElementById('checkout-street');\n    if (streetField) {\n      streetField.addEventListener('input', function() {\n        if (this.value.trim() === '') {\n          validatedAddress = null;\n          const countryEl = document.getElementById('checkout-country');\n          if (countryEl) { countryEl.disabled = false; countryEl.title = ''; }\n          const zipEl = document.getElementById('checkout-zip');\n          const cityEl = document.getElementById('checkout-city');\n          if (zipEl) zipEl.dataset.validated = '';\n          if (cityEl) cityEl.dataset.validated = '';\n        }\n      });\n    }`;

const newStreetWatcher = `    // Keep manual entry usable and invalidate a selected suggestion when it is edited.\n    const streetField = document.getElementById('checkout-street');\n    if (streetField) {\n      checkoutAddressModule.configureStreetAddressInput(streetField);\n      ensureCheckoutAddressStatus();\n      if (streetField.dataset.addressEntryBound !== 'true') {\n        streetField.dataset.addressEntryBound = 'true';\n        streetField.addEventListener('input', function() {\n          validatedAddress = null;\n          checkoutAddressModule.resetValidatedAddressFields({\n            streetInput: this,\n            zipInput: document.getElementById('checkout-zip'),\n            cityInput: document.getElementById('checkout-city'),\n            countryInput: document.getElementById('checkout-country'),\n          });\n          setCheckoutAddressStatus('');\n        });\n      }\n    }`;
app = replaceOnce(app, oldStreetWatcher, newStreetWatcher, 'street input watcher');

const focusStart = `    // Add lazy loading for Google Places Autocomplete on street field focus\n    const streetInput = document.getElementById('checkout-street');\n    if (streetInput) {\n      streetInput.addEventListener('focus', async function() {`;
const focusEnd = `      });\n    }\n\n    const checkoutCloseBtn = document.getElementById('checkout-close');`;
const startIndex = app.indexOf(focusStart);
const endIndex = app.indexOf(focusEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('Missing Google Places focus handler anchors.');
const newFocusBlock = `    // Load Google suggestions as an optional enhancement. Manual typing always remains available.\n    const streetInput = document.getElementById('checkout-street');\n    if (streetInput) {\n      checkoutAddressModule.configureStreetAddressInput(streetInput);\n      streetInput.addEventListener('focus', async function() {\n        if (placeAutocompleteInitialized || streetInput.dataset.placesLoading === 'true') return;\n\n        const failedAt = Number(streetInput.dataset.placesFailedAt || 0);\n        if (googlePlacesUnavailable && Date.now() - failedAt < 30000) {\n          setCheckoutAddressStatus('Address suggestions are unavailable. You can enter the address manually.', { warning: true });\n          return;\n        }\n\n        streetInput.dataset.placesLoading = 'true';\n        setCheckoutAddressStatus('Loading address suggestions...');\n        try {\n          await loadGooglePlaces();\n          setCheckoutAddressStatus('Choose a suggestion or continue typing the address manually.');\n        } catch (error) {\n          googlePlacesUnavailable = true;\n          streetInput.dataset.placesFailedAt = String(Date.now());\n          console.warn('Google Places autocomplete could not be loaded:', error);\n          setCheckoutAddressStatus('Address suggestions are unavailable. You can enter the address manually.', { warning: true });\n        } finally {\n          delete streetInput.dataset.placesLoading;\n        }\n      });\n    }\n\n    const checkoutCloseBtn = document.getElementById('checkout-close');`;
app = app.slice(0, startIndex) + newFocusBlock + app.slice(endIndex + focusEnd.length);

const oldValidate = `  function validateAddressWithGoogle(street, zip, city, country, callback) {\n    loadGooglePlaces().then(() => {\n      doGoogleValidation(street, zip, city, country, callback);\n    }).catch((error) => {\n      console.warn('Google address validation could not start:', error);\n      callback('Address verification is temporarily unavailable. Please try again.');\n    });\n  }`;
const newValidate = `  function validateAddressWithGoogle(street, zip, city, country, callback) {\n    const useManualFallback = () => {\n      const result = manualAddressFallback(street, zip, city, country);\n      if (result.error) {\n        callback(result.error);\n        return;\n      }\n      setCheckoutAddressStatus('Address entered manually because suggestions are unavailable.', { warning: true });\n      callback(null, result.address);\n    };\n\n    if (googlePlacesUnavailable) {\n      useManualFallback();\n      return;\n    }\n\n    loadGooglePlaces().then(() => {\n      doGoogleValidation(street, zip, city, country, callback);\n    }).catch((error) => {\n      googlePlacesUnavailable = true;\n      console.warn('Google address validation could not start:', error);\n      useManualFallback();\n    });\n  }`;
app = replaceOnce(app, oldValidate, newValidate, 'Google validation fallback');

const oldStatusCheck = `      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {\n        callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');\n        return;\n      }`;
const newStatusCheck = `      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {\n        if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {\n          callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');\n          return;\n        }\n        googlePlacesUnavailable = true;\n        const fallback = manualAddressFallback(street, zip, city, country);\n        callback(fallback.error, fallback.address);\n        return;\n      }\n      if (!results || results.length === 0) {\n        callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');\n        return;\n      }`;
app = replaceOnce(app, oldStatusCheck, newStatusCheck, 'Places service status handling');

await writeFile(APP_PATH, app, 'utf8');

let css = await readFile(CSS_PATH, 'utf8');
const cssMarker = '/* Google Places checkout suggestions */';
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.pac-container {\n  z-index: 2147483647 !important;\n  margin-top: 6px !important;\n  max-width: calc(100vw - 24px) !important;\n  overflow: hidden !important;\n  background: #111113 !important;\n  border: 1px solid rgba(255,255,255,.12) !important;\n  border-radius: 12px !important;\n  box-shadow: 0 20px 60px rgba(0,0,0,.55) !important;\n  color: #f5f5f5 !important;\n  font-family: Inter, system-ui, sans-serif !important;\n}\n.pac-item {\n  min-height: 48px !important;\n  padding: 10px 14px !important;\n  border-top-color: rgba(255,255,255,.08) !important;\n  color: rgba(255,255,255,.68) !important;\n  cursor: pointer !important;\n}\n.pac-item:first-child { border-top: 0 !important; }\n.pac-item:hover, .pac-item-selected { background: rgba(42,138,74,.14) !important; }\n.pac-item-query { color: #fff !important; }\n.pac-matched { color: #62d98a !important; }\n@media (max-width: 640px) {\n  .pac-container {\n    left: 12px !important;\n    right: 12px !important;\n    width: auto !important;\n  }\n}\n`;
}
await writeFile(CSS_PATH, css, 'utf8');

await writeFile(TEST_PATH, `import assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport test from 'node:test';\n\nconst app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');\nconst css = await readFile(new URL('../css/shared.css', import.meta.url), 'utf8');\n\ntest('checkout address suggestions never block manual entry', () => {\n  assert.match(app, /Address suggestions are unavailable\\. You can enter the address manually\\./);\n  assert.match(app, /manualAddressFallback/);\n  assert.match(app, /googlePlacesUnavailable/);\n  assert.doesNotMatch(app, /Fill in your first name, last name and email before entering the address/);\n});\n\ntest('iOS address field is normalized and does not refocus itself after a Places failure', () => {\n  assert.match(app, /configureStreetAddressInput\\(streetInput\\)/);\n  assert.doesNotMatch(app, /Google address suggestions are temporarily unavailable[\\s\\S]{0,220}focusTarget:\\s*streetInput/);\n});\n\ntest('Google suggestion list stays above the checkout drawer on mobile', () => {\n  assert.match(css, /\\.pac-container[\\s\\S]*z-index:\\s*2147483647/);\n  assert.match(css, /@media \\(max-width: 640px\\)[\\s\\S]*\\.pac-container[\\s\\S]*left:\\s*12px/);\n});\n`, 'utf8');

console.log('Applied iOS checkout address input fix.');
