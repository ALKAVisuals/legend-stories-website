import { webkit, devices } from 'playwright';

const baseUrl = 'https://legendmural.com';
const targetPath = '/music-truth-seeker.html';
const appSourceResponse = await fetch(`${baseUrl}/js/app.js`, { redirect: 'follow' });
if (!appSourceResponse.ok) {
  throw new Error(`Could not read production app.js: HTTP ${appSourceResponse.status}`);
}
const productionAppSource = await appSourceResponse.text();
const schemaMatch = productionAppSource.match(/CART_SCHEMA_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!schemaMatch) throw new Error('Could not determine the production cart schema version.');
const cartSchemaVersion = schemaMatch[1];
console.log(`Production cart schema: ${cartSchemaVersion}`);

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
  if (['image', 'media', 'font'].includes(type)) return route.abort();
  return route.continue();
});

page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) navigations.push(frame.url());
});
page.on('console', (message) => {
  const text = message.text();
  if (/google|places|address/i.test(text)) consoleMessages.push(`${message.type()}: ${text}`);
});
page.on('pageerror', (error) => consoleMessages.push(`pageerror: ${error.message}`));

await page.addInitScript(({ schemaVersion }) => {
  try {
    localStorage.setItem('legendCartVersion', schemaVersion);
    localStorage.setItem('legendShippingCountry', 'NL');
    localStorage.setItem('legendDiscountCode', '');
    localStorage.setItem('legendCart', JSON.stringify([
      {
        id: 'music-truth-seeker.html::statement-45',
        page: 'music-truth-seeker.html',
        name: 'The Truth Seeker',
        price: 45,
        variantId: 'statement-45',
        variantLabel: 'Statement',
        sizeCm: 45,
        sizeLabel: '45 cm',
        widthCm: 45,
        heightCm: 45,
        quantity: 1,
        image: '',
      },
    ]));
  } catch {}
}, { schemaVersion: cartSchemaVersion });

const roundedBox = (box) => box ? {
  x: Number(box.x.toFixed(2)),
  y: Number(box.y.toFixed(2)),
  width: Number(box.width.toFixed(2)),
  height: Number(box.height.toFixed(2)),
} : null;

const maxBoxDelta = (a, b) => (!a || !b) ? null : Math.max(
  Math.abs(a.x - b.x),
  Math.abs(a.y - b.y),
  Math.abs(a.width - b.width),
  Math.abs(a.height - b.height),
);

try {
  await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('cart-count')?.textContent === '1', null, { timeout: 12_000 });

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
    return {
      activeElementId: document.activeElement?.id || '',
      value: input?.value || '',
      ariaInvalid: input?.getAttribute('aria-invalid'),
      requiredInvalid: Boolean(input?.matches(':invalid')),
      statusText: String(status?.textContent || '').trim(),
      statusHidden: Boolean(status?.classList.contains('hidden')),
      googlePlacesReady: Boolean(window.google?.maps?.places),
      autocompleteContainers: [...document.querySelectorAll('.pac-container')].map((node) => ({
        display: getComputedStyle(node).display,
        visibility: getComputedStyle(node).visibility,
        childCount: node.children.length,
        text: String(node.textContent || '').trim().slice(0, 300),
      })),
    };
  });

  const currentUrl = page.url();
  if (!currentUrl.startsWith(`${baseUrl}${targetPath}`)) {
    throw new Error(`Address-only probe unexpectedly navigated away: ${currentUrl}`);
  }

  const result = {
    result: 'observed',
    target: `${baseUrl}${targetPath}`,
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
} finally {
  await context.close();
  await browser.close();
}
