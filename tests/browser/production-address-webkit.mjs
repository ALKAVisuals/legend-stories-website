import { webkit, devices } from 'playwright';

const baseUrl = 'https://legendmural.com';
const appSourceResponse = await fetch(`${baseUrl}/js/app.js`, { redirect: 'follow' });
if (!appSourceResponse.ok) {
  throw new Error(`Could not read production app.js: HTTP ${appSourceResponse.status}`);
}
const productionAppSource = await appSourceResponse.text();
const schemaMatch = productionAppSource.match(/CART_SCHEMA_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!schemaMatch) {
  throw new Error('Could not determine the production cart schema version.');
}
const cartSchemaVersion = schemaMatch[1];

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'en-NL',
  reducedMotion: 'reduce',
});

const page = await context.newPage();
const navigations = [];
const consoleMessages = [];

await page.route('**/*', async (route) => {
  const type = route.request().resourceType();
  if (['image', 'media', 'font'].includes(type)) {
    await route.abort();
    return;
  }
  await route.continue();
});

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});
page.on('console', (message) => {
  const text = message.text();
  if (/google|places|address/i.test(text)) consoleMessages.push(`${message.type()}: ${text}`);
});

await page.addInitScript(({ schemaVersion }) => {
  try {
    localStorage.setItem('legendCartVersion', schemaVersion);
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
    // The destination document gets another chance to run this init script.
  }
}, { schemaVersion: cartSchemaVersion });

function roundedBox(box) {
  if (!box) return null;
  return {
    x: Number(box.x.toFixed(2)),
    y: Number(box.y.toFixed(2)),
    width: Number(box.width.toFixed(2)),
    height: Number(box.height.toFixed(2)),
  };
}

function maxBoxDelta(a, b) {
  if (!a || !b) return null;
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );
}

try {
  await page.goto(`${baseUrl}/shop.html`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  try {
    await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '1', null, { timeout: 15_000 });
  } catch {
    const cartState = await page.evaluate(() => ({
      cartCount: document.getElementById('cart-count')?.textContent || '',
      cartVersion: localStorage.getItem('legendCartVersion'),
      cart: localStorage.getItem('legendCart'),
    }));
    throw new Error(`Production did not load the seeded cart. Runtime schema=${cartSchemaVersion}; state=${JSON.stringify(cartState)}`);
  }

  navigations.length = 0;
  await page.locator('#cart-btn').tap();
  await page.locator('#checkout-btn').tap();
  await page.locator('#checkout-drawer[aria-hidden="false"]').waitFor({ timeout: 10_000 });

  const street = page.locator('#checkout-street');
  await street.tap();

  const before = await street.boundingBox();
  const focusBefore = await page.evaluate(() => document.activeElement?.id || '');

  await street.pressSequentially('s', { delay: 120 });
  await page.waitForTimeout(250);
  const afterS = await street.boundingBox();
  const focusAfterS = await page.evaluate(() => document.activeElement?.id || '');

  await street.pressSequentially('c', { delay: 120 });
  await page.waitForTimeout(1500);
  const afterSC = await street.boundingBox();

  const state = await page.evaluate(() => {
    const input = document.getElementById('checkout-street');
    const status = document.getElementById('checkout-address-status');
    const pac = [...document.querySelectorAll('.pac-container')].map((node) => ({
      display: getComputedStyle(node).display,
      visibility: getComputedStyle(node).visibility,
      childCount: node.children.length,
      text: String(node.textContent || '').trim().slice(0, 300),
    }));
    return {
      activeElementId: document.activeElement?.id || '',
      value: input?.value || '',
      ariaInvalid: input?.getAttribute('aria-invalid'),
      requiredInvalid: Boolean(input?.matches(':invalid')),
      statusText: String(status?.textContent || '').trim(),
      statusHidden: Boolean(status?.classList.contains('hidden')),
      googlePlacesReady: Boolean(window.google?.maps?.places),
      autocompleteContainers: pac,
      parentChildCount: input?.parentElement?.children?.length || 0,
    };
  });

  const currentUrl = page.url();
  if (!currentUrl.startsWith(`${baseUrl}/shop.html`)) {
    throw new Error(`Address-only probe unexpectedly navigated away from shop: ${currentUrl}`);
  }

  const result = {
    result: 'observed',
    target: baseUrl,
    productionCartSchemaVersion: cartSchemaVersion,
    browser: 'webkit',
    device: 'iPhone 13',
    before: roundedBox(before),
    afterS: roundedBox(afterS),
    afterSC: roundedBox(afterSC),
    deltaAfterS: maxBoxDelta(before, afterS),
    deltaAfterSC: maxBoxDelta(before, afterSC),
    focusBefore,
    focusAfterS,
    ...state,
    navigationCount: navigations.length,
    finalUrl: currentUrl,
    consoleMessages: consoleMessages.slice(-20),
  };

  console.log(JSON.stringify(result, null, 2));

  if (state.value !== 'sc') throw new Error(`Street value changed unexpectedly: ${state.value}`);
  if (state.activeElementId !== 'checkout-street') {
    throw new Error(`Street input lost focus after typing sc; active element is ${state.activeElementId || 'none'}.`);
  }
  if ((result.deltaAfterSC ?? 0) > 1) {
    throw new Error(`Street input shifted by ${result.deltaAfterSC.toFixed(2)}px after typing sc.`);
  }
} catch (error) {
  console.error(error?.stack || error);
  try {
    await page.screenshot({ path: '/tmp/production-address-webkit.png', fullPage: true });
    const html = await page.content();
    await import('node:fs/promises').then(({ writeFile }) => writeFile('/tmp/production-address-webkit.html', html));
  } catch (diagnosticError) {
    console.error('Could not write production probe diagnostics:', diagnosticError);
  }
  throw error;
} finally {
  await context.close();
  await browser.close();
}
