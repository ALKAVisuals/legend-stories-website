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
  };

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
    updateCartCount();
    openCart();
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartCount();
    renderCart();
  }

  function updateCartQuantity(index, delta) {
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) { removeFromCart(index); return; }
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
      '<p class="text-[11px] text-text-muted mt-1.5">🚚 Shipping calculated at checkout based on your country. Free shipping available from €50+ (NL) / €75+ (EU) / €150+ (World)</p>' +
      '</div>';

    if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(cartSubtotal);
  }

  // ==========================================
  // CHECKOUT MODAL
  // ==========================================
  function openCheckoutModal() {
    if (state.cart.length === 0) return;
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

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
    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function updateCheckoutTotals() {
    const subtotal = getCartTotal();
    const zone = SHIPPING_ZONES[state.shippingCountry] || SHIPPING_ZONES.OTHER;
    const shipping = subtotal >= zone.freeFrom ? 0 : zone.cost;
    const grandTotal = subtotal + shipping;

    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const grandTotalEl = document.getElementById('checkout-grandtotal');
    const noteEl = document.getElementById('checkout-shipping-note');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (shippingEl) shippingEl.textContent = shipping === 0 ? 'Free' : formatPrice(shipping);
    if (grandTotalEl) grandTotalEl.textContent = formatPrice(grandTotal);
    if (noteEl) {
      if (shipping === 0) {
        noteEl.textContent = '✓ Free shipping to ' + zone.name;
      } else {
        noteEl.textContent = 'Add ' + formatPrice(zone.freeFrom - subtotal) + ' more for free shipping to ' + zone.name;
      }
    }
  }

  let validatedAddress = null;

  function handleCheckoutPay() {
    const firstname = document.getElementById('checkout-firstname')?.value.trim();
    const lastname = document.getElementById('checkout-lastname')?.value.trim();
    const email = document.getElementById('checkout-email')?.value.trim();
    const street = document.getElementById('checkout-street')?.value.trim();
    const zip = document.getElementById('checkout-zip')?.value.trim();
    const city = document.getElementById('checkout-city')?.value.trim();
    const country = document.getElementById('checkout-country')?.value;

    if (!firstname || !lastname || !email || !street || !zip || !city) {
      alert('Please fill in all required fields.');
      return;
    }

    // Email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid email address.');
      return;
    }

    // Address must be selected from Google Places
    if (!validatedAddress) {
      alert('Please select an address from the suggestions. Start typing your street and choose from the dropdown that appears.');
      document.getElementById('checkout-street').focus();
      return;
    }

    // Save order data for Stripe
    // Use validated address country — NOT the dropdown (which could be tampered with)
    const validatedCountry = validatedAddress.country;
    const zone = SHIPPING_ZONES[validatedCountry] || SHIPPING_ZONES.OTHER;
    const subtotal = getCartTotal();
    const shipping = subtotal >= zone.freeFrom ? 0 : zone.cost;

    const orderData = {
      items: state.cart.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
      })),
      customer: { firstname, lastname, email, street: validatedAddress.street, zip: validatedAddress.postal_code, city: validatedAddress.city, country: validatedCountry, formatted: validatedAddress.formatted },
      shipping: { zone: zone.name, cost: shipping },
      subtotal: subtotal,
      total: subtotal + shipping,
    };

    // Store for Stripe redirect
    sessionStorage.setItem('legendOrder', JSON.stringify(orderData));

    // Redirect to Stripe Checkout (placeholder — replace with real Stripe URL)
    // For now, show confirmation
    alert('Order ready! In production this redirects to Stripe Checkout.\n\nTotal: ' + formatPrice(subtotal + shipping) + '\nShipping to: ' + zone.name);
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
      loadGooglePlaces();
    });

    const checkoutCloseBtn = document.getElementById('checkout-modal-close');
    if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);

    const checkoutOverlay = document.getElementById('checkout-modal-overlay');
    if (checkoutOverlay) checkoutOverlay.addEventListener('click', closeCheckoutModal);

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

// ═══════════════════════════════════════════════════════════
// Social Video Showcase v2 — clean rewrite
// ═══════════════════════════════════════════════════════════

function switchVideo(thumb) {
  var videos = getVideoData();
  var index = parseInt(thumb.getAttribute('data-index'), 10);
  if (index < 0 || index >= videos.length) return;

  var video = videos[index];
  socialCurrentIndex = index;
  socialIsPlaying = false;

  // 1. Replace ONLY the blockquote inside the wrap (keep overlay intact)
  var wrap = document.getElementById('social-featured__wrap');
  if (wrap) {
    var oldEmbed = wrap.querySelector('blockquote');
    if (oldEmbed) oldEmbed.remove();
    var embedDiv = document.createElement('div');
    embedDiv.innerHTML = buildEmbedHTML(video);
    wrap.insertBefore(embedDiv.firstChild, wrap.firstChild);
  }

  // 2. Update badge
  updateBadge(video.platform);

  // 3. Reset overlay to visible
  var overlay = document.getElementById('social-overlay');
  if (overlay) overlay.classList.remove('is-hidden');

  // 4. Update active thumbnail
  document.querySelectorAll('.social-thumb').forEach(function(t) {
    t.classList.remove('social-thumb--active');
  });
  thumb.classList.add('social-thumb--active');

  // 5. Load embed script
  loadEmbedScript(video.platform);

  // 6. Reset auto-advance
  resetAutoAdvance();
}

function activateFeatured() {
  var overlay = document.getElementById('social-overlay');
  if (overlay) {
    overlay.classList.add('is-hidden');
    socialIsPlaying = true;
  }
  // Pause auto-advance while playing
  stopAutoAdvance();
}

// Video data from DOM
function getVideoData() {
  var thumbs = document.querySelectorAll('.social-thumb');
  var data = [];
  thumbs.forEach(function(t) {
    data.push({
      url: t.getAttribute('data-url'),
      platform: t.getAttribute('data-platform'),
      videoId: t.getAttribute('data-video-id') || ''
    });
  });
  return data;
}

// Build embed HTML for a given platform
function buildEmbedHTML(video) {
  if (video.platform === 'tiktok') {
    var vid = video.videoId || '';
    return '<blockquote class="tiktok-embed" cite="' + vid + '" data-video-id="' + vid + '" data-embed-from="oembed"><section></section></blockquote>';
  } else {
    return '<blockquote class="instagram-media" data-instgrm-permalink="' + video.url + '" data-instgrm-version="14"><section></section></blockquote>';
  }
}

// Build platform badge HTML
function buildBadgeHTML(platform) {
  if (platform === 'tiktok') {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.73a8.19 8.19 0 004.76 1.52V6.8a4.84 4.84 0 01-1-.11z"/></svg><span>TikTok</span>';
  } else {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 5.775.131 4.66.347 3.726.726c-.934.38-1.738.904-2.532 1.698C.4 3.218-.124 4.022-.504 4.956c-.38.934-.595 2.05-.654 3.327C.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.059 1.277.275 2.393.654 3.327.38.934.904 1.738 1.698 2.532.794.794 1.598 1.318 2.532 1.698.934.38 2.05.595 3.327.654C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.277-.059 2.393-.275 3.327-.654.934-.38 1.738-.904 2.532-1.698.794-.794 1.318-1.598 1.698-2.532.38-.934.595-2.05.654-3.327C23.986 15.667 24 15.259 24 12s-.014-3.667-.072-4.947c-.059-1.277-.275-2.393-.654-3.327-.38-.934-.904-1.738-1.698-2.532-.794-.794-1.598-1.318-2.532-1.698-.934-.38-2.05-.595-3.327-.654C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg><span>Instagram</span>';
  }
}

// Update the platform badge in the overlay
function updateBadge(platform) {
  var badge = document.getElementById('social-platform-badge');
  if (!badge) return;
  badge.className = 'social-featured__badge social-featured__badge--' + platform;
  badge.innerHTML = buildBadgeHTML(platform);
}

// Load platform embed script dynamically
function loadEmbedScript(platform) {
  if (platform === 'tiktok') {
    if (window.tiktokEmbed) {
      try { window.tiktokEmbed.lib.render(); } catch(e) {}
      return;
    }
    var ts = document.createElement('script');
    ts.src = 'https://www.tiktok.com/embed.js';
    ts.async = true;
    document.body.appendChild(ts);
  } else {
    if (window.instgrm) {
      try { window.instgrm.Embeds.process(); } catch(e) {}
      return;
    }
    var ins = document.createElement('script');
    ins.src = 'https://www.instagram.com/embed.js';
    ins.async = true;
    document.body.appendChild(ins);
  }
}

// Auto-advance carousel
var socialAutoAdvance = null;
var socialCurrentIndex = 0;
var socialIsPlaying = false;
var socialAdvanceInterval = 8000; // 8 seconds

function startAutoAdvance() {
  stopAutoAdvance();
  socialAutoAdvance = setInterval(function() {
    if (socialIsPlaying) return;
    var videos = getVideoData();
    if (videos.length === 0) return;
    socialCurrentIndex = (socialCurrentIndex + 1) % videos.length;
    var nextThumb = document.querySelector('.social-thumb[data-index="' + socialCurrentIndex + '"]');
    if (nextThumb) nextThumb.click();
  }, socialAdvanceInterval);
}

function stopAutoAdvance() {
  if (socialAutoAdvance) {
    clearInterval(socialAutoAdvance);
    socialAutoAdvance = null;
  }
}

function resetAutoAdvance() {
  socialIsPlaying = false;
  startAutoAdvance();
}

// Start auto-advance on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startAutoAdvance);
} else {
  startAutoAdvance();
}

// Pause on hover
var showcaseEl = document.getElementById('social-showcase');
if (showcaseEl) {
  showcaseEl.addEventListener('mouseenter', stopAutoAdvance);
  showcaseEl.addEventListener('mouseleave', function() {
    if (!socialIsPlaying) startAutoAdvance();
  });
}

// Pause on touch (mobile)
document.addEventListener('DOMContentLoaded', function() {
  var sc = document.getElementById('social-showcase');
  if (!sc) return;
  sc.addEventListener('touchstart', stopAutoAdvance, { passive: true });
  sc.addEventListener('touchend', function() {
    setTimeout(function() {
      if (!socialIsPlaying) startAutoAdvance();
    }, 3000);
  });
});

function initHoverExpandMobile() {
  // Hover expand gallery for mobile — tap to expand
  // Placeholder: no-op if no gallery elements found
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
  function init() {
    const fns = [
      initStickerClicks,
      initStickerModalClose,
      initEventListeners,
      initBeforeAfter,
      initScrollAnimations,
      initTestimonials,
      initFilters,
      initAddToCart,
      initThemeToggle,
      initGooglePlacesAutocomplete,
      initParticleCanvas,
      initScrollReveal,
      initCarousel,
      initVideoPlayer,
      initHoverExpandMobile,
    ];
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
