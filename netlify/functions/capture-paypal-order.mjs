import { handleCapturePayPalOrder } from '../../server/api/capture-paypal-order.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';
import { createPaidOrderNotificationRuntime } from '../../server/netlify/paid-order-notification-runtime.mjs';

export function createNetlifyPayPalCaptureHandler({
  env = process.env,
  storeFactory,
  notificationRuntimeFactory = createPaidOrderNotificationRuntime,
  handlerOptions = {},
} = {}) {
  return async function netlifyPayPalCaptureHandler(request) {
    try {
      const orderStore = getCommerceOrderStore({ env, storeFactory });
      const reconcilePaidOrderNotifications = handlerOptions.reconcilePaidOrderNotifications
        || notificationRuntimeFactory({ env });
      return await handleCapturePayPalOrder(request, {
        ...handlerOptions,
        env,
        orderStore,
        reconcilePaidOrderNotifications,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'PAYPAL_CAPTURE_SERVICE_NOT_CONFIGURED',
        message: 'The PayPal capture service is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      console.error('Unexpected Netlify PayPal capture bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return unexpectedCommerceFunctionResponse(
        'PAYPAL_CAPTURE_SERVICE_FAILED',
        'The PayPal capture service could not be started.',
      );
    }
  };
}

export default createNetlifyPayPalCaptureHandler();
