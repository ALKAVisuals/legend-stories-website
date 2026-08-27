import { handlePayPalWebhook } from '../../server/api/paypal-webhook.mjs';
import {
  PayPalConfigurationError,
  createPayPalApiClient,
} from '../../server/payments/paypal-api.mjs';
import { createPayPalWebhookReconciler } from '../../server/payments/paypal-webhook-reconciliation.mjs';
import { getCommerceOrderStore } from '../../server/netlify/commerce-runtime.mjs';
import { createPaidOrderNotificationRuntime } from '../../server/netlify/paid-order-notification-runtime.mjs';

function bootstrapErrorResponse(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function safeNotificationBootstrapLog(error) {
  try {
    console.error('Paid-order notification runtime could not be prepared for PayPal webhook processing.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
  } catch {
    // Notification logging must never prevent verified webhook processing.
  }
}

export function createNetlifyPayPalWebhookHandler({
  env = process.env,
  clientFactory = createPayPalApiClient,
  storeFactory,
  notificationRuntimeFactory = createPaidOrderNotificationRuntime,
  processVerifiedEvent,
} = {}) {
  return async function netlifyPayPalWebhookHandler(request) {
    let paypalClient;
    let processor = processVerifiedEvent;
    try {
      paypalClient = clientFactory({
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        apiBase: env.PAYPAL_API_BASE,
        allowLive: env.PAYPAL_ALLOW_LIVE === 'true',
      });
      if (!processor && String(env.NEON_DATABASE_URL || '').trim()) {
        const orderStore = getCommerceOrderStore({ env, storeFactory });
        let reconcilePaidOrderNotifications = null;
        try {
          reconcilePaidOrderNotifications = notificationRuntimeFactory({ env });
        } catch (error) {
          safeNotificationBootstrapLog(error);
        }
        processor = createPayPalWebhookReconciler({
          orderStore,
          paypalClient,
          reconcilePaidOrderNotifications,
        });
      }
    } catch (error) {
      if (error instanceof PayPalConfigurationError
        || error?.code === 'NEON_DATABASE_URL_INVALID'
        || error?.code === 'PAYPAL_WEBHOOK_STORE_NOT_CONFIGURED') {
        return bootstrapErrorResponse(
          503,
          'PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED',
          'The PayPal webhook service is not configured.',
        );
      }
      console.error('Unexpected PayPal webhook bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return bootstrapErrorResponse(
        500,
        'PAYPAL_WEBHOOK_SERVICE_FAILED',
        'The PayPal webhook service could not be started.',
      );
    }

    return handlePayPalWebhook(request, {
      paypalClient,
      webhookId: env.PAYPAL_WEBHOOK_ID,
      processVerifiedEvent: processor,
    });
  };
}

export default createNetlifyPayPalWebhookHandler();
