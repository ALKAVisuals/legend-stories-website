export const DISCOUNT_CODES = Object.freeze({
  LEGEND10: 10,
  WELCOME15: 15,
});

export function normalizeDiscountCode(code = '') {
  return String(code).trim().toUpperCase();
}

export function resolveDiscount(code = '') {
  const normalizedCode = normalizeDiscountCode(code);
  const percent = DISCOUNT_CODES[normalizedCode] || 0;

  return Object.freeze({
    code: percent > 0 ? normalizedCode : '',
    percent,
    valid: percent > 0,
  });
}
