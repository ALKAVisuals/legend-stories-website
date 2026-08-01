import { calculateDiscount, calculateSubtotal } from './pricing.mjs';
import { calculateShipping, getShippingZone } from './shipping.mjs';

export function calculateCommerceTotals({
  items = [],
  countryCode = 'NL',
  discountPercent = 0,
} = {}) {
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountPercent);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const shipping = calculateShipping({
    countryCode,
    subtotal: discountedSubtotal,
    hasItems: items.length > 0,
  });
  const grandTotal = Math.max(0, discountedSubtotal + shipping);
  const zone = getShippingZone(countryCode);
  const freeShippingRemaining = Math.max(0, zone.freeFrom - discountedSubtotal);

  return Object.freeze({
    subtotal,
    discount,
    discountedSubtotal,
    shipping,
    grandTotal,
    freeShippingRemaining,
    qualifiesForFreeShipping: items.length > 0 && shipping === 0,
    countryCode: SHIPPING_CODE(countryCode),
    zone,
  });
}

function SHIPPING_CODE(countryCode) {
  return typeof countryCode === 'string' && countryCode in Object.fromEntries([])
    ? countryCode
    : countryCode;
}
