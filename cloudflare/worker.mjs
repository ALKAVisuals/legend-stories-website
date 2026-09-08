export const CLOUDFLARE_API_ROUTES = Object.freeze([
  '/api/paypal/checkout',
  '/api/paypal/capture',
  '/api/paypal/webhook',
  '/api/order-status',
  '/api/invoice-download',
  '/api/internal/dashboard-invoice',
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

export async function handleCloudflareFetch(request, env) {
  const redirect = canonicalRedirect(request);
  if (redirect) return redirect;

  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith('/api/')) {
    return routeCloudflareApi(request, env);
  }

  if (typeof env?.ASSETS?.fetch !== 'function') {
    return unexpectedResponse(
      'STATIC_ASSETS_NOT_CONFIGURED',
      'Static asset delivery is not configured.',
    );
  }
  return env.ASSETS.fetch(request);
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
