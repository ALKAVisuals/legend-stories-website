import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAuthoritativeOrderQuote } from '../server/commerce/order-quote.mjs';

const ROOT = process.cwd();

function validateCentReconciliation(quote, label, errors) {
  const cents = quote.amountInCents;
  for (const [field, value] of Object.entries(cents)) {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label}: ${field} is not a non-negative integer cent amount.`);
    }
  }
  if (cents.subtotal - cents.discount + cents.shipping !== cents.grandTotal) {
    errors.push(`${label}: cent totals do not reconcile exactly.`);
  }
  if (cents.subtotal - cents.discount !== cents.discountedSubtotal) {
    errors.push(`${label}: discounted subtotal does not reconcile exactly.`);
  }
}

export async function validateOrderSecurity(root = ROOT) {
  const catalog = JSON.parse(
    await readFile(resolve(root, 'data/products/catalog.json'), 'utf8'),
  );
  const errors = [];

  if (catalog.productCount !== catalog.products.length) {
    errors.push(`Catalog count ${catalog.productCount} does not match ${catalog.products.length} products.`);
  }

  for (const product of catalog.products) {
    try {
      const byPage = createAuthoritativeOrderQuote({
        items: [{
          page: product.page,
          quantity: 1,
          price: 0.01,
          name: 'Tampered browser name',
          lineTotal: 0.01,
        }],
        countryCode: 'NL',
      }, catalog.products);
      const bySlug = createAuthoritativeOrderQuote({
        items: [{
          slug: product.slug,
          quantity: 1,
          price: 9999,
          lineTotal: 9999,
        }],
        countryCode: 'DE',
        discountCode: 'LEGEND10',
      }, catalog.products);

      if (byPage.items[0].unitPrice !== product.price) {
        errors.push(`${product.page}: page quote did not use the catalog price.`);
      }
      if (byPage.items[0].name !== product.name) {
        errors.push(`${product.page}: page quote trusted the browser product name.`);
      }
      if (bySlug.items[0].page !== product.page) {
        errors.push(`${product.page}: slug quote resolved to a different product.`);
      }
      if (bySlug.discount.code !== 'LEGEND10' || bySlug.discount.percent !== 10) {
        errors.push(`${product.page}: central discount policy was not applied.`);
      }

      validateCentReconciliation(byPage, `${product.page} page quote`, errors);
      validateCentReconciliation(bySlug, `${product.page} slug quote`, errors);
    } catch (error) {
      errors.push(`${product.page}: ${error.code || error.name}: ${error.message}`);
    }
  }

  return {
    productCount: catalog.products.length,
    errors,
  };
}

async function main() {
  const result = await validateOrderSecurity(ROOT);
  if (result.errors.length) {
    console.error('Order security validation failed:');
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  console.log(
    `Order security validation passed for ${result.productCount} products; client values were ignored and cent totals reconciled exactly.`,
  );
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Order security validation failed unexpectedly:', error);
  process.exit(1);
});
