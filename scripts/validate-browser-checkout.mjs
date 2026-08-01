import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const [appSource, clientSource, successPage, cancelledPage] = await Promise.all([
  readFile(new URL('js/app.js', ROOT), 'utf8'),
  readFile(new URL('js/commerce/checkout-client.mjs', ROOT), 'utf8'),
  readFile(new URL('order-success.html', ROOT), 'utf8'),
  readFile(new URL('order-cancelled.html', ROOT), 'utf8'),
]);

const errors = [];

if (!clientSource.includes("export const HOSTED_CHECKOUT_ENDPOINT = '';")) {
  errors.push('Hosted checkout must remain disabled until a deployment endpoint is explicitly configured.');
}
if (!clientSource.includes("checkoutUrl.hostname !== 'checkout.stripe.com'")) {
  errors.push('Browser checkout responses must be restricted to checkout.stripe.com.');
}
if (!clientSource.includes("credentials: 'omit'")) {
  errors.push('Browser checkout requests must not send ambient credentials.');
}
if (!clientSource.includes("redirect: 'error'")) {
  errors.push('The checkout endpoint request must reject unexpected HTTP redirects.');
}
if (!clientSource.includes('setTimeout(() => controller.abort(), safeTimeout)')) {
  errors.push('Hosted checkout must use a real abort signal for request timeouts.');
}
if (/STRIPE_SECRET_KEY|sk_(test|live)_/.test(clientSource)) {
  errors.push('The browser checkout module must never contain Stripe secret-key material.');
}

if (!appSource.includes("import('./commerce/checkout-client.mjs')")) {
  errors.push('app.js must load the browser checkout client through the commerce runtime.');
}
if (!appSource.includes('async function processOrder(address, firstname, lastname, email)')) {
  errors.push('processOrder() must support the asynchronous hosted-checkout request.');
}
if (!appSource.includes('commerceModule.isHostedCheckoutConfigured(')) {
  errors.push('The storefront must check whether hosted checkout is configured before requesting it.');
}
if (!appSource.includes('commerceModule.requestHostedCheckout({')) {
  errors.push('The storefront must delegate payment-session creation to the browser checkout client.');
}
if (!appSource.includes('window.location.assign(checkout.url)')) {
  errors.push('The storefront must redirect only to the validated Checkout URL returned by the client.');
}
if (!appSource.includes("sessionStorage.setItem('legendCheckoutReference', checkout.reference)")) {
  errors.push('The storefront must retain the server-generated checkout reference for the return flow.');
}

const hostedCall = appSource.match(/commerceModule\.requestHostedCheckout\(\{([\s\S]*?)\n      \}\);/);
if (!hostedCall) {
  errors.push('The hosted checkout request block could not be inspected.');
} else {
  const requestBlock = hostedCall[1];
  if (!requestBlock.includes('request: orderRequest') || !requestBlock.includes('customer: checkoutCustomer')) {
    errors.push('Hosted checkout must send only the trusted order request and normalized customer data.');
  }
  if (/totals|subtotal|discount|shipping|grandTotal|orderData|price/.test(requestBlock)) {
    errors.push('Hosted checkout must not send browser-calculated prices or totals.');
  }
}

const processOrderBlock = appSource.match(/async function processOrder\([\s\S]*?\n  \}\n\n  \/\/ ==========================================\n  \/\/ MOBILE MENU/);
if (processOrderBlock && /removeItem\(['"]legendCart/.test(processOrderBlock[0])) {
  errors.push('The browser cart must not be cleared before server-side payment verification exists.');
}

for (const [name, source, title, heading] of [
  ['order-success.html', successPage, 'Payment Submitted — Legend Stories', 'Payment submitted'],
  ['order-cancelled.html', cancelledPage, 'Payment Cancelled — Legend Stories', 'Payment cancelled'],
]) {
  if (!source.includes(`<title>${title}</title>`)) {
    errors.push(`${name} is missing its unique page title.`);
  }
  if (!source.includes(`>${heading}</h1>`)) {
    errors.push(`${name} is missing its expected H1.`);
  }
  if (!source.includes('<meta name="robots" content="noindex, nofollow">')) {
    errors.push(`${name} must remain excluded from search indexing.`);
  }
}
if (!successPage.includes('has not been confirmed by the server yet')) {
  errors.push('The success return page must state that payment is unverified until the server confirms it.');
}
if (!successPage.includes('<script type="module" src="js/order-return.js"></script>')) {
  errors.push('The success return page must load the verified order-status module.');
}
if (!cancelledPage.includes('Your cart remains saved in this browser')) {
  errors.push('The cancellation page must explain that the browser cart remains available.');
}

if (errors.length) {
  console.error('Browser checkout validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Browser checkout validation passed with dormant endpoint configuration, minimal payloads and verified Stripe redirects.');
