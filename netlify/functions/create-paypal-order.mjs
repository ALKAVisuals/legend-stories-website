import { handleCreatePayPalOrder } from '../../server/api/create-paypal-order.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

export function createNetlifyPayPalCheckoutHandler({
  env = process.env,
  storeFactory,
  handlerOptions = {},
} = {}) {
  return async function netlifyPayPalCheckoutHandler(request) {
    try {
      const checkoutStore = getCommerceOrderStore({ env, storeFactory });
      return await handleCreatePayPalOrder(request, {
        ...handlerOptions,
        env,
        checkoutStore,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED',
        message: 'The PayPal checkout service is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      console.error('Unexpected Netlify PayPal checkout bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return unexpectedCommerceFunctionResponse(
        'PAYPAL_CHECKOUT_SERVICE_FAILED',
        'The PayPal checkout service could not be started.',
      );
    }
  };
}

export default createNetlifyPayPalCheckoutHandler();
