import {
  PayPalWebhookVerificationError,
  verifyPayPalWebhookSignature,
} from '../payments/paypal-webhook-verification.mjs';

function responseHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function jsonResponse(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders(extraHeaders),
  });
}

function errorResponse(status, code, message, extraHeaders = {}) {
  return jsonResponse(status, { error: { code, message } }, extraHeaders);
}

function verificationErrorResponse(error) {
  if (!(error instanceof PayPalWebhookVerificationError)) return null;

  switch (error.code) {
    case 'PAYPAL_WEBHOOK_BODY_TOO_LARGE':
      return errorResponse(413, error.code, 'The webhook payload is too large.');
    case 'PAYPAL_WEBHOOK_BODY_INVALID':
    case 'PAYPAL_WEBHOOK_HEADERS_INVALID':
      return errorResponse(400, error.code, 'The webhook request is invalid.');
    case 'PAYPAL_WEBHOOK_SIGNATURE_INVALID':
      return errorResponse(401, error.code, 'The webhook signature could not be verified.');
    case 'PAYPAL_WEBHOOK_ID_NOT_CONFIGURED':
    case 'PAYPAL_WEBHOOK_VERIFIER_NOT_CONFIGURED':
      return errorResponse(503, 'PAYPAL_WEBHOOK_SERVICE_NOT_CONFIGURED', 'The webhook service is not configured.');
    case 'PAYPAL_WEBHOOK_VERIFICATION_INVALID_RESPONSE':
      return errorResponse(503, 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE', 'Webhook verification is temporarily unavailable.');
    default:
      return errorResponse(503, 'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE', 'Webhook verification is temporarily unavailable.');
  }
}

export async function handlePayPalWebhook(request, {
  paypalClient,
  webhookId,
  processVerifiedEvent,
} = {}) {
  if (request.method !== 'POST') {
    return errorResponse(
      405,
      'METHOD_NOT_ALLOWED',
      'Only POST is supported.',
      { Allow: 'POST' },
    );
  }

  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return errorResponse(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'The webhook request must use application/json.',
    );
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse(400, 'PAYPAL_WEBHOOK_BODY_INVALID', 'The webhook request is invalid.');
  }

  let verified;
  try {
    verified = await verifyPayPalWebhookSignature({
      paypalClient,
      headers: request.headers,
      rawBody,
      webhookId,
    });
  } catch (error) {
    const mapped = verificationErrorResponse(error);
    if (mapped) return mapped;

    console.error('PayPal webhook verification request failed.', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return errorResponse(
      503,
      'PAYPAL_WEBHOOK_VERIFICATION_UNAVAILABLE',
      'Webhook verification is temporarily unavailable.',
    );
  }

  if (typeof processVerifiedEvent !== 'function') {
    return errorResponse(
      503,
      'PAYPAL_WEBHOOK_PROCESSOR_NOT_READY',
      'The verified webhook processor is not ready.',
    );
  }

  try {
    await processVerifiedEvent({
      event: verified.event,
      mode: verified.mode,
      rawBody,
    });
  } catch (error) {
    console.error('Verified PayPal webhook processing failed.', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
      eventId: String(verified.event?.id || ''),
      eventType: String(verified.event?.event_type || ''),
    });
    return errorResponse(
      503,
      'PAYPAL_WEBHOOK_PROCESSING_FAILED',
      'The verified webhook could not be processed safely.',
    );
  }

  return jsonResponse(200, { received: true });
}
