import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createNetlifyDashboardInvoiceAccessHandler } from '../netlify/functions/dashboard-invoice-access.mjs';

const reference = 'e'.repeat(64);
const token = 'dashboard-invoice-netlify-test-token-2026';

function request() {
  return new Request('https://legendmural.com/api/internal/dashboard-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reference, action: 'metadata' }),
  });
}

function factoryCounter() {
  const calls = { invoice: 0, artifact: 0, pdf: 0 };
  return {
    calls,
    invoiceSourceFactory() {
      calls.invoice += 1;
      return {
        async loadDashboardInvoiceSummary() {
          return {
            orderReference: reference,
            invoiceId: 77,
            invoiceNumber: 'LM-INV-2026-000077',
            issuedAt: 1_800_000_100,
            currency: 'EUR',
            amountTotal: 12395,
            schemaVersion: 1,
          };
        },
      };
    },
    artifactStoreFactory() {
      calls.artifact += 1;
      return {
        async loadArtifactState() {
          return {
            orderReference: reference,
            invoiceId: 77,
            deliveryStatus: 'delivered',
            attachmentFilename: 'invoice-LM-INV-2026-000077.pdf',
            storageBound: false,
          };
        },
      };
    },
    pdfStoreFactory() {
      calls.pdf += 1;
      throw new Error('PDF store must not open for metadata with storage disabled.');
    },
  };
}

test('Deploy Preview/local contexts cannot bootstrap the internal dashboard invoice data sources', async () => {
  for (const context of ['deploy-preview', 'branch-deploy', 'dev', '']) {
    const factories = factoryCounter();
    const handler = createNetlifyDashboardInvoiceAccessHandler({
      env: {
        CONTEXT: context,
        V3_DASHBOARD_INVOICE_API_ENABLED: 'true',
        LEGENDMURAL_DASHBOARD_INVOICE_TOKEN: token,
        V3_INVOICE_STORAGE_ENABLED: 'false',
      },
      ...factories,
    });
    const response = await handler(request());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_API_DISABLED');
    assert.deepEqual(factories.calls, { invoice: 0, artifact: 0, pdf: 0 });
  }
});

test('Production context still requires the dedicated API gate and service token', async () => {
  const factories = factoryCounter();
  const handler = createNetlifyDashboardInvoiceAccessHandler({
    env: {
      CONTEXT: 'production',
      V3_DASHBOARD_INVOICE_API_ENABLED: 'false',
      LEGENDMURAL_DASHBOARD_INVOICE_TOKEN: token,
      V3_INVOICE_STORAGE_ENABLED: 'false',
    },
    ...factories,
  });
  const response = await handler(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DASHBOARD_INVOICE_API_DISABLED');
  assert.deepEqual(factories.calls, { invoice: 0, artifact: 0, pdf: 0 });
});

test('enabled Production metadata path creates only read-only Neon sources and never opens Blob storage', async () => {
  const factories = factoryCounter();
  const handler = createNetlifyDashboardInvoiceAccessHandler({
    env: {
      CONTEXT: 'production',
      V3_DASHBOARD_INVOICE_API_ENABLED: 'true',
      LEGENDMURAL_DASHBOARD_INVOICE_TOKEN: token,
      V3_INVOICE_STORAGE_ENABLED: 'false',
      NEON_DATABASE_URL: 'postgresql://runtime:secret@ep-test.neon.tech/legend?sslmode=require',
    },
    ...factories,
  });
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).invoice.invoiceNumber, 'LM-INV-2026-000077');
  assert.deepEqual(factories.calls, { invoice: 1, artifact: 1, pdf: 0 });
});

test('Netlify exposes only the server-authenticated internal dashboard route, never a Blob route', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.ok(config.includes('from = "/api/internal/dashboard-invoice"'));
  assert.ok(config.includes('to = "/.netlify/functions/dashboard-invoice-access"'));
  assert.equal(config.includes('/api/internal/dashboard-invoice/:blob'), false);
  assert.equal(config.includes('v1/invoices/:invoiceId'), false);
});
