import { handleDashboardInvoiceAccess } from '../../server/api/dashboard-invoice-access.mjs';
import { createNeonV3DashboardInvoiceSource } from '../../server/adapters/neon-v3-dashboard-invoice-source.mjs';
import { createNeonV3InvoiceArtifactStore } from '../../server/adapters/neon-v3-invoice-artifact-store.mjs';
import { createNetlifyV3InvoicePdfStore } from '../../server/adapters/netlify-v3-invoice-pdf-store.mjs';
import {
  commerceBootstrapErrorResponse,
  unexpectedCommerceFunctionResponse,
} from '../../server/netlify/commerce-runtime.mjs';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function productionContext(env) {
  return String(env?.CONTEXT || '').trim().toLowerCase() === 'production';
}

function hasServiceToken(value) {
  const token = String(value ?? '');
  return token.length >= 32 && token.length <= 512 && !/[\u0000-\u001f\u007f]/.test(token);
}

export function createNetlifyDashboardInvoiceAccessHandler({
  env = process.env,
  invoiceSourceFactory = createNeonV3DashboardInvoiceSource,
  artifactStoreFactory = createNeonV3InvoiceArtifactStore,
  pdfStoreFactory = createNetlifyV3InvoicePdfStore,
  handlerOptions = {},
} = {}) {
  return async function netlifyDashboardInvoiceAccessHandler(request) {
    const serviceToken = env.LEGENDMURAL_DASHBOARD_INVOICE_TOKEN;
    const apiEnabled = enabled(env.V3_DASHBOARD_INVOICE_API_ENABLED) && productionContext(env);
    if (!apiEnabled || !hasServiceToken(serviceToken)) {
      return handleDashboardInvoiceAccess(request, {
        ...handlerOptions,
        apiEnabled,
        serviceToken,
        storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
      });
    }

    try {
      const invoiceSource = invoiceSourceFactory({ connectionString: env.NEON_DATABASE_URL });
      const artifactStore = artifactStoreFactory({ connectionString: env.NEON_DATABASE_URL });
      const pdfStore = enabled(env.V3_INVOICE_STORAGE_ENABLED)
        ? pdfStoreFactory({ env })
        : null;

      return await handleDashboardInvoiceAccess(request, {
        ...handlerOptions,
        apiEnabled,
        serviceToken,
        storageEnabled: env.V3_INVOICE_STORAGE_ENABLED,
        invoiceSource,
        artifactStore,
        pdfStore,
      });
    } catch (error) {
      const configurationResponse = commerceBootstrapErrorResponse(error, {
        code: 'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
        message: 'Dashboard invoice API is not configured.',
      });
      if (configurationResponse) return configurationResponse;

      if (String(error?.code || '').startsWith('V3_INVOICE_STORAGE_')) {
        return new Response(JSON.stringify({
          error: {
            code: 'DASHBOARD_INVOICE_API_NOT_CONFIGURED',
            message: 'Dashboard invoice API is not configured.',
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

      console.error('Unexpected Netlify dashboard invoice bootstrap error.', {
        name: error?.name || 'Error',
        code: String(error?.code || 'UNKNOWN').slice(0, 120),
      });
      return unexpectedCommerceFunctionResponse(
        'DASHBOARD_INVOICE_API_FAILED',
        'Dashboard invoice API could not be started.',
      );
    }
  };
}

export default createNetlifyDashboardInvoiceAccessHandler();
