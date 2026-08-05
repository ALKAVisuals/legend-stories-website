/**
 * Legend Stories — Main Application JavaScript
 * Handles: Cart Drawer, Mobile Menu, Before/After Slider, 
 * Scroll Animations, Testimonial Carousel, Product Filters, Add to Cart
 */

(function () {
  'use strict';

  // Hide decorative images that fail to load without inline event handlers.
  function hideBrokenImage(event) {
    const image = event.target;
    if (image?.matches?.('img[data-hide-on-error]')) {
      image.style.display = 'none';
    }
  }
  document.addEventListener('error', hideBrokenImage, true);

  // ==========================================
  // STATE
  // ==========================================
  const state = {
    cart: [],
    cartOpen: false,
    testimonialIndex: 0,
    totalTestimonials: 4,
    shippingCountry: 'NL',
    shippingCost: 0,
    discountCode: '',
    discountPercent: 0,
  };

  const CART_SCHEMA_VERSION = '4';

  // ==========================================
  // LOCAL STORAGE - Cart Persistence
  // ==========================================
  function saveCart() {
    localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);
    localStorage.setItem('legendCart', JSON.stringify(state.cart));
    localStorage.setItem('legendShippingCountry', state.shippingCountry);
    localStorage.setItem('legendDiscountCode', state.discountCode);
  }

  function loadCart() {
    const savedCart = localStorage.getItem('legendCart');
    const savedCartVersion = localStorage.getItem('legendCartVersion');
    const savedCountry = localStorage.getItem('legendShippingCountry');
    const savedDiscountCode = localStorage.getItem('legendDiscountCode');
    if (savedCart && savedCartVersion === CART_SCHEMA_VERSION) {
      try {
        const parsedCart = JSON.parse(savedCart);
        state.cart = Array.isArray(parsedCart)
          ? parsedCart.filter((item) => item && item.page && item.variantId && Number(item.quantity) > 0)
          : [];
      } catch (e) {
        state.cart = [];
      }
    } else if (savedCart) {
      localStorage.removeItem('legendCart');
      localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);
      state.cart = [];
    }
    const savedCountryCode = String(savedCountry || '').trim().toUpperCase();
    state.shippingCountry = commerceModule.isShippingCountryEnabled(savedCountryCode)
      ? savedCountryCode
      : commerceModule.DEFAULT_SHIPPING_COUNTRY;
    if (savedCountryCode && savedCountryCode !== state.shippingCountry) {
      localStorage.removeItem('legendShippingCountry');
    }
    const savedDiscount = commerceModule.resolveDiscount(savedDiscountCode || '');
    state.discountCode = savedDiscount.code;
    state.discountPercent = savedDiscount.percent;
    localStorage.removeItem('legendDiscountPercent');
    if (savedDiscountCode && !savedDiscount.valid) {
      localStorage.removeItem('legendDiscountCode');
    }
  }

  // ==========================================
  // COMMERCE RUNTIME - Single calculation authority
  // ==========================================
  let commerceModule = null;
  let commerceModulePromise = null;

  function loadCommerceModule() {
    if (!commerceModulePromise) {
      commerceModulePromise = Promise.all([
        import('./commerce/totals.mjs'),
        import('./commerce/discounts.mjs'),
        import('./commerce/order-request.mjs'),
        import('./commerce/checkout-client.mjs'),
        import('./commerce/product-variants.mjs'),
        import('./commerce/shipping.mjs'),
      ]).then(([totals, discounts, orderRequest, checkoutClient, productVariants, shipping]) => {
        commerceModule = Object.freeze({
          ...totals,
          ...discounts,
          ...orderRequest,
          ...checkoutClient,
          ...productVariants,
          ...shipping,
        });
        return commerceModule;
      });
    }
    return commerceModulePromise;
  }

  let productCardNavigationModule = null;
let productCardNavigationModulePromise = null;

function loadProductCardNavigationModule() {
  if (!productCardNavigationModulePromise) {
    productCardNavigationModulePromise = import('./product-card-navigation.mjs')
      .then((module) => {
        productCardNavigationModule = module;
        return module;
      });
  }
  return productCardNavigationModulePromise;
}

let dialogAccessibilityModule = null;
let dialogAccessibilityModulePromise = null;
let cartDialogController = null;
let checkoutDialogController = null;
let mobileNavigationModulePromise = null;
let mobileNavigationController = null;

function loadMobileNavigationModule() {
  if (!mobileNavigationModulePromise) {
    mobileNavigationModulePromise = import('./mobile-navigation.mjs');
  }
  return mobileNavigationModulePromise;
}

let googlePlacesLoaderModule = null;
let googlePlacesLoaderModulePromise = null;
let googlePlacesLoader = null;

function loadGooglePlacesLoaderModule() {
  if (!googlePlacesLoaderModulePromise) {
    googlePlacesLoaderModulePromise = import('./google-places-loader.mjs')
      .then((module) => {
        googlePlacesLoaderModule = module;
        return module;
      });
  }
  return googlePlacesLoaderModulePromise;
}

let checkoutAddressModule = null;
let checkoutAddressModulePromise = null;

function loadCheckoutAddressModule() {
  if (!checkoutAddressModulePromise) {
    checkoutAddressModulePromise = import('./checkout-address-entry.mjs')
      .then((module) => {
        checkoutAddressModule = module;
        return module;
      });
  }
  return checkoutAddressModulePromise;
}

let cartControlsModule = null;
let cartControlsModulePromise = null;

function loadCartControlsModule() {
  if (!cartControlsModulePromise) {
    cartControlsModulePromise = import('./cart-controls.mjs')
      .then((module) => {
        cartControlsModule = module;
        return module;
      });
  }
  return cartControlsModulePromise;
}

let motionPreferencesModule = null;
let motionPreferencesModulePromise = null;

function loadMotionPreferencesModule() {
  if (!motionPreferencesModulePromise) {
    motionPreferencesModulePromise = import('./motion-preferences.mjs')
      .then((module) => {
        motionPreferencesModule = module;
        return module;
      });
  }
  return motionPreferencesModulePromise;
}

function loadDialogAccessibilityModule() {
  if (!dialogAccessibilityModulePromise) {
    dialogAccessibilityModulePromise = import('./dialog-accessibility.mjs')
      .then((module) => {
        dialogAccessibilityModule = module;
        return module;
      });
  }
  return dialogAccessibilityModulePromise;
}

  function getCommerceTotals(countryCode = state.shippingCountry) {
    if (!commerceModule) {
      throw new Error('Commerce totals requested before the commerce module was loaded.');
    }
    return commerceModule.calculateCommerceTotals({
      items: state.cart,
      countryCode,
      discountPercent: state.discountPercent,
    });
  }

  function getCheckoutCountryOptions() {
    if (!commerceModule?.getCheckoutCountryOptions) return [];
    return commerceModule.getCheckoutCountryOptions({ includePending: true });
  }

  const PRODUCT_PAGE_BY_NAME = Object.freeze({
    'The Grind Cycle': 'combat-grind-cycle.html',
    'Unstoppable Will': 'combat-unstoppable-will.html',
    'Unstoppable Will Sport': 'sport-unstoppable-will.html',
    'Dream Reality': 'combat-dream-reality.html',
    'Courageous Risk': 'combat-courageous-risk.html',
    'Greatest Courage': 'combat-greatest-courage.html',
    'The Free Spirit': 'music-free-spirit.html',
    'Eternal Smile': 'music-eternal-smile.html',
    'Constant Evolution': 'music-constant-evolution.html',
    'Lyric Mastery': 'music-lyric-mastery.html',
    'Pure Confidence': 'music-pure-confidence.html',
    'The Style Code': 'music-style-code.html',
    'The Style Prophet': 'music-style-prophet.html',
    'The Truth Seeker': 'music-truth-seeker.html',
    "The Lion's Pride": 'sport-lions-pride.html',
    'The Luxury Standard': 'sport-luxury-standard.html',
    'The Peak Performer': 'sport-peak-performer.html',
    'Pursuit of Greatness': 'sport-pursuit-greatness.html',
    'Unforgettable Roots': 'sport-unforgettable-roots.html',
    'Mamba Mindset': 'sport-mamba-mindset.html',
  });

  // ==========================================
  // DOM REFERENCES
  // ==========================================
  const dom = {
    cartBtn: document.getElementById('cart-btn'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartOverlay: document.getElementById('cart-overlay'),
    cartClose: document.getElementById('cart-close'),
    cartItems: document.getElementById('cart-items'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total'),
    checkoutBtn: document.getElementById('checkout-btn'),
    checkoutDrawer: document.getElementById('checkout-drawer'),
    checkoutOverlay: document.getElementById('checkout-overlay'),
    purchaseFeedback: document.getElementById('purchase-feedback'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    baSlider: document.getElementById('ba-slider'),
    baBefore: document.getElementById('ba-before'),
    baHandle: document.getElementById('ba-handle'),
    testimonialTrack: document.getElementById('testimonial-track'),
    testimonialDots: document.querySelectorAll('.testimonial-dot'),
  };

  let purchaseFeedbackTimer = null;

  function announcePurchaseFeedback(message, { assertive = false, focusTarget = null, duration = 6000 } = {}) {
    const feedback = dom.purchaseFeedback || document.getElementById('purchase-feedback');
    if (feedback) {
      if (purchaseFeedbackTimer) clearTimeout(purchaseFeedbackTimer);
      feedback.setAttribute('role', assertive ? 'alert' : 'status');
      feedback.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      feedback.textContent = message;
      feedback.classList.remove('hidden', 'border-red-400/40', 'text-red-300', 'border-mint/40', 'text-mint');
      feedback.classList.add(assertive ? 'border-red-400/40' : 'border-mint/40');
      feedback.classList.add(assertive ? 'text-red-300' : 'text-mint');
      if (duration > 0) {
        purchaseFeedbackTimer = setTimeout(() => feedback.classList.add('hidden'), duration);
      }
    } else if (assertive) {
      console.warn(message);
    }
    if (focusTarget?.focus) focusTarget.focus({ preventScroll: true });
  }

  // ==========================================
  // CART FUNCTIONS
  // ==========================================
  function openCart() {
    state.cartOpen = true;
    renderCart();
    if (dom.cartBtn) dom.cartBtn.setAttribute('aria-expanded', 'true');
    if (cartDialogController) {
      cartDialogController.open({ trigger: dom.cartBtn, initialFocus: dom.cartClose });
    } else {
      if (dom.cartOverlay) {
        dom.cartOverlay.classList.remove('hidden');
        dom.cartOverlay.setAttribute('aria-hidden', 'false');
      }
      if (dom.cartDrawer) {
        dom.cartDrawer.classList.remove('translate-x-full');
        dom.cartDrawer.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCart({ restoreFocus = true } = {}) {
    state.cartOpen = false;
    if (dom.cartBtn) dom.cartBtn.setAttribute('aria-expanded', 'false');
    if (cartDialogController) {
      cartDialogController.close({ restoreFocus });
    } else {
      if (dom.cartDrawer) {
        dom.cartDrawer.classList.add('translate-x-full');
        dom.cartDrawer.setAttribute('aria-hidden', 'true');
      }
      if (dom.cartOverlay) {
        dom.cartOverlay.classList.add('hidden');
        dom.cartOverlay.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  }

  function formatPrice(price) {
    return '€' + price.toFixed(2).replace('.', ',');
  }

  function addToCart(page, name, image, variant) {
    if (!page) {
      throw new Error('A stable product page is required before adding an item to the cart.');
    }
    const product = {
      id: commerceModule.createCartLineId(page, variant.id),
      page,
      name,
      price: variant.price,
      variantId: variant.id,
      variantLabel: variant.label,
      sizeCm: variant.longestSideCm,
      sizeLabel: variant.sizeLabel,
      widthCm: variant.widthCm,
      heightCm: variant.heightCm,
      quantity: 1,
      image: image || '🎨',
    };
    const existingIndex = state.cart.findIndex((item) => item.id === product.id);
    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += 1;
    } else {
      state.cart.push(product);
    }
    saveCart();
    renderCart();
    updateCartCount();
    openCart();
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    updateCartCount();
    renderCart();
  }

  function updateCartQuantity(index, delta) {
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) { removeFromCart(index); return; }
    saveCart();
    renderCart();
    updateCartCount();
  }

  function updateCartCount() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (dom.cartCount) {
      dom.cartCount.textContent = totalItems;
      dom.cartCount.style.opacity = totalItems > 0 ? '1' : '0';
    }
  }

  function getCartTotal() {
    return getCommerceTotals().subtotal;
  }

  function getShippingCost() {
    const totals = getCommerceTotals();
    state.shippingCost = totals.shipping;
    return totals.shipping;
  }

  function getGrandTotal() {
    return getCommerceTotals().grandTotal;
  }

  function setShippingCountry(code) {
    state.shippingCountry = code;
    getShippingCost();
    saveCart();
    renderCart();
  }

  function renderCart() {
    if (!dom.cartItems) return;
    if (state.cart.length === 0) {
      dom.cartItems.innerHTML = '<div class="text-center py-12"><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg></div><p class="text-text-secondary font-medium">Your cart is empty</p><p class="text-text-muted text-sm mt-1">Add something to get started</p></div>';
      if (dom.cartTotal) dom.cartTotal.textContent = '€0,00';
      if (dom.checkoutBtn) dom.checkoutBtn.disabled = true;
      const upsell = document.getElementById('cart-upsell');
      if (upsell) upsell.classList.add('hidden');
      return;
    }
    if (dom.checkoutBtn) dom.checkoutBtn.disabled = false;
    const upsell = document.getElementById('cart-upsell');
    if (upsell) upsell.classList.remove('hidden');

    const totals = getCommerceTotals();
    const cartSubtotal = totals.subtotal;
    const shippingCost = totals.shipping;
    const zone = totals.zone;

    dom.cartItems.innerHTML =
      state.cart.map((item, i) =>
        cartControlsModule.renderCartItemMarkup({
          item,
          index: i,
          formatPrice,
        })
      ).join('') +
      '<div class="border-t border-surface-border/30 pt-3 mt-3">' +
      '<div class="flex justify-between text-sm"><span class="text-text-muted">Subtotal</span><span class="text-text-primary font-medium">' + formatPrice(cartSubtotal) + '</span></div>' +
      (state.discountPercent > 0 ? '<div class="flex justify-between text-sm"><span class="text-text-muted">Discount (' + state.discountPercent + '%)</span><span class="text-red-400 font-medium">-' + formatPrice(totals.discount) + '</span></div>' : '') +
      '<p class="text-[11px] text-text-muted mt-1.5">Shipping is €4,95 within the Netherlands and €9,95 to the EU and United States. Free shipping from €69.</p>' +
      '</div>';

    // Cart drawer total excludes shipping because shipping is shown at checkout.
    if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(totals.discountedSubtotal);
  }

  // ==========================================
  // CHECKOUT MODAL
  // ==========================================
  function openCheckoutModal() {
    // Removed early return based on cart length to always open checkout drawer
    closeCart({ restoreFocus: false });
    const drawer = dom.checkoutDrawer;
    const overlay = dom.checkoutOverlay;
    if (!drawer || !overlay) {
      return;
    }
    if (dom.checkoutBtn) dom.checkoutBtn.setAttribute('aria-expanded', 'true');
    if (checkoutDialogController) {
      checkoutDialogController.open({
        trigger: dom.cartBtn,
        initialFocus: document.getElementById('checkout-close'),
      });
    } else {
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      drawer.classList.remove('translate-x-full');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    validatedAddress = null;

    // Build the country list from the shared browser/server shipping policy.
    const countrySelect = document.getElementById('checkout-country');
    if (countrySelect) {
      countrySelect.replaceChildren();
      getCheckoutCountryOptions().forEach((country) => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.label;
        option.disabled = !country.enabled;
        option.dataset.status = country.status;
        option.title = country.notice;
        countrySelect.appendChild(option);
      });

      const requestedCountry = String(state.shippingCountry || '').toUpperCase();
      state.shippingCountry = commerceModule.isShippingCountryEnabled(requestedCountry)
        ? requestedCountry
        : commerceModule.DEFAULT_SHIPPING_COUNTRY;
      countrySelect.value = state.shippingCountry;
      updateShippingMarketNotice(state.shippingCountry);
    }

    updateCheckoutTotals();

    // Country change listener
    if (countrySelect) {
      countrySelect.onchange = function() {
        const nextCountry = String(this.value || '').toUpperCase();
        if (!commerceModule.isShippingCountryEnabled(nextCountry)) {
          this.value = state.shippingCountry;
          updateShippingMarketNotice(state.shippingCountry);
          return;
        }
        state.shippingCountry = nextCountry;
        validatedAddress = null;
        saveCart();
        updateGooglePlacesCountryRestriction(nextCountry);
        updateShippingMarketNotice(nextCountry);
        updateCheckoutTotals();
      };
    }

    // Google suggestions only pre-fill the form. Every address field stays editable.
    const streetField = document.getElementById('checkout-street');
    const zipField = document.getElementById('checkout-zip');
    const cityField = document.getElementById('checkout-city');
    const countryField = document.getElementById('checkout-country');
    if (streetField) checkoutAddressModule.configureStreetAddressInput(streetField);
    ensureCheckoutAddressStatus();
    checkoutAddressModule.bindEditableAddressFields({
      streetInput: streetField,
      zipInput: zipField,
      cityInput: cityField,
      countryInput: countryField,
      onEdit: () => {
        validatedAddress = null;
        setCheckoutAddressStatus('');
      },
    });
  }

  function closeCheckoutModal({ restoreFocus = true } = {}) {
    const drawer = dom.checkoutDrawer;
    const overlay = dom.checkoutOverlay;
    if (dom.checkoutBtn) dom.checkoutBtn.setAttribute('aria-expanded', 'false');
    if (checkoutDialogController) {
      checkoutDialogController.close({ restoreFocus });
    } else {
      if (drawer) {
        drawer.classList.add('translate-x-full');
        drawer.setAttribute('aria-hidden', 'true');
      }
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }
  }

  function ensureShippingMarketNotice() {
    const country = document.getElementById('checkout-country');
    if (!country?.parentElement) return null;
    let notice = document.getElementById('checkout-market-note');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'checkout-market-note';
      notice.className = 'text-[11px] leading-relaxed text-text-muted mt-2';
      notice.setAttribute('role', 'status');
      country.insertAdjacentElement('afterend', notice);
    }
    return notice;
  }

  function updateShippingMarketNotice(countryCode = state.shippingCountry) {
    const notice = ensureShippingMarketNotice();
    if (!notice || !commerceModule) return;
    const activeMessage = commerceModule.getShippingMarketNotice(countryCode);
    const pendingMarkets = getCheckoutCountryOptions().filter((market) => !market.enabled);
    const pendingMessage = pendingMarkets.length > 0
      ? pendingMarkets.map((market) => market.notice).join(' ')
      : '';
    notice.textContent = [activeMessage, pendingMessage].filter(Boolean).join(' ');
  }

  const EU_COUNTRY_CODES = new Set([
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR',
    'GR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
    'SE', 'SI', 'SK',
  ]);

  function updateInternationalShippingNotice(countryCode = state.shippingCountry) {
    const notice = document.getElementById('checkout-import-note');
    if (!notice) return;
    const code = String(countryCode || '').toUpperCase();
    notice.classList.toggle('hidden', !code || EU_COUNTRY_CODES.has(code));
  }

  function initInternationalShippingNotice() {
    const country = document.getElementById('checkout-country');
    if (!country || document.getElementById('checkout-import-note')) return;
    const notice = document.createElement('p');
    notice.id = 'checkout-import-note';
    notice.className = 'hidden text-[11px] leading-relaxed text-text-muted mt-2';
    notice.textContent = 'Local import duties and taxes may apply outside the EU and are paid by the recipient.';
    country.insertAdjacentElement('afterend', notice);
    updateInternationalShippingNotice(country.value || state.shippingCountry);
  }

  function updateCheckoutTotals() {
    const totals = getCommerceTotals();
    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const grandTotalEl = document.getElementById('checkout-grandtotal');
    const discountEl = document.getElementById('checkout-discount-amount');
    const noteEl = document.getElementById('checkout-shipping-note');

    if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);
    if (discountEl) {
      discountEl.textContent = totals.discount > 0 ? '-' + formatPrice(totals.discount) : '€0,00';
      discountEl.parentElement.classList.toggle('hidden', totals.discount === 0);
    }
    if (shippingEl) shippingEl.textContent = totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping);
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(totals.grandTotal);
    if (noteEl) {
      if (totals.qualifiesForFreeShipping) {
        noteEl.textContent = '✓ Free shipping to ' + totals.zone.name;
      } else {
        noteEl.textContent = 'Add ' + formatPrice(totals.freeShippingRemaining) + ' more for free shipping to ' + totals.zone.name;
      }
    }
    updateInternationalShippingNotice(totals.countryCode);
    updateShippingMarketNotice(totals.countryCode);
  }

  let validatedAddress = null;

  // ==========================================
  // DISCOUNT CODE
  // ==========================================
  function applyDiscount(code) {
    const messageEl = document.getElementById('discount-message') || document.getElementById('cart-discount-message');
    const discountInput = document.getElementById('checkout-discount') || document.getElementById('cart-discount');
    
    const discount = commerceModule.resolveDiscount(code);
    const percent = discount.percent;
    
    if (discount.valid) {
      code = discount.code;
      state.discountCode = discount.code;
      state.discountPercent = percent;
      saveCart();
      if (messageEl) {
        messageEl.textContent = '✓ ' + percent + '% discount applied!';
        messageEl.className = 'text-[11px] mt-1.5 text-mint';
        messageEl.classList.remove('hidden');
      }
      updateCheckoutTotals();
      renderCart();
      announcePurchaseFeedback(percent + '% discount applied.');
      return true;
    } else {
      state.discountCode = '';
      state.discountPercent = 0;
      saveCart();
      if (messageEl) {
        messageEl.textContent = 'Invalid discount code';
        messageEl.className = 'text-[11px] mt-1.5 text-red-400';
        messageEl.classList.remove('hidden');
      }
      updateCheckoutTotals();
      announcePurchaseFeedback('Invalid discount code.', { assertive: true });
      return false;
    }
  }

  function getDiscountAmount() {
    return getCommerceTotals().discount;
  }

  // Dynamically inject discount UI into cart drawers that don't have it
  function injectCartDiscount() {
    const cartTotalEl = document.getElementById('cart-total');
    if (cartTotalEl && !document.getElementById('cart-discount')) {
      const discountHtml = '<div class="mb-3"><label class="text-[11px] text-text-muted uppercase tracking-wide font-medium mb-1.5 block">Discount code</label><div class="flex gap-2"><input type="text" id="cart-discount" class="flex-1 p-2 rounded-lg bg-void border border-surface-border/30 text-xs text-text-primary focus:border-mint/40 focus:outline-none" placeholder="LEGEND10" value="' + (state.discountCode || '') + '" /><button type="button" id="cart-apply-discount" class="px-2.5 py-1 rounded-lg bg-surface-light text-text-secondary text-xs hover:bg-surface-border transition-colors">Apply</button></div><p id="cart-discount-message" class="text-[10px] mt-1 ' + (state.discountPercent > 0 ? '' : 'hidden') + ' ' + (state.discountPercent > 0 ? 'text-mint' : '') + '">' + (state.discountPercent > 0 ? '✓ ' + state.discountPercent + '% discount applied!' : '') + '</p></div>';
      cartTotalEl.parentElement.insertAdjacentHTML('beforebegin', discountHtml);
    }
  }

  // Inject discount row in checkout drawer if missing
  function injectCheckoutDiscount() {
    const subtotalRow = document.getElementById('checkout-subtotal')?.parentElement;
    const discountRow = document.getElementById('discount-row');
    if (subtotalRow && !discountRow) {
      const html = '<div class="flex justify-between text-sm hidden" id="discount-row"><span class="text-text-muted">Discount</span><span class="text-red-400" id="checkout-discount-amount">€0,00</span></div>';
      subtotalRow.insertAdjacentHTML('afterend', html);
    }
  }

  function initDiscountCode() {
    // Checkout discount
    const applyBtn = document.getElementById('apply-discount-btn');
    const discountInput = document.getElementById('checkout-discount');
    if (applyBtn && discountInput) {
      applyBtn.addEventListener('click', function() {
        applyDiscount(discountInput.value);
      });
      discountInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyDiscount(this.value);
        }
      });
    }
    // Cart discount
    const cartApplyBtn = document.getElementById('cart-apply-discount');
    const cartDiscountInput = document.getElementById('cart-discount');
    if (cartApplyBtn && cartDiscountInput) {
      cartApplyBtn.addEventListener('click', function() {
        applyDiscount(cartDiscountInput.value);
      });
      cartDiscountInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyDiscount(this.value);
        }
      });
    }
  }

  function handleCheckoutPay() {
    const firstname = document.getElementById('checkout-firstname')?.value.trim();
    const lastname = document.getElementById('checkout-lastname')?.value.trim();
    const email = document.getElementById('checkout-email')?.value.trim();
    const street = document.getElementById('checkout-street')?.value.trim();
    const zip = document.getElementById('checkout-zip')?.value.trim();
    const city = document.getElementById('checkout-city')?.value.trim();
    const country = document.getElementById('checkout-country')?.value;

    if (!firstname || !lastname || !email || !street || !zip || !city || !country) {
      const firstMissing = [
        ['checkout-firstname', firstname],
        ['checkout-lastname', lastname],
        ['checkout-email', email],
        ['checkout-street', street],
        ['checkout-zip', zip],
        ['checkout-city', city],
        ['checkout-country', country],
      ].find(([, value]) => !value);
      announcePurchaseFeedback('Please fill in all required fields.', {
        assertive: true,
        focusTarget: firstMissing ? document.getElementById(firstMissing[0]) : null,
      });
      return;
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      announcePurchaseFeedback('Please enter a valid email address.', {
        assertive: true,
        focusTarget: document.getElementById('checkout-email'),
      });
      return;
    }

    if (!commerceModule.isShippingCountryEnabled(country)) {
      announcePurchaseFeedback(commerceModule.getShippingMarketNotice(country), {
        assertive: true,
        focusTarget: document.getElementById('checkout-country'),
      });
      return;
    }

    // Address validation: use Google Places validated address if available,
    // otherwise validate manually entered address via Google Places API
    if (validatedAddress) {
      processOrder(validatedAddress, firstname, lastname, email);
    } else {
      // Show loading state
      const payBtn = document.getElementById('checkout-pay-btn');
      const originalBtnText = payBtn ? payBtn.textContent : 'Continue to payment';
      if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Validating address...'; }

      validateAddressWithGoogle(street, zip, city, country, function(err, googleAddress) {
        if (payBtn) { payBtn.disabled = false; payBtn.textContent = originalBtnText; }
        if (err) {
          announcePurchaseFeedback(err, {
            assertive: true,
            focusTarget: document.getElementById('checkout-street'),
          });
          return;
        }
        processOrder(googleAddress, firstname, lastname, email);
      });
    }
  }

  function validateAddressWithGoogle(street, zip, city, country, callback) {
    const useManualFallback = () => {
      const result = manualAddressFallback(street, zip, city, country);
      if (result.error) {
        callback(result.error);
        return;
      }
      setCheckoutAddressStatus('Address entered manually because suggestions are unavailable.', { warning: true });
      callback(null, result.address);
    };

    if (googlePlacesUnavailable) {
      useManualFallback();
      return;
    }

    loadGooglePlaces().then(() => {
      doGoogleValidation(street, zip, city, country, callback);
    }).catch((error) => {
      googlePlacesUnavailable = true;
      console.warn('Google address validation could not start:', error);
      useManualFallback();
    });
  }

  function doGoogleValidation(street, zip, city, country, callback) {
    var service = new window.google.maps.places.PlacesService(document.createElement('div'));
    var query = street + ', ' + zip + ' ' + city + ', ' + country.toUpperCase();

    service.findPlaceFromQuery({
      query: query,
      fields: ['address_components', 'formatted_address', 'geometry', 'name']
    }, function(results, status) {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK) {
        if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');
          return;
        }
        googlePlacesUnavailable = true;
        const fallback = manualAddressFallback(street, zip, city, country);
        callback(fallback.error, fallback.address);
        return;
      }
      if (!results || results.length === 0) {
        callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');
        return;
      }

      var place = results[0];
      if (!place.address_components) {
        callback('Address not found. Please check your street, postal code, city and country, or select an address from the suggestions.');
        return;
      }

      // Parse the Google result into our address format
      var components = place.address_components;
      var gStreetNumber = '';
      var gRoute = '';
      var gPostalCode = '';
      var gCity = '';
      var gCountryCode = '';

      for (var i = 0; i < components.length; i++) {
        var types = components[i].types;
        if (types.includes('street_number')) gStreetNumber = components[i].long_name;
        if (types.includes('route')) gRoute = components[i].long_name;
        if (types.includes('postal_code')) gPostalCode = components[i].long_name;
        if (types.includes('locality') || types.includes('postal_town')) gCity = components[i].long_name;
        if (types.includes('country')) gCountryCode = components[i].short_name.toUpperCase();
      }

      var gStreet = (gRoute + ' ' + gStreetNumber).trim();

      // Verify the returned address roughly matches what the user entered
      // (Google may return a nearby match — we check postal code match)
      var normalizedInputZip = zip.replace(/\s/g, '').toUpperCase();
      var normalizedGoogleZip = gPostalCode.replace(/\s/g, '').toUpperCase();
      if (normalizedInputZip && normalizedGoogleZip && normalizedInputZip !== normalizedGoogleZip) {
        callback('Address verification failed. The postal code does not match the street and city. Please check your address or select one from the suggestions.');
        return;
      }

      callback(null, {
        street: gStreet,
        postal_code: gPostalCode,
        city: gCity,
        country: gCountryCode,
        formatted: place.formatted_address || query,
      });
    });
  }

  async function processOrder(address, firstname, lastname, email) {
    const validatedCountry = String(address.country || '').toUpperCase();
    if (!commerceModule.isShippingCountryEnabled(validatedCountry)) {
      announcePurchaseFeedback(commerceModule.getShippingMarketNotice(validatedCountry), { assertive: true });
      return;
    }
    const totals = getCommerceTotals(validatedCountry);
    let orderRequest;
    try {
      orderRequest = commerceModule.createOrderRequest({
        items: state.cart,
        countryCode: validatedCountry,
        discountCode: state.discountCode,
      });
    } catch (error) {
      console.error('Cannot create trusted order request:', error);
      announcePurchaseFeedback('Your saved cart uses an outdated product format. Please clear the cart and add the products again.', { assertive: true });
      return;
    }

    const displayCustomer = {
      firstname,
      lastname,
      email,
      street: address.street,
      zip: address.postal_code,
      city: address.city,
      country: validatedCountry,
      formatted: address.formatted,
    };
    const checkoutCustomer = {
      firstname,
      lastname,
      email,
      street: address.street,
      zip: address.postal_code,
      city: address.city,
      country: validatedCountry,
    };
    const orderData = {
      request: orderRequest,
      items: state.cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        sizeCm: item.sizeCm,
        sizeLabel: item.sizeLabel,
        widthCm: item.widthCm,
        heightCm: item.heightCm,
      })),
      customer: displayCustomer,
      shipping: { zone: totals.zone.name, cost: totals.shipping },
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountCode: state.discountCode,
      total: totals.grandTotal,
    };

    // Store display data separately from the minimal server request.
    sessionStorage.setItem('legendOrder', JSON.stringify(orderData));
    sessionStorage.setItem('legendOrderRequest', JSON.stringify(orderRequest));

    const checkoutConfigured = commerceModule.isHostedCheckoutConfigured(
      commerceModule.HOSTED_CHECKOUT_ENDPOINT,
      window.location.origin,
    );
    if (!checkoutConfigured) {
      announcePurchaseFeedback('Order ready. Secure online payment is not enabled on this deployment yet. Total: ' + formatPrice(totals.grandTotal) + '.', { assertive: true, duration: 12000 });
      return;
    }

    const payBtn = document.getElementById('checkout-pay-btn');
    const originalBtnText = payBtn ? payBtn.textContent : 'Continue to payment';
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Starting secure payment...';
    }

    try {
      const checkout = await commerceModule.requestHostedCheckout({
        endpoint: commerceModule.HOSTED_CHECKOUT_ENDPOINT,
        baseUrl: window.location.origin,
        payload: {
          request: orderRequest,
          customer: checkoutCustomer,
        },
      });
      sessionStorage.setItem('legendCheckoutReference', checkout.reference);
      sessionStorage.setItem('legendCheckoutSessionId', checkout.sessionId);
      window.location.assign(checkout.url);
    } catch (error) {
      console.error('Hosted checkout could not be started:', error);
      announcePurchaseFeedback('Secure payment could not be started. Your cart is still saved. Please try again.', { assertive: true });
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = originalBtnText;
      }
    }
  }
  // ==========================================
  // BEFORE / AFTER SLIDER
  // ==========================================
  function initBeforeAfter() {
    if (!dom.baSlider || !dom.baBefore || !dom.baHandle) return;
    let isDragging = false;

    function moveSlider(clientX) {
      const rect = dom.baSlider.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(5, Math.min(95, pct));
      dom.baHandle.style.left = pct + '%';
      dom.baBefore.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
    }

    dom.baHandle.addEventListener('mousedown', () => { isDragging = true; });
    document.addEventListener('mouseup', () => { isDragging = false; });
    document.addEventListener('mousemove', (e) => { if (isDragging) moveSlider(e.clientX); });

    // Touch support
    dom.baHandle.addEventListener('touchstart', () => { isDragging = true; });
    document.addEventListener('touchend', () => { isDragging = false; });
    document.addEventListener('touchmove', (e) => { if (isDragging) moveSlider(e.touches[0].clientX); });

    // Click to jump
    dom.baSlider.addEventListener('click', (e) => moveSlider(e.clientX));

    // Set initial clip-path
    dom.baBefore.style.clipPath = 'inset(0 50% 0 0)';
  }

  // ==========================================
  // SCROLL ANIMATIONS (Intersection Observer)
  // ==========================================
  function initScrollAnimations() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px 0px 0px' });

    reveals.forEach((el) => observer.observe(el));
  }

  // ==========================================
  // TESTIMONIAL CAROUSEL
  // ==========================================
  function goToTestimonial(index) {
    if (!dom.testimonialTrack) return;
    state.testimonialIndex = index;
    dom.testimonialTrack.style.transform = 'translateX(-' + (index * 100) + '%)';
    if (dom.testimonialDots) {
      dom.testimonialDots.forEach((dot, i) => {
        dot.classList.toggle('bg-mint', i === index);
        dot.classList.toggle('bg-surface-border', i !== index);
        dot.setAttribute('aria-pressed', i === index ? 'true' : 'false');
      });
    }
  }

  function initTestimonials() {
    if (!dom.testimonialTrack || !motionPreferencesModule) return;
    nextTestimonial();
    let timer = null;
    const testimonialMotionGate = motionPreferencesModule.createAutomaticMotionGate({
      element: dom.testimonialTrack,
      windowRef: window,
      documentRef: document,
    });

    function clearTestimonialTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function scheduleTestimonial() {
      clearTestimonialTimer();
      if (!testimonialMotionGate.isAllowed()) return;
      timer = window.setTimeout(() => {
        state.testimonialIndex = (state.testimonialIndex + 1) % state.totalTestimonials;
        goToTestimonial(state.testimonialIndex);
        scheduleTestimonial();
      }, 5000);
    }

    testimonialMotionGate.subscribe(({ allowed }) => {
      if (allowed) scheduleTestimonial();
      else clearTestimonialTimer();
    });

    if (dom.testimonialDots) {
      dom.testimonialDots.forEach((dot) => {
        dot.addEventListener('click', () => {
          goToTestimonial(Number.parseInt(dot.dataset.index, 10));
          scheduleTestimonial();
        });
      });
    }
  }
  function nextTestimonial() {
    goToTestimonial(0);
  }

  // ==========================================
  // PRODUCT FILTERS (shop page)
  // ==========================================
  function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const productCards = document.querySelectorAll('.product-card');
    if (!filterBtns.length) return;

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        productCards.forEach((card) => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // ==========================================
  // ADD TO CART BUTTONS
  // ==========================================
  function resolveCartProductPage(button, name) {
    return commerceModule.resolveProductPage({
      explicitPage: button.dataset.page || '',
      containerPage: button.closest('[data-page]')?.dataset.page || '',
      currentPath: window.location.pathname,
      name,
      pageByName: PRODUCT_PAGE_BY_NAME,
    });
  }

  function formatVariantPrice(price) {
    return '€' + Number(price).toFixed(0);
  }

  function initProductVariantSelectors() {
    document.querySelectorAll('[data-product-variant-selector]').forEach((selector) => {
      const container = selector.closest('.flex.flex-col') || selector.parentElement;
      const addButton = container?.querySelector('.add-to-cart-btn');
      const priceOutput = container?.querySelector('[data-selected-price]');
      const sizeOutput = container?.querySelector('[data-selected-size]');
      const cards = selector.querySelectorAll('[data-variant-card]');
      if (!addButton) return;

      function applySelection(input) {
        const variant = commerceModule.resolveProductVariant(input?.value);
        addButton.dataset.price = String(variant.price);
        addButton.dataset.variantId = variant.id;
        addButton.dataset.sizeCm = String(variant.longestSideCm);
        addButton.dataset.sizeLabel = variant.sizeLabel;
        addButton.dataset.widthCm = String(variant.widthCm);
        addButton.dataset.heightCm = String(variant.heightCm);
        addButton.dataset.variantLabel = variant.label;
        addButton.textContent = 'Add to cart — ' + formatVariantPrice(variant.price);
        if (priceOutput) priceOutput.textContent = formatVariantPrice(variant.price);
        if (sizeOutput) sizeOutput.textContent = variant.label + ' · ' + variant.sizeLabel;
        cards.forEach((card) => {
          const selected = card.contains(input);
          card.classList.toggle('is-selected', selected);
        });
      }

      selector.addEventListener('change', (event) => {
        if (event.target?.matches?.('input[type="radio"]')) applySelection(event.target);
      });
      applySelection(selector.querySelector('input[type="radio"]:checked'));
    });
  }

  function initAddToCart() {
    const btns = document.querySelectorAll('.add-to-cart-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const image = btn.dataset.emoji || btn.dataset.img;
        const page = resolveCartProductPage(btn, name);
        if (!page) {
          console.error('Cannot add product without a stable catalog page:', name);
          announcePurchaseFeedback('This product could not be added safely. Please open its product page and try again.', { assertive: true });
          return;
        }

        let variant;
        try {
          variant = commerceModule.resolveProductVariant(btn.dataset.variantId);
        } catch (error) {
          console.error('Cannot add product with an invalid size:', error);
          announcePurchaseFeedback('Please choose a valid size before adding this product.', { assertive: true });
          return;
        }

        addToCart(page, name, image, variant);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Added!';
        btn.style.background = '#16a34a';
        setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 2000);
      });
    });
  }

  // Product card navigation is centralized so cards have one click and keyboard contract.
function initProductCards() {
  if (!productCardNavigationModule) {
    throw new Error('Product card navigation module was not loaded.');
  }
  productCardNavigationModule.initProductCardNavigation({
    root: document,
    navigate: (href) => { window.location.href = href; },
    pageByName: PRODUCT_PAGE_BY_NAME,
  });
}

// ==========================================
// DAY / NIGHT TOGGLE
  // ==========================================
  function initThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (!toggle || !sunIcon || !moonIcon) return;

    // Check saved preference — default to dark mode
    const savedTheme = localStorage.getItem('theme');
    let isDark = savedTheme !== 'light';

    function applyTheme(dark) {
      isDark = dark;
      document.documentElement.classList.toggle('light-mode', !dark);
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
      sunIcon.classList.toggle('hidden', !dark);
      moonIcon.classList.toggle('hidden', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }

    // Apply initial
    applyTheme(isDark);

    toggle.addEventListener('click', () => applyTheme(!isDark));
  }

  // ==========================================
  // GOOGLE PLACES AUTOCOMPLETE
  // ==========================================
  let placeAutocomplete = null;
  let placeAutocompleteInitialized = false;
  let googlePlacesUnavailable = false;

  const GP_API_KEY = 'V5yqGyVnJ1IFk3fpZojBuvxMAic=';

  function ensureCheckoutAddressStatus() {
    const streetInput = document.getElementById('checkout-street');
    if (!streetInput?.parentElement) return null;
    let status = document.getElementById('checkout-address-status');
    if (!status) {
      status = document.createElement('p');
      status.id = 'checkout-address-status';
      status.className = 'hidden text-[11px] leading-relaxed mt-1.5 text-text-muted';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      streetInput.parentElement.appendChild(status);
    }
    streetInput.setAttribute('aria-describedby', status.id);
    return status;
  }

  function setCheckoutAddressStatus(message, { warning = false } = {}) {
    const status = ensureCheckoutAddressStatus();
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('hidden', !message);
    status.classList.toggle('text-amber-300', Boolean(message) && warning);
    status.classList.toggle('text-text-muted', !warning);
  }

  function manualAddressFallback(street, zip, city, country) {
    if (!checkoutAddressModule) {
      return { address: null, error: 'Address entry is temporarily unavailable. Please reload the page.' };
    }
    return checkoutAddressModule.createManualAddress({
      street,
      postalCode: zip,
      city,
      country,
    });
  }

  async function loadGooglePlaces() {
    if (placeAutocompleteInitialized) return;
    if (!googlePlacesLoader) {
      throw new Error('Google Places loader is not initialized.');
    }
    await googlePlacesLoader.load();
    initGooglePlacesAutocomplete();
    googlePlacesUnavailable = false;
  }

  function initGooglePlacesAutocomplete() {
    const streetInput = document.getElementById('checkout-street');
    if (!streetInput) return;

    placeAutocomplete = new window.google.maps.places.Autocomplete(streetInput, {
      types: ['address'],
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
      componentRestrictions: {
        country: commerceModule.getPlacesCountryRestriction(state.shippingCountry),
      },
    });

    placeAutocompleteInitialized = true;
    updateGooglePlacesCountryRestriction(state.shippingCountry);

    placeAutocomplete.addListener('place_changed', function() {
      const place = placeAutocomplete.getPlace();
      if (!place || !place.address_components) return;

      parseAndFillAddress(place);
    });
  }

  function updateGooglePlacesCountryRestriction(countryCode = state.shippingCountry) {
    if (!placeAutocomplete?.setComponentRestrictions || !commerceModule) return;
    placeAutocomplete.setComponentRestrictions({
      country: commerceModule.getPlacesCountryRestriction(countryCode),
    });
  }

  function parseAndFillAddress(place) {
    const components = place.address_components;
    let street_number = '';
    let route = '';
    let postal_code = '';
      let city = '';
    let country_code = '';

    for (const comp of components) {
      const types = comp.types;
      if (types.includes('street_number')) street_number = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('postal_code')) postal_code = comp.long_name;
      if (types.includes('locality') || types.includes('postal_town')) city = comp.long_name;
      if (types.includes('country')) country_code = comp.short_name.toLowerCase();
    }

    const resolvedCountry = country_code.toUpperCase();
    if (!commerceModule.isShippingCountryEnabled(resolvedCountry)) {
      validatedAddress = null;
      setCheckoutAddressStatus(commerceModule.getShippingMarketNotice(resolvedCountry), { warning: true });
      return;
    }

    // Fill street
    const streetInput = document.getElementById('checkout-street');
    if (streetInput) streetInput.value = (route + ' ' + street_number).trim();

    // Fill postal code
    const zipInput = document.getElementById('checkout-zip');
    if (zipInput) zipInput.value = postal_code;

    // Fill city
    const cityInput = document.getElementById('checkout-city');
    if (cityInput) cityInput.value = city;

    // Fill country
    const countryInput = document.getElementById('checkout-country');
    if (countryInput) {
      const codeUpper = country_code.toUpperCase();
      const match = Array.from(countryInput.options).find(o => o.value === codeUpper);
      if (match) {
        countryInput.value = codeUpper;
        if (state) state.shippingCountry = codeUpper;
        updateCheckoutTotals();
      }
      // Google pre-fills the country, but every address field remains editable.
      countryInput.disabled = false;
      countryInput.title = '';
    }

    // Lock street, zip, city — they come from the validated address
    if (streetInput) { streetInput.dataset.validated = 'true'; }
    if (zipInput) { zipInput.dataset.validated = 'true'; }
    if (cityInput) { cityInput.dataset.validated = 'true'; }

    // Mark as validated
    validatedAddress = {
      street: (route + ' ' + street_number).trim(),
      postal_code: postal_code,
      city: city,
      country: resolvedCountry,
      formatted: place.formatted_address || '',
    };
    setCheckoutAddressStatus('Address selected. You can edit any field before continuing.');
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function initEventListeners() {
    if (dom.cartBtn) dom.cartBtn.addEventListener('click', openCart);
    if (dom.cartClose) dom.cartClose.addEventListener('click', closeCart);
    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);
    if (dom.cartItems) {
      cartControlsModule.initCartControlDelegation({
        container: dom.cartItems,
        onUpdateQuantity: updateCartQuantity,
        onRemoveItem: removeFromCart,
      });
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', function() {
      openCheckoutModal();
      // Google Places will be loaded lazily when the user focuses the street field after filling required info.
    });
    // Load Google suggestions as an optional enhancement. Manual typing always remains available.
    const streetInput = document.getElementById('checkout-street');
    if (streetInput) {
      checkoutAddressModule.configureStreetAddressInput(streetInput);
      streetInput.addEventListener('focus', async function() {
        if (placeAutocompleteInitialized || streetInput.dataset.placesLoading === 'true') return;

        const failedAt = Number(streetInput.dataset.placesFailedAt || 0);
        if (googlePlacesUnavailable && Date.now() - failedAt < 30000) {
          setCheckoutAddressStatus('Address suggestions are unavailable. You can enter the address manually.', { warning: true });
          return;
        }

        streetInput.dataset.placesLoading = 'true';
        setCheckoutAddressStatus('Loading address suggestions...');
        try {
          await loadGooglePlaces();
          setCheckoutAddressStatus('Choose a suggestion or continue typing the address manually.');
        } catch (error) {
          googlePlacesUnavailable = true;
          streetInput.dataset.placesFailedAt = String(Date.now());
          console.warn('Google Places autocomplete could not be loaded:', error);
          setCheckoutAddressStatus('Address suggestions are unavailable. You can enter the address manually.', { warning: true });
        } finally {
          delete streetInput.dataset.placesLoading;
        }
      });
    }

    const checkoutCloseBtn = document.getElementById('checkout-close');
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);

    const checkoutOverlayEl = document.getElementById('checkout-overlay');
    if (checkoutOverlayEl) checkoutOverlayEl.addEventListener('click', closeCheckoutModal);

    const checkoutPayBtn = document.getElementById('checkout-pay-btn');
    if (checkoutPayBtn) checkoutPayBtn.addEventListener('click', handleCheckoutPay);
  }

  // ==========================================
  // SKIPER39: Particle Canvas Animation
  // ==========================================
  function initParticleCanvas() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas || !motionPreferencesModule) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width, height;
    let particles = [];
    let frameId = null;
    const particleCount = 60;
    const connectionDistance = 150;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width;
      canvas.height = height;
    }

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(42, 138, 74, ${this.opacity})`;
        ctx.fill();
      }
    }

    function initParticles() {
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    }

    function renderFrame(advance) {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        if (advance) particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(42, 138, 74, ${0.08 * (1 - dist / connectionDistance)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    const particleMotionGate = motionPreferencesModule.createAutomaticMotionGate({
      element: canvas,
      windowRef: window,
      documentRef: document,
    });

    function stopAnimation() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      renderFrame(false);
    }

    function startAnimation() {
      if (frameId !== null || !particleMotionGate.isAllowed()) return;
      function animate() {
        if (!particleMotionGate.isAllowed()) {
          frameId = null;
          renderFrame(false);
          return;
        }
        renderFrame(true);
        frameId = window.requestAnimationFrame(animate);
      }
      frameId = window.requestAnimationFrame(animate);
    }

    resize();
    initParticles();
    renderFrame(false);
    particleMotionGate.subscribe(({ allowed }) => {
      if (allowed) startAnimation();
      else stopAnimation();
    });
    window.addEventListener('resize', () => {
      resize();
      initParticles();
      renderFrame(false);
    });
  }

  // ==========================================
  // SKIPER34: Scroll Reveal Animation
  // ==========================================
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.skiper-reveal-img, .skiper-reveal-slide');
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach((el) => observer.observe(el));
  }

  // ==========================================
  // SKIPER48: Card Swipe Carousel
  // ==========================================
  // ==========================================
  // RELATED PRODUCTS RUNTIME - Generated registry + browser module
  // ==========================================
  var relatedProductsModulePromise = null;

  function loadRelatedProductsModule() {
    if (!relatedProductsModulePromise) {
      relatedProductsModulePromise = import('./catalog/related-products.mjs');
    }
    return relatedProductsModulePromise;
  }

  function escapeRelatedHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentPageFileName() {
    var page = window.location.pathname.split('/').filter(Boolean).pop();
    try { return decodeURIComponent(page || 'index.html'); }
    catch (error) { return page || 'index.html'; }
  }

  // ==========================================
  // RELATED PRODUCT DISCOVERY
  // ==========================================
  function ensureRelatedProductsStyles() {
    if (document.querySelector('link[data-related-products-styles]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('css/related-products.css', document.baseURI).href;
    link.dataset.relatedProductsStyles = 'true';
    document.head.appendChild(link);
  }

  function enhanceRelatedProductsSection(el) {
    var section = el.closest('section');
    if (!section) return;
    section.classList.add('related-discovery-section');

    var heading = section.querySelector('h2');
    if (heading) {
      heading.className = 'related-discovery-heading';
      heading.textContent = 'Discover more legends';
    }

    if (!section.querySelector('.related-discovery-intro')) {
      var intro = document.createElement('p');
      intro.className = 'related-discovery-intro';
      intro.textContent = 'A fresh selection of wall art, chosen for this visit.';
      heading?.insertAdjacentElement('afterend', intro);
    }
  }

  async function initRelatedProducts() {
    var el = document.getElementById('related-carousel');
    if (!el) return;

    try {
      ensureRelatedProductsStyles();
      var catalog = await loadRelatedProductsModule();
      var products = await catalog.loadProductRegistry(document.baseURI);
      var currentProduct = catalog.findCurrentProduct(products, {
        page: currentPageFileName(),
        name: el.dataset.currentProduct || '',
      });
      var related = catalog.selectRelatedProducts(products, currentProduct, { limit: 4 });
      if (!currentProduct || related.length === 0) return;

      enhanceRelatedProductsSection(el);

      var html = '<div class="related-discovery-track" role="list" aria-label="Other LegendMural wall stickers">';
      for (var index = 0; index < related.length; index += 1) {
        var product = related[index];
        var page = escapeRelatedHtml(product.page);
        var image = escapeRelatedHtml(product.image);
        var name = escapeRelatedHtml(product.name);
        var collection = escapeRelatedHtml(product.collection || 'LegendMural');

        html += '<a href="' + page + '" class="related-discovery-card" role="listitem" aria-label="View ' + name + '">';
        html += '<span class="related-discovery-image">';
        html += '<img src="' + image + '" alt="' + name + ' wall sticker" loading="lazy" decoding="async" fetchpriority="low">';
        html += '</span>';
        html += '<span class="related-discovery-copy">';
        html += '<span class="related-discovery-collection">' + collection + '</span>';
        html += '<span class="related-discovery-name">' + name + '</span>';
        html += '<span class="related-discovery-meta">';
        html += '<span class="related-discovery-price">From €35</span>';
        html += '<span class="related-discovery-arrow" aria-hidden="true"></span>';
        html += '</span>';
        html += '</span>';
        html += '</a>';
      }
      html += '</div>';
      el.innerHTML = html;
    } catch (error) {
      console.warn('Related products could not be loaded:', error);
    }
  }

  function initCarousel() {
    const carousels = document.querySelectorAll('.skiper-carousel');
    carousels.forEach((carousel) => {
      const cards = carousel.querySelectorAll('.carousel-card');
      if (!cards.length) return;
      let currentIndex = 0;
      const totalCards = cards.length;

      // Make first card active
      cards[0].classList.add('active');

      // Touch/drag support
      let startX = 0;
      let isDragging = false;

      carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
      });
      carousel.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        if (Math.abs(diff) > 50) {
          if (diff > 0 && currentIndex < totalCards - 1) {
            currentIndex++;
          } else if (diff < 0 && currentIndex > 0) {
            currentIndex--;
          }
          updateCarousel();
        }
        isDragging = false;
      });

      // Arrow buttons
      const prevBtn = carousel.parentElement.querySelector('.carousel-prev');
      const nextBtn = carousel.parentElement.querySelector('.carousel-next');
      if (prevBtn) prevBtn.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; updateCarousel(); } });
      if (nextBtn) nextBtn.addEventListener('click', () => { if (currentIndex < totalCards - 1) { currentIndex++; updateCarousel(); } });

      function updateCarousel() {
        cards.forEach((card, i) => {
          card.classList.toggle('active', i === currentIndex);
        });
        carousel.style.transform = `translateX(-${currentIndex * (100 / totalCards)}%)`;
      }
    });
  }

  // ==========================================
  // STICKER FACT MODAL
  // ==========================================
async function fetchStickerFact(query) {
  try {
    const resp = await fetch(`https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(query)}&key=${GP_API_KEY}&limit=1`);
    if (!resp.ok) return null;
    const data = await resp.json();
    const element = data.itemListElement && data.itemListElement[0];
    if (element && element.result && element.result.description) {
      return element.result.description;
    }
    return null;
  } catch (e) {
    console.warn('Sticker fact fetch error:', e);
    return null;
  }
}

function initStickerClicks() {
  // Sticker click handlers — attach to sticker cards with data-sticker-name
  const stickers = document.querySelectorAll('[data-sticker-name]');
  stickers.forEach(function(sticker) {
    sticker.addEventListener('click', async function() {
      const name = this.dataset.stickerName;
      const modal = document.getElementById('sticker-modal');
      const title = document.getElementById('sticker-modal-title');
      const content = document.getElementById('sticker-modal-content');
      if (!modal || !title || !content) return;
      title.textContent = name;
      content.textContent = 'Loading...';
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      const fact = await fetchStickerFact(name);
      content.textContent = fact || 'No fact found for this sticker.';
    });
  });
}

function initStickerModalClose() {
  const modal = document.getElementById('sticker-modal');
  const closeBtn = document.getElementById('sticker-modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  }
}

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function init() {
    await loadCommerceModule();
    loadCart();  // Restore cart after commerce policies are available
    await loadProductCardNavigationModule();
    await loadDialogAccessibilityModule();
    await loadMotionPreferencesModule();
    await loadCartControlsModule();
    await loadGooglePlacesLoaderModule();
    await loadCheckoutAddressModule();
    googlePlacesLoader = googlePlacesLoader || googlePlacesLoaderModule.createGooglePlacesLoader({
      apiKey: GP_API_KEY,
      windowRef: window,
      documentRef: document,
    });
    const mobileNavigationModule = await loadMobileNavigationModule();
    if (dom.cartDrawer && dom.cartOverlay) {
      cartDialogController = dialogAccessibilityModule.createDialogController({
        dialog: dom.cartDrawer,
        overlay: dom.cartOverlay,
        documentRef: document,
        onRequestClose: closeCart,
      });
    }
    if (dom.checkoutDrawer && dom.checkoutOverlay) {
      checkoutDialogController = dialogAccessibilityModule.createDialogController({
        dialog: dom.checkoutDrawer,
        overlay: dom.checkoutOverlay,
        documentRef: document,
        onRequestClose: closeCheckoutModal,
      });
    }
    if (dom.mobileMenuBtn && dom.mobileMenu) {
      mobileNavigationController = mobileNavigationModule.createMobileNavigationController({
        button: dom.mobileMenuBtn,
        menu: dom.mobileMenu,
        documentRef: document,
        windowRef: window,
      });
    }
    const fns = [
      initStickerClicks,
      initStickerModalClose,
      initEventListeners,
      initBeforeAfter,
      initScrollAnimations,
      initTestimonials,
      initFilters,
      initProductVariantSelectors,
      initAddToCart,
      initProductCards,
      initThemeToggle,
      initInternationalShippingNotice,
      initParticleCanvas,
      initScrollReveal,
      initRelatedProducts,
      initCarousel,
    ];
    // Inject discount UI and init after DOM is ready
    injectCartDiscount();
    injectCheckoutDiscount();
    initDiscountCode();
    fns.forEach(function(fn) {
      try { fn(); } catch(e) { console.error('init error:', fn.name, e); }
    });
    updateCartCount();
  }

  function startApp() {
    init().catch((error) => {
      console.error('LegendMural app initialization failed:', error);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
})();
