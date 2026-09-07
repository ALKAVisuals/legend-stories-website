import { createV3InvoiceSnapshot } from '../../server/invoices/v3-invoice-snapshot.mjs';
import {
  renderV3InvoicePdf,
  V3_INVOICE_PDF_RENDERER_VERSION,
} from '../../server/invoices/v3-invoice-pdf.mjs';

const reference = 'c'.repeat(64);
const paidAt = 1_800_300_010;
const issuedAt = paidAt + 5;
const paypalOrderId = 'PAYPAL-WORKER-PDF-001';

function buildSnapshot() {
  const order = {
    reference,
    status: 'paid',
    amountTotal: 12_395,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: paypalOrderId,
    createdAt: 1_800_300_000,
    updatedAt: paidAt,
    paidAt,
    version: 1,
    customer: {
      firstname: 'Worker',
      lastname: 'Probe',
      email: 'worker-probe@example.invalid',
      street: 'Shipping Street 1',
      line2: '',
      zip: '1234 AB',
      city: 'Nijmegen',
      country: 'NL',
    },
    items: [{
      productId: 'LM-2026-00001',
      slug: 'worker-probe-product',
      page: 'worker-probe-product.html',
      sku: 'LM-WORKER-PROBE',
      name: 'LegendMural Worker PDF Probe',
      image: 'media/worker-probe.png',
      variantId: 'probe',
      variantLabel: 'Probe',
      sizeLabel: '70 × 70 cm',
      widthCm: 70,
      heightCm: 70,
      longestSideCm: 70,
      unitPrice: 129.90,
      quantity: 1,
      lineTotal: 129.90,
    }],
    discount: {
      code: 'PROBE',
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

  return createV3InvoiceSnapshot({
    order,
    orderNumber: 'LM-ORD-2027-000001',
    invoiceNumber: 'LM-INV-2027-000001',
    issuedAt,
    seller: {
      legalName: 'Synthetic Worker Seller V.O.F.',
      tradingName: 'Synthetic LegendMural Worker Probe',
      registrationNumber: 'WORKER-REG-001',
      vatIdentificationNumber: 'WORKER-VAT-001',
      invoiceEmail: 'billing@example.invalid',
      supportEmail: 'support@example.invalid',
      website: 'https://example.invalid',
      address: {
        street: 'Workerstraat 10',
        line2: '',
        postalCode: '1234 AB',
        city: 'Nijmegen',
        countryCode: 'NL',
      },
    },
    billingAddress: {
      street: 'Factuurstraat 20',
      line2: '',
      postalCode: '3011 AA',
      city: 'Rotterdam',
      countryCode: 'NL',
    },
    tax: {
      treatmentCode: 'SYNTHETIC_WORKER_PROBE',
      jurisdictionCode: 'SYNTHETIC-NL',
      pricingBasis: 'tax_inclusive',
      taxableAmountCents: 10_244,
      taxAmountCents: 2_151,
      rateBasisPoints: 2_100,
      legalText: 'Synthetic workerd compatibility fixture only.',
    },
    payment: {
      provider: 'paypal',
      providerOrderId: paypalOrderId,
      providerCaptureId: 'CAPTURE-WORKER-PDF-001',
      providerEventId: 'EVENT-WORKER-PDF-001',
      providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
      source: 'paypal_webhook',
      verifiedPaidAt: paidAt,
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/probe' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    try {
      const first = await renderV3InvoicePdf({ snapshot: buildSnapshot() });
      const second = await renderV3InvoicePdf({ snapshot: buildSnapshot() });
      const pdfHeader = Buffer.from(first.bytes).subarray(0, 8).toString('ascii');

      return Response.json({
        rendererVersion: first.rendererVersion,
        expectedRendererVersion: V3_INVOICE_PDF_RENDERER_VERSION,
        filename: first.filename,
        byteLength: first.byteLength,
        sha256: first.sha256,
        secondByteLength: second.byteLength,
        secondSha256: second.sha256,
        deterministic: first.sha256 === second.sha256
          && first.byteLength === second.byteLength
          && Buffer.compare(first.bytes, second.bytes) === 0,
        pdfHeader,
      });
    } catch (error) {
      return Response.json({
        error: {
          name: String(error?.name || 'Error').slice(0, 120),
          code: String(error?.code || 'UNKNOWN').slice(0, 120),
          message: String(error?.message || 'PDF worker probe failed.').slice(0, 500),
        },
      }, { status: 500 });
    }
  },
};
