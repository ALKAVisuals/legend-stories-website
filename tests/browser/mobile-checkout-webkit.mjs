import { webkit, devices } from 'playwright';

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const origin = new URL(baseUrl).origin;
const productPagePattern = /\/(?:combat|music|sport|wisdom)-[^/]+\.html(?:[?#].*)?$/i;
const seededCart = [
  {
    id: 'combat-balanced-mind-combat-legend-mural.html::statement-45',
    page: 'combat-balanced-mind-combat-legend-mural.html',
    name: 'The Balanced Mind',
    price: 45,
    variantId: 'statement-45',
    variantLabel: 'Statement',
    sizeCm: 45,
    sizeLabel: '45 cm',
    widthCm: 45,
    heightCm: 45,
    quantity: 1,
    image: 'media/stikkers/2026/Batch 4/combat Legends/balanced-mind-combat-legend-mural.png',
  },
];

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'en-NL',
  storageState: {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: 'legendCartVersion', value: '4' },
          { name: 'legendShippingCountry', value: 'NL' },
          { name: 'legendDiscountCode', value: '' },
          { name: 'legendCart', value: JSON.stringify(seededCart) },
        ],
      },
    ],
  },
});

const page = await context.newPage();
page.setDefaultTimeout(15_000);
const navigations = [];
const browserErrors = [];
const failedRequests = [];

function recordDiagnostic(collection, value) {
  if (collection.length < 20) collection.push(value);
}

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});

page.on('pageerror', (error) => {
  recordDiagnostic(browserErrors, `pageerror: ${error?.message || String(error)}`);
});

page.on('console', (message) => {
  if (message.type() === 'error') {
    recordDiagnostic(browserErrors, `console: ${message.text()}`);
  }
});

page.on('requestfailed', (request) => {
  recordDiagnostic(failedRequests, {
    url: request.url(),
    error: request.failure()?.errorText || 'unknown',
  });
});

try {
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });

  const seededStorage = await page.evaluate(() => {
    let cart = null;
    try {
      cart = JSON.parse(localStorage.getItem('legendCart') || 'null');
    } catch {
      cart = 'invalid-json';
    }
    return {
      cartVersion: localStorage.getItem('legendCartVersion'),
      shippingCountry: localStorage.getItem('legendShippingCountry'),
      cart,
    };
  });

  if (seededStorage.cartVersion !== '4') {
    throw new Error(`Expected legendCartVersion=4 before checkout init, received ${seededStorage.cartVersion || '(missing)'}.`);
  }
  if (seededStorage.shippingCountry !== 'NL') {
    throw new Error(`Expected legendShippingCountry=NL before checkout init, received ${seededStorage.shippingCountry || '(missing)'}.`);
  }
  if (!Array.isArray(seededStorage.cart) || seededStorage.cart.length !== 1 || seededStorage.cart[0]?.variantId !== 'statement-45') {
    throw new Error(`Expected one deterministic seeded cart item before checkout init, received ${JSON.stringify(seededStorage.cart)}.`);
  }

  await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '1');
  navigations.length = 0;

  await page.locator('#cart-btn').tap();
  await page.locator('#checkout-btn').tap();
  await page.locator('#checkout-drawer[aria-hidden="false"]').waitFor();

  await page.locator('#checkout-firstname').fill('Mobile');
  await page.locator('#checkout-lastname').fill('Tester');
  await page.locator('#checkout-email').fill('mobile-test@example.invalid');

  const street = page.locator('#checkout-street');
  const zip = page.locator('#checkout-zip');
  await street.tap();

  const beforeTyping = await street.boundingBox();
  const zipBeforeTyping = await zip.boundingBox();
  const streetFontSize = await street.evaluate((element) => getComputedStyle(element).fontSize);

  await street.pressSequentially('sc', { delay: 120 });
  await page.waitForTimeout(150);

  const afterTyping = await street.boundingBox();
  const zipAfterTyping = await zip.boundingBox();
  const activeId = await page.evaluate(() => document.activeElement?.id || '');

  if (!beforeTyping || !afterTyping || !zipBeforeTyping || !zipAfterTyping) {
    throw new Error('Checkout address field bounding box was unavailable.');
  }

  const positionDelta = Math.max(
    Math.abs(beforeTyping.x - afterTyping.x),
    Math.abs(beforeTyping.y - afterTyping.y),
    Math.abs(beforeTyping.width - afterTyping.width),
  );
  const followingFieldDelta = Math.abs(zipBeforeTyping.y - zipAfterTyping.y);

  if (streetFontSize !== '16px') {
    throw new Error(`Expected 16px mobile checkout font size, received ${streetFontSize}.`);
  }
  if (positionDelta > 1) {
    throw new Error(`Street input shifted by ${positionDelta.toFixed(2)}px while typing.`);
  }
  if (followingFieldDelta > 1) {
    throw new Error(`Postal-code field shifted by ${followingFieldDelta.toFixed(2)}px while typing.`);
  }
  if (activeId !== 'checkout-street') {
    throw new Error(`Street input lost focus while typing; active element is ${activeId || 'none'}.`);
  }

  await street.fill('Example Street 4');
  await zip.fill('1015 AB');
  await page.locator('#checkout-city').fill('Amsterdam');
  await page.locator('#checkout-country').selectOption('NL');

  const payButton = page.locator('#checkout-pay-btn');
  const startedAt = Date.now();
  await payButton.tap();
  await page.waitForFunction(() => String(document.getElementById('purchase-feedback')?.textContent || '').includes('Secure online payment is not enabled'));
  const checkoutDecisionMs = Date.now() - startedAt;

  const payButtonText = await payButton.textContent();
  if (String(payButtonText || '').toLowerCase().includes('validating address')) {
    throw new Error('Checkout still entered the removed Google address-validation loading state.');
  }
  if (checkoutDecisionMs >= 2000) {
    throw new Error(`Local address validation took ${checkoutDecisionMs}ms; checkout should not wait on Google Places.`);
  }

  const currentUrl = page.url();
  const unexpectedProductNavigation = navigations.find((url) => productPagePattern.test(new URL(url).pathname));
  if (unexpectedProductNavigation) {
    throw new Error(`Checkout interaction navigated to product page: ${unexpectedProductNavigation}`);
  }
  if (!currentUrl.startsWith(`${baseUrl}/shop.html`)) {
    throw new Error(`Checkout interaction left the shop unexpectedly: ${currentUrl}`);
  }

  const feedback = await page.locator('#purchase-feedback').textContent();
  if (!String(feedback || '').includes('Secure online payment is not enabled')) {
    throw new Error(`Expected safe no-payment fallback after local address validation, received: ${feedback || '(empty)'}`);
  }

  console.log(JSON.stringify({
    result: 'passed',
    browser: 'webkit',
    device: 'iPhone 13',
    cartSeedMethod: 'storageState',
    streetFontSize,
    streetPositionDeltaPx: Number(positionDelta.toFixed(2)),
    followingFieldDeltaPx: Number(followingFieldDelta.toFixed(2)),
    streetFocusPreserved: activeId === 'checkout-street',
    checkoutDecisionMs,
    navigationCount: navigations.length,
    finalUrl: currentUrl,
  }, null, 2));
} catch (error) {
  let runtime = {};
  try {
    runtime = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      cartCount: document.getElementById('cart-count')?.textContent || null,
      cartVersion: localStorage.getItem('legendCartVersion'),
      cartPresent: Boolean(localStorage.getItem('legendCart')),
    }));
  } catch (diagnosticError) {
    runtime = { diagnosticError: diagnosticError?.message || String(diagnosticError) };
  }

  console.error(JSON.stringify({
    result: 'failed',
    browser: 'webkit',
    device: 'iPhone 13',
    error: error?.message || String(error),
    runtime,
    browserErrors,
    failedRequests,
    navigations,
  }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
