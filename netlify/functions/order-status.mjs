import { handleOrderStatus } from '../../server/api/order-status.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

export function createNetlifyOrderStatusHandler({
  env = process.env,
  storeFactory,
  handlerOptions = {},
} = {}) {
  return async function netlifyOrderStatusHandler(request) {
    try {
      const orderStore = getCommerceOrderStore({ env, storeFactory });
      return await handleOrderStatus(request, {
        ...handlerOptions,
        orderStore,
        allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'ORDER_STATUS_SERVICE_NOT_CONFIGURED',
        message: 'Order verification is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      console.error('Unexpected Netlify order-status bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return unexpectedCommerceFunctionResponse(
        'ORDER_STATUS_SERVICE_FAILED',
        'Order verification could not be started.',
      );
    }
  };
}

export default createNetlifyOrderStatusHandler();
