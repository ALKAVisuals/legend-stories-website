import { handleCapturePayPalOrder } from '../../server/api/capture-paypal-order.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';
import { createPaidOrderNotificationRuntime } from '../../server/netlify/paid-order-notification-runtime.mjs';
import { createV3PaidFinalizationRuntime } from '../../server/netlify/v3-paid-finalization-runtime.mjs';

export function createNetlifyPayPalCaptureHandler({
  env = process.env,
  storeFactory,
  notificationRuntimeFactory = createPaidOrderNotificationRuntime,
  v3PaidFinalization = null,
  v3PaidFinalizationRuntimeFactory = createV3PaidFinalizationRuntime,
  handlerOptions = {},
} = {}) {
  return async function netlifyPayPalCaptureHandler(request) {
    try {
      const orderStore = getCommerceOrderStore({ env, storeFactory });
      const reconcilePaidOrderNotifications = handlerOptions.reconcilePaidOrderNotifications
        || notificationRuntimeFactory({ env });
      const finalizePaidOrder = handlerOptions.finalizePaidOrder
        || v3PaidFinalizationRuntimeFactory({
          env,
          config: v3PaidFinalization,
        });
      return await handleCapturePayPalOrder(request, {
        ...handlerOptions,
        env,
        orderStore,
        finalizePaidOrder,
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
