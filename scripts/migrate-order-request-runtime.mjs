import { readFile, writeFile } from 'node:fs/promises';

const APP_PATH = new URL('../js/app.js', import.meta.url);
let source = await readFile(APP_PATH, 'utf8');

function replaceOnce(pattern, replacement, label, completedMarker = '') {
  if (completedMarker && source.includes(completedMarker)) return;
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches.length}.`);
  }
  source = source.replace(pattern, replacement);
}

replaceOnce(
  /(  const state = \{[\s\S]*?\n  \};)\n\n  \/\/ ==========================================\n  \/\/ LOCAL STORAGE/,
  `$1\n\n  const CART_SCHEMA_VERSION = '2';\n\n  // ==========================================\n  // LOCAL STORAGE`,
  'cart schema constant',
  "const CART_SCHEMA_VERSION = '2';",
);

replaceOnce(
  /  function saveCart\(\) \{\n    localStorage\.setItem\('legendCart', JSON\.stringify\(state\.cart\)\);/,
  `  function saveCart() {\n    localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);\n    localStorage.setItem('legendCart', JSON.stringify(state.cart));`,
  'cart schema persistence',
  "localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);",
);

replaceOnce(
  /  function loadCart\(\) \{\n    const savedCart = localStorage\.getItem\('legendCart'\);\n    const savedCountry = localStorage\.getItem\('legendShippingCountry'\);\n    const savedDiscountCode = localStorage\.getItem\('legendDiscountCode'\);\n    const savedDiscountPercent = localStorage\.getItem\('legendDiscountPercent'\);\n    if \(savedCart\) \{\n      try \{\n        state\.cart = JSON\.parse\(savedCart\);\n      \} catch \(e\) \{\n        state\.cart = \[\];\n      \}\n    \}/,
  `  function loadCart() {\n    const savedCart = localStorage.getItem('legendCart');\n    const savedCartVersion = localStorage.getItem('legendCartVersion');\n    const savedCountry = localStorage.getItem('legendShippingCountry');\n    const savedDiscountCode = localStorage.getItem('legendDiscountCode');\n    const savedDiscountPercent = localStorage.getItem('legendDiscountPercent');\n    if (savedCart && savedCartVersion === CART_SCHEMA_VERSION) {\n      try {\n        const parsedCart = JSON.parse(savedCart);\n        state.cart = Array.isArray(parsedCart)\n          ? parsedCart.filter((item) => item && item.page && Number(item.quantity) > 0)\n          : [];\n      } catch (e) {\n        state.cart = [];\n      }\n    } else if (savedCart) {\n      localStorage.removeItem('legendCart');\n      localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);\n      state.cart = [];\n    }`,
  'legacy cart migration',
  "savedCartVersion === CART_SCHEMA_VERSION",
);

replaceOnce(
  /      commerceModulePromise = import\('\.\/commerce\/totals\.mjs'\)\.then\(\(module\) => \{\n        commerceModule = module;\n        return module;\n      \}\);/,
  `      commerceModulePromise = Promise.all([\n        import('./commerce/totals.mjs'),\n        import('./commerce/discounts.mjs'),\n        import('./commerce/order-request.mjs'),\n      ]).then(([totals, discounts, orderRequest]) => {\n        commerceModule = Object.freeze({ ...totals, ...discounts, ...orderRequest });\n        return commerceModule;\n      });`,
  'commerce runtime module loading',
  "import('./commerce/order-request.mjs')",
);

replaceOnce(
  /  \];\n\n  \/\/ ==========================================\n  \/\/ DOM REFERENCES/,
  `  ];\n\n  const PRODUCT_PAGE_BY_NAME = Object.freeze({\n    'The Grind Cycle': 'combat-grind-cycle.html',\n    'Unstoppable Will': 'combat-unstoppable-will.html',\n    'Unstoppable Will Sport': 'sport-unstoppable-will.html',\n    'Dream Reality': 'combat-dream-reality.html',\n    'Courageous Risk': 'combat-courageous-risk.html',\n    'Greatest Courage': 'combat-greatest-courage.html',\n    'The Free Spirit': 'music-free-spirit.html',\n    'Eternal Smile': 'music-eternal-smile.html',\n    'Constant Evolution': 'music-constant-evolution.html',\n    'Lyric Mastery': 'music-lyric-mastery.html',\n    'Pure Confidence': 'music-pure-confidence.html',\n    'The Style Code': 'music-style-code.html',\n    'The Style Prophet': 'music-style-prophet.html',\n    'The Truth Seeker': 'music-truth-seeker.html',\n    "The Lion's Pride": 'sport-lions-pride.html',\n    'The Luxury Standard': 'sport-luxury-standard.html',\n    'The Peak Performer': 'sport-peak-performer.html',\n    'Pursuit of Greatness': 'sport-pursuit-greatness.html',\n    'Unforgettable Roots': 'sport-unforgettable-roots.html',\n    'Mamba Mindset': 'sport-mamba-mindset.html',\n  });\n\n  // ==========================================\n  // DOM REFERENCES`,
  'homepage product page mapping',
  'const PRODUCT_PAGE_BY_NAME = Object.freeze({',
);

replaceOnce(
  /  function addToCart\(name, price, image\) \{\n    const product = \{\n      id: name\.toLowerCase\(\)\.replace\(\/\\s\+\/g, '-'\),\n      name: name,\n      price: parseFloat\(price\),\n      quantity: 1,\n      image: image \|\| '🎨',\n    \};/,
  `  function addToCart(page, name, price, image) {\n    if (!page) {\n      throw new Error('A stable product page is required before adding an item to the cart.');\n    }\n    const product = {\n      id: page,\n      page: page,\n      name: name,\n      price: parseFloat(price),\n      quantity: 1,\n      image: image || '🎨',\n    };`,
  'stable cart item identity',
  'A stable product page is required before adding an item to the cart.',
);

replaceOnce(
  /  function initAddToCart\(\) \{[\s\S]*?\n  \}\n\n  \/\/ Product card navigation/,
  `  function resolveCartProductPage(button, name) {\n    return commerceModule.resolveProductPage({\n      explicitPage: button.dataset.page || '',\n      containerPage: button.closest('[data-page]')?.dataset.page || '',\n      currentPath: window.location.pathname,\n      name,\n      pageByName: PRODUCT_PAGE_BY_NAME,\n    });\n  }\n\n  function initAddToCart() {\n    const btns = document.querySelectorAll('.add-to-cart-btn');\n    btns.forEach((btn) => {\n      btn.addEventListener('click', () => {\n        const name = btn.dataset.name;\n        const price = btn.dataset.price;\n        const image = btn.dataset.emoji || btn.dataset.img;\n        const page = resolveCartProductPage(btn, name);\n        if (!page) {\n          console.error('Cannot add product without a stable catalog page:', name);\n          alert('This product could not be added safely. Please open its product page and try again.');\n          return;\n        }\n        addToCart(page, name, price, image);\n        const originalText = btn.innerHTML;\n        btn.innerHTML = '✅ Added!';\n        btn.style.background = '#16a34a';\n        setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 2000);\n      });\n    });\n  }\n\n  // Product card navigation`,
  'add-to-cart page resolution',
  'function resolveCartProductPage(button, name)',
);

replaceOnce(
  /          const pageMap = \{[\s\S]*?\n          \};\n          const page = pageMap\[name\] \|\| pageMap\[name\.replace\(\/\^The \/, ''\)\] \|\| pageMap\[name\.replace\(\/ Legend\$\/, ''\)\] \|\| pageMap\[name\.replace\(\/ Legend\$\/, ''\)\];/,
  `          const page = PRODUCT_PAGE_BY_NAME[name]\n            || PRODUCT_PAGE_BY_NAME[name.replace(/^The /, '')]\n            || PRODUCT_PAGE_BY_NAME[name.replace(/ Legend$/, '')];`,
  'duplicate homepage product map',
  'const page = PRODUCT_PAGE_BY_NAME[name]',
);

replaceOnce(
  /  const VALID_DISCOUNT_CODES = \{\n    'LEGEND10': 10,\n    'WELCOME15': 15,\n  \};\n\n/,
  '',
  'duplicate discount policy',
);

replaceOnce(
  /    code = code\.trim\(\)\.toUpperCase\(\);\n    const percent = VALID_DISCOUNT_CODES\[code\];\n    \n    if \(percent\) \{\n      state\.discountCode = code;/,
  `    const discount = commerceModule.resolveDiscount(code);\n    const percent = discount.percent;\n    \n    if (discount.valid) {\n      code = discount.code;\n      state.discountCode = discount.code;`,
  'central discount resolution',
  'const discount = commerceModule.resolveDiscount(code);',
);

replaceOnce(
  /  function processOrder\(address, firstname, lastname, email\) \{\n    const validatedCountry = address\.country;\n    const totals = getCommerceTotals\(validatedCountry\);\n\n    const orderData = \{/,
  `  function processOrder(address, firstname, lastname, email) {\n    const validatedCountry = address.country;\n    const totals = getCommerceTotals(validatedCountry);\n    let orderRequest;\n    try {\n      orderRequest = commerceModule.createOrderRequest({\n        items: state.cart,\n        countryCode: validatedCountry,\n        discountCode: state.discountCode,\n      });\n    } catch (error) {\n      console.error('Cannot create trusted order request:', error);\n      alert('Your saved cart uses an outdated product format. Please clear the cart and add the products again.');\n      return;\n    }\n\n    const orderData = {\n      request: orderRequest,`,
  'trusted order request creation',
  'Cannot create trusted order request:',
);

replaceOnce(
  /    \/\/ Store for Stripe redirect\n    sessionStorage\.setItem\('legendOrder', JSON\.stringify\(orderData\)\);/,
  `    // Store display data separately from the minimal future server request.\n    sessionStorage.setItem('legendOrder', JSON.stringify(orderData));\n    sessionStorage.setItem('legendOrderRequest', JSON.stringify(orderRequest));`,
  'trusted order request storage',
  "sessionStorage.setItem('legendOrderRequest'",
);

await writeFile(APP_PATH, source, 'utf8');
console.log('Migrated app.js to stable cart identities and trusted order requests.');
