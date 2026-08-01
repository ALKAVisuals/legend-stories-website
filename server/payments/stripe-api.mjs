const DEFAULT_API_BASE = 'https://api.stripe.com/v1';

export class StripeConfigurationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StripeConfigurationError';
    this.code = code;
  }
}

export class StripeApiError extends Error {
  constructor(code, message, { status = 502, requestId = '' } = {}) {
    super(message);
    this.name = 'StripeApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

function validateSecretKey(secretKey, allowLive) {
  const key = String(secretKey || '').trim();
  if (!key) {
    throw new StripeConfigurationError(
      'MISSING_STRIPE_SECRET_KEY',
      'STRIPE_SECRET_KEY is required to create a Checkout Session.',
    );
  }
  if (!key.startsWith('sk_test_') && !key.startsWith('sk_live_')) {
    throw new StripeConfigurationError(
      'INVALID_STRIPE_SECRET_KEY',
      'STRIPE_SECRET_KEY must be a Stripe secret test or live key.',
    );
  }
  if (key.startsWith('sk_live_') && !allowLive) {
    throw new StripeConfigurationError(
      'LIVE_STRIPE_KEY_BLOCKED',
      'Live Stripe keys are blocked unless STRIPE_ALLOW_LIVE=true is set explicitly.',
    );
  }
  return key;
}

function appendFormValue(form, key, value) {
  if (value === undefined || value === null) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => appendFormValue(form, `${key}[${index}]`, entry));
    return;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, childValue]) => {
      appendFormValue(form, `${key}[${childKey}]`, childValue);
    });
    return;
  }

  form.append(key, typeof value === 'boolean' ? String(value) : String(value));
}

export function encodeStripeForm(payload = {}) {
  const form = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => appendFormValue(form, key, value));
  return form;
}

export function createStripeApiClient({
  secretKey = process.env.STRIPE_SECRET_KEY,
  apiBase = process.env.STRIPE_API_BASE || DEFAULT_API_BASE,
  apiVersion = process.env.STRIPE_API_VERSION || '',
  allowLive = process.env.STRIPE_ALLOW_LIVE === 'true',
  fetchImpl = globalThis.fetch,
} = {}) {
  const key = validateSecretKey(secretKey, allowLive);
  if (typeof fetchImpl !== 'function') {
    throw new StripeConfigurationError('MISSING_FETCH', 'A Fetch-compatible implementation is required.');
  }

  const normalizedBase = String(apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
  const mode = key.startsWith('sk_test_') ? 'test' : 'live';

  return Object.freeze({
    mode,
    async createCheckoutSession(payload, { idempotencyKey = '' } = {}) {
      const headers = {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      if (apiVersion) headers['Stripe-Version'] = apiVersion;
      if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

      let response;
      try {
        response = await fetchImpl(`${normalizedBase}/checkout/sessions`, {
          method: 'POST',
          headers,
          body: encodeStripeForm(payload),
        });
      } catch (error) {
        throw new StripeApiError(
          'STRIPE_NETWORK_ERROR',
          'Stripe could not be reached. Please try again.',
          { status: 502 },
        );
      }

      const requestId = response.headers?.get?.('request-id') || '';
      let body;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        const message = body?.error?.message || 'Stripe rejected the Checkout Session request.';
        throw new StripeApiError('STRIPE_REQUEST_FAILED', message, {
          status: response.status || 502,
          requestId,
        });
      }

      if (!body?.id || !body?.url) {
        throw new StripeApiError(
          'INVALID_STRIPE_RESPONSE',
          'Stripe returned an incomplete Checkout Session.',
          { status: 502, requestId },
        );
      }

      return Object.freeze({
        id: body.id,
        url: body.url,
        paymentStatus: body.payment_status || 'unpaid',
        livemode: Boolean(body.livemode),
        requestId,
      });
    },
  });
}
