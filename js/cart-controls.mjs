import { loadProductRegistry } from './catalog/related-products.mjs';

const ACTION_DELTAS = Object.freeze({
  decrement: -1,
  increment: 1,
});

const CART_IMAGE_PATH_PATTERN = /^(?:media\/(?!\/)|(?:\.\/)?assets\/(?!\/)|\/(?:[A-Za-z0-9._~-]+\/)*assets\/(?!\/))/;
const PRODUCT_PAGE_PATTERN = /^[A-Za-z0-9._~-]+\.html$/;
const recoveredCartImages = new Map();

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

function normalizeProductPage(value = '') {
  const page = String(value).trim();
  return PRODUCT_PAGE_PATTERN.test(page) ? page : '';
}

export function isCartImagePath(value = '') {
  return CART_IMAGE_PATH_PATTERN.test(String(value).trim());
}

export function persistRecoveredCartImage(
  page,
  image,
  storage = globalThis.localStorage,
) {
  const safePage = normalizeProductPage(page);
  const safeImage = String(image || '').trim();
  if (!safePage || !isCartImagePath(safeImage) || !storage?.getItem || !storage?.setItem) {
    return false;
  }

  try {
    const savedCart = JSON.parse(storage.getItem('legendCart') || '[]');
    if (!Array.isArray(savedCart)) return false;

    let changed = false;
    const updatedCart = savedCart.map((item) => {
      if (!item || item.page !== safePage || item.image === safeImage) return item;
      changed = true;
      return { ...item, image: safeImage };
    });

    if (changed) storage.setItem('legendCart', JSON.stringify(updatedCart));
    return changed;
  } catch {
    return false;
  }
}

export async function recoverCartImage({
  imageElement,
  page,
  baseUri = globalThis.document?.baseURI,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  registryLoader = loadProductRegistry,
} = {}) {
  const safePage = normalizeProductPage(page);
  if (!imageElement || !safePage || typeof registryLoader !== 'function') return null;

  const recoveryState = imageElement.dataset?.cartImageRecovery;
  if (recoveryState === 'pending' || recoveryState === 'done' || recoveryState === 'failed') {
    return null;
  }

  if (imageElement.dataset) imageElement.dataset.cartImageRecovery = 'pending';

  try {
    const products = await registryLoader(baseUri, fetchImpl);
    const product = Array.isArray(products)
      ? products.find((entry) => entry?.page === safePage)
      : null;
    const replacement = String(product?.browserImage || product?.image || '').trim();

    if (!isCartImagePath(replacement)) {
      throw new Error('The product registry does not contain a safe browser image path.');
    }

    recoveredCartImages.set(safePage, replacement);
    persistRecoveredCartImage(safePage, replacement, storage);
    imageElement.src = replacement;
    if (imageElement.dataset) imageElement.dataset.cartImageRecovery = 'done';
    return replacement;
  } catch {
    if (imageElement.dataset) imageElement.dataset.cartImageRecovery = 'failed';
    return null;
  }
}

export function renderCartItemMarkup({ item, index, formatPrice } = {}) {
  const cartIndex = parseCartIndex(index);
  if (!item || cartIndex === null || typeof formatPrice !== 'function') {
    throw new Error('Cart item markup requires an item, non-negative index and price formatter.');
  }

  const productPage = normalizeProductPage(item.page);
  const resolvedImage = recoveredCartImages.get(productPage) || item.image;
  const safeName = escapeCartHtml(item.name || 'Product');
  const variantText = item.sizeLabel
    ? `${item.variantLabel || 'Size'} · ${item.sizeLabel}`
    : (item.sizeCm ? `${item.sizeCm} cm${item.variantLabel ? ` · ${item.variantLabel}` : ''}` : '');
  const safeVariant = escapeCartHtml(variantText);
  const accessibleName = safeVariant ? `${safeName}, ${safeVariant}` : safeName;
  const safeImage = escapeCartHtml(resolvedImage || '🎨');
  const safeProductPage = escapeCartHtml(productPage);
  const quantity = Math.max(1, Number.parseInt(String(item.quantity), 10) || 1);
  const lineTotal = Number(item.price) * quantity;
  const recoveryAttribute = safeProductPage
    ? ` data-cart-product-page="${safeProductPage}" data-cart-image-recovery="idle"`
    : '';
  const imageMarkup = isCartImagePath(resolvedImage)
    ? `<img src="${safeImage}" alt="${safeName}" class="w-12 h-12 object-contain rounded" decoding="async"${recoveryAttribute}>`
    : safeImage;

  return '<div class="flex gap-4 mb-3 p-3 rounded-xl bg-surface-light/50 border border-surface-border/30">' +
    '<div class="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-2xl shrink-0">' + imageMarkup + '</div>' +
    '<div class="flex-1 min-w-0"><p class="text-sm font-medium text-text-primary truncate">' + safeName + '</p>' +
    (safeVariant ? '<p class="text-xs text-text-muted mt-0.5">' + safeVariant + '</p>' : '') +
    '<div class="flex items-center justify-between mt-2"><div class="flex items-center gap-2">' +
    '<button type="button" data-cart-action="decrement" data-cart-index="' + cartIndex + '" aria-label="Decrease quantity for ' + accessibleName + '" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">−</button>' +
    '<span class="text-sm text-text-primary min-w-[20px] text-center">' + quantity + '</span>' +
    '<button type="button" data-cart-action="increment" data-cart-index="' + cartIndex + '" aria-label="Increase quantity for ' + accessibleName + '" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">+</button>' +
    '</div><div class="flex items-center gap-3"><span class="text-sm font-medium text-mint">' + formatPrice(lineTotal) + '</span>' +
    '<button type="button" data-cart-action="remove" data-cart-index="' + cartIndex + '" aria-label="Remove ' + accessibleName + ' from cart" class="text-text-muted hover:text-red-400 transition-colors">' +
    '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>' +
    '</button></div></div></div></div>';
}

export function initCartControlDelegation({
  container,
  onUpdateQuantity,
  onRemoveItem,
  baseUri = globalThis.document?.baseURI,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage,
  registryLoader = loadProductRegistry,
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

  function handleImageError(event) {
    const image = event?.target;
    if (!image?.matches?.('img[data-cart-product-page]') || !container.contains?.(image)) return;

    void recoverCartImage({
      imageElement: image,
      page: image.dataset?.cartProductPage,
      baseUri,
      fetchImpl,
      storage,
      registryLoader,
    });
  }

  container.addEventListener('click', handleClick);
  container.addEventListener('error', handleImageError, true);

  return Object.freeze({
    destroy() {
      container.removeEventListener?.('click', handleClick);
      container.removeEventListener?.('error', handleImageError, true);
    },
  });
}
