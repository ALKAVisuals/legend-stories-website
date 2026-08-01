export const SHIPPING_ZONES = Object.freeze({
  NL: { cost: 3.95, freeFrom: 50 },
  BE: { cost: 5.95, freeFrom: 75 },
  DE: { cost: 5.95, freeFrom: 75 },
  FR: { cost: 5.95, freeFrom: 75 },
  DK: { cost: 9.95, freeFrom: 100 },
  SE: { cost: 9.95, freeFrom: 100 },
  US: { cost: 14.95, freeFrom: 150 },
  OTHER: { cost: 14.95, freeFrom: 150 }
});

export function getShippingZone(countryCode) {
  return SHIPPING_ZONES[countryCode] || SHIPPING_ZONES.OTHER;
}

export function calculateShipping({ countryCode = 'NL', subtotal = 0, hasItems = true } = {}) {
  if (!hasItems) return 0;
  const zone = getShippingZone(countryCode);
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  return safeSubtotal >= zone.freeFrom ? 0 : zone.cost;
}
