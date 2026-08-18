import { createNeonWithdrawalStore } from '../../server/adapters/neon-withdrawal-store.mjs';
import { handleCreateWithdrawal } from '../../server/api/create-withdrawal.mjs';
import { createResendWithdrawalNotifier } from '../../server/notifications/resend-withdrawal-notifier.mjs';

export function createNetlifyWithdrawalHandler({
  env = process.env,
  storeFactory = createNeonWithdrawalStore,
  notifierFactory = createResendWithdrawalNotifier,
  handlerOptions = {},
} = {}) {
  return async function netlifyWithdrawalHandler(request) {
    try {
      const connectionString = String(env.NEON_DATABASE_URL || '').trim();
      if (!connectionString) {
        return new Response(JSON.stringify({
          error: {
            code: 'WITHDRAWAL_STORE_NOT_CONFIGURED',
            message: 'Withdrawal storage is not configured.',
          },
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }

      const withdrawalStore = storeFactory({ connectionString });
      const resendApiKey = String(env.RESEND_API_KEY || '').trim();
      const resendFrom = String(env.RESEND_FROM || '').trim();
      const withdrawalNotifier = resendApiKey && resendFrom
        ? notifierFactory({ apiKey: resendApiKey, from: resendFrom })
        : null;

      return handleCreateWithdrawal(request, {
        ...handlerOptions,
        withdrawalStore,
        withdrawalNotifier,
        allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
      });
    } catch (error) {
      console.error('Unexpected withdrawal function bootstrap error.', {
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
      return new Response(JSON.stringify({
        error: {
          code: 'WITHDRAWAL_SERVICE_FAILED',
          message: 'The withdrawal service could not be started.',
        },
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  };
}

export default createNetlifyWithdrawalHandler();
