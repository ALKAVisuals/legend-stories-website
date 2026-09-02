import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build } from 'esbuild';

import { createV3InvoiceSnapshot } from '../server/invoices/v3-invoice-snapshot.mjs';
import {
  renderV3InvoicePdf,
  V3_INVOICE_PDF_RENDERER_VERSION,
} from '../server/invoices/v3-invoice-pdf.mjs';

const reference = 'b'.repeat(64);
const paidAt = 1_800_200_010;
const issuedAt = paidAt + 5;
const paypalOrderId = 'PAYPAL-SYNTHETIC-PDF-001';

function paidOrder({ shippingStreet = 'Keizersgracht 1' } = {}) {
  return {
    reference,
    status: 'paid',
    amountTotal: 12_395,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: paypalOrderId,
    createdAt: 1_800_200_000,
    updatedAt: paidAt,
    paidAt,
    version: 1,
    customer: {
      firstname: 'Zoë',
      lastname: 'Jansen',
      email: 'zoe@example.invalid',
      street: shippingStreet,
      line2: '2e verdieping',
      zip: '1015 CJ',
      city: 'Amsterdam',
      country: 'NL',
    },
    items: [
      {
        productId: 'LM-2026-00001',
        slug: 'legend-one',
        page: 'legend-one.html',
        sku: 'LM-2026-00001-STATEMENT',
        name: 'Legend One — Statement (70 × 70 cm)',
        image: 'media/stikkers/legend-one.png',
        variantId: 'statement',
        variantLabel: 'Statement',
        sizeLabel: '70 × 70 cm',
        widthCm: 70,
        heightCm: 70,
        longestSideCm: 70,
        unitPrice: 49.95,
        quantity: 2,
        lineTotal: 99.90,
      },
      {
        productId: 'LM-2026-00002',
        slug: 'legend-two',
        page: 'legend-two.html',
        sku: 'LM-2026-00002-COMPACT',
        name: 'Legend Two — Compact (40 × 50 cm)',
        image: 'media/stikkers/legend-two.png',
        variantId: 'compact',
        variantLabel: 'Compact',
        sizeLabel: '40 × 50 cm',
        widthCm: 40,
        heightCm: 50,
        longestSideCm: 50,
        unitPrice: 30,
        quantity: 1,
        lineTotal: 30,
      },
    ],
    discount: {
      code: 'LEGEND',
      percent: 7.621247113163973,
      amount: 9.90,
    },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 3.95,
      freeFrom: 69,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 12_990,
      discount: 990,
      discountedSubtotal: 12_000,
      shipping: 395,
      grandTotal: 12_395,
    },
  };
}

function buildSnapshot({
  invoiceNumber = 'INVOICE-FORMAT-NOT-LOCKED-000001',
  shippingStreet = 'Keizersgracht 1',
} = {}) {
  return createV3InvoiceSnapshot({
    order: paidOrder({ shippingStreet }),
    orderNumber: 'ORDER-FORMAT-NOT-LOCKED-000001',
    invoiceNumber,
    issuedAt,
    seller: {
      legalName: 'Synthetic Seller V.O.F.',
      tradingName: 'Synthetic LegendMural',
      registrationNumber: 'TEST-REG-001',
      vatIdentificationNumber: 'TEST-VAT-001',
      invoiceEmail: 'billing@example.invalid',
      supportEmail: 'support@example.invalid',
      website: 'https://example.invalid',
      address: {
        street: 'Teststraat 10',
        line2: '',
        postalCode: '1234 AB',
        city: 'Nijmegen',
        countryCode: 'NL',
      },
    },
    billingAddress: {
      street: 'Factuurstraat 20',
      line2: 'Unit B',
      postalCode: '3011 AA',
      city: 'Rotterdam',
      countryCode: 'NL',
    },
    tax: {
      treatmentCode: 'SYNTHETIC_TEST_TREATMENT',
      jurisdictionCode: 'SYNTHETIC-NL',
      pricingBasis: 'tax_inclusive',
      taxableAmountCents: 10_244,
      taxAmountCents: 2_151,
      rateBasisPoints: 2_100,
      legalText: 'Synthetic tax text for contract testing only.',
    },
    payment: {
      provider: 'paypal',
      providerOrderId: paypalOrderId,
      providerCaptureId: 'CAPTURE-SYNTHETIC-PDF-001',
      providerEventId: 'EVENT-SYNTHETIC-PDF-001',
      providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
      source: 'paypal_webhook',
      verifiedPaidAt: paidAt,
    },
  });
}

function independentSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('renders the same immutable snapshot byte-for-byte deterministically', async () => {
  const snapshot = buildSnapshot();

  const first = await renderV3InvoicePdf({ snapshot });
  const second = await renderV3InvoicePdf({ snapshot });

  assert.equal(first.rendererVersion, V3_INVOICE_PDF_RENDERER_VERSION);
  assert.equal(first.rendererVersion, 1);
  assert.equal(first.filename, 'invoice-INVOICE-FORMAT-NOT-LOCKED-000001.pdf');
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.byteLength, second.byteLength);
  assert.deepEqual(first.bytes, second.bytes);
});

test('returns a Buffer with exact artifact metadata and a functional A4 PDF 1.4 document', async () => {
  const artifact = await renderV3InvoicePdf({ snapshot: buildSnapshot() });
  const bytes = artifact.bytes;
  const raw = bytes.toString('latin1');

  assert.equal(Buffer.isBuffer(bytes), true);
  assert.equal(bytes.subarray(0, 8).toString('ascii'), '%PDF-1.4');
  assert.match(raw, /\/MediaBox\s*\[0 0 595\.28\d* 841\.89\d*\]/);
  assert.equal(artifact.byteLength, bytes.byteLength);
  assert.equal(artifact.sha256, independentSha256(bytes));
  assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
  assert.ok(artifact.byteLength > 1_000);
});

test('uses persisted invoice identity in deterministic filename and artifact bytes', async () => {
  const first = await renderV3InvoicePdf({
    snapshot: buildSnapshot({ invoiceNumber: 'CUSTOM-INVOICE-A-42' }),
  });
  const second = await renderV3InvoicePdf({
    snapshot: buildSnapshot({ invoiceNumber: 'CUSTOM-INVOICE-B-42' }),
  });

  assert.equal(first.filename, 'invoice-CUSTOM-INVOICE-A-42.pdf');
  assert.equal(second.filename, 'invoice-CUSTOM-INVOICE-B-42.pdf');
  assert.notEqual(first.sha256, second.sha256);
});

test('renders the persisted shipping address instead of ignoring it', async () => {
  const first = await renderV3InvoicePdf({
    snapshot: buildSnapshot({ shippingStreet: 'Shipping Proof Street A 10' }),
  });
  const second = await renderV3InvoicePdf({
    snapshot: buildSnapshot({ shippingStreet: 'Shipping Proof Street B 20' }),
  });

  assert.notEqual(first.sha256, second.sha256);
  assert.notDeepEqual(first.bytes, second.bytes);
});

test('rejects missing snapshot input', async () => {
  await assert.rejects(
    renderV3InvoicePdf(),
    (error) => error?.code === 'INVALID_V3_INVOICE_PDF_SNAPSHOT'
      && error?.details?.field === 'snapshot',
  );
});

test('rejects malformed persisted snapshot input', async () => {
  const snapshot = structuredClone(buildSnapshot());
  snapshot.customer.shippingAddress = null;

  await assert.rejects(
    renderV3InvoicePdf({ snapshot }),
    (error) => error?.code === 'INVALID_V3_INVOICE_PDF_SNAPSHOT'
      && error?.details?.field === 'snapshot.customer.shippingAddress',
  );
});

test('rejects an unsupported persisted snapshot schema instead of guessing how to render it', async () => {
  const snapshot = structuredClone(buildSnapshot());
  snapshot.schemaVersion = 2;

  await assert.rejects(
    renderV3InvoicePdf({ snapshot }),
    (error) => error?.code === 'UNSUPPORTED_V3_INVOICE_SNAPSHOT_SCHEMA'
      && error?.details?.schemaVersion === 2,
  );
});

test('does not mutate the immutable invoice snapshot while rendering', async () => {
  const snapshot = buildSnapshot();
  const before = JSON.stringify(snapshot);

  await renderV3InvoicePdf({ snapshot });

  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.lines), true);
});

test('bundles, imports and executes the renderer with pinned PDFKit for the Node 22 server target', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'legendmural-v3-pdf-bundle-'));
  const outfile = join(tempDir, 'v3-invoice-pdf.bundle.mjs');
  const entry = fileURLToPath(new URL('../server/invoices/v3-invoice-pdf.mjs', import.meta.url));

  try {
    const result = await build({
      entryPoints: [entry],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: ['node22'],
      sourcemap: false,
      minify: false,
      logLevel: 'silent',
      metafile: true,
    });

    const output = await readFile(outfile);
    assert.ok(output.byteLength > 10_000);
    assert.ok(Object.keys(result.metafile.inputs).some((input) => input.includes('node_modules/pdfkit/')));

    const bundledRenderer = await import(pathToFileURL(outfile).href);
    const artifact = await bundledRenderer.renderV3InvoicePdf({ snapshot: buildSnapshot() });
    assert.equal(Buffer.isBuffer(artifact.bytes), true);
    assert.equal(artifact.rendererVersion, 1);
    assert.equal(artifact.sha256, independentSha256(artifact.bytes));
    assert.ok(artifact.byteLength > 1_000);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});