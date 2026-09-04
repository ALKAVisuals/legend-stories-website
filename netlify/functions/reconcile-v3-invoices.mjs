import { createV3InvoiceReconciliationRuntime } from '../../server/netlify/v3-invoice-reconciliation-runtime.mjs';

export const config = Object.freeze({
  schedule: '*/5 * * * *',
});

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function createNetlifyV3InvoiceReconciliationHandler({
  runtimeFactory = createV3InvoiceReconciliationRuntime,
  runtimeOptions = {},
  logger = console,
} = {}) {
  if (typeof runtimeFactory !== 'function') {
    throw new TypeError('V3 reconciliation runtime factory must be a function.');
  }
  const run = runtimeFactory(runtimeOptions);
  if (typeof run !== 'function') {
    throw new TypeError('V3 reconciliation runtime factory returned an invalid runner.');
  }

  return async function netlifyV3InvoiceReconciliationHandler() {
    try {
      const result = await run();
      return jsonResponse(200, result);
    } catch (error) {
      try {
        logger?.error?.('V3 invoice reconciliation runtime failed.', {
          name: String(error?.name || 'Error').slice(0, 120),
          code: String(error?.code || 'UNKNOWN').slice(0, 120),
        });
      } catch {
        // Logging failure must not hide the scheduled-function failure response.
      }
      return jsonResponse(500, Object.freeze({
        failed: true,
        code: 'V3_INVOICE_RECONCILIATION_RUNTIME_FAILED',
      }));
    }
  };
}

export default createNetlifyV3InvoiceReconciliationHandler();
