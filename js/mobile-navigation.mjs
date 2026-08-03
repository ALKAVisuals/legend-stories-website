const DEFAULT_BREAKPOINT = 768;
const PREMIUM_NAVIGATION_STYLESHEET = 'css/premium-navigation.css';

function setAttribute(element, name, value) {
  if (element?.setAttribute) element.setAttribute(name, String(value));
}

function toggleClass(element, name, enabled) {
  element?.classList?.toggle?.(name, Boolean(enabled));
}

function focusElement(element) {
  if (!element?.focus) return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function ensurePremiumNavigationStyles(documentRef) {
  if (!documentRef?.head || !documentRef?.createElement || !documentRef?.querySelector) return;
  if (documentRef.querySelector('link[data-premium-navigation-styles]')) return;

  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = PREMIUM_NAVIGATION_STYLESHEET;
  link.dataset.premiumNavigationStyles = 'true';
  documentRef.head.append(link);
}

function removeEmoji(value) {
  return String(value || '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function enhanceAnnouncementBar(documentRef) {
  const announcement = documentRef?.querySelector?.('body > div[role="banner"]');
  const paragraph = announcement?.querySelector?.('p');
  if (!announcement || !paragraph || announcement.dataset?.premiumAnnouncement === 'true') return;

  announcement.classList?.add?.('premium-announcement');
  if (announcement.dataset) announcement.dataset.premiumAnnouncement = 'true';
  if (!documentRef?.createElement) return;

  const sourceText = removeEmoji(paragraph.textContent);
  const collectionName = sourceText.match(/new\s+drop:\s*(.+?)\s+collection/i)?.[1]?.trim()
    || sourceText.match(/new\s+release:\s*(.+?)(?:\s+[—-]|$)/i)?.[1]?.trim()
    || 'LegendMural';
  const promotionCode = sourceText.match(/\bLEGEND\d+\b/i)?.[0]?.toUpperCase() || 'LEGEND10';
  const discountText = sourceText.match(/\b\d+%\s*off\b/i)?.[0] || '10% off';

  const kicker = documentRef.createElement('span');
  kicker.className = 'premium-announcement-kicker';
  kicker.textContent = 'New release';

  const collection = documentRef.createElement('span');
  collection.className = 'premium-announcement-collection';
  collection.textContent = `${collectionName} collection`;

  const offer = documentRef.createElement('span');
  offer.className = 'premium-announcement-offer';
  offer.textContent = 'Use';

  const code = documentRef.createElement('span');
  code.className = 'premium-announcement-code';
  code.textContent = promotionCode;

  const discount = documentRef.createElement('span');
  discount.className = 'premium-announcement-discount';
  discount.textContent = `for ${discountText}`;

  paragraph.replaceChildren?.(kicker, collection, offer, code, discount);
}

function createMobileMenuTopbar(panel, documentRef) {
  if (!panel?.querySelector || !documentRef?.createElement) return null;

  const existingClose = panel.querySelector('[data-mobile-menu-close]');
  if (existingClose) return existingClose;

  const topbar = documentRef.createElement('div');
  topbar.className = 'premium-mobile-menu-topbar';

  const brand = documentRef.createElement('a');
  brand.href = 'index.html';
  brand.className = 'premium-mobile-menu-brand';
  brand.textContent = 'legendmural.';

  const closeButton = documentRef.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'premium-mobile-menu-close';
  closeButton.dataset.mobileMenuClose = 'true';
  closeButton.setAttribute('aria-label', 'Close menu');

  const closeLineOne = documentRef.createElement('span');
  closeLineOne.setAttribute('aria-hidden', 'true');
  const closeLineTwo = documentRef.createElement('span');
  closeLineTwo.setAttribute('aria-hidden', 'true');
  closeButton.append(closeLineOne, closeLineTwo);

  topbar.append(brand, closeButton);
  if (panel.prepend) panel.prepend(topbar);
  else panel.insertBefore?.(topbar, panel.firstChild || null);

  return closeButton;
}

function portalMobileMenu(menu, documentRef) {
  const body = documentRef?.body;
  if (!body?.append || menu?.parentElement === body) return;
  body.append(menu);
}

function enhanceNavigationMarkup({ button, menu, documentRef }) {
  const header = button?.closest?.('header');
  header?.classList?.add?.('premium-site-header');
  header?.querySelector?.('nav')?.classList?.add?.('premium-site-navigation');
  header?.querySelector?.('a[href="shop.html"]')?.classList?.add?.('premium-nav-control');

  const panel = menu?.firstElementChild;
  panel?.classList?.add?.('premium-mobile-menu-panel');
  setAttribute(menu, 'aria-label', 'Mobile navigation');
  setAttribute(menu, 'role', 'dialog');
  setAttribute(menu, 'aria-modal', 'true');

  const closeButton = createMobileMenuTopbar(panel, documentRef);

  if (panel?.querySelector && documentRef?.createElement && !panel.querySelector('[data-mobile-menu-shop]')) {
    const shopLink = documentRef.createElement('a');
    shopLink.href = 'shop.html';
    shopLink.className = 'premium-mobile-menu-cta';
    shopLink.dataset.mobileMenuShop = 'true';
    shopLink.textContent = 'Shop the collection';
    panel.append(shopLink);
  }

  portalMobileMenu(menu, documentRef);
  return { closeButton, header, panel };
}

export function createMobileNavigationController({
  button,
  menu,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  breakpoint = DEFAULT_BREAKPOINT,
  openLabel = 'Close menu',
} = {}) {
  if (!button || !menu) {
    throw new Error('Mobile navigation requires both a trigger button and menu.');
  }
  if (!documentRef?.addEventListener || !windowRef?.addEventListener) {
    throw new Error('Mobile navigation requires document and window event targets.');
  }

  ensurePremiumNavigationStyles(documentRef);
  enhanceAnnouncementBar(documentRef);
  const { closeButton } = enhanceNavigationMarkup({ button, menu, documentRef });

  const closedLabel = button.getAttribute?.('aria-label') || 'Open menu';
  const menuId = menu.id || 'mobile-menu';
  let open = false;

  if (!menu.id) menu.id = menuId;
  menu.style?.removeProperty?.('display');

  function sync(nextOpen) {
    open = Boolean(nextOpen);
    menu.hidden = !open;
    setAttribute(menu, 'aria-hidden', open ? 'false' : 'true');
    setAttribute(button, 'aria-expanded', open ? 'true' : 'false');
    setAttribute(button, 'aria-controls', menuId);
    setAttribute(button, 'aria-label', open ? openLabel : closedLabel);
    toggleClass(menu, 'is-open', open);
    toggleClass(button, 'is-open', open);
    toggleClass(documentRef.body, 'mobile-menu-open', open);
  }

  function openMenu() {
    if (open) return false;
    sync(true);
    focusElement(closeButton);
    return true;
  }

  function close({ restoreFocus = false } = {}) {
    if (!open) return false;
    sync(false);
    if (restoreFocus) focusElement(button);
    return true;
  }

  function toggle() {
    return open ? close() : openMenu();
  }

  function handleButtonClick(event) {
    event?.preventDefault?.();
    toggle();
  }

  function handleMenuClick(event) {
    const target = event?.target;
    if (target === menu) {
      close({ restoreFocus: true });
      return;
    }

    const closeControl = target?.closest?.('[data-mobile-menu-close]');
    if (closeControl && menu.contains?.(closeControl)) {
      close({ restoreFocus: true });
      return;
    }

    const link = target?.closest?.('a[href]');
    if (link && menu.contains?.(link)) close();
  }

  function handleDocumentClick(event) {
    if (!open) return;
    const target = event?.target;
    if (button.contains?.(target) || menu.contains?.(target)) return;
    close();
  }

  function handleKeydown(event) {
    if (!open || event?.key !== 'Escape') return;
    event.preventDefault?.();
    close({ restoreFocus: true });
  }

  function handleResize() {
    if (open && Number(windowRef.innerWidth) >= Number(breakpoint)) {
      close();
    }
  }

  button.addEventListener('click', handleButtonClick);
  menu.addEventListener('click', handleMenuClick);
  documentRef.addEventListener('click', handleDocumentClick);
  documentRef.addEventListener('keydown', handleKeydown);
  windowRef.addEventListener('resize', handleResize);

  sync(false);

  return Object.freeze({
    open: openMenu,
    close,
    toggle,
    isOpen: () => open,
    destroy() {
      button.removeEventListener?.('click', handleButtonClick);
      menu.removeEventListener?.('click', handleMenuClick);
      documentRef.removeEventListener?.('click', handleDocumentClick);
      documentRef.removeEventListener?.('keydown', handleKeydown);
      windowRef.removeEventListener?.('resize', handleResize);
      sync(false);
    },
  });
}
