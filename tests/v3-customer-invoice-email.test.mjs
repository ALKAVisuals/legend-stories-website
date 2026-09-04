import test from 'node:test';
import assert from 'node:assert/strict';

import { createV3InvoiceSnapshot } from '../server/invoices/v3-invoice-snapshot.mjs';
import {
  renderV3CustomerInvoiceEmail,
  V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION,
  V3CustomerInvoiceEmailError,
} from '../server/notifications/v3-customer-invoice-email.mjs';

const reference = 'c'.repeat(64);
const paidAt = 1_800_300_010;
const issuedAt = paidAt + 5;
const paypalOrderId = 'PAYPAL-SYNTHETIC-EMAIL-001';

function buildSnapshot({ firstName = 'Zoë', itemName = 'Legend One' } = {}) {
  return createV3InvoiceSnapshot({
    order: {
      reference,
      status: 'paid',
      currency: 'EUR',
      mode: 'test',
      paymentSessionId: paypalOrderId,
      createdAt: 1_800_300_000,
      updatedAt: paidAt,
      paidAt,
      version: 1,
      customer: {
        firstname: firstName,
        lastname: 'Jansen',
        email: 'zoe@example.invalid',
        companyName: 'Example Studio',
        street: 'Keizersgracht 1',
        line2: '2e verdieping',
        zip: '1015 CJ',
        city: 'Amsterdam',
        country: 'NL',
      },
      items: [{
        productId: 'LM-2026-00001',
        slug: 'legend-one',
        page: 'legend-one.html',
        sku: 'LM-2026-00001-STATEMENT',
        name: itemName,
        image: 'media/stikkers/legend-one.png',
        variantId: 'statement',
        variantLabel: 'Statement',
        sizeLabel: '70 × 70 cm',
        widthCm: 70,
        heightCm: 70,
        longestSideCm: 70,
        unitPrice: 49.95,
        quantity: 1,
        lineTotal: 49.95,
      }],
      discount: {
        code: 'LEGEND',
        percent: 10,
        amount: 5,
      },
      shipping: {
        deliveryCountry: 'NL',
        zoneCode: 'NL',
        zone: 'Netherlands',
        cost: 8.95,
        freeFrom: 69,
        qualifiesForFreeShipping: false,
      },
      totals: {
        subtotal: 4_995,
        discount: 500,
        discountedSubtotal: 4_495,
        shipping: 895,
        grandTotal: 5_390,
      },
      amountTotal: 5_390,
    },
    orderNumber: 'ORDER-FORMAT-NOT-LOCKED-000042',
    invoiceNumber: 'INVOICE-FORMAT-NOT-LOCKED-000077',
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
      taxableAmountCents: 4_455,
      taxAmountCents: 935,
      rateBasisPoints: 2_100,
      legalText: 'Synthetic tax text for contract testing only.',
    },
    payment: {
      provider: 'paypal',
      providerOrderId: paypalOrderId,
      providerCaptureId: 'CAPTURE-SYNTHETIC-EMAIL-001',
      providerEventId: 'EVENT-SYNTHETIC-EMAIL-001',
      providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
      source: 'paypal_webhook',
      verifiedPaidAt: paidAt,
    },
  });
}

test('renders deterministic approved V4 transactional text and HTML from the immutable schema-v1 snapshot', () => {
  const snapshot = buildSnapshot();
  const first = renderV3CustomerInvoiceEmail({ snapshot });
  const second = renderV3CustomerInvoiceEmail({ snapshot });

  assert.deepEqual(first, second);
  assert.equal(first.rendererVersion, V3_CUSTOMER_INVOICE_EMAIL_RENDERER_VERSION);
  assert.equal(first.rendererVersion, 2);
  assert.match(first.subject, /ORDER-FORMAT-NOT-LOCKED-000042/);
  assert.match(first.subject, /INVOICE-FORMAT-NOT-LOCKED-000077/);
  assert.match(first.text, /Order number: ORDER-FORMAT-NOT-LOCKED-000042/);
  assert.match(first.text, /Invoice number: INVOICE-FORMAT-NOT-LOCKED-000077/);
  assert.match(first.text, /Your PDF invoice is attached to this email\./);
  assert.match(first.text, /1 × Legend One — LM-2026-00001-STATEMENT — Statement — 70 × 70 cm/);
  assert.match(first.text, /Unit price: EUR 49\.95/);
  assert.match(first.text, /Discount \(LEGEND\): EUR 5\.00/);
  assert.match(first.text, /Shipping: EUR 8\.95/);
  assert.match(first.text, /Tax amount: EUR 9\.35/);
  assert.match(first.text, /Total paid: EUR 53\.90/);
  assert.match(first.text, /Keizersgracht 1/);

  assert.match(first.html, /#0A0A0A/);
  assert.match(first.html, /#1A1A1A/);
  assert.match(first.html, /#2A8A4A/);
  assert.match(first.html, /#3DA86A/);
  assert.match(first.html, /https:\/\/legendmural\.com\/media\/LOGO\/lm-logo-transparant\.png/);
  assert.match(first.html, /alt="LegendMural"/);
  assert.match(first.html, /PAYMENT RECEIVED/);
  assert.match(first.html, /Your order is<br><span style="color:#2A8A4A;">confirmed\.<\/span>/);
  assert.match(first.html, /OFFICIAL ORDER NUMBER/);
  assert.match(first.html, /ORDER-FORMAT-NOT-LOCKED-000042/);
  assert.match(first.html, /Legend One/);
  assert.match(first.html, /Statement · 70 × 70 cm/);
  assert.match(first.html, /€49,95/);
  assert.match(first.html, /Payment summary/);
  assert.match(first.html, /TOTAL PAID/);
  assert.match(first.html, /€53,90/);
  assert.match(first.html, /YOUR INVOICE/);
  assert.match(first.html, /INVOICE-FORMAT-NOT-LOCKED-000077/);
  assert.match(first.html, /PDF INVOICE ATTACHED/);
  assert.match(first.html, /PRODUCTION/);
  assert.match(first.html, /SHIPPING/);
  assert.equal(first.html.includes('media/stikkers/legend-one.png'), false);
  assert.equal(first.html.includes('View invoice'), false);
});

test('never exposes the internal order reference or PayPal provider identity as customer-facing identifiers', () => {
  const rendered = renderV3CustomerInvoiceEmail({ snapshot: buildSnapshot() });
  const output = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;

  assert.equal(output.includes(reference), false);
  assert.equal(output.includes(reference.toUpperCase()), false);
  assert.equal(output.includes(paypalOrderId), false);
});

test('escapes snapshot text in V4 HTML while preserving the immutable input', () => {
  const snapshot = buildSnapshot({
    firstName: '<Zoë & Co>',
    itemName: 'Legend <One> & Friends',
  });
  const before = JSON.stringify(snapshot);

  const rendered = renderV3CustomerInvoiceEmail({ snapshot });

  assert.match(rendered.text, /Hi <Zoë & Co>,/);
  assert.match(rendered.html, /Thank you, &lt;Zoë &amp; Co&gt;\./);
  assert.match(rendered.html, /Legend &lt;One&gt; &amp; Friends/);
  assert.doesNotMatch(rendered.html, /<Zoë & Co>/);
  assert.equal(JSON.stringify(snapshot), before);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.lines), true);
});

test('displays stored tax truth without recalculating it from totals or rate', () => {
  const snapshot = structuredClone(buildSnapshot());
  snapshot.tax.taxAmountCents = 1_234;
  snapshot.tax.rateBasisPoints = 9_999;

  const rendered = renderV3CustomerInvoiceEmail({ snapshot });

  assert.match(rendered.text, /Tax amount: EUR 12\.34/);
  assert.match(rendered.html, /VAT \/ tax/);
  assert.match(rendered.html, /€12,34/);
  assert.match(rendered.text, /Total paid: EUR 53\.90/);
  assert.match(rendered.html, /€53,90/);
});

test('rejects missing and malformed persisted snapshot input', () => {
  assert.throws(
    () => renderV3CustomerInvoiceEmail(),
    (error) => error instanceof V3CustomerInvoiceEmailError
      && error.code === 'INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT'
      && error.details.field === 'snapshot',
  );

  const malformed = structuredClone(buildSnapshot());
  malformed.customer.shippingAddress = null;
  assert.throws(
    () => renderV3CustomerInvoiceEmail({ snapshot: malformed }),
    (error) => error instanceof V3CustomerInvoiceEmailError
      && error.code === 'INVALID_V3_CUSTOMER_INVOICE_EMAIL_SNAPSHOT'
      && error.details.field === 'snapshot.customer.shippingAddress',
  );
});

test('rejects an unsupported persisted invoice snapshot schema instead of guessing', () => {
  const snapshot = structuredClone(buildSnapshot());
  snapshot.schemaVersion = 2;

  assert.throws(
    () => renderV3CustomerInvoiceEmail({ snapshot }),
    (error) => error instanceof V3CustomerInvoiceEmailError
      && error.code === 'UNSUPPORTED_V3_INVOICE_SNAPSHOT_SCHEMA'
      && error.details.schemaVersion === 2,
  );
});
