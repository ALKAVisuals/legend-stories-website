import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let app = await readFile(appPath, 'utf8');

function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Could not find ${label}.`);
  }
  return source.replace(search, replacement);
}

app = replaceOrThrow(
  app,
  `    if (savedCountry === 'NL') {\n      state.shippingCountry = 'NL';\n    } else {\n      state.shippingCountry = 'NL';\n      localStorage.removeItem('legendShippingCountry');\n    }`,
  `    const savedCountryCode = String(savedCountry || '').trim().toUpperCase();\n    state.shippingCountry = commerceModule.isShippingCountryEnabled(savedCountryCode)\n      ? savedCountryCode\n      : commerceModule.DEFAULT_SHIPPING_COUNTRY;\n    if (savedCountryCode && savedCountryCode !== state.shippingCountry) {\n      localStorage.removeItem('legendShippingCountry');\n    }`,
  'saved shipping country policy',
);

app = replaceOrThrow(
  app,
  `        import('./commerce/product-variants.mjs'),\n      ]).then(([totals, discounts, orderRequest, checkoutClient, productVariants]) => {`,
  `        import('./commerce/product-variants.mjs'),\n        import('./commerce/shipping.mjs'),\n      ]).then(([totals, discounts, orderRequest, checkoutClient, productVariants, shipping]) => {`,
  'commerce shipping import',
);

app = replaceOrThrow(
  app,
  `          ...productVariants,\n        });`,
  `          ...productVariants,\n          ...shipping,\n        });`,
  'commerce shipping exports',
);

app = replaceOrThrow(
  app,
  `  const COUNTRY_OPTIONS = Object.freeze([\n    Object.freeze({ code: 'NL', flag: '🇳🇱', name: 'Netherlands' }),\n  ]);`,
  `  function getCheckoutCountryOptions() {\n    if (!commerceModule?.getCheckoutCountryOptions) return [];\n    return commerceModule.getCheckoutCountryOptions({ includePending: true });\n  }`,
  'hard-coded country options',
);

app = replaceOrThrow(
  app,
  `    // Country selector HTML\n    const countryOptions = COUNTRY_OPTIONS.map(c =>\n      '<option value="' + c.code + '"' + (state.shippingCountry === c.code ? ' selected' : '') + '>' + c.flag + ' ' + c.name + '</option>'\n    ).join('');\n\n`,
  '',
  'unused cart country options',
);

app = replaceOrThrow(
  app,
  `<p class="text-[11px] text-text-muted mt-1.5">🚚 Shipping calculated at checkout based on your country. Netherlands shipping is €4,95 and free from €69. International checkout opens per validated market.</p>`,
  `<p class="text-[11px] text-text-muted mt-1.5">Shipping within the Netherlands is €4,95 and free from €69. United States shipping opens after tracked rates and import charges are confirmed.</p>`,
  'cart shipping copy',
);

app = replaceOrThrow(
  app,
  `    // Populate country dropdown\n    const countrySelect = document.getElementById('checkout-country');\n    if (countrySelect && countrySelect.options.length === 0) {\n      COUNTRY_OPTIONS.forEach(c => {\n        const opt = document.createElement('option');\n        opt.value = c.code;\n        opt.textContent = c.flag + ' ' + c.name;\n        if (c.code === 'NL') opt.selected = true;\n        countrySelect.appendChild(opt);\n      });\n    }\n\n    // Set saved country\n    if (countrySelect) {\n      countrySelect.value = state.shippingCountry || 'NL';\n    }`,
  `    // Build the country list from the shared browser/server shipping policy.\n    const countrySelect = document.getElementById('checkout-country');\n    if (countrySelect) {\n      countrySelect.replaceChildren();\n      getCheckoutCountryOptions().forEach((country) => {\n        const option = document.createElement('option');\n        option.value = country.code;\n        option.textContent = country.label;\n        option.disabled = !country.enabled;\n        option.dataset.status = country.status;\n        option.title = country.notice;\n        countrySelect.appendChild(option);\n      });\n\n      const requestedCountry = String(state.shippingCountry || '').toUpperCase();\n      state.shippingCountry = commerceModule.isShippingCountryEnabled(requestedCountry)\n        ? requestedCountry\n        : commerceModule.DEFAULT_SHIPPING_COUNTRY;\n      countrySelect.value = state.shippingCountry;\n      updateShippingMarketNotice(state.shippingCountry);\n    }`,
  'checkout country population',
);

app = replaceOrThrow(
  app,
  `    // Country change listener\n    if (countrySelect) {\n      countrySelect.onchange = function() {\n        state.shippingCountry = this.value;\n        updateCheckoutTotals();\n      };\n    }`,
  `    // Country change listener\n    if (countrySelect) {\n      countrySelect.onchange = function() {\n        const nextCountry = String(this.value || '').toUpperCase();\n        if (!commerceModule.isShippingCountryEnabled(nextCountry)) {\n          this.value = state.shippingCountry;\n          updateShippingMarketNotice(state.shippingCountry);\n          return;\n        }\n        state.shippingCountry = nextCountry;\n        validatedAddress = null;\n        saveCart();\n        updateGooglePlacesCountryRestriction(nextCountry);\n        updateShippingMarketNotice(nextCountry);\n        updateCheckoutTotals();\n      };\n    }`,
  'checkout country change listener',
);

app = replaceOrThrow(
  app,
  `  const EU_COUNTRY_CODES = new Set([`,
  `  function ensureShippingMarketNotice() {\n    const country = document.getElementById('checkout-country');\n    if (!country?.parentElement) return null;\n    let notice = document.getElementById('checkout-market-note');\n    if (!notice) {\n      notice = document.createElement('p');\n      notice.id = 'checkout-market-note';\n      notice.className = 'text-[11px] leading-relaxed text-text-muted mt-2';\n      notice.setAttribute('role', 'status');\n      country.insertAdjacentElement('afterend', notice);\n    }\n    return notice;\n  }\n\n  function updateShippingMarketNotice(countryCode = state.shippingCountry) {\n    const notice = ensureShippingMarketNotice();\n    if (!notice || !commerceModule) return;\n    const activeMessage = commerceModule.getShippingMarketNotice(countryCode);\n    const pendingMarkets = getCheckoutCountryOptions().filter((market) => !market.enabled);\n    const pendingMessage = pendingMarkets.length > 0\n      ? pendingMarkets.map((market) => market.notice).join(' ')\n      : '';\n    notice.textContent = [activeMessage, pendingMessage].filter(Boolean).join(' ');\n  }\n\n  const EU_COUNTRY_CODES = new Set([`,
  'shipping market notice helpers',
);

app = replaceOrThrow(
  app,
  `    updateInternationalShippingNotice(totals.countryCode);\n  }`,
  `    updateInternationalShippingNotice(totals.countryCode);\n    updateShippingMarketNotice(totals.countryCode);\n  }`,
  'checkout totals market notice',
);

app = replaceOrThrow(
  app,
  `    // Email format check\n    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n      announcePurchaseFeedback('Please enter a valid email address.', {\n        assertive: true,\n        focusTarget: document.getElementById('checkout-email'),\n      });\n      return;\n    }\n\n    // Address validation:`,
  `    // Email format check\n    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n      announcePurchaseFeedback('Please enter a valid email address.', {\n        assertive: true,\n        focusTarget: document.getElementById('checkout-email'),\n      });\n      return;\n    }\n\n    if (!commerceModule.isShippingCountryEnabled(country)) {\n      announcePurchaseFeedback(commerceModule.getShippingMarketNotice(country), {\n        assertive: true,\n        focusTarget: document.getElementById('checkout-country'),\n      });\n      return;\n    }\n\n    // Address validation:`,
  'checkout market guard',
);

app = replaceOrThrow(
  app,
  `  async function processOrder(address, firstname, lastname, email) {\n    const validatedCountry = address.country;\n    const totals = getCommerceTotals(validatedCountry);\n    let orderRequest;`,
  `  async function processOrder(address, firstname, lastname, email) {\n    const validatedCountry = String(address.country || '').toUpperCase();\n    if (!commerceModule.isShippingCountryEnabled(validatedCountry)) {\n      announcePurchaseFeedback(commerceModule.getShippingMarketNotice(validatedCountry), { assertive: true });\n      return;\n    }\n    const totals = getCommerceTotals(validatedCountry);\n    let orderRequest;`,
  'server-bound order market guard',
);

app = replaceOrThrow(
  app,
  `    placeAutocomplete = new window.google.maps.places.Autocomplete(streetInput, {\n      types: ['address'],\n      fields: ['address_components', 'formatted_address', 'geometry', 'name'],\n    });`,
  `    placeAutocomplete = new window.google.maps.places.Autocomplete(streetInput, {\n      types: ['address'],\n      fields: ['address_components', 'formatted_address', 'geometry', 'name'],\n      componentRestrictions: {\n        country: commerceModule.getPlacesCountryRestriction(state.shippingCountry),\n      },\n    });`,
  'Google Places market restriction',
);

app = replaceOrThrow(
  app,
  `    placeAutocompleteInitialized = true;\n\n    placeAutocomplete.addListener('place_changed', function() {`,
  `    placeAutocompleteInitialized = true;\n    updateGooglePlacesCountryRestriction(state.shippingCountry);\n\n    placeAutocomplete.addListener('place_changed', function() {`,
  'Google Places initial restriction update',
);

app = replaceOrThrow(
  app,
  `  function parseAndFillAddress(place) {`,
  `  function updateGooglePlacesCountryRestriction(countryCode = state.shippingCountry) {\n    if (!placeAutocomplete?.setComponentRestrictions || !commerceModule) return;\n    placeAutocomplete.setComponentRestrictions({\n      country: commerceModule.getPlacesCountryRestriction(countryCode),\n    });\n  }\n\n  function parseAndFillAddress(place) {`,
  'Google Places restriction helper',
);

app = replaceOrThrow(
  app,
  `    for (const comp of components) {\n      const types = comp.types;\n      if (types.includes('street_number')) street_number = comp.long_name;\n      if (types.includes('route')) route = comp.long_name;\n      if (types.includes('postal_code')) postal_code = comp.long_name;\n      if (types.includes('locality') || types.includes('postal_town')) city = comp.long_name;\n      if (types.includes('country')) country_code = comp.short_name.toLowerCase();\n    }\n\n    // Fill street`,
  `    for (const comp of components) {\n      const types = comp.types;\n      if (types.includes('street_number')) street_number = comp.long_name;\n      if (types.includes('route')) route = comp.long_name;\n      if (types.includes('postal_code')) postal_code = comp.long_name;\n      if (types.includes('locality') || types.includes('postal_town')) city = comp.long_name;\n      if (types.includes('country')) country_code = comp.short_name.toLowerCase();\n    }\n\n    const resolvedCountry = country_code.toUpperCase();\n    if (!commerceModule.isShippingCountryEnabled(resolvedCountry)) {\n      validatedAddress = null;\n      setCheckoutAddressStatus(commerceModule.getShippingMarketNotice(resolvedCountry), { warning: true });\n      return;\n    }\n\n    // Fill street`,
  'Google result market guard',
);

app = replaceOrThrow(
  app,
  `      country: country_code.toUpperCase(),`,
  `      country: resolvedCountry,`,
  'validated address country',
);

await writeFile(appPath, app);

const contractTest = `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

test('checkout country options come from the shared shipping policy', () => {
  assert.match(app, /import\('\.\/commerce\/shipping\.mjs'\)/);
  assert.match(app, /commerceModule\.getCheckoutCountryOptions/);
  assert.match(app, /option\.disabled = !country\.enabled/);
  assert.doesNotMatch(app, /const COUNTRY_OPTIONS/);
  assert.doesNotMatch(app, /c\.flag/);
});

test('unsupported markets cannot reach payment even after DOM manipulation', () => {
  assert.match(app, /if \(!commerceModule\.isShippingCountryEnabled\(country\)\)/);
  assert.match(app, /if \(!commerceModule\.isShippingCountryEnabled\(validatedCountry\)\)/);
  assert.match(app, /commerceModule\.getShippingMarketNotice/);
});

test('Google Places follows the active enabled shipping market', () => {
  assert.match(app, /componentRestrictions:/);
  assert.match(app, /getPlacesCountryRestriction\(state\.shippingCountry\)/);
  assert.match(app, /setComponentRestrictions/);
});

test('cart and checkout explain the staged United States rollout without emoji flags', () => {
  assert.match(app, /United States shipping opens after tracked rates and import charges are confirmed/);
  assert.doesNotMatch(app, /Shipping calculated at checkout based on your country/);
});
`;

await writeFile(new URL('../tests/shipping-checkout-ui-contract.test.mjs', import.meta.url), contractTest);
