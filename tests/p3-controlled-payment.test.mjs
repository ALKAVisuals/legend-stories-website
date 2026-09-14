import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createAuthoritativeOrderQuote } from '../server/commerce/order-quote.mjs';
import {
  P3_CONTROLLED_TEST_CATALOG,
  P3_CONTROLLED_TEST_PRODUCT,
  isAuthorizedP3ControlledCheckout,
  isExactP3ControlledOrderRequest,
  isP3ControlledCheckoutEnabled,
} from '../server/commerce/p3-controlled-test-item.mjs';

const TEST_TOKEN = 'p3-test-token-abcdefghijklmnopqrstuvwxyz-123456';

function requestWithToken(token = TEST_TOKEN) {
  return new Request('https://legendmural.com/api/paypal/checkout', {
    method: 'POST',
    headers: {
      'x-legendmural-p3-test-token': token,
    },
  });
}

test('P3 controlled checkout is disabled by default and requires the exact server secret', () => {
  assert.equal(isP3ControlledCheckoutEnabled({}), false);
  assert.equal(isAuthorizedP3ControlledCheckout(requestWithToken(), {}), false);

  const env = {
    P3_TEST_CHECKOUT_ENABLED: 'true',
    P3_TEST_CHECKOUT_TOKEN: TEST_TOKEN,
  };
  assert.equal(isP3ControlledCheckoutEnabled(env), true);
  assert.equal(isAuthorizedP3ControlledCheckout(requestWithToken(), env), true);
  assert.equal(isAuthorizedP3ControlledCheckout(requestWithToken(`${TEST_TOKEN}x`), env), false);
  assert.equal(isAuthorizedP3ControlledCheckout(requestWithToken('too-short'), env), false);
});

test('P3 controlled request accepts exactly one NL one-cent test item and no discount', () => {
  const valid = {
    items: [{ slug: P3_CONTROLLED_TEST_PRODUCT.slug, quantity: 1 }],
    countryCode: 'NL',
    discountCode: '',
  };
  assert.equal(isExactP3ControlledOrderRequest(valid), true);
  assert.equal(isExactP3ControlledOrderRequest({ ...valid, discountCode: 'LEGEND10' }), false);
  assert.equal(isExactP3ControlledOrderRequest({ ...valid, countryCode: 'BE' }), false);
  assert.equal(isExactP3ControlledOrderRequest({ ...valid, items: [{ slug: P3_CONTROLLED_TEST_PRODUCT.slug, quantity: 2 }] }), false);
  assert.equal(isExactP3ControlledOrderRequest({ ...valid, items: [{ slug: 'normal-product', quantity: 1 }] }), false);
});

test('P3 controlled product produces an authoritative EUR 0.01 grand total with zero shipping', () => {
  const quote = createAuthoritativeOrderQuote({
    items: [{ slug: P3_CONTROLLED_TEST_PRODUCT.slug, quantity: 1 }],
    countryCode: 'NL',
  }, P3_CONTROLLED_TEST_CATALOG);

  assert.equal(quote.currency, 'EUR');
  assert.equal(quote.amountInCents.subtotal, 1);
  assert.equal(quote.amountInCents.shipping, 0);
  assert.equal(quote.amountInCents.grandTotal, 1);
  assert.equal(quote.shipping.qualifiesForFreeShipping, true);
});

test('ordinary products retain normal Netherlands shipping', () => {
  const normalProduct = Object.freeze({
    productId: 'LM-2026-99998',
    slug: 'ordinary-test-product',
    page: 'ordinary-test-product.html',
    name: 'Ordinary test product',
    image: '',
    price: 35,
    currency: 'EUR',
    availability: 'https://schema.org/InStock',
  });
  const quote = createAuthoritativeOrderQuote({
    items: [{ slug: normalProduct.slug, quantity: 1 }],
    countryCode: 'NL',
  }, [normalProduct]);

  assert.equal(quote.amountInCents.subtotal, 3500);
  assert.equal(quote.amountInCents.shipping, 495);
  assert.equal(quote.amountInCents.grandTotal, 3995);
});

test('P3 controlled product is absent from public catalog and storefront discovery files', async () => {
  const [catalogSource, indexSource, shopSource, sitemapSource] = await Promise.all([
    readFile(new URL('../data/products/catalog.json', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../shop.html', import.meta.url), 'utf8'),
    readFile(new URL('../sitemap.xml', import.meta.url), 'utf8'),
  ]);

  for (const source of [catalogSource, indexSource, shopSource, sitemapSource]) {
    assert.equal(source.includes(P3_CONTROLLED_TEST_PRODUCT.slug), false);
    assert.equal(source.includes(P3_CONTROLLED_TEST_PRODUCT.page), false);
  }
});
