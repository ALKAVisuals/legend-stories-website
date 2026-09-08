import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCommerceRuntimeConfig } from './generate-commerce-runtime-config.mjs';

export const CLOUDFLARE_COMMERCE_RUNTIME_ENV = Object.freeze({
  LEGENDMURAL_HOSTED_CHECKOUT_ENDPOINT: '/api/paypal/checkout',
  LEGENDMURAL_ORDER_STATUS_ENDPOINT: '/api/order-status',
  LEGENDMURAL_PAYPAL_CAPTURE_ENDPOINT: '/api/paypal/capture',
});

export async function writeCloudflareCommerceRuntimeConfig({ targetPath } = {}) {
  const options = {
    env: CLOUDFLARE_COMMERCE_RUNTIME_ENV,
  };

  if (targetPath) {
    options.targetPath = targetPath;
  }

  return writeCommerceRuntimeConfig(options);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath && import.meta.url === invokedPath) {
  await writeCloudflareCommerceRuntimeConfig();
  console.log('Cloudflare commerce runtime config generated with same-origin API routes.');
}
