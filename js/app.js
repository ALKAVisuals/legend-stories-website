/**
 * Legend Murals — Main Application JavaScript
 * Handles: Cart Drawer, Mobile Menu, Size Selector, Quantity, Add to Cart
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
    selectedSize: 'medium',
    selectedPrice: 49.95,
    quantity: 1,
  };

  // ==========================================
  // DOM REFERENCES
  // ==========================================
  const dom = {
    // Cart
    cartBtn: document.getElementById('cart-btn'),
    cartDrawer: document.getElementById('cart-drawer'),
    cartOverlay: document.getElementById('cart-overlay'),
    cartClose: document.getElementById('cart-close'),
    cartItems: document.getElementById('cart-items'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total'),
    checkoutBtn: document.getElementById('checkout-btn'),

    // Mobile Menu
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    mobileMenu: document.getElementById('mobile-menu'),

    // Product Page
    sizeBtns: document.querySelectorAll('.size-btn'),
    qtyDecrease: document.getElementById('qty-decrease'),
    qtyIncrease: document.getElementById('qty-increase'),
    qtyValue: document.getElementById('qty-value'),
    addToCartBtn: document.getElementById('add-to-cart'),
    mobileAddToCartBtn: document.getElementById('mobile-add-to-cart'),
    mobilePrice: document.getElementById('mobile-price'),
  };

  // ==========================================
  // CART FUNCTIONS
  // ==========================================
  function openCart() {
    state.cartOpen = true;
    dom.cartOverlay.classList.remove('hidden');
    dom.cartDrawer.classList.remove('translate-x-full');
    dom.cartDrawer.setAttribute('aria-hidden', 'false');
    dom.cartOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    renderCart();
  }

  function closeCart() {
    state.cartOpen = false;
    dom.cartDrawer.classList.add('translate-x-full');
    dom.cartOverlay.classList.add('hidden');
    dom.cartDrawer.setAttribute('aria-hidden', 'true');
    dom.cartOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function addToCart() {
    const product = {
      id: 'griekse-goden-mural',
      name: 'Griekse Goden Mural',
      size: state.selectedSize,
      sizeLabel: getSizeLabel(state.selectedSize),
      price: state.selectedPrice,
      quantity: state.quantity,
      image: '🔱',
    };

    // Check if same product + size already in cart
    const existingIndex = state.cart.findIndex(
      (item) => item.id === product.id && item.size === product.size
    );

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += product.quantity;
    } else {
      state.cart.push(product);
    }

    updateCartCount();
    openCart();

    // Visual feedback on button
    const btn = dom.addToCartBtn || dom.mobileAddToCartBtn;
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Toegevoegd!
      `;
      btn.classList.add('bg-green-600');
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.classList.remove('bg-green-600');
      }, 2000);
    }
  }

  function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartCount();
    renderCart();
  }

  function updateCartQuantity(index, delta) {
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) {
      removeFromCart(index);
      return;
    }
    renderCart();
    updateCartCount();
  }

  function updateCartCount() {
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    dom.cartCount.textContent = totalItems;
    dom.cartCount.style.opacity = totalItems > 0 ? '1' : '0';
  }

  function getCartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getSizeLabel(size) {
    const labels = {
      small: 'Small (60×80cm)',
      medium: 'Medium (100×140cm)',
      mural: 'Mural (200×280cm)',
    };
    return labels[size] || size;
  }

  function formatPrice(price) {
    return '€' + price.toFixed(2).replace('.', ',');
  }

  function renderCart() {
    if (state.cart.length === 0) {
      dom.cartItems.innerHTML = `
        <div class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-light flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </div>
          <p class="text-text-secondary font-medium">Je winkelwagen is leeg</p>
          <p class="text-text-muted text-sm mt-1">Voeg items toe om te beginnen</p>
        </div>
      `;
      dom.cartTotal.textContent = '€0,00';
      dom.checkoutBtn.disabled = true;
      return;
    }

    dom.checkoutBtn.disabled = false;
    const total = getCartTotal();
    dom.cartTotal.textContent = formatPrice(total);

    dom.cartItems.innerHTML = state.cart
      .map(
        (item, index) => `
        <div class="flex gap-4 mb-4 p-3 rounded-xl bg-surface-light/50 border border-surface-border/30">
          <div class="w-16 h-16 rounded-lg bg-surface flex items-center justify-center text-2xl shrink-0">
            ${item.image}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-text-primary truncate">${item.name}</p>
            <p class="text-xs text-text-muted">${item.sizeLabel}</p>
            <div class="flex items-center justify-between mt-2">
              <div class="flex items-center gap-2">
                <button onclick="window.legendApp.updateQty(${index}, -1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-gold transition-colors text-xs">−</button>
                <span class="text-sm text-text-primary min-w-[20px] text-center">${item.quantity}</span>
                <button onclick="window.legendApp.updateQty(${index}, 1)" class="w-6 h-6 rounded bg-surface flex items-center justify-center text-text-secondary hover:text-gold transition-colors text-xs">+</button>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-sm font-medium text-gold">${formatPrice(item.price * item.quantity)}</span>
                <button onclick="window.legendApp.removeItem(${index})" class="text-text-muted hover:text-red-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `
      )
      .join('');
  }

  // ==========================================
  // MOBILE MENU
  // ==========================================
  function toggleMobileMenu() {
    state.mobileMenuOpen = !state.mobileMenuOpen;
    dom.mobileMenu.classList.toggle('hidden');
    dom.mobileMenuBtn.setAttribute('aria-expanded', state.mobileMenuOpen);
  }

  function closeMobileMenu() {
    state.mobileMenuOpen = false;
    dom.mobileMenu.classList.add('hidden');
    dom.mobileMenuBtn.setAttribute('aria-expanded', 'false');
  }

  // ==========================================
  // SIZE SELECTOR
  // ==========================================
  function selectSize(btn) {
    // Reset all buttons
    dom.sizeBtns.forEach((b) => {
      b.classList.remove('border-2', 'border-gold/50', 'bg-gold/5');
      b.classList.add('border', 'border-surface-border/50', 'bg-surface');
      b.setAttribute('aria-checked', 'false');
      const title = b.querySelector('.font-display');
      if (title) title.classList.remove('text-gold');
    });

    // Set active button
    btn.classList.remove('border', 'border-surface-border/50', 'bg-surface');
    btn.classList.add('border-2', 'border-gold/50', 'bg-gold/5');
    btn.setAttribute('aria-checked', 'true');
    const activeTitle = btn.querySelector('.font-display');
    if (activeTitle) activeTitle.classList.add('text-gold');

    // Update state
    state.selectedSize = btn.dataset.size;
    state.selectedPrice = parseFloat(btn.dataset.price);

    // Update mobile price display
    if (dom.mobilePrice) {
      dom.mobilePrice.textContent = formatPrice(state.selectedPrice);
    }
  }

  // ==========================================
  // QUANTITY
  // ==========================================
  function updateQuantity(delta) {
    state.quantity = Math.max(1, Math.min(10, state.quantity + delta));
    if (dom.qtyValue) {
      dom.qtyValue.textContent = state.quantity;
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================
  function initEventListeners() {
    // Cart
    if (dom.cartBtn) dom.cartBtn.addEventListener('click', openCart);
    if (dom.cartClose) dom.cartClose.addEventListener('click', closeCart);
    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);

    // Mobile Menu
    if (dom.mobileMenuBtn) dom.mobileMenuBtn.addEventListener('click', toggleMobileMenu);

    // Size Selector
    dom.sizeBtns.forEach((btn) => {
      btn.addEventListener('click', () => selectSize(btn));
    });

    // Quantity
    if (dom.qtyDecrease) dom.qtyDecrease.addEventListener('click', () => updateQuantity(-1));
    if (dom.qtyIncrease) dom.qtyIncrease.addEventListener('click', () => updateQuantity(1));

    // Add to Cart
    if (dom.addToCartBtn) dom.addToCartBtn.addEventListener('click', addToCart);
    if (dom.mobileAddToCartBtn) dom.mobileAddToCartBtn.addEventListener('click', addToCart);

    // Close mobile menu on link click
    if (dom.mobileMenu) {
      dom.mobileMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', closeMobileMenu);
      });
    }

    // Keyboard: Escape to close cart/menu
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
    updateCartCount();
  }

  // Expose functions for inline onclick handlers
  window.legendApp = {
    updateQty: updateCartQuantity,
    removeItem: removeFromCart,
  };

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
