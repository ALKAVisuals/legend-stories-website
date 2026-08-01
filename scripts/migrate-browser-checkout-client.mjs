import { readFile, writeFile } from 'node:fs/promises';

const appPath = new URL('../js/app.js', import.meta.url);
let source = await readFile(appPath, 'utf8');

function replaceExactly(before, after, label) {
  if (source.includes(after)) return;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source fragment was not found.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source fragment is not unique.`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceExactly(
  `        import('./commerce/order-request.mjs'),\n      ]).then(([totals, discounts, orderRequest]) => {\n        commerceModule = Object.freeze({ ...totals, ...discounts, ...orderRequest });`,
  `        import('./commerce/order-request.mjs'),\n        import('./commerce/checkout-client.mjs'),\n      ]).then(([totals, discounts, orderRequest, checkoutClient]) => {\n        commerceModule = Object.freeze({\n          ...totals,\n          ...discounts,\n          ...orderRequest,\n          ...checkoutClient,\n        });`,
  'checkout client module loading',
);

const functionStart = "  function processOrder(address, firstname, lastname, email) {";
const nextSection = "\n  // ==========================================\n  // MOBILE MENU";
const startIndex = source.indexOf(functionStart);
const endIndex = source.indexOf(nextSection, startIndex);
if (startIndex < 0 || endIndex < 0) {
  if (!source.includes('async function processOrder(address, firstname, lastname, email)')) {
    throw new Error('processOrder(): expected function boundaries were not found.');
  }
} else {
  const replacement = `  async function processOrder(address, firstname, lastname, email) {\n    const validatedCountry = address.country;\n    const totals = getCommerceTotals(validatedCountry);\n    let orderRequest;\n    try {\n      orderRequest = commerceModule.createOrderRequest({\n        items: state.cart,\n        countryCode: validatedCountry,\n        discountCode: state.discountCode,\n      });\n    } catch (error) {\n      console.error('Cannot create trusted order request:', error);\n      alert('Your saved cart uses an outdated product format. Please clear the cart and add the products again.');\n      return;\n    }\n\n    const displayCustomer = {\n      firstname,\n      lastname,\n      email,\n      street: address.street,\n      zip: address.postal_code,\n      city: address.city,\n      country: validatedCountry,\n      formatted: address.formatted,\n    };\n    const checkoutCustomer = {\n      firstname,\n      lastname,\n      email,\n      street: address.street,\n      zip: address.postal_code,\n      city: address.city,\n      country: validatedCountry,\n    };\n    const orderData = {\n      request: orderRequest,\n      items: state.cart.map(item => ({\n        name: item.name,\n        price: item.price,\n        quantity: item.quantity,\n        image: item.image,\n      })),\n      customer: displayCustomer,\n      shipping: { zone: totals.zone.name, cost: totals.shipping },\n      subtotal: totals.subtotal,\n      discount: totals.discount,\n      discountCode: state.discountCode,\n      total: totals.grandTotal,\n    };\n\n    // Store display data separately from the minimal server request.\n    sessionStorage.setItem('legendOrder', JSON.stringify(orderData));\n    sessionStorage.setItem('legendOrderRequest', JSON.stringify(orderRequest));\n\n    const checkoutConfigured = commerceModule.isHostedCheckoutConfigured(\n      commerceModule.HOSTED_CHECKOUT_ENDPOINT,\n      window.location.origin,\n    );\n    if (!checkoutConfigured) {\n      alert('Order ready! Secure online payment is not enabled on this deployment yet.\\n\\nSubtotal: ' + formatPrice(totals.subtotal) + '\\nDiscount (' + state.discountPercent + '%): -' + formatPrice(totals.discount) + '\\nShipping to ' + totals.zone.name + ': ' + (totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)) + '\\nTotal: ' + formatPrice(totals.grandTotal));\n      return;\n    }\n\n    const payBtn = document.getElementById('checkout-pay-btn');\n    const originalBtnText = payBtn ? payBtn.textContent : 'Continue to payment';\n    if (payBtn) {\n      payBtn.disabled = true;\n      payBtn.textContent = 'Starting secure payment...';\n    }\n\n    try {\n      const checkout = await commerceModule.requestHostedCheckout({\n        endpoint: commerceModule.HOSTED_CHECKOUT_ENDPOINT,\n        baseUrl: window.location.origin,\n        payload: {\n          request: orderRequest,\n          customer: checkoutCustomer,\n        },\n      });\n      sessionStorage.setItem('legendCheckoutReference', checkout.reference);\n      sessionStorage.setItem('legendCheckoutSessionId', checkout.sessionId);\n      window.location.assign(checkout.url);\n    } catch (error) {\n      console.error('Hosted checkout could not be started:', error);\n      alert('Secure payment could not be started. Your cart is still saved. Please try again.');\n    } finally {\n      if (payBtn) {\n        payBtn.disabled = false;\n        payBtn.textContent = originalBtnText;\n      }\n    }\n  }`;

  source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

await writeFile(appPath, source, 'utf8');
console.log('Connected the storefront checkout flow to the optional hosted checkout client.');
