/**
 * Legend Stories — Main Application JavaScript
 * Handles: Cart Drawer, Mobile Menu, Before/After Slider, 
 * Scroll Animations, Testimonial Carousel, Product Filters, Add to Cart
 */

(function () {
  'use strict';

  // ==========================================
  // STATE
  // ==========================================
  const state = {
    cart: [],
    cartOpen: false,
    mobileMenuOpen: false,
    testimonialIndex: 0,
    totalTestimonials: 4,
    shippingCountry: 'NL',
    shippingCost: 0,
    discountCode: '',
    discountPercent: 0,
  };

  // ==========================================
  // LOCAL STORAGE - Cart Persistence
  // ==========================================
  function saveCart() {
    localStorage.setItem('legendCart', JSON.stringify(state.cart));
    localStorage.setItem('legendShippingCountry', state.shippingCountry);
    localStorage.setItem('legendDiscountCode', state.discountCode);
    localStorage.setItem('legendDiscountPercent', state.discountPercent);
  }

  function loadCart() {
    const savedCart = localStorage.getItem('legendCart');
    const savedCountry = localStorage.getItem('legendShippingCountry');
    const savedDiscountCode = localStorage.getItem('legendDiscountCode');
    const savedDiscountPercent = localStorage.getItem('legendDiscountPercent');
    if (savedCart) {
      try {
        state.cart = JSON.parse(savedCart);
      } catch (e) {
        state.cart = [];
      }
    }
    if (savedCountry) {
      state.shippingCountry = savedCountry;
    }
    if (savedDiscountCode) {
      state.discountCode = savedDiscountCode;
    }
    if (savedDiscountPercent) {
      state.discountPercent = parseInt(savedDiscountPercent) || 0;
    }
  }

  // ==========================================
  // SHIPPING CONFIG
  // ==========================================
  const SHIPPING_ZONES = {
    NL:  { name: 'Netherlands',     cost: 3.95, freeFrom: 50,  currency: 'EUR' },
    BE:  { name: 'Belgium',         cost: 5.95, freeFrom: 75,  currency: 'EUR' },
    DE:  { name: 'Germany',         cost: 5.95, freeFrom: 75,  currency: 'EUR' },
    FR:  { name: 'France',          cost: 5.95, freeFrom: 75,  currency: 'EUR' },
    LU:  { name: 'Luxembourg',      cost: 5.95, freeFrom: 75,  currency: 'EUR' },
    AT:  { name: 'Austria',         cost: 5.95, freeFrom: 75,  currency: 'EUR' },
    DK:  { name: 'Denmark',         cost: 9.95, freeFrom: 100, currency: 'EUR' },
    SE:  { name: 'Sweden',          cost: 9.95, freeFrom: 100, currency: 'EUR' },
    ES:  { name: 'Spain',           cost: 9.95, freeFrom: 100, currency: 'EUR' },
    IT:  { name: 'Italy',           cost: 9.95, freeFrom: 100, currency: 'EUR' },
    PT:  { name: 'Portugal',        cost: 9.95, freeFrom: 100, currency: 'EUR' },
    IE:  { name: 'Ireland',         cost: 9.95, freeFrom: 100, currency: 'EUR' },
    FI:  { name: 'Finland',         cost: 9.95, freeFrom: 100, currency: 'EUR' },
    PL:  { name: 'Poland',          cost: 9.95, freeFrom: 100, currency: 'EUR' },
    CZ:  { name: 'Czech Republic',  cost: 9.95, freeFrom: 100, currency: 'EUR' },
    CH:  { name: 'Switzerland',     cost: 9.95, freeFrom: 100, currency: 'EUR' },
    NO:  { name: 'Norway',          cost: 9.95, freeFrom: 100, currency: 'EUR' },
    GB:  { name: 'United Kingdom',  cost: 9.95, freeFrom: 100, currency: 'EUR' },
    US:  { name: 'United States',   cost: 14.95,freeFrom: 150, currency: 'EUR' },
    CA:  { name: 'Canada',          cost: 14.95,freeFrom: 150, currency: 'EUR' },
    AU:  { name: 'Australia',       cost: 14.95,freeFrom: 150, currency: 'EUR' },
    JP:  { name: 'Japan',           cost: 14.95,freeFrom: 150, currency: 'EUR' },
    OTHER: { name: 'Rest of World', cost: 14.95,freeFrom: 150, currency: 'EUR' },
  };

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
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),
    baSlider: document.getElementById('ba-slider'),
    baBefore: document.getElementById('ba-before'),
    baHandle: document.getElementById('ba-handle'),
    testimonialTrack: document.getElementById('testimonial-track'),
    testimonialDots: document.querySelectorAll('.testimonial-dot'),
  };

  // ==========================================
  // CART FUNCTIONS
  // ==========================================
  function openCart() {
    state.cartOpen = true;
    if (dom.cartOverlay) dom.cartOverlay.classList.remove('hidden');
    if (dom.cartDrawer) {
      dom.cartDrawer.classList.remove('translate-x-full');
      dom.cartDrawer.setAttribute('aria-hidden', 'false');
    }
    if (dom.cartOverlay) dom.cartOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderCart();
  }

  function closeCart() {
    state.cartOpen = false;
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

  function formatPrice(price) {
    return '€' + price.toFixed(2).replace('.', ',');
  }

  function addToCart(name, price, image) {
    const product = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
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
    return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getShippingCost() {
    if (state.cart.length === 0) { state.shippingCost = 0; return 0; }
    const zone = SHIPPING_ZONES[state.shippingCountry] || SHIPPING_ZONES.OTHER;
    const cartTotal = getCartTotal();
    if (cartTotal >= zone.freeFrom) { state.shippingCost = 0; return 0; }
    state.shippingCost = zone.cost;
    return zone.cost;
  }

  function getGrandTotal() {
    return getCartTotal() + getShippingCost();
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

    const cartSubtotal = getCartTotal();
    const shippingCost = getShippingCost();
    const zone = SHIPPING_ZONES[state.shippingCountry] || SHIPPING_ZONES.OTHER;

    dom.cartItems.innerHTML =
      state.cart.map((item, i) => {
        const imgHtml = item.image && item.image.startsWith('media/')
          ? '<img src="' + item.image + '" alt="' + item.name + '" class="w-12 h-12 object-contain rounded">'
          : item.image;
        return '<div class="flex gap-4 mb-3 p-3 rounded-xl bg-surface-light/50 border border-surface-border/30"><div class="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-2xl shrink-0">' + imgHtml + '</div><div class="flex-1 min-w-0"><p class="text-sm font-medium text-text-primary truncate">' + item.name + '</p><div class="flex items-center justify-between mt-2"><div class="flex items-center gap-2"><button onclick="window.legendApp.updateQty(' + i + ',-1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">−</button><span class="text-sm text-text-primary min-w-[20px] text-center">' + item.quantity + '</span><button onclick="window.legendApp.updateQty(' + i + ',1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-mint transition-colors">+</button></div><div class="flex items-center gap-3"><span class="text-sm font-medium text-mint">' + formatPrice(item.price * item.quantity) + '</span><button onclick="window.legendApp.removeItem(' + i + ')" class="text-text-muted hover:text-red-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div></div></div>';
      }).join('') +
      '<div class="border-t border-surface-border/30 pt-3 mt-3">' +
      '<div class="flex justify-between text-sm"><span class="text-text-muted">Subtotal</span><span class="text-text-primary font-medium">' + formatPrice(cartSubtotal) + '</span></div>' +
      (state.discountPercent > 0 ? '<div class="flex justify-between text-sm"><span class="text-text-muted">Discount (' + state.discountPercent + '%)</span><span class="text-red-400 font-medium">-' + formatPrice(getDiscountAmount(cartSubtotal)) + '</span></div>' : '') +
      '<p class="text-[11px] text-text-muted mt-1.5">🚚 Shipping calculated at checkout based on your country. Free shipping available from €50+ (NL) / €75+ (EU) / €150+ (World)</p>' +
      '</div>';

    // Update cart total to show discounted total
    const discountedTotal = cartSubtotal - (state.discountPercent > 0 ? getDiscountAmount(cartSubtotal) : 0);
    if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(discountedTotal);
  }

  // ==========================================
  // CHECKOUT MODAL
  // ==========================================
  function openCheckoutModal() {
    console.log('[DEBUG] openCheckoutModal called');
    // Removed early return based on cart length to always open checkout drawer
    closeCart();
    const drawer = dom.checkoutDrawer;
    const overlay = dom.checkoutOverlay;
    console.log('[DEBUG] drawer:', drawer, 'overlay:', overlay);
    if (!drawer || !overlay) {
      console.log('[DEBUG] drawer or overlay not found!');
      return;
    }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    drawer.classList.remove('translate-x-full');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    console.log('[DEBUG] checkout drawer opened');

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

  function closeCheckoutModal() {
    const drawer = dom.checkoutDrawer;
    const overlay = dom.checkoutOverlay;
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

  function updateCheckoutTotals() {
    const subtotal = getCartTotal();
    const discount = getDiscountAmount(subtotal);
    const discountedSubtotal = subtotal - discount;
    const zone = SHIPPING_ZONES[state.shippingCountry] || SHIPPING_ZONES.OTHER;
    const shipping = discountedSubtotal >= zone.freeFrom ? 0 : zone.cost;
    const grandTotal = discountedSubtotal + shipping;

    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const grandTotalEl = document.getElementById('checkout-grandtotal');
    const discountEl = document.getElementById('checkout-discount-amount');
    const noteEl = document.getElementById('checkout-shipping-note');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (discountEl) {
      discountEl.textContent = discount > 0 ? '-' + formatPrice(discount) : '€0,00';
      discountEl.parentElement.classList.toggle('hidden', discount === 0);
    }
    if (shippingEl) shippingEl.textContent = shipping === 0 ? 'Free' : formatPrice(shipping);
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(grandTotal);
    if (noteEl) {
      if (shipping === 0) {
        noteEl.textContent = '✓ Free shipping to ' + zone.name;
      } else {
        noteEl.textContent = 'Add ' + formatPrice(zone.freeFrom - discountedSubtotal) + ' more for free shipping to ' + zone.name;
      }
    }
  }

  let validatedAddress = null;

  // ==========================================
  // DISCOUNT CODE
  // ==========================================
  const VALID_DISCOUNT_CODES = {
    'LEGEND10': 10,
    'WELCOME15': 15,
  };

  function applyDiscount(code) {
    const messageEl = document.getElementById('discount-message') || document.getElementById('cart-discount-message');
    const discountInput = document.getElementById('checkout-discount') || document.getElementById('cart-discount');
    
    code = code.trim().toUpperCase();
    const percent = VALID_DISCOUNT_CODES[code];
    
    if (percent) {
      state.discountCode = code;
      state.discountPercent = percent;
      if (messageEl) {
        messageEl.textContent = '✓ ' + percent + '% discount applied!';
        messageEl.className = 'text-[11px] mt-1.5 text-mint';
        messageEl.classList.remove('hidden');
      }
      updateCheckoutTotals();
      renderCart();
      return true;
    } else {
      state.discountCode = '';
      state.discountPercent = 0;
      if (messageEl) {
        messageEl.textContent = 'Invalid discount code';
        messageEl.className = 'text-[11px] mt-1.5 text-red-400';
        messageEl.classList.remove('hidden');
      }
      updateCheckoutTotals();
      return false;
    }
  }

  function getDiscountAmount(subtotal) {
    return subtotal * (state.discountPercent / 100);
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
      alert('Please fill in all required fields.');
      return;
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
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
          alert(err);
          document.getElementById('checkout-street').focus();
          return;
        }
        processOrder(googleAddress, firstname, lastname, email);
      });
    }
  }

  function validateAddressWithGoogle(street, zip, city, country, callback) {
    // Ensure Google Places is loaded
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      // Google API not loaded yet — load it first, then retry
      loadGooglePlaces();
      // Wait for API to load, then retry
      var retryInterval = setInterval(function() {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(retryInterval);
          doGoogleValidation(street, zip, city, country, callback);
        }
      }, 500);
      // Timeout after 10s
      setTimeout(function() { clearInterval(retryInterval); }, 10000);
      return;
    }
    doGoogleValidation(street, zip, city, country, callback);
  }

  function doGoogleValidation(street, zip, city, country, callback) {
    var service = new google.maps.places.PlacesService(document.createElement('div'));
    var query = street + ', ' + zip + ' ' + city + ', ' + country.toUpperCase();

    service.findPlaceFromQuery({
      query: query,
      fields: ['address_components', 'formatted_address', 'geometry', 'name']
    }, function(results, status) {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
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

  function processOrder(address, firstname, lastname, email) {
    const validatedCountry = address.country;
    const zone = SHIPPING_ZONES[validatedCountry] || SHIPPING_ZONES.OTHER;
    const subtotal = getCartTotal();
    const discount = getDiscountAmount(subtotal);
    const discountedSubtotal = subtotal - discount;
    const shipping = discountedSubtotal >= zone.freeFrom ? 0 : zone.cost;
    const total = discountedSubtotal + shipping;

    const orderData = {
      items: state.cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })),
      customer: { firstname, lastname, email, street: address.street, zip: address.postal_code, city: address.city, country: validatedCountry, formatted: address.formatted },
      shipping: { zone: zone.name, cost: shipping },
      subtotal: subtotal,
      discount: discount,
      discountCode: state.discountCode,
      total: total,
    };

    // Store for Stripe redirect
    sessionStorage.setItem('legendOrder', JSON.stringify(orderData));

    // Redirect to Stripe Checkout (placeholder — replace with real Stripe URL)
    // For now, show confirmation
    alert('Order ready! In production this redirects to Stripe Checkout.\n\nSubtotal: ' + formatPrice(subtotal) + '\nDiscount (' + state.discountPercent + '%): -' + formatPrice(discount) + '\nShipping to ' + zone.name + ': ' + (shipping === 0 ? 'Free' : formatPrice(shipping)) + '\nTotal: ' + formatPrice(total));
  }

  // ==========================================
  // MOBILE MENU
  // ==========================================
  function toggleMobileMenu() {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    if (dom.mobileMenu) {
      dom.mobileMenu.style.display = state.mobileMenuOpen ? 'block' : 'none';
    }
    if (dom.mobileMenuBtn) dom.mobileMenuBtn.setAttribute('aria-expanded', state.mobileMenuOpen);
  }
  function closeMobileMenu() {
    state.mobileMenuOpen = false;
    if (dom.mobileMenu) {
      dom.mobileMenu.style.display = 'none';
    }
    if (dom.mobileMenuBtn) dom.mobileMenuBtn.setAttribute('aria-expanded', 'false');
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
      });
    }
  }

  function initTestimonials() {
    if (!dom.testimonialTrack) return;
    nextTestimonial(); // Set initial state
    setInterval(() => {
      state.testimonialIndex = (state.testimonialIndex + 1) % state.totalTestimonials;
      goToTestimonial(state.testimonialIndex);
    }, 5000);
    if (dom.testimonialDots) {
      dom.testimonialDots.forEach((dot) => {
        dot.addEventListener('click', () => goToTestimonial(parseInt(dot.dataset.index)));
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
  function initAddToCart() {
    const btns = document.querySelectorAll('.add-to-cart-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const price = btn.dataset.price;
        const emoji = btn.dataset.emoji || btn.dataset.img;
        addToCart(name, price, emoji);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Added!';
        btn.style.background = '#16a34a';
        setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 2000);
      });
    });
  }

  // Product card navigation (click anywhere on card except add-to-cart button)
  function initProductCards() {
    const cards = document.querySelectorAll('.legend-card-swiper article.group');
    cards.forEach((card) => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        // Don't navigate if clicking add-to-cart button
        if (e.target.closest('.add-to-cart-btn')) return;
        const name = card.querySelector('h3')?.textContent;
        if (name) {
          const pageMap = {
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
            'The Truth Seeker': 'wisdom-legends.html',
            "The Lion's Pride": 'sport-lions-pride.html',
            'The Luxury Standard': 'sport-luxury-standard.html',
            'The Peak Performer': 'sport-peak-performer.html',
            'Pursuit of Greatness': 'sport-pursuit-greatness.html',
            'Unforgettable Roots': 'sport-unforgettable-roots.html',
            'Mamba Mindset': 'music-mamba-mindset.html',
          };
          const page = pageMap[name] || pageMap[name.replace(/^The /, '')] || pageMap[name.replace(/ Legend$/, '')] || pageMap[name.replace(/ Legend$/, '')];
          if (page) window.location.href = page;
        }
      });
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

  function loadGooglePlaces() {
    if (placeAutocompleteInitialized) return;

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GP_API_KEY}&libraries=places&callback=initGooglePlacesAutocomplete`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  function initGooglePlacesAutocomplete() {
    const streetInput = document.getElementById('checkout-street');
    if (!streetInput) return;

    placeAutocomplete = new google.maps.places.Autocomplete(streetInput, {
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

  // Global callback for Google script
  window.initGooglePlacesAutocomplete = initGooglePlacesAutocomplete;

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function initEventListeners() {
    if (dom.cartBtn) dom.cartBtn.addEventListener('click', openCart);
    if (dom.cartClose) dom.cartClose.addEventListener('click', closeCart);
    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);
    if (dom.mobileMenuBtn) dom.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (dom.mobileMenu) {
      dom.mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMobileMenu);
      });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (state.cartOpen) closeCart();
        if (state.mobileMenuOpen) closeMobileMenu();
        closeCheckoutModal();
      }
    });

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', function() {
      openCheckoutModal();
      // Google Places will be loaded lazily when the user focuses the street field after filling required info.
    });
    // Add lazy loading for Google Places Autocomplete on street field focus
    const streetInput = document.getElementById('checkout-street');
    if (streetInput) {
      streetInput.addEventListener('focus', function() {
        const fn = document.getElementById('checkout-firstname')?.value.trim();
        const ln = document.getElementById('checkout-lastname')?.value.trim();
        const email = document.getElementById('checkout-email')?.value.trim();
        if (fn && ln && email) {
          loadGooglePlaces();
        } else {
          // Prompt user to fill missing fields before address autocomplete
          alert('Vul eerst uw voornaam, achternaam en e‑mail in voordat u het adres invult.');
          // Optionally focus the first missing field
          if (!fn) document.getElementById('checkout-firstname')?.focus();
          else if (!ln) document.getElementById('checkout-lastname')?.focus();
          else if (!email) document.getElementById('checkout-email')?.focus();
        }
      }, { once: true });
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width, height;
    let particles = [];
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
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
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
      requestAnimationFrame(animate);
    }

    resize();
    initParticles();
    animate();
    window.addEventListener('resize', () => { resize(); initParticles(); });
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
  // PRODUCT DATABASE - Used for related products carousel
  // ==========================================
  var PRODUCTS = [
    {name:'The Unfazed Fighter', page:'combat-unfazed-fighter.html', img:'media/stikkers/2026/batch1/combat Legends/unfazed-fighter-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Iron Discipline', page:'combat-iron-discipline.html', img:'media/stikkers/2026/batch1/combat Legends/iron-discipline-boxing-legend-mural.png', cat:'Combat Legends'},
    {name:'The Beast Within', page:'combat-beast-within.html', img:'media/stikkers/2026/batch1/combat Legends/power-beast-boxing-legend-mural.png', cat:'Combat Legends'},
    {name:'The Stone Face', page:'combat-stone-face.html', img:'media/stikkers/2026/batch1/combat Legends/stone-face-chama-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'The Grind Cycle', page:'combat-grind-cycle.html', img:'media/stikkers/2026/batch 3/Combat Legends/grind-cycle-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Unstoppable Will', page:'combat-unstoppable-will.html', img:'media/stikkers/2026/batch 3/Combat Legends/unstoppable-will-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Dream Reality', page:'combat-dream-reality.html', img:'media/stikkers/2026/batch 3/Combat Legends/dream-reality-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Courageous Risk', page:'combat-courageous-risk.html', img:'media/stikkers/2026/batch 3/Combat Legends/courageous-risk-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'The Greatest Courage', page:'combat-greatest-courage.html', img:'media/stikkers/2026/batch 3/Combat Legends/greatest-courage-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Beyond Pop Music', page:'music-beyond-pop-music.html', img:'media/stikkers/2026/batch1/Music Legends/beyond-pop-music-icon-legend-mural.png', cat:'Music Legends'},
    {name:'Creative Vision', page:'music-creative-vision.html', img:'media/stikkers/2026/batch1/Music Legends/creative-vision-music-legend-mural.png', cat:'Music Legends'},
    {name:'Eternal Will', page:'music-eternal-will.html', img:'media/stikkers/2026/batch1/Music Legends/eternal-will-rap-legend-mural.png', cat:'Music Legends'},
    {name:'Mental Freedom', page:'music-mental-freedom.html', img:'media/stikkers/2026/batch1/Music Legends/mental-freedom-reggae-legend-mural.png', cat:'Music Legends'},
    {name:'Pure Soul', page:'music-pure-soul.html', img:'media/stikkers/2026/batch1/Music Legends/pure-soul-purple-music-legend-mural.png', cat:'Music Legends'},
    {name:'Rebel Spirit', page:'music-rebel-spirit.html', img:'media/stikkers/2026/batch1/Music Legends/rebel-spirit-music-icon-legend-mural.png', cat:'Music Legends'},
    {name:'Respect Code', page:'music-respect-code.html', img:'media/stikkers/2026/batch1/Music Legends/respect-code-color-legend-mural.png', cat:'Music Legends'},
    {name:'Respect Code Green', page:'music-respect-code-green.html', img:'media/stikkers/2026/batch1/Music Legends/respect-code-green-legend-mural.jpg.png', cat:'Music Legends'},
    {name:'West Coast Loyalty', page:'music-west-coast-loyalty.html', img:'media/stikkers/2026/batch1/Music Legends/west-coast-loyalty-color-legend-mural.png', cat:'Music Legends'},
    {name:'West Coast Loyalty Grey', page:'music-west-coast-loyalty-grey.html', img:'media/stikkers/2026/batch1/Music Legends/west-coast-loyalty-grey-legend-mural.png', cat:'Music Legends'},
    {name:'Constant Evolution', page:'music-constant-evolution.html', img:'media/stikkers/2026/batch 3/Music Legends/constant-evolution-music-legend-mural.png', cat:'Music Legends'},
    {name:'Eternal Smile', page:'music-eternal-smile.html', img:'media/stikkers/2026/batch 3/Music Legends/eternal-smile-music-legend-mural.png', cat:'Music Legends'},
    {name:'Lyric Mastery', page:'music-lyric-mastery.html', img:'media/stikkers/2026/batch 3/Music Legends/lyric-mastery-music-legend-mural.png', cat:'Music Legends'},
    {name:'Pure Confidence', page:'music-pure-confidence.html', img:'media/stikkers/2026/batch 3/Music Legends/pure-confidence-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Style Code', page:'music-style-code.html', img:'media/stikkers/2026/batch 3/Music Legends/style-code-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Free Spirit', page:'music-free-spirit.html', img:'media/stikkers/2026/batch 3/Music Legends/free-spirit-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Truth Seeker', page:'music-truth-seeker.html', img:'media/stikkers/2026/batch 3/Music Legends/truth-seeker-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Style Prophet', page:'music-style-prophet.html', img:'media/stikkers/2026/batch 3/Music Legends/style-prophet-music-legend-mural.png', cat:'Music Legends'},
    {name:'Clutch Player', page:'sport-clutch-player.html', img:'media/stikkers/2026/batch1/Sport Legends/clutch-player-basketball-legend-mural.png', cat:'Sport Legends'},
    {name:'Game Changer', page:'sport-game-changer.html', img:'media/stikkers/2026/batch1/Sport Legends/game-changer-art-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'King of Pitch', page:'sport-king-of-pitch.html', img:'media/stikkers/2026/batch1/Sport Legends/king-of-pitch-football-legend-mural.png', cat:'Sport Legends'},
    {name:'Winners Mindset', page:'sport-winners-mindset.html', img:'media/stikkers/2026/batch1/Sport Legends/winners-mindset-basketball-legend-mural.png', cat:'Sport Legends'},
    {name:'Unstoppable Will Sport', page:'sport-unstoppable-will.html', img:'media/stikkers/2026/batch 3/Sport Legends/unstoppable-will-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Peak Performer', page:'sport-peak-performer.html', img:'media/stikkers/2026/batch 3/Sport Legends/peak-performer-sport-legend-mural.png', cat:'Sport Legends'},
    {name:"The Lion's Pride", page:'sport-lions-pride.html', img:'media/stikkers/2026/batch 3/Sport Legends/lions-pride-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Luxury Standard', page:'sport-luxury-standard.html', img:'media/stikkers/2026/batch 3/Sport Legends/football-luxury-performance-legend-mural.png', cat:'Sport Legends'},
    {name:'Mamba Mindset', page:'sport-mamba-mindset.html', img:'media/stikkers/2026/batch 3/Sport Legends/mamba-mindset-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Pursuit of Greatness', page:'sport-pursuit-greatness.html', img:'media/stikkers/2026/batch 3/Sport Legends/pursuit-greatness-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Unforgettable Roots', page:'sport-unforgettable-roots.html', img:'media/stikkers/2026/batch 3/Sport Legends/unforgettable-roots-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Material Illusion', page:'wisdom-material-illusion.html', img:'media/stikkers/2026/batch1/Wisdom Legends/material-illusion-mindset-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Rule Breaker', page:'wisdom-rule-breaker.html', img:'media/stikkers/2026/batch1/Wisdom Legends/rule-breaker-mindset-legend-mural.png', cat:'Wisdom Legends'},
  ];

  // ==========================================
  // RELATED PRODUCTS CAROUSEL
  // ==========================================
  function initRelatedProducts() {
    var el = document.getElementById('related-carousel');
    if (!el) return;
    var currentName = el.dataset.currentProduct;
    if (!currentName) return;

    // Find current product's category
    var currentCat = '';
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].name === currentName) {
        currentCat = PRODUCTS[i].cat;
        break;
      }
    }
    if (!currentCat) return;

    // Collect other products from same category
    var related = [];
    for (var j = 0; j < PRODUCTS.length; j++) {
      if (PRODUCTS[j].cat === currentCat && PRODUCTS[j].name !== currentName) {
        related.push(PRODUCTS[j]);
      }
    }
    if (related.length === 0) return;

    // Inject responsive CSS for carousel items
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

    // Build HTML
    var html = '';
    for (var k = 0; k < related.length; k++) {
      var p = related[k];
      html += '<a href="' + p.page + '" class="inline-block flex-none snap-start group related-carousel-item">';
      html += '<div class="aspect-[4/3] rounded-xl overflow-hidden border border-surface-border/30 mb-2 bg-neutral-200">';
      html += '<img src="' + p.img + '" alt="' + p.name + '" class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" loading="lazy">';
      html += '</div>';
      html += '<p class="text-sm text-text-secondary group-hover:text-mint transition-colors truncate">' + p.name + '</p>';
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

    // ---- Smooth scroll helper with easing ----
    function smoothScrollTo(targetX, duration) {
      if (!track) return;
      duration = duration || 800;
      var start = track.scrollLeft;
      var distance = targetX - start;
      if (Math.abs(distance) < 1) return;
      var startTime = null;
      function ease(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; } // easeInOutQuad
      function step(ts) {
        if (!startTime) startTime = ts;
        var elapsed = ts - startTime;
        var progress = Math.min(elapsed / duration, 1);
        track.scrollLeft = start + distance * ease(progress);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // Wire up scroll buttons
    var track = el.querySelector('.related-track');
    var prev = el.querySelector('.related-prev');
    var next = el.querySelector('.related-next');
    if (track && prev) {
      prev.addEventListener('click', function(e) {
        e.stopPropagation();
        var target = track.scrollLeft - track.clientWidth * 0.66;
        smoothScrollTo(target, 600);
      });
    }
    if (track && next) {
      next.addEventListener('click', function(e) {
        e.stopPropagation();
        var target = track.scrollLeft + track.clientWidth * 0.66;
        smoothScrollTo(target, 600);
      });
    }

    // ---- Auto-scroll with requestAnimationFrame ----
    var autoTimer = null;
    var autoActive = false;
    function doAutoScroll() {
      if (!track || !autoActive) return;
      var maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 1) { autoActive = false; return; }
      
      var target = track.scrollLeft + track.clientWidth * 0.66;
      if (target >= maxScroll - 5) target = 0;
      
      smoothScrollTo(target, 900);
      
      // Schedule next after scroll duration + idle time
      setTimeout(function() { doAutoScroll(); }, 900 + 3000);
    }
    function startAutoScroll() {
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
      autoActive = true;
      // First scroll after a small delay
      autoTimer = setTimeout(function() { doAutoScroll(); }, 1500);
    }
    function stopAutoScroll() {
      autoActive = false;
      if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    }
    // Start auto-scroll after layout settles
    setTimeout(startAutoScroll, 600);
    // Pause on hover/touch
    track.addEventListener('mouseenter', stopAutoScroll);
    track.addEventListener('mouseleave', startAutoScroll);
    track.addEventListener('touchstart', stopAutoScroll, {passive:true});
    track.addEventListener('touchend', startAutoScroll);
    // Pause on manual arrow click
    if (prev) prev.addEventListener('click', stopAutoScroll);
    if (next) next.addEventListener('click', stopAutoScroll);
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
  function init() {
    loadCart();  // Restore cart from localStorage
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
        {name:'Iron Soul', page:'combat-iron-soul-combat-legend-mural.html', img:'media/stikkers/2026/Batch2/combat Legends/iron-soul-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Dreamers\' Reality', page:'music-dreamers-reality-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/dreamers-reality-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Hidden Truth', page:'music-hidden-truth-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/hidden-truth-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Eternal Bond', page:'music-homie-bond-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/homie-bond-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Hustler\'s Mindset', page:'music-hustler-mind-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/hustler-mind-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Royal Groove', page:'music-kings-groove-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/kings-groove-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Living Truth', page:'music-living-truth-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/living-truth-music-legend-mural.png', cat:'Music Legends'},
    {name:'Mental Liberation', page:'music-mental-liberation-reggae-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/mental-liberation-reggae-legend-mural.png', cat:'Music Legends'},
    {name:'The Timeless Icon', page:'music-timeless-icon-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/timeless-icon-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Unbothered Mind', page:'music-unbothered-mind-music-legend-mural.html', img:'media/stikkers/2026/Batch2/Music Legends/unbothered-mind-music-legend-mural.png', cat:'Music Legends'},
    {name:'Beyond Possible', page:'sport-beyond-possible-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/beyond-possible-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Court Dominance', page:'sport-court-dominance-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/court-dominance-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Divine Touch', page:'sport-divine-touch-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/divine-touch-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Hand of Destiny', page:'sport-hand-of-destiny-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/hand-of-destiny-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Relentless Spirit', page:'sport-relentless-spirit-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/relentless-spirit-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Silent Answer', page:'sport-silent-answer-sport-legend-mural.html', img:'media/stikkers/2026/Batch2/Sport Legends/silent-answer-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Absolute Freedom', page:'wisdom-absolute-freedom-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch2/Wisdom Legends/absolute-freedom-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Chaos Theory', page:'wisdom-chaos-theory-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch2/Wisdom Legends/chaos-theory-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Total Liberation', page:'wisdom-total-liberation-mindset-legend-mural.html', img:'media/stikkers/2026/Batch2/Wisdom Legends/total-liberation-mindset-legend-mural.png', cat:'Wisdom Legends'},
    {name:'True Freedom', page:'wisdom-true-freedom-mindset-legend-mural.html', img:'media/stikkers/2026/Batch2/Wisdom Legends/true-freedom-mindset-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Total Ownership', page:'combat-total-ownership-combat-legend-mural.html', img:'media/stikkers/2026/Batch 4/combat Legends/total-ownership-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'The Fearless Challenger', page:'combat-fearless-challenger-combat-legend-mural.html', img:'media/stikkers/2026/Batch 4/combat Legends/fearless-challenger-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Inner Vision', page:'combat-inner-vision-combat-legend-mural.html', img:'media/stikkers/2026/Batch 4/combat Legends/inner-vision-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'The Balanced Mind', page:'combat-balanced-mind-combat-legend-mural.html', img:'media/stikkers/2026/Batch 4/combat Legends/balanced-mind-combat-legend-mural.png', cat:'Combat Legends'},
    {name:'Daily Blessing', page:'music-daily-blessing-music-legend-mural.html', img:'media/stikkers/2026/Batch 4/Music Legends/daily-blessing-music-legend-mural.png', cat:'Music Legends'},
    {name:'The Beautiful Choice', page:'music-beautiful-world-music-legend-mural.html', img:'media/stikkers/2026/Batch 4/Music Legends/beautiful-world-music-legend-mural.png', cat:'Music Legends'},
    {name:'Grateful Spirit', page:'music-grateful-spirit-music-legend-mural.html', img:'media/stikkers/2026/Batch 4/Music Legends/grateful-spirit-music-legend-mural.png', cat:'Music Legends'},
    {name:'Eternal Respect', page:'sport-respect-and-dignity-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/respect-and-dignity-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Pure Instinct', page:'sport-intuitive-wisdom-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/intuitive-wisdom-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Reward of Effort', page:'sport-hard-work-reward-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/hard-work-reward-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Rising from Failure', page:'sport-failure-into-triumph-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/failure-into-triumph-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Pressure into Power', page:'sport-pressure-into-power-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/pressure-into-power-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Fearless Respect', page:'sport-fearless-respect-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/fearless-respect-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Dreamer\'s Sacrifice', page:'sport-sacrifice-for-dreams-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/sacrifice-for-dreams-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Silent Confidence', page:'sport-supreme-confidence-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/supreme-confidence-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Beyond Fear', page:'sport-overcoming-fear-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/overcoming-fear-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Unstoppable Will', page:'sport-unstoppable-will-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/unstoppable-will-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'The Height of Success', page:'sport-height-of-success-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/height-of-success-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Dedicated Vision', page:'sport-dedicated-vision-sport-legend-mural.html', img:'media/stikkers/2026/Batch 4/Sport Legends/dedicated-vision-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Timeless Truth', page:'music-truth-runs-marathons-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/truth-runs-marathons-music-legend-mural.png', cat:'Music Legends'},
    {name:'Visionary Reality', page:'music-making-dreams-real-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/making-dreams-real-music-legend-mural.png', cat:'Music Legends'},
    {name:'Dreaming in Motion', page:'music-dreaming-in-motion-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/dreaming-in-motion-music-legend-mural.png', cat:'Music Legends'},
    {name:'Natural Integrity', page:'music-natural-integrity-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/natural-integrity-music-legend-mural.png', cat:'Music Legends'},
    {name:'Heart of Gold', page:'music-heart-of-gold-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/heart-of-gold-music-legend-mural.png', cat:'Music Legends'},
    {name:'Unwavering Spirit', page:'music-unwavering-spirit-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/unwavering-spirit-music-legend-mural.png', cat:'Music Legends'},
    {name:'Eternal Blessing', page:'music-eternal-blessing-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/eternal-blessing-music-legend-mural.png', cat:'Music Legends'},
    {name:'Quiet Wisdom', page:'music-quiet-wisdom-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/quiet-wisdom-music-legend-mural.png', cat:'Music Legends'},
    {name:'Radiant Autonomy', page:'music-radiant-autonomy-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/radiant-autonomy-music-legend-mural.png', cat:'Music Legends'},
    {name:'Noble Legacy', page:'music-noble-legacy-music-legend-mural.html', img:'media/stikkers/2026/Batch 5/Music Legends/noble-legacy-music-legend-mural.png', cat:'Music Legends'},
    {name:'Unstoppable Resilience', page:'sport-unstoppable-resilience-sport-legend-mural.html', img:'media/stikkers/2026/Batch 5/Sport Legends/unstoppable-resilience-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Simple Wisdom', page:'sport-simple-wisdom-sport-legend-mural.html', img:'media/stikkers/2026/Batch 5/Sport Legends/simple-wisdom-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Pure Ambition', page:'sport-pure-ambition-sport-legend-mural.html', img:'media/stikkers/2026/Batch 5/Sport Legends/pure-ambition-sport-legend-mural.png', cat:'Sport Legends'},
    {name:'Independent Spirit', page:'wisdom-independent-spirit-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/independent-spirit-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Boundless Ambition', page:'wisdom-boundless-ambition-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/boundless-ambition-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Creative Integrity', page:'wisdom-creative-integrity-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/creative-integrity-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Original Vision', page:'wisdom-original-vision-wisdom-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/original-vision-wisdom-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Unyielding Drive', page:'wisdom-unyielding-drive-combat-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/unyielding-drive-combat-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Relentless Power', page:'wisdom-relentless-power-combat-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/relentless-power-combat-legend-mural.png', cat:'Wisdom Legends'},
    {name:'Consistent Excellence', page:'wisdom-consistent-excellence-combat-legend-mural.html', img:'media/stikkers/2026/Batch 5/Wisdom Legends/consistent-excellence-combat-legend-mural.png', cat:'Wisdom Legends'},
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


  // Expose for inline onclick
  window.legendApp = {
    updateQty: updateCartQuantity,
    removeItem: removeFromCart,
    addProduct: addToCart,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
