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
  };

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

  function addToCart(name, price, emoji) {
    const product = {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      price: parseFloat(price),
      quantity: 1,
      image: emoji || '🎨',
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

  function renderCart() {
    if (!dom.cartItems) return;
    if (state.cart.length === 0) {
      dom.cartItems.innerHTML = '<div class="text-center py-12"><div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg></div><p class="text-text-secondary font-medium">Je winkelwagen is leeg</p><p class="text-text-muted text-sm mt-1">Voeg items toe om te beginnen</p></div>';
      if (dom.cartTotal) dom.cartTotal.textContent = '€0,00';
      if (dom.checkoutBtn) dom.checkoutBtn.disabled = true;
      return;
    }
    if (dom.checkoutBtn) dom.checkoutBtn.disabled = false;
    if (dom.cartTotal) dom.cartTotal.textContent = formatPrice(getCartTotal());
    dom.cartItems.innerHTML = state.cart.map((item, i) => '<div class="flex gap-4 mb-4 p-3 rounded-xl bg-surface-light/50 border border-surface-border/30"><div class="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-2xl shrink-0">' + item.image + '</div><div class="flex-1 min-w-0"><p class="text-sm font-medium text-text-primary truncate">' + item.name + '</p><div class="flex items-center justify-between mt-2"><div class="flex items-center gap-2"><button onclick="window.legendApp.updateQty(' + i + ',-1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-gold transition-colors">−</button><span class="text-sm text-text-primary min-w-[20px] text-center">' + item.quantity + '</span><button onclick="window.legendApp.updateQty(' + i + ',1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-gold transition-colors">+</button></div><div class="flex items-center gap-3"><span class="text-sm font-medium text-gold">' + formatPrice(item.price * item.quantity) + '</span><button onclick="window.legendApp.removeItem(' + i + ')" class="text-text-muted hover:text-red-400 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div></div></div></div>').join('');
  }

  // ==========================================
  // MOBILE MENU
  // ==========================================
  function toggleMobileMenu() {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    if (dom.mobileMenu) dom.mobileMenu.classList.toggle('hidden');
    if (dom.mobileMenuBtn) dom.mobileMenuBtn.setAttribute('aria-expanded', state.mobileMenuOpen);
  }
  function closeMobileMenu() {
    state.mobileMenuOpen = false;
    if (dom.mobileMenu) dom.mobileMenu.classList.add('hidden');
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
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

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
        dot.classList.toggle('bg-gold', i === index);
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
        const emoji = btn.dataset.emoji;
        addToCart(name, price, emoji);
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Toegevoegd!';
        btn.style.background = '#16a34a';
        setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ''; }, 2000);
      });
    });
  }

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
      }
    });
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    initEventListeners();
    initBeforeAfter();
    initScrollAnimations();
    initTestimonials();
    initFilters();
    initAddToCart();
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
