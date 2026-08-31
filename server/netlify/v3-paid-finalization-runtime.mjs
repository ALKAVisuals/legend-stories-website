import { createNeonPaidOrderFinalizer } from '../adapters/neon-paid-order-finalizer.mjs';
import { NetlifyCommerceConfigurationError } from './commerce-runtime.mjs';

function configurationFailure(code, message) {
  throw new NetlifyCommerceConfigurationError(code, message);
}

export function createV3PaidFinalizationRuntime({
  env = process.env,
  config = null,
  finalizerFactory = createNeonPaidOrderFinalizer,
} = {}) {
  if (config?.enabled !== true) return null;

  if (!config.numberingPolicy
    || typeof config.numberingPolicy.resolveSeriesKey !== 'function'
    || typeof config.numberingPolicy.format !== 'function') {
    configurationFailure(
      'V3_DOCUMENT_NUMBER_POLICY_MISSING',
      'V3 paid finalization requires an explicit server-side document numbering policy.',
    );
  }

  if (typeof config.documentContextProvider !== 'function') {
    configurationFailure(
      'V3_INVOICE_DOCUMENT_CONTEXT_MISSING',
      'V3 paid finalization requires explicit server-side invoice document context.',
    );
  }

  if (typeof finalizerFactory !== 'function') {
    configurationFailure(
      'V3_PAID_FINALIZER_FACTORY_INVALID',
      'The V3 paid-order finalizer adapter is unavailable.',
    );
  }

  const connectionString = String(env.NEON_DATABASE_URL || '').trim();
  if (!connectionString) {
    configurationFailure(
      'NEON_DATABASE_URL_MISSING',
      'The commerce database is not configured.',
    );
  }

  let runtime;
  try {
    runtime = finalizerFactory({
      connectionString,
      numberingPolicy: config.numberingPolicy,
      documentContextProvider: config.documentContextProvider,
    });
  } catch (error) {
    if (error instanceof NetlifyCommerceConfigurationError) throw error;
    configurationFailure(
      'V3_PAID_FINALIZER_CONFIGURATION_INVALID',
      'The V3 paid-order finalizer configuration is invalid.',
    );
  }

  if (typeof runtime?.finalizePaidOrder !== 'function') {
    configurationFailure(
      'V3_PAID_FINALIZER_FACTORY_INVALID',
      'The V3 paid-order finalizer adapter is unavailable.',
    );
  }

  return runtime.finalizePaidOrder.bind(runtime);
}
