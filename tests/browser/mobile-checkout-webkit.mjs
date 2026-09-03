import { webkit, devices } from 'playwright';

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const appStartupTimeoutMs = 45_000;
const productPagePattern = /\/(?:combat|music|sport|wisdom)-[^/]+\.html(?:[?#].*)?$/i;

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'en-NL',
  reducedMotion: 'reduce',
});

// This regression covers cart/checkout interaction, field stability and local
// validation. Product artwork, video and webfonts are not part of those
// assertions, so avoid loading them in WebKit CI to keep the page lightweight.
await context.route('**/*', (route) => {
  const request = route.request();
  const resourceType = request.resourceType();
  const url = request.url();
  if (
    resourceType === 'font'
    || resourceType === 'media'
    || url.includes('/media/stikkers/')
    || url.startsWith('https://fonts.googleapis.com/')
    || url.startsWith('https://fonts.gstatic.com/')
  ) {
    return route.abort();
  }
  return route.continue();
});

const page = await context.newPage();
page.setDefaultTimeout(15_000);
const navigations = [];

browser.on('disconnected', () => {
  console.error('WebKit browser disconnected unexpectedly.');
});
page.on('crash', () => {
  console.error('WebKit page crashed unexpectedly.');
});
page.on('pageerror', (error) => {
  console.error(`WebKit page error: ${error?.message || error}`);
});

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});

async function touchscreenTapCenter(locator, label) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} bounding box was unavailable.`);
  await page.touchscreen.tap(box.x + (box.width / 2), box.y + (box.height / 2));
}

await page.addInitScript(() => {
  try {
    localStorage.setItem('legendCartVersion', '4');
    localStorage.setItem('legendShippingCountry', 'NL');
    localStorage.setItem('legendDiscountCode', '');
    localStorage.setItem('legendCart', JSON.stringify([
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
    ]));
  } catch {
    // about:blank can reject storage access; the destination document runs this again.
  }
});

try {
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.getElementById('cart-count')?.textContent === '1',
    null,
    { timeout: appStartupTimeoutMs },
  );
  navigations.length = 0;

  await touchscreenTapCenter(page.locator('#cart-btn'), 'Cart button');
  await page.locator('#cart-drawer[aria-hidden="false"]').waitFor();
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
    server: 'production-preview',
    appStartupTimeoutMs,
    cartInteraction: 'touchscreen.tap',
    streetFontSize,
    streetPositionDeltaPx: Number(positionDelta.toFixed(2)),
    followingFieldDeltaPx: Number(followingFieldDelta.toFixed(2)),
    streetFocusPreserved: activeId === 'checkout-street',
    checkoutDecisionMs,
    navigationCount: navigations.length,
    finalUrl: currentUrl,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
