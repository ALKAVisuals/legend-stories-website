const ACTION_DELTAS = Object.freeze({
  decrement: -1,
  increment: 1,
});

export function escapeCartHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseCartIndex(value) {
  const index = Number.parseInt(String(value), 10);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

export function renderCartItemMarkup({ item, index, formatPrice } = {}) {
  const cartIndex = parseCartIndex(index);
  if (!item || cartIndex === null || typeof formatPrice !== 'function') {
    throw new Error('Cart item markup requires an item, non-negative index and price formatter.');
  }

  const safeName = escapeCartHtml(item.name || 'Product');
  const safeImage = escapeCartHtml(item.image || '🎨');
  const quantity = Math.max(1, Number.parseInt(String(item.quantity), 10) || 1);
  const lineTotal = Number(item.price) * quantity;
  const imageMarkup = String(item.image || '').startsWith('media/')
    ? `<img src="${safeImage}" alt="${safeName}" class="w-12 h-12 object-contain rounded" decoding="async">`
    : safeImage;

  return '<div class="flex gap-4 mb-3 p-3 rounded-xl bg-surface-light/50 border border-surface-border/30">' +
    '<div class="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-2xl shrink-0">' + imageMarkup + '</div>' +
    '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-text-primary truncate">' + safeName + '</p>' +
    '<div class="flex items-center justify-between mt-2"><div class="flex items-center gap-2">' +
    '<button type="button" data-cart-action="decrement" data-cart-index="' + cartIndex + '" aria-label="Decrease quantity for ' + safeName + '" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">−</button>' +
    '<span class="text-sm text-text-primary min-w-[20px] text-center">' + quantity + '</span>' +
    '<button type="button" data-cart-action="increment" data-cart-index="' + cartIndex + '" aria-label="Increase quantity for ' + safeName + '" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">+</button>' +
    '</div><div class="flex items-center gap-3"><span class="text-sm font-medium text-mint">' + formatPrice(lineTotal) + '</span>' +
    '<button type="button" data-cart-action="remove" data-cart-index="' + cartIndex + '" aria-label="Remove ' + safeName + ' from cart" class="text-text-muted hover:text-red-400 transition-colors">' +
    '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>' +
    '</button></div></div></div></div>';
}

export function initCartControlDelegation({
  container,
  onUpdateQuantity,
  onRemoveItem,
} = {}) {
  if (!container?.addEventListener) {
    throw new Error('Cart control delegation requires a container.');
  }
  if (typeof onUpdateQuantity !== 'function' || typeof onRemoveItem !== 'function') {
    throw new Error('Cart control delegation requires update and remove callbacks.');
  }

  function handleClick(event) {
    const control = event?.target?.closest?.('[data-cart-action][data-cart-index]');
    if (!control || !container.contains?.(control)) return;

    const index = parseCartIndex(control.dataset?.cartIndex);
    const action = control.dataset?.cartAction;
    if (index === null || (!Object.hasOwn(ACTION_DELTAS, action) && action !== 'remove')) return;

    event.preventDefault?.();
    if (action === 'remove') {
      onRemoveItem(index);
      return;
    }
    onUpdateQuantity(index, ACTION_DELTAS[action]);
  }

  container.addEventListener('click', handleClick);

  return Object.freeze({
    destroy() {
      container.removeEventListener?.('click', handleClick);
    },
  });
}
