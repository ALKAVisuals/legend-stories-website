import catalog from '../data/products/catalog.json' with { type: 'json' };

import { handleCreatePayPalOrder } from '../server/api/create-paypal-order.mjs';
import { handleCapturePayPalOrder } from '../server/api/capture-paypal-order.mjs';
import { handlePayPalWebhook } from '../server/api/paypal-webhook.mjs';
import { handleOrderStatus } from '../server/api/order-status.mjs';
import { handleInvoiceDownload } from '../server/api/invoice-download.mjs';
import { handleDashboardInvoiceAccess } from '../server/api/dashboard-invoice-access.mjs';
import { createNeonV3InvoiceArtifactStore } from '../server/adapters/neon-v3-invoice-artifact-store.mjs';
import { createNeonV3InvoiceDownloadSource } from '../server/adapters/neon-v3-invoice-download-source.mjs';
import { createNeonV3DashboardInvoiceSource } from '../server/adapters/neon-v3-dashboard-invoice-source.mjs';
import { createCloudflareR2V3InvoicePdfStore } from '../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs';
import {
  PayPalConfigurationError,
  createPayPalApiClient,
} from '../server/payments/paypal-api.mjs';
import { createPayPalWebhookReconciler } from '../server/payments/paypal-webhook-reconciliation.mjs';
import {
  CloudflareCommerceConfigurationError,
  CloudflareV3OrderCreationProfileError,
  createCloudflarePaidOrderNotificationRuntime,
  createCloudflareV3InvoiceReconciliationRuntime,
  createCloudflareV3PaidFinalizationRuntime,
  getCloudflareCommerceOrderStore,
  resolveCloudflareOrderCreationDocumentProfile,
} from './runtime.mjs';

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

function configurationResponse(error, code, message) {
  if (!(error instanceof CloudflareCommerceConfigurationError)) return null;
  return jsonResponse(503, { error: { code, message } });
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

async function handleCheckout(request, env) {
  if (enabled(env.LEGENDMURAL_CHECKOUT_PAUSED)) return checkoutPausedResponse();

  try {
    const documentProfileVersion = resolveCloudflareOrderCreationDocumentProfile({ env });
    const checkoutStore = getCloudflareCommerceOrderStore({ env });
    const returnUrls = resolveCloudflarePayPalReturnUrls(request, env);
    return await handleCreatePayPalOrder(request, {
      env,
      catalogProducts: catalog.products,
      checkoutStore,
      documentProfileVersion,
      successUrl: returnUrls.successUrl,
      cancelUrl: returnUrls.cancelUrl,
    });
  } catch (error) {
    if (error instanceof CloudflareV3OrderCreationProfileError) {
      return jsonResponse(503, {
        error: {
          code: 'V3_ORDER_CREATION_NOT_CONFIGURED',
          message: 'V3 order creation is not configured.',
        },
      });
    }
    const configured = configurationResponse(
      error,
      'PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED',
      'The PayPal checkout service is not configured.',
    );
    if (configured) return configured;
    console.error('Unexpected Cloudflare PayPal checkout bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'PAYPAL_CHECKOUT_SERVICE_FAILED',
      'The PayPal checkout service could not be started.',
    );
  }
}

async function handleCapture(request, env) {
  try {
    const orderStore = getCloudflareCommerceOrderStore({ env });
    const reconcilePaidOrderNotifications = createCloudflarePaidOrderNotificationRuntime({ env });
    const finalizePaidOrder = createCloudflareV3PaidFinalizationRuntime({ env });
    return await handleCapturePayPalOrder(request, {
      env,
      orderStore,
      finalizePaidOrder,
      reconcilePaidOrderNotifications,
    });
  } catch (error) {
    const configured = configurationResponse(
      error,
      'PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED',
      'The PayPal capture service is not configured.',
    );
    if (configured) return configured;
    console.error('Unexpected Cloudflare PayPal capture bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'PAYPAL_CAPTURE_SERVICE_FAILED',
      'The PayPal capture service could not be started.',
    );
  }
}

function safeNotificationBootstrapLog(error) {
  try {
    console.error('Paid-order notification runtime could not be prepared for PayPal webhook processing.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
  } catch {}
}

async function handleWebhook(request, env) {
  let paypalClient;
  let processor;
  try {
    paypalClient = createPayPalApiClient({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      apiBase: env.PAYPAL_API_BASE,
      allowLive: env.PAYPAL_ALLOW_LIVE === 'true',
    });
    if (String(env.NEON_DATABASE_URL || '').trim()) {
      const orderStore = getCloudflareCommerceOrderStore({ env });
      let reconcilePaidOrderNotifications = null;
      try {
        reconcilePaidOrderNotifications = createCloudflarePaidOrderNotificationRuntime({ env });
      } catch (error) {
        safeNotificationBootstrapLog(error);
      }
      const finalizePaidOrder = createCloudflareV3PaidFinalizationRuntime({ env });
      processor = createPayPalWebhookReconciler({
        orderStore,
        paypalClient,
        finalizePaidOrder,
        reconcilePaidOrderNotifications,
      });
    }
  } catch (error) {
    if (error instanceof PayPalConfigurationError
      || error?.code === 'NEON_DATABASE_URL_INVALID'
      || error?.code === 'PAYPAL_WEBHOOK_STORE_NOT_CONFIGURED') {
      return jsonResponse(503, {
        error: {
          code: 'PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED',
          message: 'The PayPal webhook service is not configured.',
        },
      });
    }
    console.error('Unexpected Cloudflare PayPal webhook bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'PAYPAL_WEBHOOK_SERVICE_FAILED',
      'The PayPal webhook service could not be started.',
    );
  }

  return handlePayPalWebhook(request, {
    paypalClient,
    webhookId: env.PAYPAL_WEBHOOK_ID,
    processVerifiedEvent: processor,
  });
}

async function handleStatus(request, env) {
  try {
    const orderStore = getCloudflareCommerceOrderStore({ env });
    return await handleOrderStatus(request, {
      orderStore,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  } catch (error) {
    const configured = configurationResponse(
      error,
      'ORDER_STATUS_SERVICE_NOT_CONFIGURED',
      'Order verification is not configured.',
    );
    if (configured) return configured;
    console.error('Unexpected Cloudflare order-status bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'ORDER_STATUS_SERVICE_FAILED',
      'Order verification could not be started.',
    );
  }
}

function storageConfigurationResponse(message = 'Invoice download is not configured.') {
  return jsonResponse(503, {
    error: {
      code: 'INVOICE_DOWNLOAD_NOT_CONFIGURED',
      message,
    },
  }, {
    'Cache-Control': 'private, no-store',
  });
}

async function handleInvoice(request, env) {
  if (!enabled(env.V3_INVOICE_STORAGE_ENABLED)) {
    return handleInvoiceDownload(request, {
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  }

  try {
    const orderStore = getCloudflareCommerceOrderStore({ env });
    const artifactStore = createNeonV3InvoiceArtifactStore({ connectionString: env.NEON_DATABASE_URL });
    const identitySource = createNeonV3InvoiceDownloadSource({ connectionString: env.NEON_DATABASE_URL });
    const pdfStore = createCloudflareR2V3InvoicePdfStore({ env });
    return await handleInvoiceDownload(request, {
      orderStore,
      identitySource,
      artifactStore,
      pdfStore,
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  } catch (error) {
    const configured = configurationResponse(
      error,
      'INVOICE_DOWNLOAD_NOT_CONFIGURED',
      'Invoice download is not configured.',
    );
    if (configured) return configured;
    if (String(error?.code || '').startsWith('V3_INVOICE_STORAGE_')) {
      return storageConfigurationResponse();
    }
    console.error('Unexpected Cloudflare invoice-download bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'INVOICE_DOWNLOAD_SERVICE_FAILED',
      'Invoice download could not be started.',
    );
  }
}

function hasServiceToken(value) {
  const token = String(value ?? '');
  return token.length >= 32 && token.length <= 512 && !/[\u0000-\u001f\u007f]/.test(token);
}

async function handleDashboardInvoice(request, env) {
  const serviceToken = env.LEGENDMURAL_DASHBOARD_INVOICE_TOKEN;
  const apiEnabled = enabled(env.V3_DASHBOARD_INVOICE_API_ENABLED) && productionContext(env);
  if (!apiEnabled || !hasServiceToken(serviceToken)) {
    return handleDashboardInvoiceAccess(request, {
      apiEnabled,
      serviceToken,
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
    });
  }

  try {
    const invoiceSource = createNeonV3DashboardInvoiceSource({ connectionString: env.NEON_DATABASE_URL });
    const artifactStore = createNeonV3InvoiceArtifactStore({ connectionString: env.NEON_DATABASE_URL });
    const pdfStore = enabled(env.V3_INVOICE_STORAGE_ENABLED)
      ? createCloudflareR2V3InvoicePdfStore({ env })
      : null;
    return await handleDashboardInvoiceAccess(request, {
      apiEnabled,
      serviceToken,
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      invoiceSource,
      artifactStore,
      pdfStore,
    });
  } catch (error) {
    const configured = configurationResponse(
      error,
      'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
      'Dashboard invoice API is not configured.',
    );
    if (configured) return configured;
    if (String(error?.code || '').startsWith('V3_INVOICE_STORAGE_')) {
      return jsonResponse(503, {
        error: {
          code: 'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
          message: 'Dashboard invoice API is not configured.',
        },
      }, {
        'Cache-Control': 'private, no-store',
      });
    }
    console.error('Unexpected Cloudflare dashboard invoice bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return unexpectedResponse(
      'DASHBOARD_INVOICE_API_FAILED',
      'Dashboard invoice API could not be started.',
    );
  }
}

export async function routeCloudflareApi(request, env) {
  const pathname = new URL(request.url).pathname;
  switch (pathname) {
    case '/api/paypal/checkout': return handleCheckout(request, env);
    case '/api/paypal/capture': return handleCapture(request, env);
    case '/api/paypal/webhook': return handleWebhook(request, env);
    case '/api/order-status': return handleStatus(request, env);
    case '/api/invoice-download': return handleInvoice(request, env);
    case '/api/internal/dashboard-invoice': return handleDashboardInvoice(request, env);
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

export async function handleCloudflareScheduled(_controller, env) {
  const run = createCloudflareV3InvoiceReconciliationRuntime({ env });
  try {
    const result = await run();
    console.log('Cloudflare V3 invoice reconciliation completed.', {
      skipped: Boolean(result?.skipped),
      reason: String(result?.reason || '').slice(0, 80),
      selected: Number(result?.selected || 0),
      sent: Number(result?.sent || 0),
      failed: Number(result?.failed || 0),
      duplicate: Number(result?.duplicate || 0),
    });
  } catch (error) {
    console.error('Cloudflare V3 invoice reconciliation failed.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    throw error;
  }
}

export function isCloudflareApiRoute(pathname) {
  return API_ROUTE_SET.has(String(pathname || ''));
}

export default {
  fetch: handleCloudflareFetch,
  scheduled: handleCloudflareScheduled,
};
