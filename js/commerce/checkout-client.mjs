import { COMMERCE_RUNTIME_CONFIG } from './runtime-config.mjs';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ERROR_MESSAGE_LENGTH = 240;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export const HOSTED_CHECKOUT_ENDPOINT = String(
  COMMERCE_RUNTIME_CONFIG.hostedCheckoutEndpoint || '',
).trim();

export class HostedCheckoutClientError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HostedCheckoutClientError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new HostedCheckoutClientError(code, message, details);
}

function isLocalDevelopmentHost(hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function normalizeHostedCheckoutEndpoint(value = '', baseUrl = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let endpoint;
  try {
    endpoint = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
  } catch {
    fail('INVALID_CHECKOUT_ENDPOINT', 'The hosted checkout endpoint is not a valid URL.');
  }

  const localHttp = endpoint.protocol === 'http:' && isLocalDevelopmentHost(endpoint.hostname);
  if (endpoint.protocol !== 'https:' && !localHttp) {
    fail('INVALID_CHECKOUT_ENDPOINT', 'The hosted checkout endpoint must use HTTPS.');
  }
  if (endpoint.username || endpoint.password) {
    fail('INVALID_CHECKOUT_ENDPOINT', 'The hosted checkout endpoint cannot contain credentials.');
  }
  endpoint.hash = '';
  return endpoint.toString();
}

export function isHostedCheckoutConfigured(
  endpoint = HOSTED_CHECKOUT_ENDPOINT,
  baseUrl = globalThis.location?.origin || '',
) {
  return Boolean(normalizeHostedCheckoutEndpoint(endpoint, baseUrl));
}

function trustedPayPalUrl(url, mode) {
  const host = url.hostname.toLowerCase();
  const sandboxHost = host === 'sandbox.paypal.com' || host.endsWith('.sandbox.paypal.com');
  const liveHost = host === 'paypal.com' || host.endsWith('.paypal.com');
  return mode === 'test' ? sandboxHost : (liveHost && !sandboxHost);
}

function parseHostedCheckoutResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid response.');
  }

  const provider = String(payload.provider || 'stripe').trim().toLowerCase();
  const sessionId = String(payload.sessionId || '').trim();
  const mode = String(payload.mode || '');
  const reference = String(payload.reference || '');
  if (!['stripe', 'paypal'].includes(provider)) {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid payment provider.');
  }
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid mode.');
  }
  if (!/^[a-f0-9]{64}$/.test(reference)) {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid reference.');
  }

  if (provider === 'stripe') {
    if (!/^cs_(test|live)_[A-Za-z0-9_-]+$/.test(sessionId)) {
      fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid Stripe session ID.');
    }
    if ((mode === 'test' && !sessionId.startsWith('cs_test_'))
      || (mode === 'live' && !sessionId.startsWith('cs_live_'))) {
      fail('INVALID_CHECKOUT_RESPONSE', 'The Stripe Checkout Session does not match the reported mode.');
    }
  } else if (!PAYPAL_ORDER_ID_PATTERN.test(sessionId)) {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid PayPal order ID.');
  }

  let checkoutUrl;
  try {
    checkoutUrl = new URL(String(payload.url || ''));
  } catch {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an invalid Checkout URL.');
  }
  if (checkoutUrl.protocol !== 'https:') {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an insecure Checkout URL.');
  }
  if (provider === 'stripe' && checkoutUrl.hostname !== 'checkout.stripe.com') {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an unexpected Stripe Checkout URL.');
  }
  if (provider === 'paypal' && !trustedPayPalUrl(checkoutUrl, mode)) {
    fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint returned an unexpected PayPal Checkout URL.');
  }

  return Object.freeze({
    provider,
    sessionId,
    mode,
    reference,
    url: checkoutUrl.toString(),
  });
}

function checkoutErrorFromResponse(status, payload) {
  const serverCode = String(payload?.error?.code || '').trim();
  const serverMessage = String(payload?.error?.message || '').trim();
  const message = serverMessage
    ? serverMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
    : 'Hosted checkout could not be started.';
  return new HostedCheckoutClientError(
    serverCode || 'CHECKOUT_REQUEST_FAILED',
    message,
    { status },
  );
}

export async function requestHostedCheckout({
  endpoint = HOSTED_CHECKOUT_ENDPOINT,
  payload,
  baseUrl = globalThis.location?.origin || '',
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const normalizedEndpoint = normalizeHostedCheckoutEndpoint(endpoint, baseUrl);
  if (!normalizedEndpoint) {
    fail('CHECKOUT_NOT_CONFIGURED', 'Hosted checkout is not configured.');
  }
  if (!payload?.request || !payload?.customer) {
    fail('INVALID_CHECKOUT_PAYLOAD', 'Checkout requires an order request and customer details.');
  }
  if (typeof fetchImpl !== 'function') {
    fail('CHECKOUT_UNAVAILABLE', 'The browser cannot contact the checkout endpoint.');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const safeTimeout = Math.min(60_000, Math.max(1_000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  const timer = controller
    ? setTimeout(() => controller.abort(), safeTimeout)
    : null;

  try {
    const response = await fetchImpl(normalizedEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request: payload.request,
        customer: payload.customer,
      }),
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      ...(controller ? { signal: controller.signal } : {}),
    });

    let responsePayload = null;
    try {
      responsePayload = await response.json();
    } catch {
      fail('INVALID_CHECKOUT_RESPONSE', 'The checkout endpoint did not return JSON.', {
        status: response.status,
      });
    }

    if (!response.ok) {
      throw checkoutErrorFromResponse(response.status, responsePayload);
    }
    return parseHostedCheckoutResponse(responsePayload);
  } catch (error) {
    if (error instanceof HostedCheckoutClientError) throw error;
    if (controller?.signal.aborted || error?.name === 'AbortError') {
      fail('CHECKOUT_TIMEOUT', 'The checkout request took too long. Please try again.');
    }
    fail('CHECKOUT_NETWORK_ERROR', 'The checkout service could not be reached. Please try again.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
