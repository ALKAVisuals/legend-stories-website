import { handleInvoiceDownload } from '../../server/api/invoice-download.mjs';
import { createNetlifyV3InvoicePdfStore } from '../../server/adapters/netlify-v3-invoice-pdf-store.mjs';
import { createNeonV3InvoiceArtifactStore } from '../../server/adapters/neon-v3-invoice-artifact-store.mjs';
import { createNeonV3InvoiceDeliverySource } from '../../server/adapters/neon-v3-invoice-delivery-source.mjs';
import {
  commerceBootstrapErrorResponse,
  getCommerceOrderStore,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export function createNetlifyInvoiceDownloadHandler({
  env = process.env,
  orderStoreFactory,
  artifactStoreFactory = createNeonV3InvoiceArtifactStore,
  invoiceSourceFactory = createNeonV3InvoiceDeliverySource,
  pdfStoreFactory = createNetlifyV3InvoicePdfStore,
  handlerOptions = {},
} = {}) {
  return async function netlifyInvoiceDownloadHandler(request) {
    if (!enabled(env.V3_INVOICE_STORAGE_ENABLED)) {
      return handleInvoiceDownload(request, {
        ...handlerOptions,
        storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
        allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
      });
    }

    try {
      const orderStore = getCommerceOrderStore({ env, storeFactory: orderStoreFactory });
      const artifactStore = artifactStoreFactory({ connectionString: env.NEON_DATABASE_URL });
      const invoiceSource = invoiceSourceFactory({ connectionString: env.NEON_DATABASE_URL });
      const pdfStore = pdfStoreFactory({ env });
      return await handleInvoiceDownload(request, {
        ...handlerOptions,
        orderStore,
        artifactStore,
        invoiceSource,
        pdfStore,
        storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
        allowedOrigins: env.CHECKOUT_ALLOWED_ORIGINS || '',
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'INVOICE_DOWNLOAD_NOT_CONFIGURED',
        message: 'Invoice download is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      if (String(error?.code || '').startsWith('V3_INVOICE_STORAGE_')) {
        return new Response(JSON.stringify({
          error: {
            code: 'INVOICE_DOWNLOAD_NOT_CONFIGURED',
            message: 'Invoice download is not configured.',
          },
        }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer',
          },
        });
      }

      console.error('Unexpected Netlify invoice-download bootstrap error.', {
        name: error?.name || 'Error',
        code: String(error?.code || 'UNKNOWN').slice(0, 120),
      });
      return unexpectedCommerceFunctionResponse(
        'INVOICE_DOWNLOAD_SERVICE_FAILED',
        'Invoice download could not be started.',
      );
    }
  };
}

export default createNetlifyInvoiceDownloadHandler();
