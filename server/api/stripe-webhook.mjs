import { OrderStatusError, createOrderStatusUpdate } from '../orders/order-status.mjs';
import { OrderStoreContractError } from '../orders/store-contract.mjs';
import { requireStripePaymentEventStore } from '../orders/stripe-store-legacy.mjs';
import {
  StripeWebhookError,
  verifyAndNormalizeStripeWebhook,
} from '../payments/stripe-webhook.mjs';

const MAX_WEBHOOK_BYTES = 1024 * 1024;

function responseHeaders() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(),
  });
}

function errorResponse(status, code, message) {
  return jsonResponse(status, { error: { code, message } });
}

async function readRawBody(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_WEBHOOK_BYTES) {
    throw new StripeWebhookError('WEBHOOK_TOO_LARGE', 'The Stripe webhook body is too large.');
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MAX_WEBHOOK_BYTES) {
    throw new StripeWebhookError('WEBHOOK_TOO_LARGE', 'The Stripe webhook body is too large.');
  }
  if (body.length === 0) {
    throw new StripeWebhookError('EMPTY_WEBHOOK', 'The Stripe webhook body is empty.');
  }
  return body;
}

function mapError(error) {
  if (error instanceof StripeWebhookError) {
    if (error.code === 'INVALID_WEBHOOK_SECRET') {
      return errorResponse(503, 'WEBHOOK_NOT_CONFIGURED', 'Stripe webhook verification is not configured.');
    }
    return errorResponse(400, error.code, error.message);
  }
  if (error instanceof OrderStoreContractError) {
    return errorResponse(
      503,
      'PAYMENT_STORE_NOT_CONFIGURED',
      'Atomic payment-event storage is not configured.',
    );
  }
  if (error instanceof OrderStatusError) {
    return errorResponse(409, error.code, error.message);
  }
  if (error?.code === 'ORDER_NOT_FOUND') {
    return errorResponse(409, 'ORDER_NOT_FOUND', 'The referenced order is not available yet.');
  }

  console.error('Unexpected Stripe webhook error:', error);
  return errorResponse(500, 'STRIPE_WEBHOOK_FAILED', 'The Stripe webhook could not be processed.');
}

export async function handleStripeWebhook(request, {
  env = process.env,
  paymentStore = null,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
} = {}) {
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.');
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }

  const secret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret.startsWith('whsec_')) {
    return errorResponse(503, 'WEBHOOK_NOT_CONFIGURED', 'Stripe webhook verification is not configured.');
  }

  try {
    const rawBody = await readRawBody(request);
    const paymentEvent = verifyAndNormalizeStripeWebhook({
      rawBody,
      signatureHeader: request.headers.get('stripe-signature') || '',
      secret,
      toleranceSeconds,
      now,
    });

    if (paymentEvent.livemode && env.STRIPE_ALLOW_LIVE !== 'true') {
      return errorResponse(403, 'LIVE_WEBHOOK_DISABLED', 'Live Stripe webhooks are disabled.');
    }

    if (paymentEvent.ignored) {
      return jsonResponse(200, {
        received: true,
        ignored: true,
        eventId: paymentEvent.eventId,
        eventType: paymentEvent.eventType,
      });
    }

    const store = requireStripePaymentEventStore(paymentStore);
    const result = await store.processStripeEvent(
      paymentEvent,
      (order) => createOrderStatusUpdate(order, paymentEvent),
    );
    if (!result || typeof result.duplicate !== 'boolean') {
      throw new Error('Payment store returned an invalid processing result.');
    }

    return jsonResponse(200, {
      received: true,
      ignored: false,
      duplicate: result.duplicate,
      eventId: paymentEvent.eventId,
      reference: paymentEvent.reference,
      status: result.order?.status || paymentEvent.status,
    });
  } catch (error) {
    return mapError(error);
  }
}

export function createStripeWebhookHandler(options = {}) {
  return (request) => handleStripeWebhook(request, options);
}
