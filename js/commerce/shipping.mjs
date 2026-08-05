const freezeMarket = (market) => Object.freeze(market);

export const DEFAULT_SHIPPING_COUNTRY = 'NL';
export const FREE_SHIPPING_THRESHOLD = 69;

const EU_COUNTRIES = Object.freeze({
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
});

function createEuMarket(code, name) {
  return freezeMarket({
    code,
    name,
    checkoutLabel: name,
    region: 'eu',
    cost: 9.95,
    freeFrom: FREE_SHIPPING_THRESHOLD,
    enabled: true,
    visibleInCheckout: true,
    status: 'active',
    customs: false,
    trackedShippingRequired: true,
    placesCountry: code.toLowerCase(),
    notice: `Shipping to ${name} is €9,95 and free from €69.`,
  });
}

const EU_SHIPPING_ZONES = Object.fromEntries(
  Object.entries(EU_COUNTRIES).map(([code, name]) => [code, createEuMarket(code, name)]),
);

export const SHIPPING_ZONES = Object.freeze({
  NL: freezeMarket({
    code: 'NL',
    name: 'Netherlands',
    checkoutLabel: 'Netherlands',
    region: 'domestic',
    cost: 4.95,
    freeFrom: FREE_SHIPPING_THRESHOLD,
    enabled: true,
    visibleInCheckout: true,
    status: 'active',
    customs: false,
    trackedShippingRequired: false,
    placesCountry: 'nl',
    notice: 'Shipping within the Netherlands is €4,95 and free from €69.',
  }),
  US: freezeMarket({
    code: 'US',
    name: 'United States',
    checkoutLabel: 'United States',
    region: 'international',
    cost: 9.95,
    freeFrom: FREE_SHIPPING_THRESHOLD,
    enabled: true,
    visibleInCheckout: true,
    status: 'active',
    customs: true,
    trackedShippingRequired: true,
    placesCountry: 'us',
    notice: 'Tracked shipping to the United States is €9,95 and free from €69. Local import duties and taxes may apply.',
  }),
  ...EU_SHIPPING_ZONES,
  OTHER: freezeMarket({
    code: 'OTHER',
    name: 'Unavailable market',
    checkoutLabel: 'Unavailable market',
    region: 'unsupported',
    cost: null,
    freeFrom: Number.POSITIVE_INFINITY,
    enabled: false,
    visibleInCheckout: false,
    status: 'unsupported',
    customs: true,
    trackedShippingRequired: true,
    placesCountry: null,
    notice: 'Shipping is not available for this destination yet.',
  }),
});

function normalizeCountryCode(countryCode) {
  return String(countryCode || '').trim().toUpperCase();
}

export function getShippingZone(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  return SHIPPING_ZONES[normalizedCountryCode] || SHIPPING_ZONES.OTHER;
}

export function isShippingCountryEnabled(countryCode) {
  return Boolean(getShippingZone(countryCode).enabled);
}

export function getCheckoutCountryOptions({ includePending = true } = {}) {
  return Object.values(SHIPPING_ZONES)
    .filter((market) => market.visibleInCheckout && (includePending || market.enabled))
    .map((market) => Object.freeze({
      code: market.code,
      name: market.name,
      label: market.checkoutLabel,
      enabled: market.enabled,
      status: market.status,
      customs: market.customs,
      notice: market.notice,
    }));
}

export function getShippingMarketNotice(countryCode) {
  return getShippingZone(countryCode).notice;
}

export function getPlacesCountryRestriction(countryCode = DEFAULT_SHIPPING_COUNTRY) {
  const market = getShippingZone(countryCode);
  if (market.enabled && market.placesCountry) return market.placesCountry;
  return SHIPPING_ZONES[DEFAULT_SHIPPING_COUNTRY].placesCountry;
}

export function calculateShipping({ countryCode = DEFAULT_SHIPPING_COUNTRY, subtotal = 0, hasItems = true } = {}) {
  if (!hasItems) return 0;
  const zone = getShippingZone(countryCode);
  if (!zone.enabled) {
    throw new Error(`Shipping is not enabled for ${countryCode || 'this market'}.`);
  }
  if (!Number.isFinite(zone.cost) || zone.cost < 0) {
    throw new Error(`Shipping cost is not configured for ${zone.code}.`);
  }
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  return safeSubtotal >= zone.freeFrom ? 0 : zone.cost;
}
