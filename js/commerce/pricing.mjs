export function calculateSubtotal(items = []) {
  return items.reduce((total, item) => {
    const price = Math.max(0, Number(item.price) || 0);
    const quantity = Math.max(0, Number(item.quantity) || 0);
    return total + price * quantity;
  }, 0);
}

export function calculateDiscount(subtotal, percent = 0) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  return safeSubtotal * (safePercent / 100);
}

export function calculateGrandTotal({ items = [], shipping = 0, discountPercent = 0 } = {}) {
  const subtotal = calculateSubtotal(items);
  const discount = calculateDiscount(subtotal, discountPercent);
  const safeShipping = Math.max(0, Number(shipping) || 0);
  return Math.max(0, subtotal - discount + safeShipping);
}
