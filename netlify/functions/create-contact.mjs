import { handleContactRequest } from '../../server/api/contact.mjs';
import { createResendContactNotifier } from '../../server/notifications/resend-contact-notifier.mjs';

export function createNetlifyContactHandler({
  env = process.env,
  notifierFactory = createResendContactNotifier,
  handlerOptions = {},
} = {}) {
  return async function netlifyContactHandler(request) {
    try {
      const apiKey = String(env.RESEND_API_KEY || '').trim();
      const from = String(env.RESEND_FROM || '').trim();
      if (!apiKey || !from) {
        return new Response(JSON.stringify({
          error: {
            code: 'CONTACT_SERVICE_NOT_CONFIGURED',
            message: 'Contact messaging is not configured.',
          },
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }

      const contactNotifier = notifierFactory({
        apiKey,
        from,
        to: String(env.CONTACT_NOTIFICATION_TO || 'info@legendmural.com').trim(),
      });
      return handleContactRequest(request, {
        ...handlerOptions,
        contactNotifier,
        allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
      });
    } catch (error) {
      console.error('Unexpected contact function bootstrap error.', {
        name: String(error?.name || 'Error').slice(0, 120),
        code: String(error?.code || 'UNKNOWN').slice(0, 120),
      });
      return new Response(JSON.stringify({
        error: {
          code: 'CONTACT_SERVICE_FAILED',
          message: 'The contact service could not be started.',
        },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  };
}

export default createNetlifyContactHandler();
