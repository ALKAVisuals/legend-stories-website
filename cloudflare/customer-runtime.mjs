function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function handleActiveContact(request, env) {
  try {
    const [{ handleContactRequest }, { createResendContactNotifier }] = await Promise.all([
      import('../server/api/contact.mjs'),
      import('../server/notifications/resend-contact-notifier.mjs'),
    ]);
    const apiKey = String(env.RESEND_API_KEY || '').trim();
    const from = String(env.RESEND_FROM || '').trim();
    if (!apiKey || !from) {
      return jsonResponse(503, {
        error: {
          code: 'CONTACT_SERVICE_NOT_CONFIGURED',
          message: 'Contact messaging is not configured.',
        },
      });
    }
    const contactNotifier = createResendContactNotifier({
      apiKey,
      from,
      to: String(env.CONTACT_NOTIFICATION_TO || 'info@legendmural.com').trim(),
    });
    return handleContactRequest(request, {
      contactNotifier,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  } catch (error) {
    console.error('Unexpected Cloudflare contact bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return jsonResponse(500, {
      error: {
        code: 'CONTACT_SERVICE_FAILED',
        message: 'The contact service could not be started.',
      },
    });
  }
}

export async function handleActiveWithdrawal(request, env) {
  try {
    const [
      { createNeonWithdrawalStore },
      { handleCreateWithdrawal },
      { createResendWithdrawalNotifier },
    ] = await Promise.all([
      import('../server/adapters/neon-withdrawal-store.mjs'),
      import('../server/api/create-withdrawal.mjs'),
      import('../server/notifications/resend-withdrawal-notifier.mjs'),
    ]);

    const connectionString = String(env.NEON_DATABASE_URL || '').trim();
    if (!connectionString) {
      return jsonResponse(503, {
        error: {
          code: 'WITHDRAWAL_STORE_NOT_CONFIGURED',
          message: 'Withdrawal storage is not configured.',
        },
      });
    }

    const withdrawalStore = createNeonWithdrawalStore({ connectionString });
    const resendApiKey = String(env.RESEND_API_KEY || '').trim();
    const resendFrom = String(env.RESEND_FROM || '').trim();
    const resendReplyTo = String(env.RESEND_REPLY_TO || '').trim();
    const withdrawalNotifier = resendApiKey && resendFrom
      ? createResendWithdrawalNotifier({
        apiKey: resendApiKey,
        from: resendFrom,
        ...(resendReplyTo ? { replyTo: resendReplyTo } : {}),
      })
      : null;

    return handleCreateWithdrawal(request, {
      withdrawalStore,
      withdrawalNotifier,
      allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
    });
  } catch (error) {
    console.error('Unexpected Cloudflare withdrawal bootstrap error.', {
      name: String(error?.name || 'Error').slice(0, 120),
      code: String(error?.code || 'UNKNOWN').slice(0, 120),
    });
    return jsonResponse(500, {
      error: {
        code: 'WITHDRAWAL_SERVICE_FAILED',
        message: 'The withdrawal service could not be started.',
      },
    });
  }
}
