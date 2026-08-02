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
