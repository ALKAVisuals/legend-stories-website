const INTERACTIVE_DESCENDANT_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'details',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
].join(', ');

export function isProductCardActivationKey(key) {
  return key === 'Enter';
}

export function resolveProductCardHref(card, pageByName = {}) {
  const explicitHref = String(card?.dataset?.productHref || '').trim();
  if (explicitHref) return explicitHref;

  const name = String(card?.querySelector?.('h3')?.textContent || '').trim();
  if (!name) return '';
  return pageByName[name]
    || pageByName[name.replace(/^The /, '')]
    || pageByName[name.replace(/ Legend$/, '')]
    || '';
}

export function shouldIgnoreProductCardClick(card, target) {
  if (!card || !target || typeof target.closest !== 'function') return false;
  const interactive = target.closest(INTERACTIVE_DESCENDANT_SELECTOR);
  return Boolean(interactive && interactive !== card);
}

function applyProductCardSemantics(card, href) {
  if (typeof card.setAttribute !== 'function') return;
  if (!card.hasAttribute?.('role')) card.setAttribute('role', 'link');
  if (!card.hasAttribute?.('tabindex')) card.setAttribute('tabindex', '0');
  if (!card.hasAttribute?.('aria-label')) {
    const name = String(card.querySelector?.('h3')?.textContent || '').trim();
    card.setAttribute('aria-label', name ? `View ${name}` : `View product ${href}`);
  }
}

export function initProductCardNavigation({
  root = document,
  navigate = (href) => window.location.assign(href),
  pageByName = {},
} = {}) {
  const cards = [...root.querySelectorAll(
    '[data-product-href], .legend-card-swiper article.group',
  )];
  let initialized = 0;

  for (const card of new Set(cards)) {
    const href = resolveProductCardHref(card, pageByName);
    if (!href) continue;
    applyProductCardSemantics(card, href);

    card.addEventListener('click', (event) => {
      if (shouldIgnoreProductCardClick(card, event.target)) return;
      navigate(href);
    });

    card.addEventListener('keydown', (event) => {
      if (event.target !== card || !isProductCardActivationKey(event.key)) return;
      event.preventDefault();
      navigate(href);
    });

    initialized += 1;
  }

  return initialized;
}
