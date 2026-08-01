const BLOCKED_EFFECTIVE_TYPES = new Set(['slow-2g', '2g']);

export function normalizeEffectiveType(value = '') {
  return String(value).trim().toLowerCase();
}

export function evaluateCollectionVideoPolicy({
  reducedMotion = false,
  saveData = false,
  effectiveType = '',
  documentHidden = false,
  intersecting = false,
} = {}) {
  const normalizedEffectiveType = normalizeEffectiveType(effectiveType);
  let reason = 'allowed';

  if (reducedMotion) reason = 'reduced-motion';
  else if (saveData) reason = 'save-data';
  else if (BLOCKED_EFFECTIVE_TYPES.has(normalizedEffectiveType)) reason = 'constrained-network';

  const mayLoad = reason === 'allowed';
  const shouldPlay = mayLoad && intersecting && !documentHidden;

  return Object.freeze({
    mayLoad,
    shouldPlay,
    reason,
    effectiveType: normalizedEffectiveType,
  });
}

export function readConnectionPreferences(connection = null) {
  return Object.freeze({
    saveData: Boolean(connection?.saveData),
    effectiveType: normalizeEffectiveType(connection?.effectiveType),
  });
}
