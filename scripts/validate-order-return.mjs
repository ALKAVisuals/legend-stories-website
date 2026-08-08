import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { applyVerifiedOrderStatus } from '../js/commerce/order-return.mjs';
import { handleOrderStatus } from '../server/api/order-status.mjs';

const catalog = JSON.parse(
  await readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
).products;
const [clientSource, paypalCaptureClientSource, runtimeConfigSource, returnSource, returnPage] = await Promise.all([
  readFile(new URL('../js/commerce/order-status-client.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../js/commerce/paypal-capture-client.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../js/commerce/runtime-config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../js/order-return.js', import.meta.url), 'utf8'),
  readFile(new URL('../order-success.html', import.meta.url), 'utf8'),
]);
const errors = [];

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    removeItem(key) {
      values.delete(key);
    },
    has(key) {
      return values.has(key);
    },
  };
}

if (!runtimeConfigSource.includes("orderStatusEndpoint: ''")
  || !clientSource.includes('COMMERCE_RUNTIME_CONFIG.orderStatusEndpoint')) {
  errors.push('Order status must remain disabled in tracked source until a deployment endpoint is generated.');
}
if (!runtimeConfigSource.includes("paypalCaptureEndpoint: ''")
  || !paypalCaptureClientSource.includes('COMMERCE_RUNTIME_CONFIG.paypalCaptureEndpoint')) {
  errors.push('PayPal capture must remain disabled in tracked source until a deployment endpoint is generated.');
}
for (const [label, source] of [
  ['Order status', clientSource],
  ['PayPal capture', paypalCaptureClientSource],
]) {
  if (!source.includes("credentials: 'omit'")) {
    errors.push(`${label} requests must omit ambient browser credentials.`);
  }
  if (!source.includes("redirect: 'error'")) {
    errors.push(`${label} requests must reject unexpected HTTP redirects.`);
  }
}
if (/NEON_DATABASE_URL|postgres(?:ql)?:\/\/|STRIPE_SECRET_KEY|sk_(?:test|live)_|whsec_|PAYPAL_CLIENT_SECRET/.test(
  `${clientSource}\n${paypalCaptureClientSource}\n${runtimeConfigSource}`,
)) {
  errors.push('Public order-return modules must not contain database or payment-provider credentials.');
}
if (!returnSource.includes('returnedSessionId !== storedSessionId')) {
  errors.push('Return page must match the returned provider session to the stored payment session.');
}
if (!returnSource.includes("url.searchParams.get('session_id')")
  || !returnSource.includes("url.searchParams.get('token')")) {
  errors.push('Return page must recognize both Stripe and PayPal hosted-return identifiers.');
}
if (!returnSource.includes('requestPayPalCapture({')) {
  errors.push('PayPal returns must be captured server-side before order status verification.');
}
if (!returnSource.includes('applyVerifiedOrderStatus(status')) {
  errors.push('Return page must use the verified cart-clearing policy.');
}
if (!returnPage.includes('<script type="module" src="js/order-return.js"></script>')) {
  errors.push('Payment return page is not connected to the verified status client.');
}
if (!returnPage.includes('<meta name="robots" content="noindex, nofollow">')) {
  errors.push('Payment return page must remain excluded from search indexing.');
}

const statuses = ['payment_pending', 'payment_processing', 'payment_failed', 'expired', 'paid'];
for (const [index, product] of catalog.entries()) {
  const reference = createHash('sha256').update(`order-return:${product.page}`).digest('hex');
  const sessionId = index % 2 === 0
    ? `cs_test_order_return_${index}`
    : `P${String(index).padStart(16, '0')}TEST`;
  const status = statuses[index % statuses.length];
  const order = {
    reference,
    paymentSessionId: sessionId,
    mode: 'test',
    status,
    updatedAt: 1_800_000_000 + index,
    version: index,
    amountTotal: 5390,
    currency: 'EUR',
    customer: { email: `private-${index}@example.com` },
    items: [{ name: product.name, unitPrice: product.price }],
  };

  try {
    const response = await handleOrderStatus(new Request('https://payments.example/api/order-status', {
      method: 'POST',
      headers: {
        Origin: 'https://shop.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reference, sessionId }),
    }), {
      orderStore: {
        async getOrderByReference() {
          return order;
        },
      },
      allowedOrigins: 'https://shop.example',
    });
    const result = await response.json();
    if (response.status !== 200) {
      errors.push(`${product.page}: status endpoint returned ${response.status}.`);
      continue;
    }

    const keys = Object.keys(result).sort().join(',');
    if (keys !== 'mode,paid,reference,sessionId,status,terminal,updatedAt,version') {
      errors.push(`${product.page}: status endpoint exposed unexpected fields.`);
    }
    if (JSON.stringify(result).includes(`private-${index}@example.com`)
      || JSON.stringify(result).includes(product.name)) {
      errors.push(`${product.page}: status endpoint leaked private order data.`);
    }

    const localStorage = memoryStorage({ legendCart: 'saved', unrelated: 'keep' });
    const sessionStorage = memoryStorage({
      legendCheckoutReference: reference,
      legendCheckoutSessionId: sessionId,
      unrelatedSession: 'keep',
    });
    applyVerifiedOrderStatus(result, { localStorage, sessionStorage });
    const shouldClear = status === 'paid';
    if (localStorage.has('legendCart') === shouldClear) {
      errors.push(`${product.page}: cart clearing policy is incorrect for ${status}.`);
    }
    if (!localStorage.has('unrelated') || !sessionStorage.has('unrelatedSession')) {
      errors.push(`${product.page}: verified cleanup removed unrelated browser state.`);
    }
  } catch (error) {
    errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
  }
}

if (errors.length) {
  console.error('Verified order return validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Verified order return validation passed for ${catalog.length} products with Stripe/PayPal return identifiers, privacy-minimal status responses and paid-only cart clearing.`,
);
