const DEFAULT_BREAKPOINT = 768;

function setAttribute(element, name, value) {
  if (element?.setAttribute) element.setAttribute(name, String(value));
}

function focusTrigger(trigger) {
  if (!trigger?.focus) return;
  try {
    trigger.focus({ preventScroll: true });
  } catch {
    trigger.focus();
  }
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
  }

  function openMenu() {
    if (open) return false;
    sync(true);
    return true;
  }

  function close({ restoreFocus = false } = {}) {
    if (!open) return false;
    sync(false);
    if (restoreFocus) focusTrigger(button);
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
    const link = event?.target?.closest?.('a[href]');
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
