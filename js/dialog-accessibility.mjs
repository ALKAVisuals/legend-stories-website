const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusableElements(container) {
  if (!container?.querySelectorAll) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.disabled || element.hidden) return false;
    if (element.getAttribute?.('aria-hidden') === 'true') return false;
    return element.tabIndex !== -1;
  });
}

export function getFocusWrapTarget(elements, activeElement, shiftKey = false) {
  if (!Array.isArray(elements) || elements.length === 0) return null;
  const activeIndex = elements.indexOf(activeElement);
  if (shiftKey && activeIndex <= 0) return elements[elements.length - 1];
  if (!shiftKey && (activeIndex === -1 || activeIndex === elements.length - 1)) return elements[0];
  return null;
}

export function createDialogController({
  dialog,
  overlay,
  documentRef = globalThis.document,
  body = documentRef?.body,
  onRequestClose = null,
} = {}) {
  if (!dialog || !overlay || !documentRef) {
    throw new Error('A dialog, overlay and document are required.');
  }

  let open = false;
  let returnFocus = null;

  function focusElement(element) {
    if (element?.focus) element.focus({ preventScroll: true });
  }

  function requestClose() {
    if (typeof onRequestClose === 'function') {
      onRequestClose();
    } else {
      close();
    }
  }

  function handleKeydown(event) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      focusElement(dialog);
      return;
    }

    const target = getFocusWrapTarget(focusable, documentRef.activeElement, event.shiftKey);
    if (target) {
      event.preventDefault();
      focusElement(target);
    }
  }

  function show({ trigger = documentRef.activeElement, initialFocus = null } = {}) {
    if (open) return;
    open = true;
    returnFocus = trigger?.focus ? trigger : null;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    dialog.classList.remove('translate-x-full');
    dialog.setAttribute('aria-hidden', 'false');
    if (body?.style) body.style.overflow = 'hidden';
    documentRef.addEventListener('keydown', handleKeydown);

    const schedule = globalThis.queueMicrotask || ((callback) => Promise.resolve().then(callback));
    schedule(() => {
      const target = initialFocus || getFocusableElements(dialog)[0] || dialog;
      focusElement(target);
    });
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    dialog.classList.add('translate-x-full');
    dialog.setAttribute('aria-hidden', 'true');
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    if (body?.style) body.style.overflow = '';
    documentRef.removeEventListener('keydown', handleKeydown);

    const focusTarget = returnFocus;
    returnFocus = null;
    if (restoreFocus && focusTarget && focusTarget.isConnected !== false) {
      focusElement(focusTarget);
    }
  }

  return Object.freeze({
    open: show,
    close,
    requestClose,
    isOpen: () => open,
    getReturnFocus: () => returnFocus,
  });
}
