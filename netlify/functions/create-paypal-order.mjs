import { handleCreatePayPalOrder } from '../../server/api/create-paypal-order.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

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

export function isLegendMuralCheckoutPaused(env = process.env) {
  return String(env?.LEGENDMURAL_CHECKOUT_PAUSED || '').trim().toLowerCase() === 'true';
}

function checkoutPausedResponse() {
  return Response.json({
    error: {
      code: 'CHECKOUT_PAUSED',
      message: 'Checkout is temporarily unavailable. Please try again later.',
    },
  }, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'retry-after': '300',
    },
  });
}

export function resolveNetlifyPayPalReturnUrls(request, env = process.env) {
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

export function createNetlifyPayPalCheckoutHandler({
  env = process.env,
  storeFactory,
  handlerOptions = {},
} = {}) {
  return async function netlifyPayPalCheckoutHandler(request) {
    if (isLegendMuralCheckoutPaused(env)) {
      return checkoutPausedResponse();
    }

    try {
      const checkoutStore = getCommerceOrderStore({ env, storeFactory });
      const returnUrls = resolveNetlifyPayPalReturnUrls(request, env);
      return await handleCreatePayPalOrder(request, {
        ...handlerOptions,
        env,
        checkoutStore,
        successUrl: returnUrls.successUrl,
        cancelUrl: returnUrls.cancelUrl,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'PAYPAL_CHECKOUT_SERVICE_NOT_CONFIGURED',
        message: 'The PayPal checkout service is not configured.',
      });
      if (configurationResponse) {
        console.error('Netlify PayPal checkout configuration error.', {
          name: error?.name || 'Error',
          code: error?.code || 'UNKNOWN',
        });
        return configurationResponse;
      }

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
