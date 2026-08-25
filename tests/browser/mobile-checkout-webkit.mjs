import { webkit, devices } from 'playwright';

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const productPagePattern = /\/(?:combat|music|sport|wisdom)-[^/]+\.html(?:[?#].*)?$/i;

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'en-NL',
});

const page = await context.newPage();
page.setDefaultTimeout(15_000);
const navigations = [];

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});

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

  class FakeAutocomplete {
    constructor(input) {
      this.input = input;
      this.listeners = new Map();
    }
    addListener(name, callback) {
      this.listeners.set(name, callback);
      return { remove: () => this.listeners.delete(name) };
    }
    getPlace() {
      return {};
    }
    setComponentRestrictions() {}
  }

  function FakePlacesService() {}
  FakePlacesService.prototype.findPlaceFromQuery = function findPlaceFromQuery(_request, callback) {
    window.setTimeout(() => {
      callback([
        {
          formatted_address: 'Late Google result',
          address_components: [],
        },
      ], 'OK');
    }, 4500);
  };

  window.google = {
    maps: {
      places: {
        Autocomplete: FakeAutocomplete,
        PlacesService: FakePlacesService,
        PlacesServiceStatus: {
          OK: 'OK',
          ZERO_RESULTS: 'ZERO_RESULTS',
          UNKNOWN_ERROR: 'UNKNOWN_ERROR',
        },
      },
    },
  };
});

try {
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '1');
  navigations.length = 0;

  await page.locator('#cart-btn').tap();
  await page.locator('#checkout-btn').tap();
  await page.locator('#checkout-drawer[aria-hidden="false"]').waitFor();

  await page.locator('#checkout-firstname').fill('Mobile');
  await page.locator('#checkout-lastname').fill('Tester');
  await page.locator('#checkout-email').fill('mobile-test@example.invalid');

  const street = page.locator('#checkout-street');
  await street.tap();
  await page.locator('#checkout-address-status').waitFor({ state: 'attached' });

  const beforeTyping = await street.boundingBox();
  await street.pressSequentially('sc', { delay: 120 });
  await page.waitForTimeout(150);
  const afterTyping = await street.boundingBox();
  const activeId = await page.evaluate(() => document.activeElement?.id || '');

  if (!beforeTyping || !afterTyping) {
    throw new Error('Street input bounding box was unavailable.');
  }

  const positionDelta = Math.max(
    Math.abs(beforeTyping.x - afterTyping.x),
    Math.abs(beforeTyping.y - afterTyping.y),
    Math.abs(beforeTyping.width - afterTyping.width),
  );

  if (positionDelta > 1) {
    throw new Error(`Street input shifted by ${positionDelta.toFixed(2)}px while typing.`);
  }
  if (activeId !== 'checkout-street') {
    throw new Error(`Street input lost focus while typing; active element is ${activeId || 'none'}.`);
  }

  await street.fill('Example Street 4');
  await page.locator('#checkout-zip').fill('1015 AB');
  await page.locator('#checkout-city').fill('Amsterdam');
  await page.locator('#checkout-country').selectOption('NL');

  const payButton = page.locator('#checkout-pay-btn');
  await payButton.tap();
  await page.waitForFunction(() => document.getElementById('checkout-pay-btn')?.textContent?.includes('Validating address'));

  await page.waitForTimeout(5200);

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
    throw new Error(`Expected safe no-payment fallback after address timeout, received: ${feedback || '(empty)'}`);
  }

  console.log(JSON.stringify({
    result: 'passed',
    browser: 'webkit',
    device: 'iPhone 13',
    streetPositionDeltaPx: Number(positionDelta.toFixed(2)),
    streetFocusPreserved: activeId === 'checkout-street',
    navigationCount: navigations.length,
    finalUrl: currentUrl,
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
