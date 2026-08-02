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

  const CART_SCHEMA_VERSION = '2';

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
          ? parsedCart.filter((item) => item && item.page && Number(item.quantity) > 0)
          : [];
      } catch (e) {
        state.cart = [];
      }
    } else if (savedCart) {
      localStorage.removeItem('legendCart');
      localStorage.setItem('legendCartVersion', CART_SCHEMA_VERSION);
      state.cart = [];
    }
    if (savedCountry) {
      state.shippingCountry = savedCountry;
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
      ]).then(([totals, discounts, orderRequest, checkoutClient]) => {
        commerceModule = Object.freeze({
          ...totals,
          ...discounts,
          ...orderRequest,
          ...checkoutClient,
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

  const COUNTRY_OPTIONS = [
    { code: 'NL', flag: '🇳🇱', name: 'Netherlands' },
    { code: 'BE', flag: '🇧🇪', name: 'Belgium' },
    { code: 'DE', flag: '🇩🇪', name: 'Germany' },
    { code: 'FR', flag: '🇫🇷', name: 'France' },
    { code: 'LU', flag: '🇱🇺', name: 'Luxembourg' },
    { code: 'AT', flag: '🇦🇹', name: 'Austria' },
    { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
    { code: 'IE', flag: '🇮🇪', name: 'Ireland' },
    { code: 'DK', flag: '🇩🇰', name: 'Denmark' },
    { code: 'SE', flag: '🇸🇪', name: 'Sweden' },
    { code: 'NO', flag: '🇳🇴', name: 'Norway' },
    { code: 'FI', flag: '🇫🇮', name: 'Finland' },
    { code: 'ES', flag: '🇪🇸', name: 'Spain' },
    { code: 'PT', flag: '🇵🇹', name: 'Portugal' },
    { code: 'IT', flag: '🇮🇹', name: 'Italy' },
    { code: 'GR', flag: '🇬🇷', name: 'Greece' },
    { code: 'PL', flag: '🇵🇱', name: 'Poland' },
    { code: 'CZ', flag: '🇨🇿', name: 'Czech Republic' },
    { code: 'HU', flag: '🇭🇺', name: 'Hungary' },
    { code: 'RO', flag: '🇷🇴', name: 'Romania' },
    { code: 'BG', flag: '🇧🇬', name: 'Bulgaria' },
    { code: 'HR', flag: '🇭🇷', name: 'Croatia' },
    { code: 'SK', flag: '🇸🇰', name: 'Slovakia' },
    { code: 'SI', flag: '🇸🇮', name: 'Slovenia' },
    { code: 'EE', flag: '🇪🇪', name: 'Estonia' },
    { code: 'LV', flag: '🇱🇻', name: 'Latvia' },
    { code: 'LT', flag: '🇱🇹', name: 'Lithuania' },
    { code: 'CH', flag: '🇨🇭', name: 'Switzerland' },
    { code: 'US', flag: '🇺🇸', name: 'United States' },
    { code: 'CA', flag: '🇨🇦', name: 'Canada' },
    { code: 'AU', flag: '🇦🇺', name: 'Australia' },
    { code: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
    { code: 'JP', flag: '🇯🇵', name: 'Japan' },
    { code: 'KR', flag: '🇰🇷', name: 'South Korea' },
    { code: 'SG', flag: '🇸🇬', name: 'Singapore' },
    { code: 'AE', flag: '🇦🇪', name: 'United Arab Emirates' },
    { code: 'OTHER', flag: '🌍', name: 'Rest of World' },
  ];

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

  function addToCart(page, name, price, image) {
    if (!page) {
      throw new Error('A stable product page is required before adding an item to the cart.');
    }
    const product = {
      id: page,
      page: page,
      name: name,
      price: parseFloat(price),
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

    // Country selector HTML
    const countryOptions = COUNTRY_OPTIONS.map(c =>
      '<option value="' + c.code + '"' + (state.shippingCountry === c.code ? ' selected' : '') + '>' + c.flag + ' ' + c.name + '</option>'
    ).join('');

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
      '<p class="text-[11px] text-text-muted mt-1.5">🚚 Shipping calculated at checkout based on your country. Free shipping available from €50+ (NL) / €75+ (EU) / €150+ (World)</p>' +
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

    // Populate country dropdown
    const countrySelect = document.getElementById('checkout-country');
    if (countrySelect && countrySelect.options.length === 0) {
      COUNTRY_OPTIONS.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.flag + ' ' + c.name;
        if (c.code === 'NL') opt.selected = true;
        countrySelect.appendChild(opt);
      });
    }

    // Set saved country
    if (countrySelect) {
      countrySelect.value = state.shippingCountry || 'NL';
    }

    updateCheckoutTotals();

    // Country change listener
    if (countrySelect) {
      countrySelect.onchange = function() {
        state.shippingCountry = this.value;
        updateCheckoutTotals();
      };
    }

    // Watch for street field being cleared — re-enable fields
    const streetField = document.getElementById('checkout-street');
    if (streetField) {
      streetField.addEventListener('input', function() {
        if (this.value.trim() === '') {
          validatedAddress = null;
          const countryEl = document.getElementById('checkout-country');
          if (countryEl) { countryEl.disabled = false; countryEl.title = ''; }
          const zipEl = document.getElementById('checkout-zip');
          const cityEl = document.getElementById('checkout-city');
          if (zipEl) zipEl.dataset.validated = '';
          if (cityEl) cityEl.dataset.validated = '';
        }
      });
    }
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
    loadGooglePlaces().then(() => {
      doGoogleValidation(street, zip, city, country, callback);
    }).catch((error) => {
      console.warn('Google address validation could not start:', error);
      callback('Address verification is temporarily unavailable. Please try again.');
    });
  }

  function doGoogleValidation(street, zip, city, country, callback) {
    var service = new window.google.maps.places.PlacesService(document.createElement('div'));
    var query = street + ', ' + zip + ' ' + city + ', ' + country.toUpperCase();

    service.findPlaceFromQuery({
      query: query,
      fields: ['address_components', 'formatted_address', 'geometry', 'name']
    }, function(results, status) {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
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
    const validatedCountry = address.country;
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

  function initAddToCart() {
    const btns = document.querySelectorAll('.add-to-cart-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const price = btn.dataset.price;
        const image = btn.dataset.emoji || btn.dataset.img;
        const page = resolveCartProductPage(btn, name);
        if (!page) {
          console.error('Cannot add product without a stable catalog page:', name);
          announcePurchaseFeedback('This product could not be added safely. Please open its product page and try again.', { assertive: true });
          return;
        }
        addToCart(page, name, price, image);
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

  const GP_API_KEY = 'V5yqGyVnJ1IFk3fpZojBuvxMAic=';

  async function loadGooglePlaces() {
    if (placeAutocompleteInitialized) return;
    if (!googlePlacesLoader) {
      throw new Error('Google Places loader is not initialized.');
    }
    await googlePlacesLoader.load();
    initGooglePlacesAutocomplete();
  }

  function initGooglePlacesAutocomplete() {
    const streetInput = document.getElementById('checkout-street');
    if (!streetInput) return;

    placeAutocomplete = new window.google.maps.places.Autocomplete(streetInput, {
      types: ['address'],
      fields: ['address_components', 'formatted_address', 'geometry', 'name'],
    });

    placeAutocompleteInitialized = true;

    placeAutocomplete.addListener('place_changed', function() {
      const place = placeAutocomplete.getPlace();
      if (!place || !place.address_components) return;

      parseAndFillAddress(place);
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
      // Lock country field — it's determined by the validated address
      countryInput.disabled = true;
      countryInput.title = 'Country is set based on your address. Clear the street field to change.';
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
      country: country_code.toUpperCase(),
      formatted: place.formatted_address || '',
    };
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
    // Add lazy loading for Google Places Autocomplete on street field focus
    const streetInput = document.getElementById('checkout-street');
    if (streetInput) {
      streetInput.addEventListener('focus', async function() {
        const fn = document.getElementById('checkout-firstname')?.value.trim();
        const ln = document.getElementById('checkout-lastname')?.value.trim();
        const email = document.getElementById('checkout-email')?.value.trim();
        if (!fn || !ln || !email) {
          const firstMissing = !fn
            ? document.getElementById('checkout-firstname')
            : !ln
              ? document.getElementById('checkout-lastname')
              : document.getElementById('checkout-email');
          announcePurchaseFeedback('Fill in your first name, last name and email before entering the address.', {
            assertive: true,
            focusTarget: firstMissing,
          });
          return;
        }

        try {
          await loadGooglePlaces();
        } catch (error) {
          console.warn('Google Places autocomplete could not be loaded:', error);
          announcePurchaseFeedback(
            'Google address suggestions are temporarily unavailable. You can try focusing the address field again.',
            { assertive: true, focusTarget: streetInput },
          );
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
  // RELATED PRODUCTS CAROUSEL
  // ==========================================
  async function initRelatedProducts() {
    var el = document.getElementById('related-carousel');
    if (!el) return;

    try {
      var catalog = await loadRelatedProductsModule();
      var products = await catalog.loadProductRegistry(document.baseURI);
      var currentProduct = catalog.findCurrentProduct(products, {
        page: currentPageFileName(),
        name: el.dataset.currentProduct || '',
      });
      var related = catalog.selectRelatedProducts(products, currentProduct);
      if (!currentProduct || related.length === 0) return;

      var styleId = 'related-carousel-style';
      if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = '.related-carousel-item{width:45%;flex:0 0 45%}@media(min-width:640px){.related-carousel-item{width:30%;flex:0 0 30%}}@media(min-width:1024px){.related-carousel-item{width:22%;flex:0 0 22%}}' +
                '.related-track{scrollbar-width:none;-ms-overflow-style:none;pointer-events:auto}.related-track::-webkit-scrollbar{display:none}' +
                '.related-arrow{z-index:20;pointer-events:auto}' +
                '.related-track-wrap{position:relative;max-width:100%;pointer-events:none}';
        document.head.appendChild(style);
      }

      var html = '';
      for (var index = 0; index < related.length; index++) {
        var product = related[index];
        var page = escapeRelatedHtml(product.page);
        var image = escapeRelatedHtml(product.image);
        var name = escapeRelatedHtml(product.name);
        html += '<a href="' + page + '" class="inline-block flex-none snap-start group related-carousel-item">';
        html += '<div class="aspect-[4/3] rounded-xl overflow-hidden border border-surface-border/30 mb-2 bg-neutral-200">';
        html += '<img src="' + image + '" alt="' + name + '" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" fetchpriority="low">';
        html += '</div>';
        html += '<p class="text-sm text-text-secondary group-hover:text-mint transition-colors truncate">' + name + '</p>';
        html += '</a>';
      }

      el.innerHTML =
        '<div class="related-track-wrap">' +
        '<button class="related-arrow related-prev absolute left-0 top-[40%] -translate-y-1/2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-surface-border/30 flex items-center justify-center text-text-secondary hover:text-mint hover:bg-surface transition-all shadow-lg z-20" aria-label="Previous">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>' +
        '</button>' +
        '<button class="related-arrow related-next absolute right-0 top-[40%] -translate-y-1/2 w-10 h-10 rounded-full bg-surface/90 backdrop-blur-sm border border-surface-border/30 flex items-center justify-center text-text-secondary hover:text-mint hover:bg-surface transition-all shadow-lg z-20" aria-label="Next">' +
        '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>' +
        '</button>' +
        '<div class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 related-track" style="-webkit-overflow-scrolling:touch;overflow-y:hidden">' +
        html +
        '</div>' +
        '</div>';

      var track = el.querySelector('.related-track');
      var previous = el.querySelector('.related-prev');
      var next = el.querySelector('.related-next');
      var relatedMotionGate = motionPreferencesModule.createAutomaticMotionGate({
        element: track,
        windowRef: window,
        documentRef: document,
      });

      function smoothScrollTo(targetX, duration) {
        if (!track) return;
        duration = duration || 800;
        if (relatedMotionGate.prefersReducedMotion() || duration <= 0) {
          track.scrollLeft = targetX;
          return;
        }
        var start = track.scrollLeft;
        var distance = targetX - start;
        if (Math.abs(distance) < 1) return;
        var startTime = null;
        function ease(progress) { return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress; }
        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var elapsed = timestamp - startTime;
          var progress = Math.min(elapsed / duration, 1);
          track.scrollLeft = start + distance * ease(progress);
          if (progress < 1) window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);
      }

      if (track && previous) {
        previous.addEventListener('click', function(event) {
          event.stopPropagation();
          smoothScrollTo(track.scrollLeft - track.clientWidth * 0.66, 600);
          deferAutoScroll();
        });
      }
      if (track && next) {
        next.addEventListener('click', function(event) {
          event.stopPropagation();
          smoothScrollTo(track.scrollLeft + track.clientWidth * 0.66, 600);
          deferAutoScroll();
        });
      }

      var autoTimer = null;
      var interactionPaused = false;

      function clearAutoTimer() {
        if (autoTimer) {
          window.clearTimeout(autoTimer);
          autoTimer = null;
        }
      }

      function scheduleAutoScroll(delay) {
        clearAutoTimer();
        if (interactionPaused || !relatedMotionGate.isAllowed()) return;
        autoTimer = window.setTimeout(doAutoScroll, delay || 1500);
      }

      function doAutoScroll() {
        if (!track || interactionPaused || !relatedMotionGate.isAllowed()) return;
        var maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll <= 1) return;
        var target = track.scrollLeft + track.clientWidth * 0.66;
        if (target >= maxScroll - 5) target = 0;
        smoothScrollTo(target, 900);
        scheduleAutoScroll(3900);
      }

      function pauseAutoScroll() {
        interactionPaused = true;
        clearAutoTimer();
      }

      function resumeAutoScroll() {
        interactionPaused = false;
        scheduleAutoScroll(1500);
      }

      function deferAutoScroll() {
        if (!interactionPaused) scheduleAutoScroll(5000);
      }

      function handleRelatedFocusOut(event) {
        if (!track.contains(event.relatedTarget)) resumeAutoScroll();
      }

      relatedMotionGate.subscribe(({ allowed }) => {
        if (allowed && !interactionPaused) scheduleAutoScroll(1500);
        else clearAutoTimer();
      });
      track.addEventListener('mouseenter', pauseAutoScroll);
      track.addEventListener('mouseleave', resumeAutoScroll);
      track.addEventListener('focusin', pauseAutoScroll);
      track.addEventListener('focusout', handleRelatedFocusOut);
      track.addEventListener('touchstart', pauseAutoScroll, { passive: true });
      track.addEventListener('touchend', resumeAutoScroll);
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
  // SKIPER67: Video Player Interaction
  // ==========================================
  function initVideoPlayer() {
    const players = document.querySelectorAll('.skiper-video-player');
    players.forEach((player) => {
      player.addEventListener('click', () => {
        // Placeholder: show alert or expand to modal
        const videoId = player.dataset.videoId;
        if (videoId) {
          // Future: open video modal or redirect
          console.log('Play video:', videoId);
        }
      });
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

function initHoverExpandMobile() {}

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
      initAddToCart,
      initProductCards,
      initThemeToggle,
      initParticleCanvas,
      initScrollReveal,
      initRelatedProducts,
      initCarousel,
      initVideoPlayer,
      initHoverExpandMobile,
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
