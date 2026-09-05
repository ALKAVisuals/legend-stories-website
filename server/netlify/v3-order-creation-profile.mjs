export class V3OrderCreationProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'V3OrderCreationProfileError';
    this.code = code;
  }
}

function isExplicitlyEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function hasNumberingPolicy(policy) {
  return Boolean(policy
    && typeof policy.resolveSeriesKey === 'function'
    && typeof policy.format === 'function');
}

function hasCompletePaidFinalizationConfig(config) {
  return Boolean(config?.enabled === true
    && hasNumberingPolicy(config.numberingPolicy)
    && typeof config.documentContextProvider === 'function');
}

export function isV3Profile1OrderCreationEnabled(env = process.env) {
  return isExplicitlyEnabled(env?.V3_PROFILE1_ORDER_CREATION_ENABLED);
}

export function resolveV3OrderCreationDocumentProfile({
  env = process.env,
  v3PaidFinalization = null,
} = {}) {
  if (!isV3Profile1OrderCreationEnabled(env)) return 0;

  if (!String(env?.NEON_DATABASE_URL || '').trim()
    || !hasCompletePaidFinalizationConfig(v3PaidFinalization)) {
    throw new V3OrderCreationProfileError(
      'V3_ORDER_CREATION_NOT_CONFIGURED',
      'Profile-1 order creation requires complete server-side V3 paid-finalization configuration.',
    );
  }

  return 1;
}
