const DEFAULT_SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com';
const LIVE_API_BASE = 'https://api-m.paypal.com';
const MAX_ERROR_BODY_LENGTH = 2_000;
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{1,36}$/;

export class PayPalConfigurationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalConfigurationError';
    this.code = code;
    this.details = details;
  }
}

export class PayPalApiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PayPalApiError';
    this.code = code;
    this.details = details;
  }
}

function configurationError(code, message, details) {
  throw new PayPalConfigurationError(code, message, details);
}

function normalizeCredentials(clientId, clientSecret) {
  const normalizedClientId = String(clientId || '').trim();
  const normalizedClientSecret = String(clientSecret || '').trim();
  if (!normalizedClientId || !normalizedClientSecret) {
    configurationError(
      'PAYPAL_CREDENTIALS_NOT_CONFIGURED',
      'PayPal client credentials are not configured.',
    );
  }
  return Object.freeze({
    clientId: normalizedClientId,
    clientSecret: normalizedClientSecret,
  });
}

export function normalizePayPalOrderId(value) {
  const orderId = String(value || '').trim().toUpperCase();
  if (!PAYPAL_ORDER_ID_PATTERN.test(orderId)) {
    throw new PayPalApiError('INVALID_PAYPAL_ORDER_ID', 'PayPal order ID is invalid.');
  }
  return orderId;
}

export function normalizePayPalApiBase(value, { allowLive = false } = {}) {
  const source = String(value || DEFAULT_SANDBOX_API_BASE).trim();
  let url;
  try {
    url = new URL(source);
  } catch {
    configurationError('INVALID_PAYPAL_API_BASE', 'PayPal API base URL is invalid.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    configurationError('INVALID_PAYPAL_API_BASE', 'PayPal API base URL must be a clean HTTPS origin.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  const origin = url.origin;
  if (origin === LIVE_API_BASE && !allowLive) {
    configurationError(
      'PAYPAL_LIVE_NOT_ALLOWED',
      'PayPal live API access requires explicit PAYPAL_ALLOW_LIVE=true.',
    );
  }
  if (![DEFAULT_SANDBOX_API_BASE, LIVE_API_BASE].includes(origin)) {
    configurationError(
      'UNTRUSTED_PAYPAL_API_BASE',
      'PayPal API base must use an official PayPal API origin.',
    );
  }

  return Object.freeze({
    apiBase: origin,
    mode: origin === LIVE_API_BASE ? 'live' : 'test',
  });
}

async function readErrorBody(response) {
  const text = await response.text().catch(() => '');
  return text.slice(0, MAX_ERROR_BODY_LENGTH);
}

async function parseJsonResponse(response, code, message) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new PayPalApiError(code, message, { status: response.status });
  }
  return payload;
}

function requestId(value) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 108 || /[^A-Za-z0-9._:-]/.test(normalized)) {
    throw new PayPalApiError('INVALID_PAYPAL_REQUEST_ID', 'PayPal request ID is invalid.');
  }
  return normalized;
}

function rawJsonRequestBody(value) {
  if (typeof value !== 'string' || !value) {
    throw new PayPalApiError(
      'INVALID_PAYPAL_RAW_JSON_BODY',
      'PayPal raw JSON request body is invalid.',
    );
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
  } catch {
    throw new PayPalApiError(
      'INVALID_PAYPAL_RAW_JSON_BODY',
      'PayPal raw JSON request body is invalid.',
    );
  }
  return value;
}

export function createPayPalApiClient({
  clientId = process.env.PAYPAL_CLIENT_ID,
  clientSecret = process.env.PAYPAL_CLIENT_SECRET,
  apiBase = process.env.PAYPAL_API_BASE,
  allowLive = process.env.PAYPAL_ALLOW_LIVE === 'true',
  fetchImpl = globalThis.fetch,
} = {}) {
  const credentials = normalizeCredentials(clientId, clientSecret);
  const configuration = normalizePayPalApiBase(apiBase, { allowLive });
  if (typeof fetchImpl !== 'function') {
    configurationError('PAYPAL_FETCH_UNAVAILABLE', 'PayPal API transport is unavailable.');
  }

  let accessTokenPromise = null;

  async function getAccessToken() {
    if (!accessTokenPromise) {
      accessTokenPromise = (async () => {
        const basic = Buffer.from(
          `${credentials.clientId}:${credentials.clientSecret}`,
          'utf8',
        ).toString('base64');
        const response = await fetchImpl(`${configuration.apiBase}/v1/oauth2/token`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        if (!response.ok) {
          const body = await readErrorBody(response);
          throw new PayPalApiError(
            'PAYPAL_OAUTH_FAILED',
            'PayPal could not authenticate the server.',
            { status: response.status, body },
          );
        }
        const payload = await parseJsonResponse(
          response,
          'PAYPAL_OAUTH_INVALID_RESPONSE',
          'PayPal returned an invalid authentication response.',
        );
        const token = String(payload?.access_token || '').trim();
        if (!token) {
          throw new PayPalApiError(
            'PAYPAL_OAUTH_INVALID_RESPONSE',
            'PayPal returned no access token.',
          );
        }
        return token;
      })().catch((error) => {
        accessTokenPromise = null;
        throw error;
      });
    }
    return accessTokenPromise;
  }

  async function paypalRequest(path, {
    method = 'GET',
    body,
    rawJsonBody,
    paypalRequestId,
    preferRepresentation = false,
  } = {}) {
    if (body !== undefined && rawJsonBody !== undefined) {
      throw new PayPalApiError(
        'INVALID_PAYPAL_REQUEST_BODY',
        'PayPal request cannot contain both structured and raw JSON bodies.',
      );
    }
    const accessToken = await getAccessToken();
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    if (paypalRequestId) headers['PayPal-Request-Id'] = requestId(paypalRequestId);
    if (preferRepresentation) headers.Prefer = 'return=representation';

    const requestBody = rawJsonBody === undefined
      ? (body === undefined ? undefined : JSON.stringify(body))
      : rawJsonRequestBody(rawJsonBody);
    const response = await fetchImpl(`${configuration.apiBase}${path}`, {
      method,
      headers,
      ...(requestBody === undefined ? {} : { body: requestBody }),
    });
    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      throw new PayPalApiError(
        'PAYPAL_API_REQUEST_FAILED',
        'PayPal rejected the payment request.',
        { status: response.status, body: errorBody },
      );
    }
    return parseJsonResponse(
      response,
      'PAYPAL_API_INVALID_RESPONSE',
      'PayPal returned an invalid API response.',
    );
  }

  return Object.freeze({
    mode: configuration.mode,
    apiBase: configuration.apiBase,
    async createOrder(payload, { idempotencyKey } = {}) {
      return paypalRequest('/v2/checkout/orders', {
        method: 'POST',
        body: payload,
        paypalRequestId: idempotencyKey,
        preferRepresentation: true,
      });
    },
    async captureOrder(orderIdInput, { idempotencyKey } = {}) {
      const orderId = normalizePayPalOrderId(orderIdInput);
      return paypalRequest(`/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        body: {},
        paypalRequestId: idempotencyKey,
        preferRepresentation: true,
      });
    },
    async getOrder(orderIdInput) {
      const orderId = normalizePayPalOrderId(orderIdInput);
      return paypalRequest(`/v2/checkout/orders/${orderId}`);
    },
    async verifyWebhookSignature(rawVerificationBody) {
      return paypalRequest('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        rawJsonBody: rawVerificationBody,
      });
    },
  });
}
