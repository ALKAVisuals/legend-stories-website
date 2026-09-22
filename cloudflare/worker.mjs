export const CLOUDFLARE_API_ROUTES = Object.freeze([
  '/api/paypal/checkout',
  '/api/paypal/capture',
  '/api/paypal/webhook',
  '/api/order-status',
  '/api/contact',
  '/api/withdrawal',
  '/api/invoice-download',
  '/api/internal/dashboard-invoice',
  '/api/internal/p3-v3-one-cent-start',
]);

const API_ROUTE_SET = new Set(CLOUDFLARE_API_ROUTES);

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function productionContext(env) {
  return String(env?.LEGENDMURAL_DEPLOY_CONTEXT || '').trim().toLowerCase() === 'production';
}

function hasServiceToken(value) {
  const token = String(value ?? '');
  return token.length >= 32 && token.length <= 512 && !/[\u0000-\u001f\u007f]/.test(token);
}

function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  });
}

function unexpectedResponse(code, message) {
  return jsonResponse(500, { error: { code, message } });
}

function normalizedOrigin(value = '') {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

export function resolveCloudflarePayPalReturnUrls(request, env = process.env) {
  const requestOrigin = normalizedOrigin(request?.url);
  const browserOrigin = normalizedOrigin(request?.headers?.get?.('origin') || '');
  if (requestOrigin && browserOrigin === requestOrigin) {
    return Object.freeze({
      successUrl: new URL('/order-success.html', `${requestOrigin}/`).toString(),
      cancelUrl: new URL('/order-cancelled.html', `${requestOrigin}/`).toString(),
    });
  }
  return Object.freeze({
    successUrl: env.CHECKOUT_SUCCESS_URL,
    cancelUrl: env.CHECKOUT_CANCEL_URL,
  });
}

function checkoutPausedResponse() {
  return jsonResponse(503, {
    error: {
      code: 'CHECKOUT_PAUSED',
      message: 'Checkout is temporarily unavailable. Please try again later.',
    },
  }, {
    'Retry-After': '300',
  });
}

const P3_V3_WINDOW_KEY_SHA256 = 'b9c882ed809231911a641d0c49bcf297e0722b705d3f48cb0c37f1988f157c83';

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function validP3Secret(value) {
  const token = String(value || '');
  return token.length >= 32
    && token.length <= 512
    && !/[\u0000-\u001f\u007f]/.test(token);
}

async function handleP3V3OneCentStart(request, env) {
  if (!productionContext(env) || !enabled(env.P3_TEST_CHECKOUT_ENABLED)) {
    return jsonResponse(404, {
      error: {
        code: 'API_ROUTE_NOT_FOUND',
        message: 'The requested API route does not exist.',
      },
    });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is allowed.',
      },
    });
  }

  const requestOrigin = normalizedOrigin(request.headers.get('origin') || '');
  if (requestOrigin !== 'https://legendmural.com') {
    return jsonResponse(403, {
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Request origin is not allowed.',
      },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body is invalid JSON.',
      },
    });
  }

  const providedHash = await sha256Hex(payload?.key);
  if (!timingSafeEqual(providedHash, P3_V3_WINDOW_KEY_SHA256)) {
    return jsonResponse(403, {
      error: {
        code: 'P3_TEST_WINDOW_UNAUTHORIZED',
        message: 'The temporary test code is invalid.',
      },
    });
  }

  const p3Token = String(env.P3_TEST_CHECKOUT_TOKEN || '');
  if (!validP3Secret(p3Token)) {
    return jsonResponse(503, {
      error: {
        code: 'P3_TEST_WINDOW_NOT_CONFIGURED',
        message: 'The temporary test window is not configured.',
      },
    });
  }

  const runtime = await loadApiRuntime();
  const checkoutRequest = new Request('https://legendmural.com/api/paypal/checkout', {
    method: 'POST',
    headers: {
      Origin: 'https://legendmural.com',
      'Content-Type': 'application/json',
      'x-legendmural-p3-test-token': p3Token,
    },
    body: JSON.stringify({
      request: {
        items: [{
          slug: '__p3-controlled-payment-test__',
          quantity: 1,
        }],
        countryCode: 'NL',
        discountCode: '',
      },
      customer: payload?.customer,
    }),
  });

  return runtime.handleActiveCheckout(
    checkoutRequest,
    env,
    resolveCloudflarePayPalReturnUrls(checkoutRequest, env),
  );
}

function dashboardDisabledResponse(request, env) {
  if (request.headers.get('origin')) {
    return jsonResponse(403, {
      error: {
        code: 'BROWSER_ORIGIN_NOT_ALLOWED',
        message: 'Browser-origin requests are not allowed.',
      },
    }, { 'Cache-Control': 'private, no-store' });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST is allowed.',
      },
    }, { 'Cache-Control': 'private, no-store' });
  }

  const apiEnabled = enabled(env.V3_DASHBOARD_INVOICE_API_ENABLED) && productionContext(env);
  if (!apiEnabled) {
    return jsonResponse(503, {
      error: {
        code: 'DASHBOARD_INVOICE_API_DISABLED',
        message: 'Dashboard invoice API is not enabled.',
      },
    }, { 'Cache-Control': 'private, no-store' });
  }
  if (!hasServiceToken(env.LEGENDMURAL_DASHBOARD_INVOICE_TOKEN)) {
    return jsonResponse(503, {
      error: {
        code: 'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
        message: 'Dashboard invoice API is not configured.',
      },
    }, { 'Cache-Control': 'private, no-store' });
  }
  return null;
}

async function loadApiRuntime() {
  return import('./api-runtime.mjs');
}

async function loadCustomerRuntime() {
  return import('./customer-runtime.mjs');
}

export async function routeCloudflareApi(request, env) {
  const pathname = new URL(request.url).pathname;

  if (!API_ROUTE_SET.has(pathname)) {
    return jsonResponse(404, {
      error: {
        code: 'API_ROUTE_NOT_FOUND',
        message: 'The requested API route does not exist.',
      },
    });
  }

  if (pathname === '/api/paypal/checkout' && enabled(env.LEGENDMURAL_CHECKOUT_PAUSED)) {
    return checkoutPausedResponse();
  }

  if (pathname === '/api/internal/dashboard-invoice') {
    const disabled = dashboardDisabledResponse(request, env);
    if (disabled) return disabled;
  }

  if (pathname === '/api/internal/p3-v3-one-cent-start') {
    return handleP3V3OneCentStart(request, env);
  }

  if (pathname === '/api/contact' || pathname === '/api/withdrawal') {
    const customerRuntime = await loadCustomerRuntime();
    if (pathname === '/api/contact') {
      return customerRuntime.handleActiveContact(request, env);
    }
    return customerRuntime.handleActiveWithdrawal(request, env);
  }

  const runtime = await loadApiRuntime();
  switch (pathname) {
    case '/api/paypal/checkout':
      return runtime.handleActiveCheckout(
        request,
        env,
        resolveCloudflarePayPalReturnUrls(request, env),
      );
    case '/api/paypal/capture':
      return runtime.handleActiveCapture(request, env);
    case '/api/paypal/webhook':
      return runtime.handleActiveWebhook(request, env);
    case '/api/order-status':
      return runtime.handleActiveStatus(request, env);
    case '/api/invoice-download':
      return runtime.handleActiveInvoice(request, env);
    case '/api/internal/dashboard-invoice':
      return runtime.handleActiveDashboardInvoice(request, env);
    default:
      return jsonResponse(404, {
        error: {
          code: 'API_ROUTE_NOT_FOUND',
          message: 'The requested API route does not exist.',
        },
      });
  }
}

function canonicalRedirect(request) {
  const url = new URL(request.url);
  if (url.hostname === 'www.legendmural.com') {
    url.hostname = 'legendmural.com';
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  if (url.hostname === 'legendmural.com' && url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  return null;
}

function secureStaticResponse(response, request, env) {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const url = new URL(request.url);
  if (
    productionContext(env)
    && url.protocol === 'https:'
    && (url.hostname === 'legendmural.com' || url.hostname === 'www.legendmural.com')
  ) {
    headers.set('Strict-Transport-Security', 'max-age=31536000');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleCloudflareFetch(request, env) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const requestUrl = new URL(request.url);
  const pathname = requestUrl.pathname;
  if (pathname.startsWith('/api/')) {
    return routeCloudflareApi(request, env);
  }

  if (typeof env?.ASSETS?.fetch !== 'function') {
    return unexpectedResponse(
      'STATIC_ASSETS_NOT_CONFIGURED',
      'Static asset delivery is not configured.',
    );
  }

  if (pathname === '/') {
    requestUrl.pathname = '/index.html';
    const response = await env.ASSETS.fetch(new Request(requestUrl.toString(), request));
    return secureStaticResponse(response, request, env);
  }

  const response = await env.ASSETS.fetch(request);
  return secureStaticResponse(response, request, env);
}

function skippedReconciliation(reason) {
  return Object.freeze({
    skipped: true,
    reason,
    selected: 0,
    sent: 0,
    failed: 0,
    duplicate: 0,
  });
}

export async function handleCloudflareScheduled(_controller, env) {
  let result;
  if (!enabled(env.V3_INVOICE_RECONCILIATION_ENABLED)) {
    result = skippedReconciliation('reconciliation_disabled');
  } else if (!enabled(env.ORDER_EMAILS_ENABLED)) {
    result = skippedReconciliation('emails_disabled');
  } else {
    const runtime = await loadApiRuntime();
    result = await runtime.runActiveCloudflareScheduled(env);
  }

  console.log('Cloudflare V3 invoice reconciliation completed.', {
    skipped: Boolean(result?.skipped),
    reason: String(result?.reason || '').slice(0, 80),
    selected: Number(result?.selected || 0),
    sent: Number(result?.sent || 0),
    failed: Number(result?.failed || 0),
    duplicate: Number(result?.duplicate || 0),
  });
  return result;
}

export function isCloudflareApiRoute(pathname) {
  return API_ROUTE_SET.has(String(pathname || ''));
}

export default {
  fetch: handleCloudflareFetch,
  scheduled: handleCloudflareScheduled,
};
