export const SHIPPING_ZONES = Object.freeze({
  NL: Object.freeze({ name: 'Netherlands', cost: 4.95, freeFrom: 69, enabled: true }),
  OTHER: Object.freeze({ name: 'Unavailable market', cost: 0, freeFrom: Number.POSITIVE_INFINITY, enabled: false }),
});

export function getShippingZone(countryCode) {
  return SHIPPING_ZONES[countryCode] || SHIPPING_ZONES.OTHER;
}

export function isShippingCountryEnabled(countryCode) {
  return Boolean(getShippingZone(countryCode).enabled);
}

export function calculateShipping({ countryCode = 'NL', subtotal = 0, hasItems = true } = {}) {
  if (!hasItems) return 0;
  const zone = getShippingZone(countryCode);
  if (!zone.enabled) {
    throw new Error(`Shipping is not enabled for ${countryCode || 'this market'}.`);
  }
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  return safeSubtotal >= zone.freeFrom ? 0 : zone.cost;
}
