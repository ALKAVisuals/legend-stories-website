import { handleCreateCheckoutSession } from '../../server/api/create-checkout-session.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

export function createNetlifyCheckoutHandler({
  env = process.env,
  storeFactory,
  handlerOptions = {},
} = {}) {
  return async function netlifyCheckoutHandler(request) {
    try {
      const checkoutStore = getCommerceOrderStore({ env, storeFactory });
      return await handleCreateCheckoutSession(request, {
        ...handlerOptions,
        env,
        checkoutStore,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'CHECKOUT_SERVICE_NOT_CONFIGURED',
        message: 'The secure checkout service is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      console.error('Unexpected Netlify checkout bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return unexpectedCommerceFunctionResponse(
        'CHECKOUT_SERVICE_FAILED',
        'The secure checkout service could not be started.',
      );
    }
  };
}

export default createNetlifyCheckoutHandler();
