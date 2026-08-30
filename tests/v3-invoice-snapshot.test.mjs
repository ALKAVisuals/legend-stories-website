import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createV3InvoiceSnapshot,
  V3_INVOICE_SNAPSHOT_SCHEMA_VERSION,
} from '../server/invoices/v3-invoice-snapshot.mjs';

const reference = 'a'.repeat(64);
const paidAt = 1_800_100_010;
const issuedAt = paidAt + 5;
const paypalOrderId = '5O190127TN364715T';

function paidOrder() {
  return {
    reference,
    status: 'paid',
    amountTotal: 12_395,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: paypalOrderId,
    createdAt: 1_800_100_000,
    updatedAt: paidAt,
    paidAt,
    version: 1,
    customer: {
      firstname: 'Zoë',
      lastname: 'Jansen',
      email: 'zoe@example.invalid',
      street: 'Keizersgracht 1',
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
        sizeCm: 70,
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
        sizeCm: 50,
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

function seller() {
  return {
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
  };
}

function billingAddress() {
  return {
    street: 'Factuurstraat 20',
    line2: 'Unit B',
    postalCode: '3011 AA',
    city: 'Rotterdam',
    countryCode: 'NL',
  };
}

function tax() {
  return {
    treatmentCode: 'SYNTHETIC_TEST_TREATMENT',
    jurisdictionCode: 'SYNTHETIC-NL',
    pricingBasis: 'tax_inclusive',
    taxableAmountCents: 10_244,
    taxAmountCents: 2_151,
    rateBasisPoints: 2_100,
    legalText: 'Synthetic tax text for contract testing only.',
  };
}

function payment() {
  return {
    provider: 'paypal',
    providerOrderId: paypalOrderId,
    providerCaptureId: '3Y662965014333303',
    providerEventId: 'WH-SYNTHETIC-V3-001',
    providerEventType: 'PAYMENT.CAPTURE.COMPLETED',
    source: 'paypal_webhook',
    verifiedPaidAt: paidAt,
  };
}

function buildInput(overrides = {}) {
  return {
    order: paidOrder(),
    orderNumber: 'ORDER-FORMAT-NOT-LOCKED-000001',
    invoiceNumber: 'INVOICE-FORMAT-NOT-LOCKED-000001',
    issuedAt,
    seller: seller(),
    billingAddress: billingAddress(),
    tax: tax(),
    payment: payment(),
    ...overrides,
  };
}

test('builds a complete versioned snapshot from durable stored order truth without catalog access', () => {
  const snapshot = createV3InvoiceSnapshot(buildInput());

  assert.equal(snapshot.schemaVersion, V3_INVOICE_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(snapshot.schemaVersion, 1);
  assert.deepEqual(snapshot.document, {
    orderNumber: 'ORDER-FORMAT-NOT-LOCKED-000001',
    invoiceNumber: 'INVOICE-FORMAT-NOT-LOCKED-000001',
    issuedAt,
    currency: 'EUR',
  });
  assert.equal(snapshot.order.reference, reference);
  assert.equal(snapshot.order.paidAt, paidAt);
  assert.equal(snapshot.customer.firstName, 'Zoë');
  assert.equal(snapshot.customer.billingAddress.street, 'Factuurstraat 20');
  assert.equal(snapshot.customer.shippingAddress.street, 'Keizersgracht 1');
  assert.equal(snapshot.lines.length, 2);
  assert.equal(snapshot.lines[0].unitPriceCents, 4_995);
  assert.equal(snapshot.lines[0].lineTotalCents, 9_990);
  assert.equal(snapshot.lines[1].unitPriceCents, 3_000);
  assert.deepEqual(snapshot.totals, {
    subtotalCents: 12_990,
    discountCents: 990,
    discountedSubtotalCents: 12_000,
    shippingCents: 395,
    grandTotalCents: 12_395,
  });
  assert.equal(snapshot.shipping.costCents, 395);
  assert.equal(snapshot.discount.amountCents, 990);
  assert.equal(snapshot.payment.providerOrderId, paypalOrderId);
});

test('preserves explicitly supplied authoritative tax fields without recalculating them', () => {
  const inputTax = tax();
  inputTax.taxableAmountCents = 9_876;
  inputTax.taxAmountCents = 1_234;
  inputTax.rateBasisPoints = null;
  inputTax.pricingBasis = 'not_applicable';

  const snapshot = createV3InvoiceSnapshot(buildInput({ tax: inputTax }));

  assert.deepEqual(snapshot.tax, {
    treatmentCode: 'SYNTHETIC_TEST_TREATMENT',
    jurisdictionCode: 'SYNTHETIC-NL',
    pricingBasis: 'not_applicable',
    taxableAmountCents: 9_876,
    taxAmountCents: 1_234,
    rateBasisPoints: null,
    legalText: 'Synthetic tax text for contract testing only.',
  });
});

test('deep-freezes and detaches the immutable snapshot from later source mutations', () => {
  const input = buildInput();
  const snapshot = createV3InvoiceSnapshot(input);

  input.order.customer.firstname = 'Changed';
  input.order.items[0].name = 'Changed product';
  input.seller.legalName = 'Changed seller';
  input.billingAddress.street = 'Changed billing street';
  input.tax.taxAmountCents = 999_999;
  input.payment.providerCaptureId = 'CHANGED';

  assert.equal(snapshot.customer.firstName, 'Zoë');
  assert.equal(snapshot.lines[0].name, 'Legend One — Statement (70 × 70 cm)');
  assert.equal(snapshot.seller.legalName, 'Synthetic Seller V.O.F.');
  assert.equal(snapshot.customer.billingAddress.street, 'Factuurstraat 20');
  assert.equal(snapshot.tax.taxAmountCents, 2_151);
  assert.equal(snapshot.payment.providerCaptureId, '3Y662965014333303');

  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.lines), true);
  assert.equal(Object.isFrozen(snapshot.lines[0]), true);
  assert.equal(Object.isFrozen(snapshot.customer.billingAddress), true);
});

test('rejects unpaid orders before any invoice snapshot can be built', () => {
  const order = paidOrder();
  order.status = 'payment_pending';
  order.paidAt = null;

  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ order })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_ORDER_NOT_PAID',
  );
});

test('requires explicit approved seller identity instead of inventing legal defaults', () => {
  const incompleteSeller = seller();
  delete incompleteSeller.vatIdentificationNumber;

  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ seller: incompleteSeller })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE'
      && error?.details?.missing?.includes('vatIdentificationNumber'),
  );
});

test('requires an explicit tax snapshot instead of deriving VAT from destination', () => {
  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ tax: null })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE'
      && error?.details?.missing?.includes('tax'),
  );
});

test('rejects stored line and total inconsistencies instead of repairing invoice money', () => {
  const order = paidOrder();
  order.items[0].lineTotal = 99.89;

  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ order })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_TOTAL_MISMATCH',
  );

  const totalsOrder = paidOrder();
  totalsOrder.totals.grandTotal = 12_396;
  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ order: totalsOrder })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_TOTAL_MISMATCH',
  );
});

test('rejects payment evidence that does not match the durable paid order', () => {
  const mismatchedOrder = payment();
  mismatchedOrder.providerOrderId = 'DIFFERENT-PROVIDER-ORDER';
  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ payment: mismatchedOrder })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_PAYMENT_MISMATCH',
  );

  const mismatchedTime = payment();
  mismatchedTime.verifiedPaidAt = paidAt + 1;
  assert.throws(
    () => createV3InvoiceSnapshot(buildInput({ payment: mismatchedTime })),
    (error) => error?.code === 'INVOICE_SNAPSHOT_PAYMENT_MISMATCH',
  );
});

test('does not lock proposed public identifier formatting into the snapshot builder', () => {
  const snapshot = createV3InvoiceSnapshot(buildInput({
    orderNumber: 'CUSTOM-ORDER-SERIES-A-42',
    invoiceNumber: 'CUSTOM-INVOICE-SERIES-B-7',
  }));

  assert.equal(snapshot.document.orderNumber, 'CUSTOM-ORDER-SERIES-A-42');
  assert.equal(snapshot.document.invoiceNumber, 'CUSTOM-INVOICE-SERIES-B-7');
});
