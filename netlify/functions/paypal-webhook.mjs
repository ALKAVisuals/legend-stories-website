import { handlePayPalWebhook } from '../../server/api/paypal-webhook.mjs';
import {
  PayPalConfigurationError,
  createPayPalApiClient,
} from '../../server/payments/paypal-api.mjs';

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

export function createNetlifyPayPalWebhookHandler({
  env = process.env,
  clientFactory = createPayPalApiClient,
  processVerifiedEvent,
} = {}) {
  return async function netlifyPayPalWebhookHandler(request) {
    let paypalClient;
    try {
      paypalClient = clientFactory({
        clientId: env.PAYPAL_CLIENT_ID,
        clientSecret: env.PAYPAL_CLIENT_SECRET,
        apiBase: env.PAYPAL_API_BASE,
        allowLive: env.PAYPAL_ALLOW_LIVE === 'true',
      });
    } catch (error) {
      if (error instanceof PayPalConfigurationError) {
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
      processVerifiedEvent,
    });
  };
}

export default createNetlifyPayPalWebhookHandler();
