import { createNeonPaidOrderFinalizer } from '../adapters/neon-paid-order-finalizer.mjs';
import { recordPayPalWebhookEventInTransaction } from '../adapters/neon-paypal-webhook-event-recorder.mjs';

function hasNumberingPolicy(policy) {
  return Boolean(policy
    && typeof policy.resolveSeriesKey === 'function'
    && typeof policy.format === 'function');
}

export function createV3PaidFinalizationRuntime({
  env = process.env,
  config = null,
  finalizerFactory = createNeonPaidOrderFinalizer,
  providerEventRecorder = recordPayPalWebhookEventInTransaction,
} = {}) {
  // Production remains explicitly inactive until business/legal configuration is approved.
  // Returning null is intentional: paid profile-1 paths then fail closed before mutation,
  // while profile-0 continues through the existing legacy stores.
  if (config?.enabled !== true) return null;

  if (!hasNumberingPolicy(config.numberingPolicy)
    || typeof config.documentContextProvider !== 'function'
    || typeof finalizerFactory !== 'function'
    || typeof providerEventRecorder !== 'function') {
    return null;
  }

  const connectionString = String(env.NEON_DATABASE_URL || '').trim();
  if (!connectionString) return null;

  let runtime;
  try {
    runtime = finalizerFactory({
      connectionString,
      numberingPolicy: config.numberingPolicy,
      documentContextProvider: config.documentContextProvider,
      providerEventRecorder,
    });
  } catch {
    return null;
  }

  if (typeof runtime?.finalizePaidOrder !== 'function') return null;
  return runtime.finalizePaidOrder.bind(runtime);
}
