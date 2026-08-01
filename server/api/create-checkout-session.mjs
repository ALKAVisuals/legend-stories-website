import { readFile } from 'node:fs/promises';

import { OrderQuoteError } from '../commerce/order-quote.mjs';
import {
  CheckoutPersistenceError,
  createDurableHostedCheckoutSession,
} from '../orders/checkout-persistence.mjs';
import { CheckoutSessionError } from '../payments/checkout-session.mjs';
import {
  StripeApiError,
  StripeConfigurationError,
  createStripeApiClient,
} from '../payments/stripe-api.mjs';

const MAX_REQUEST_BYTES = 32 * 1024;
let catalogPromise = null;

async function loadCatalogProducts() {
  if (!catalogPromise) {
    catalogPromise = readFile(new URL('../../data/products/catalog.json', import.meta.url), 'utf8')
      .then((source) => JSON.parse(source).products);
  }
  return catalogPromise;
}

function parseAllowedOrigins(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function responseHeaders(origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function jsonResponse(status, body, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function errorResponse(status, code, message, origin = '') {
  return jsonResponse(status, { error: { code, message } }, origin);
}

function resolveCorsOrigin(request, configuredOrigins) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return '';

  const allowed = parseAllowedOrigins(configuredOrigins);
  allowed.add(new URL(request.url).origin);
  if (!allowed.has(origin)) return null;
  return origin;
}

function validateConfiguredUrl(value, label) {
  const source = String(value || '').trim();
  if (!source) {
    throw new StripeConfigurationError(
      'MISSING_CHECKOUT_URL',
      `${label} is required in the server environment.`,
    );
  }

  let url;
  try {
    url = new URL(source);
  } catch {
    throw new StripeConfigurationError(
      'INVALID_CHECKOUT_URL',
      `${label} must be a valid absolute URL.`,
    );
  }

  const localDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localDevelopment && url.protocol === 'http:')) {
    throw new StripeConfigurationError(
      'INVALID_CHECKOUT_URL',
      `${label} must use HTTPS.`,
    );
  }
  if (url.username || url.password) {
    throw new StripeConfigurationError(
      'INVALID_CHECKOUT_URL',
      `${label} must not contain embedded credentials.`,
    );
  }

  return url.toString();
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new CheckoutSessionError(
      'UNSUPPORTED_CONTENT_TYPE',
      'Content-Type must be application/json.',
    );
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new CheckoutSessionError('REQUEST_TOO_LARGE', 'Checkout request is too large.');
  }

  const source = await request.text();
  if (Buffer.byteLength(source, 'utf8') > MAX_REQUEST_BYTES) {
    throw new CheckoutSessionError('REQUEST_TOO_LARGE', 'Checkout request is too large.');
  }

  try {
    return JSON.parse(source);
  } catch {
    throw new CheckoutSessionError('INVALID_JSON', 'Checkout request body is invalid JSON.');
  }
}

function mapError(error, origin) {
  if (error instanceof OrderQuoteError || error instanceof CheckoutSessionError) {
    return errorResponse(400, error.code, error.message, origin);
  }
  if (error instanceof CheckoutPersistenceError) {
    const status = error.code === 'CHECKOUT_STORE_CONFLICT' ? 409 : 503;
    return errorResponse(status, error.code, error.message, origin);
  }
  if (error instanceof StripeConfigurationError) {
    return errorResponse(503, error.code, 'Stripe test checkout is not configured.', origin);
  }
  if (error instanceof StripeApiError) {
    return errorResponse(502, error.code, 'Stripe could not create a Checkout Session.', origin);
  }

  console.error('Unexpected checkout session error:', error);
  return errorResponse(500, 'CHECKOUT_SESSION_FAILED', 'Checkout could not be started.', origin);
}

export async function handleCreateCheckoutSession(request, {
  env = process.env,
  catalogProducts = null,
  stripeClient = null,
  stripeClientFactory = createStripeApiClient,
  checkoutStore = null,
  successUrl = env.CHECKOUT_SUCCESS_URL,
  cancelUrl = env.CHECKOUT_CANCEL_URL,
  allowedOrigins = env.CHECKOUT_ALLOWED_ORIGINS || '',
  createdAt = Math.floor(Date.now() / 1000),
} = {}) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin === null) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(corsOrigin),
    });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.', corsOrigin);
  }

  try {
    const configuredSuccessUrl = validateConfiguredUrl(successUrl, 'CHECKOUT_SUCCESS_URL');
    const configuredCancelUrl = validateConfiguredUrl(cancelUrl, 'CHECKOUT_CANCEL_URL');
    const payload = await parseJsonRequest(request);
    const products = catalogProducts || await loadCatalogProducts();
    const client = stripeClient || stripeClientFactory({
      secretKey: env.STRIPE_SECRET_KEY,
      apiBase: env.STRIPE_API_BASE,
      apiVersion: env.STRIPE_API_VERSION,
      allowLive: env.STRIPE_ALLOW_LIVE === 'true',
    });

    const checkout = await createDurableHostedCheckoutSession({
      request: payload?.request,
      customer: payload?.customer,
      catalogProducts: products,
      stripeClient: client,
      checkoutStore,
      successUrl: configuredSuccessUrl,
      cancelUrl: configuredCancelUrl,
      createdAt,
    });

    return jsonResponse(201, {
      sessionId: checkout.sessionId,
      url: checkout.url,
      mode: checkout.mode,
      reference: checkout.reference,
    }, corsOrigin);
  } catch (error) {
    return mapError(error, corsOrigin);
  }
}

export function createCheckoutSessionHandler(options = {}) {
  return (request) => handleCreateCheckoutSession(request, options);
}
