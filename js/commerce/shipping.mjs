export const SHIPPING_ZONES = Object.freeze({
  NL: { name: 'Netherlands', cost: 3.95, freeFrom: 50 },
  BE: { name: 'Belgium', cost: 5.95, freeFrom: 75 },
  DE: { name: 'Germany', cost: 5.95, freeFrom: 75 },
  FR: { name: 'France', cost: 5.95, freeFrom: 75 },
  LU: { name: 'Luxembourg', cost: 5.95, freeFrom: 75 },
  AT: { name: 'Austria', cost: 5.95, freeFrom: 75 },
  DK: { name: 'Denmark', cost: 9.95, freeFrom: 100 },
  SE: { name: 'Sweden', cost: 9.95, freeFrom: 100 },
  ES: { name: 'Spain', cost: 9.95, freeFrom: 100 },
  IT: { name: 'Italy', cost: 9.95, freeFrom: 100 },
  PT: { name: 'Portugal', cost: 9.95, freeFrom: 100 },
  IE: { name: 'Ireland', cost: 9.95, freeFrom: 100 },
  FI: { name: 'Finland', cost: 9.95, freeFrom: 100 },
  PL: { name: 'Poland', cost: 9.95, freeFrom: 100 },
  CZ: { name: 'Czech Republic', cost: 9.95, freeFrom: 100 },
  CH: { name: 'Switzerland', cost: 9.95, freeFrom: 100 },
  NO: { name: 'Norway', cost: 9.95, freeFrom: 100 },
  GB: { name: 'United Kingdom', cost: 9.95, freeFrom: 100 },
  US: { name: 'United States', cost: 14.95, freeFrom: 150 },
  CA: { name: 'Canada', cost: 14.95, freeFrom: 150 },
  AU: { name: 'Australia', cost: 14.95, freeFrom: 150 },
  JP: { name: 'Japan', cost: 14.95, freeFrom: 150 },
  OTHER: { name: 'Rest of World', cost: 14.95, freeFrom: 150 },
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
