import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const [appSource, clientSource, runtimeConfigSource, successPage, cancelledPage] = await Promise.all([
  readFile(new URL('js/app.js', ROOT), 'utf8'),
  readFile(new URL('js/commerce/checkout-client.mjs', ROOT), 'utf8'),
  readFile(new URL('js/commerce/runtime-config.mjs', ROOT), 'utf8'),
  readFile(new URL('order-success.html', ROOT), 'utf8'),
  readFile(new URL('order-cancelled.html', ROOT), 'utf8'),
]);

const errors = [];

if (!runtimeConfigSource.includes("hostedCheckoutEndpoint: ''")
  || !clientSource.includes('COMMERCE_RUNTIME_CONFIG.hostedCheckoutEndpoint')) {
  errors.push('Hosted checkout must remain disabled in tracked source until a deployment endpoint is generated.');
}
if (!clientSource.includes("checkoutUrl.hostname !== 'checkout.stripe.com'")) {
  errors.push('Stripe fallback responses must remain restricted to checkout.stripe.com.');
}
if (!clientSource.includes('trustedPayPalUrl(checkoutUrl, mode)')) {
  errors.push('PayPal hosted checkout responses must be restricted to the reported PayPal environment.');
}
if (!clientSource.includes("provider === 'paypal'")) {
  errors.push('Browser checkout must explicitly distinguish PayPal from the Stripe fallback.');
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
if (/STRIPE_SECRET_KEY|sk_(test|live)_|PAYPAL_CLIENT_SECRET|PAYPAL_CLIENT_ID\s*=/.test(
  `${clientSource}\n${runtimeConfigSource}`,
)) {
  errors.push('Browser checkout modules must never contain payment-provider secret material.');
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
  errors.push('The storefront must redirect only to the validated provider URL returned by the client.');
}
if (!appSource.includes("sessionStorage.setItem('legendCheckoutReference', checkout.reference)")) {
  errors.push('The storefront must retain the server-generated checkout reference for the return flow.');
}
if (!appSource.includes("sessionStorage.setItem('legendCheckoutSessionId', checkout.sessionId)")) {
  errors.push('The storefront must retain the exact provider session/order ID for return verification.');
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

console.log('Browser checkout validation passed with deployment-generated endpoints, minimal payloads, trusted PayPal Sandbox redirects and the Stripe fallback intact.');
