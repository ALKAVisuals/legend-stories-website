export function roundMoney(value = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function calculateSubtotal(items = []) {
  const total = items.reduce((sum, item) => {
    const price = Math.max(0, Number(item.price) || 0);
    const quantity = Math.max(0, Number(item.quantity) || 0);
    return sum + price * quantity;
  }, 0);
  return roundMoney(total);
}

export function calculateDiscount(subtotal, percent = 0) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  return roundMoney(safeSubtotal * (safePercent / 100));
}

export function calculateGrandTotal({ items = [], shipping = 0, discountPercent = 0 } = {}) {
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountPercent);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  return roundMoney(Math.max(0, subtotal - discount + safeShipping));
}
