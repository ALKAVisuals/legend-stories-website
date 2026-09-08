import catalog from '../data/products/catalog.json' with { type: 'json' };

import {
  CloudflareCommerceConfigurationError,
  CloudflareV3OrderCreationProfileError,
  createCloudflareV3PaidFinalizationRuntime,
  getCloudflareCommerceOrderStore,
  resolveCloudflareOrderCreationDocumentProfile,
} from './runtime-core.mjs';

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

function configurationResponse(error, code, message) {
  if (!(error instanceof CloudflareCommerceConfigurationError)) return null;
  return jsonResponse(503, { error: { code, message } });
}

function unexpectedResponse(code, message) {
  return jsonResponse(500, { error: { code, message } });
}

function disabledNotificationResult() {
  return Object.freeze({
    skipped: true,
    reason: 'disabled',
    failed: false,
    deliveries: Object.freeze([]),
  });
}

async function resolveNotificationRuntime(env) {
  if (!enabled(env.ORDER_EMAILS_ENABLED)) {
    return async function disabledPaidOrderNotifications() {
      return disabledNotificationResult();
    };
  }
  const { createCloudflarePaidOrderNotificationRuntime } = await import('./runtime.mjs');
  return createCloudflarePaidOrderNotificationRuntime({ env });
}

export async function handleActiveCheckout(request, env, { successUrl, cancelUrl } = {}) {
  try {
    const { handleCreatePayPalOrder } = await import('../server/api/create-paypal-order.mjs');
    const documentProfileVersion = resolveCloudflareOrderCreationDocumentProfile({ env });
    const checkoutStore = getCloudflareCommerceOrderStore({ env });
    return await handleCreatePayPalOrder(request, {
      env,
      catalogProducts: catalog.products,
      checkoutStore,
      documentProfileVersion,
      successUrl,
      cancelUrl,
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

export async function handleActiveCapture(request, env) {
  try {
    const { handleCapturePayPalOrder } = await import('../server/api/capture-paypal-order.mjs');
    const orderStore = getCloudflareCommerceOrderStore({ env });
    const reconcilePaidOrderNotifications = await resolveNotificationRuntime(env);
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

export async function handleActiveWebhook(request, env) {
  let paypalClient;
  let processor;
  let PayPalConfigurationError;
  try {
    const paypal = await import('../server/payments/paypal-api.mjs');
    PayPalConfigurationError = paypal.PayPalConfigurationError;
    paypalClient = paypal.createPayPalApiClient({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
      apiBase: env.PAYPAL_API_BASE,
      allowLive: env.PAYPAL_ALLOW_LIVE === 'true',
    });
    if (String(env.NEON_DATABASE_URL || '').trim()) {
      const orderStore = getCloudflareCommerceOrderStore({ env });
      let reconcilePaidOrderNotifications = null;
      try {
        reconcilePaidOrderNotifications = await resolveNotificationRuntime(env);
      } catch (error) {
        safeNotificationBootstrapLog(error);
      }
      const finalizePaidOrder = createCloudflareV3PaidFinalizationRuntime({ env });
      const { createPayPalWebhookReconciler } = await import('../server/payments/paypal-webhook-reconciliation.mjs');
      processor = createPayPalWebhookReconciler({
        orderStore,
        paypalClient,
        finalizePaidOrder,
        reconcilePaidOrderNotifications,
      });
    }
  } catch (error) {
    if ((PayPalConfigurationError && error instanceof PayPalConfigurationError)
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

  const { handlePayPalWebhook } = await import('../server/api/paypal-webhook.mjs');
  return handlePayPalWebhook(request, {
    paypalClient,
    webhookId: env.PAYPAL_WEBHOOK_ID,
    processVerifiedEvent: processor,
  });
}

export async function handleActiveStatus(request, env) {
  try {
    const { handleOrderStatus } = await import('../server/api/order-status.mjs');
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

export async function handleActiveInvoice(request, env) {
  const { handleInvoiceDownload } = await import('../server/api/invoice-download.mjs');
  if (!enabled(env.V3_INVOICE_STORAGE_ENABLED)) {
    return handleInvoiceDownload(request, {
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  }

  try {
    const [artifactModule, identityModule, auditModule, r2Module] = await Promise.all([
      import('../server/adapters/neon-v3-invoice-artifact-store.mjs'),
      import('../server/adapters/neon-v3-invoice-download-source.mjs'),
      import('../server/adapters/neon-v3-invoice-access-audit-store.mjs'),
      import('../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs'),
    ]);
    const orderStore = getCloudflareCommerceOrderStore({ env });
    const artifactStore = artifactModule.createNeonV3InvoiceArtifactStore({
      connectionString: env.NEON_DATABASE_URL,
    });
    const identitySource = identityModule.createNeonV3InvoiceDownloadSource({
      connectionString: env.NEON_DATABASE_URL,
    });
    const auditStore = auditModule.createNeonV3InvoiceAccessAuditStore({
      connectionString: env.NEON_DATABASE_URL,
    });
    const pdfStore = r2Module.createCloudflareR2V3InvoicePdfStore({ env });
    return await handleInvoiceDownload(request, {
      orderStore,
      identitySource,
      artifactStore,
      auditStore,
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
    const errorCode = String(error?.code || '');
    if (errorCode.startsWith('V3_INVOICE_STORAGE_') || errorCode.startsWith('V3_INVOICE_AUDIT_')) {
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

export async function handleActiveDashboardInvoice(request, env) {
  const { handleDashboardInvoiceAccess } = await import('../server/api/dashboard-invoice-access.mjs');
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
    const [invoiceModule, artifactModule, auditModule, r2Module] = await Promise.all([
      import('../server/adapters/neon-v3-dashboard-invoice-source.mjs'),
      import('../server/adapters/neon-v3-invoice-artifact-store.mjs'),
      import('../server/adapters/neon-v3-invoice-access-audit-store.mjs'),
      import('../server/adapters/cloudflare-r2-v3-invoice-pdf-store.mjs'),
    ]);
    const invoiceSource = invoiceModule.createNeonV3DashboardInvoiceSource({
      connectionString: env.NEON_DATABASE_URL,
    });
    const artifactStore = artifactModule.createNeonV3InvoiceArtifactStore({
      connectionString: env.NEON_DATABASE_URL,
    });
    const storageEnabled = enabled(env.V3_INVOICE_STORAGE_ENABLED);
    const auditStore = storageEnabled
      ? auditModule.createNeonV3InvoiceAccessAuditStore({ connectionString: env.NEON_DATABASE_URL })
      : null;
    const pdfStore = storageEnabled
      ? r2Module.createCloudflareR2V3InvoicePdfStore({ env })
      : null;
    return await handleDashboardInvoiceAccess(request, {
      apiEnabled,
      serviceToken,
      storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      invoiceSource,
      artifactStore,
      auditStore,
      pdfStore,
    });
  } catch (error) {
    const configured = configurationResponse(
      error,
      'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
      'Dashboard invoice API is not configured.',
    );
    if (configured) return configured;
    const errorCode = String(error?.code || '');
    if (errorCode.startsWith('V3_INVOICE_STORAGE_') || errorCode.startsWith('V3_INVOICE_AUDIT_')) {
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

export async function runActiveCloudflareScheduled(env) {
  const { createCloudflareV3InvoiceReconciliationRuntime } = await import('./runtime.mjs');
  const run = createCloudflareV3InvoiceReconciliationRuntime({ env });
  return run();
}
