import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const EXPECTED_PURCHASE_SURFACES = 118;
const PRESENTATION_MANIFEST = /2026-batch-\d+-presentation\.json$/;

function replaceOnce(source, from, to, label) {
  const occurrences = source.split(from).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly one occurrence, found ${occurrences}`);
  }
  return source.replace(from, to);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one occurrence, found ${matches.length}`);
  }
  return source.replace(pattern, replacement);
}

function countMatches(source, pattern) {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
}

function migrateApp(source) {
  let app = source;

  app = replaceOnce(
    app,
    "  return productCardNavigationModulePromise;\n}\n\n  function getCommerceTotals",
    "  return productCardNavigationModulePromise;\n}\n\nlet dialogAccessibilityModule = null;\nlet dialogAccessibilityModulePromise = null;\nlet cartDialogController = null;\nlet checkoutDialogController = null;\n\nfunction loadDialogAccessibilityModule() {\n  if (!dialogAccessibilityModulePromise) {\n    dialogAccessibilityModulePromise = import('./dialog-accessibility.mjs')\n      .then((module) => {\n        dialogAccessibilityModule = module;\n        return module;\n      });\n  }\n  return dialogAccessibilityModulePromise;\n}\n\n  function getCommerceTotals",
    'dialog accessibility module loader',
  );

  app = replaceOnce(
    app,
    "    checkoutOverlay: document.getElementById('checkout-overlay'),\n    mobileMenuBtn:",
    "    checkoutOverlay: document.getElementById('checkout-overlay'),\n    purchaseFeedback: document.getElementById('purchase-feedback'),\n    mobileMenuBtn:",
    'purchase feedback DOM reference',
  );

  app = replaceOnce(
    app,
    "    testimonialDots: document.querySelectorAll('.testimonial-dot'),\n  };\n\n  // ==========================================\n  // CART FUNCTIONS",
    "    testimonialDots: document.querySelectorAll('.testimonial-dot'),\n  };\n\n  let purchaseFeedbackTimer = null;\n\n  function announcePurchaseFeedback(message, { assertive = false, focusTarget = null, duration = 6000 } = {}) {\n    const feedback = dom.purchaseFeedback || document.getElementById('purchase-feedback');\n    if (feedback) {\n      if (purchaseFeedbackTimer) clearTimeout(purchaseFeedbackTimer);\n      feedback.setAttribute('role', assertive ? 'alert' : 'status');\n      feedback.setAttribute('aria-live', assertive ? 'assertive' : 'polite');\n      feedback.textContent = message;\n      feedback.classList.remove('hidden', 'border-red-400/40', 'text-red-300', 'border-mint/40', 'text-mint');\n      feedback.classList.add(assertive ? 'border-red-400/40' : 'border-mint/40');\n      feedback.classList.add(assertive ? 'text-red-300' : 'text-mint');\n      if (duration > 0) {\n        purchaseFeedbackTimer = setTimeout(() => feedback.classList.add('hidden'), duration);\n      }\n    } else if (assertive) {\n      console.warn(message);\n    }\n    if (focusTarget?.focus) focusTarget.focus({ preventScroll: true });\n  }\n\n  // ==========================================\n  // CART FUNCTIONS",
    'purchase feedback helper',
  );

  app = replaceRegexOnce(
    app,
    /  function openCart\(\) \{[\s\S]*?\n  \}\n\n  function closeCart\(\) \{[\s\S]*?\n  \}\n\n  function formatPrice/,
    `  function openCart() {
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

  function formatPrice`,
    'cart dialog lifecycle',
  );

  app = replaceOnce(
    app,
    "    closeCart();\n    const drawer = dom.checkoutDrawer;\n    const overlay = dom.checkoutOverlay;\n    if (!drawer || !overlay) {\n      return;\n    }\n    overlay.classList.remove('hidden');\n    overlay.setAttribute('aria-hidden', 'false');\n    drawer.classList.remove('translate-x-full');\n    drawer.setAttribute('aria-hidden', 'false');\n    document.body.style.overflow = 'hidden';\n\n    validatedAddress = null;",
    "    closeCart({ restoreFocus: false });\n    const drawer = dom.checkoutDrawer;\n    const overlay = dom.checkoutOverlay;\n    if (!drawer || !overlay) {\n      return;\n    }\n    if (dom.checkoutBtn) dom.checkoutBtn.setAttribute('aria-expanded', 'true');\n    if (checkoutDialogController) {\n      checkoutDialogController.open({\n        trigger: dom.cartBtn,\n        initialFocus: document.getElementById('checkout-close'),\n      });\n    } else {\n      overlay.classList.remove('hidden');\n      overlay.setAttribute('aria-hidden', 'false');\n      drawer.classList.remove('translate-x-full');\n      drawer.setAttribute('aria-hidden', 'false');\n      document.body.style.overflow = 'hidden';\n    }\n\n    validatedAddress = null;",
    'checkout open lifecycle',
  );

  app = replaceRegexOnce(
    app,
    /  function closeCheckoutModal\(\) \{[\s\S]*?\n  \}\n\n  function updateCheckoutTotals/,
    `  function closeCheckoutModal({ restoreFocus = true } = {}) {
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

  function updateCheckoutTotals`,
    'checkout close lifecycle',
  );

  app = replaceOnce(
    app,
    "      updateCheckoutTotals();\n      renderCart();\n      return true;",
    "      updateCheckoutTotals();\n      renderCart();\n      announcePurchaseFeedback(percent + '% discount applied.');\n      return true;",
    'discount success feedback',
  );
  app = replaceOnce(
    app,
    "      updateCheckoutTotals();\n      return false;",
    "      updateCheckoutTotals();\n      announcePurchaseFeedback('Invalid discount code.', { assertive: true });\n      return false;",
    'discount error feedback',
  );

  app = replaceOnce(
    app,
    "    if (!firstname || !lastname || !email || !street || !zip || !city || !country) {\n      alert('Please fill in all required fields.');\n      return;\n    }",
    "    if (!firstname || !lastname || !email || !street || !zip || !city || !country) {\n      const firstMissing = [\n        ['checkout-firstname', firstname],\n        ['checkout-lastname', lastname],\n        ['checkout-email', email],\n        ['checkout-street', street],\n        ['checkout-zip', zip],\n        ['checkout-city', city],\n        ['checkout-country', country],\n      ].find(([, value]) => !value);\n      announcePurchaseFeedback('Please fill in all required fields.', {\n        assertive: true,\n        focusTarget: firstMissing ? document.getElementById(firstMissing[0]) : null,\n      });\n      return;\n    }",
    'required checkout feedback',
  );
  app = replaceOnce(
    app,
    "    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n      alert('Please enter a valid email address.');\n      return;\n    }",
    "    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {\n      announcePurchaseFeedback('Please enter a valid email address.', {\n        assertive: true,\n        focusTarget: document.getElementById('checkout-email'),\n      });\n      return;\n    }",
    'email validation feedback',
  );
  app = replaceOnce(
    app,
    "        if (err) {\n          alert(err);\n          document.getElementById('checkout-street').focus();\n          return;\n        }",
    "        if (err) {\n          announcePurchaseFeedback(err, {\n            assertive: true,\n            focusTarget: document.getElementById('checkout-street'),\n          });\n          return;\n        }",
    'address validation feedback',
  );
  app = replaceOnce(
    app,
    "      alert('Your saved cart uses an outdated product format. Please clear the cart and add the products again.');",
    "      announcePurchaseFeedback('Your saved cart uses an outdated product format. Please clear the cart and add the products again.', { assertive: true });",
    'outdated cart feedback',
  );
  app = replaceOnce(
    app,
    "      alert('Order ready! Secure online payment is not enabled on this deployment yet.\\n\\nSubtotal: ' + formatPrice(totals.subtotal) + '\\nDiscount (' + state.discountPercent + '%): -' + formatPrice(totals.discount) + '\\nShipping to ' + totals.zone.name + ': ' + (totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)) + '\\nTotal: ' + formatPrice(totals.grandTotal));",
    "      announcePurchaseFeedback('Order ready. Secure online payment is not enabled on this deployment yet. Total: ' + formatPrice(totals.grandTotal) + '.', { assertive: true, duration: 12000 });",
    'inactive checkout feedback',
  );
  app = replaceOnce(
    app,
    "      alert('Secure payment could not be started. Your cart is still saved. Please try again.');",
    "      announcePurchaseFeedback('Secure payment could not be started. Your cart is still saved. Please try again.', { assertive: true });",
    'hosted checkout failure feedback',
  );
  app = replaceOnce(
    app,
    "          alert('This product could not be added safely. Please open its product page and try again.');",
    "          announcePurchaseFeedback('This product could not be added safely. Please open its product page and try again.', { assertive: true });",
    'unsafe add-to-cart feedback',
  );

  app = replaceOnce(
    app,
    "    document.addEventListener('keydown', (e) => {\n      if (e.key === 'Escape') {\n        if (state.cartOpen) closeCart();\n        if (state.mobileMenuOpen) closeMobileMenu();\n        closeCheckoutModal();\n      }\n    });",
    "    document.addEventListener('keydown', (e) => {\n      if (e.key === 'Escape' && state.mobileMenuOpen) closeMobileMenu();\n    });",
    'central Escape ownership',
  );

  app = replaceOnce(
    app,
    "          // Prompt user to fill missing fields before address autocomplete\n          alert('Vul eerst uw voornaam, achternaam en e‑mail in voordat u het adres invult.');\n          // Optionally focus the first missing field\n          if (!fn) document.getElementById('checkout-firstname')?.focus();\n          else if (!ln) document.getElementById('checkout-lastname')?.focus();\n          else if (!email) document.getElementById('checkout-email')?.focus();",
    "          const firstMissing = !fn\n            ? document.getElementById('checkout-firstname')\n            : !ln\n              ? document.getElementById('checkout-lastname')\n              : document.getElementById('checkout-email');\n          announcePurchaseFeedback('Fill in your first name, last name and email before entering the address.', {\n            assertive: true,\n            focusTarget: firstMissing,\n          });",
    'address autocomplete prerequisite feedback',
  );

  app = replaceOnce(
    app,
    "    await loadProductCardNavigationModule();\n    const fns = [",
    "    await loadProductCardNavigationModule();\n    await loadDialogAccessibilityModule();\n    if (dom.cartDrawer && dom.cartOverlay) {\n      cartDialogController = dialogAccessibilityModule.createDialogController({\n        dialog: dom.cartDrawer,\n        overlay: dom.cartOverlay,\n        documentRef: document,\n        onRequestClose: closeCart,\n      });\n    }\n    if (dom.checkoutDrawer && dom.checkoutOverlay) {\n      checkoutDialogController = dialogAccessibilityModule.createDialogController({\n        dialog: dom.checkoutDrawer,\n        overlay: dom.checkoutOverlay,\n        documentRef: document,\n        onRequestClose: closeCheckoutModal,\n      });\n    }\n    const fns = [",
    'dialog controller initialization',
  );

  return app;
}

function migratePurchaseSurface(source, name) {
  let html = source;
  html = replaceOnce(
    html,
    'aria-label="Cart" aria-hidden="true"',
    'aria-modal="true" aria-label="Cart" aria-hidden="true" data-focus-managed="true" tabindex="-1"',
    `${name}: cart modal semantics`,
  );
  html = replaceOnce(
    html,
    'aria-label="Shipping address" aria-hidden="true"',
    'aria-modal="true" aria-label="Shipping address" aria-hidden="true" data-focus-managed="true" tabindex="-1"',
    `${name}: checkout modal semantics`,
  );
  html = replaceOnce(
    html,
    'aria-label="Cart">',
    'aria-label="Cart" aria-controls="cart-drawer" aria-expanded="false">',
    `${name}: cart trigger relationship`,
  );
  html = replaceOnce(
    html,
    'disabled id="checkout-btn">',
    'disabled id="checkout-btn" aria-controls="checkout-drawer" aria-expanded="false">',
    `${name}: checkout trigger relationship`,
  );
  html = replaceOnce(
    html,
    'id="checkout-close" class="p-2 rounded-lg hover:bg-surface-light transition-colors" aria-label="Close">',
    'id="checkout-close" class="p-2 rounded-lg hover:bg-surface-light transition-colors" aria-label="Close checkout">',
    `${name}: checkout close name`,
  );
  html = replaceOnce(
    html,
    '  <!-- CART DRAWER -->',
    '  <div id="purchase-feedback" class="fixed left-1/2 bottom-6 -translate-x-1/2 z-[80] hidden max-w-[calc(100%-2rem)] rounded-xl border bg-surface px-4 py-3 text-sm font-medium shadow-lg" role="status" aria-live="polite" aria-atomic="true"></div>\n\n  <!-- CART DRAWER -->',
    `${name}: purchase feedback live region`,
  );

  const footerHeadingPattern = /<h4 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary mb-4">([\s\S]*?)<\/h4>/g;
  const footerHeadings = countMatches(html, footerHeadingPattern);
  if (footerHeadings !== 3) {
    throw new Error(`${name}: expected three footer h4 headings, found ${footerHeadings}`);
  }
  html = html.replace(footerHeadingPattern, '<h3 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary mb-4">$1</h3>');
  return html;
}

async function main() {
  const appPath = join(ROOT, 'js', 'app.js');
  await writeFile(appPath, migrateApp(await readFile(appPath, 'utf8')), 'utf8');

  const rootEntries = await readdir(ROOT, { withFileTypes: true });
  const htmlFiles = rootEntries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => entry.name)
    .sort();

  let purchaseSurfaces = 0;
  for (const file of htmlFiles) {
    const path = join(ROOT, file);
    const html = await readFile(path, 'utf8');
    if (!/id=["']checkout-drawer["']/i.test(html)) continue;
    purchaseSurfaces += 1;
    await writeFile(path, migratePurchaseSurface(html, file), 'utf8');
  }
  if (purchaseSurfaces !== EXPECTED_PURCHASE_SURFACES) {
    throw new Error(`Expected ${EXPECTED_PURCHASE_SURFACES} purchase surfaces, found ${purchaseSurfaces}`);
  }

  const templatePath = join(ROOT, 'templates', 'product-page.html');
  const template = migratePurchaseSurface(await readFile(templatePath, 'utf8'), 'templates/product-page.html');
  await writeFile(templatePath, template, 'utf8');

  const templateHash = createHash('sha256').update(template).digest('hex');
  const productDir = join(ROOT, 'data', 'products');
  const manifests = (await readdir(productDir))
    .filter((name) => PRESENTATION_MANIFEST.test(name))
    .sort();
  if (manifests.length !== 6) throw new Error(`Expected six presentation manifests, found ${manifests.length}`);
  for (const name of manifests) {
    const path = join(productDir, name);
    const manifest = JSON.parse(await readFile(path, 'utf8'));
    manifest.template.sha256 = templateHash;
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  const auditPath = join(ROOT, 'scripts', 'accessibility-purchase-flow-audit.mjs');
  let audit = await readFile(auditPath, 'utf8');
  audit = replaceOnce(
    audit,
    "    issues.push(issue(page, 'review', 'dialog-focus-lifecycle', 'Verify focus entry, focus containment, Escape handling and focus restoration for this dialog.', signature));",
    "    if (attributes['data-focus-managed'] !== 'true') {\n      issues.push(issue(page, 'review', 'dialog-focus-lifecycle', 'Verify focus entry, focus containment, Escape handling and focus restoration for this dialog.', signature));\n    }",
    'accessibility audit focus contract',
  );
  await writeFile(auditPath, audit, 'utf8');

  console.log(`Dialog accessibility migration applied to ${purchaseSurfaces} purchase surfaces; template hash ${templateHash}.`);
}

main().catch((error) => {
  console.error('Dialog accessibility migration failed:', error);
  process.exit(1);
});
