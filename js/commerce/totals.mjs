import { calculateDiscount, calculateSubtotal } from './pricing.mjs';
import { calculateShipping, getShippingZone, SHIPPING_ZONES } from './shipping.mjs';

export function calculateCommerceTotals({
  items = [],
  countryCode = 'NL',
  discountPercent = 0,
} = {}) {
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountPercent);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const normalizedCountryCode = Object.hasOwn(SHIPPING_ZONES, countryCode)
    ? countryCode
    : 'OTHER';
  const zone = getShippingZone(normalizedCountryCode);
  const shipping = calculateShipping({
    countryCode: normalizedCountryCode,
    subtotal: discountedSubtotal,
    hasItems: items.length > 0,
  });
  const grandTotal = Math.max(0, discountedSubtotal + shipping);
  const freeShippingRemaining = items.length > 0
    ? Math.max(0, zone.freeFrom - discountedSubtotal)
    : 0;

  return Object.freeze({
    subtotal,
    discount,
    discountedSubtotal,
    shipping,
    grandTotal,
    freeShippingRemaining,
    qualifiesForFreeShipping: items.length > 0 && shipping === 0,
    countryCode: normalizedCountryCode,
    zone,
  });
}
