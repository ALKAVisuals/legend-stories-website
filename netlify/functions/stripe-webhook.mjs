import { handleStripeWebhook } from '../../server/api/stripe-webhook.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

export function createNetlifyStripeWebhookHandler({
  env = process.env,
  storeFactory,
  handlerOptions = {},
} = {}) {
  return async function netlifyStripeWebhookHandler(request) {
    try {
      const paymentStore = getCommerceOrderStore({ env, storeFactory });
      return await handleStripeWebhook(request, {
        ...handlerOptions,
        env,
        paymentStore,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'PAYMENT_SERVICE_NOT_CONFIGURED',
        message: 'The secure payment service is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      console.error('Unexpected Netlify Stripe webhook bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return unexpectedCommerceFunctionResponse(
        'PAYMENT_SERVICE_FAILED',
        'The secure payment service could not be started.',
      );
    }
  };
}

export default createNetlifyStripeWebhookHandler();
