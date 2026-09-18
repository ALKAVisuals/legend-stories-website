import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveCloudflareV3PaidFinalizationConfig,
} from '../cloudflare/v3-paid-finalization-config.mjs';

const paidAt2026 = Math.floor(Date.UTC(2026, 8, 18, 12, 0, 0) / 1000);
const paidAt2027 = Math.floor(Date.UTC(2027, 0, 1, 0, 0, 0) / 1000);

function order(overrides = {}) {
  return {
    amountTotal: 3_645,
    totals: {
      grandTotal: 3_645,
    },
    customer: {
      firstname: 'Klant',
      lastname: 'Voorbeeld',
      email: 'customer@example.invalid',
      phone: '+31 6 00000000',
      street: 'Voorbeeldstraat 10',
      line2: 'Unit B',
      zip: '1234 AB',
      city: 'Nijmegen',
      country: 'nl',
    },
    ...overrides,
  };
}

test('resolves the owner-approved Profile-1 Cloudflare finalization config', () => {
  const config = resolveCloudflareV3PaidFinalizationConfig();

  assert.equal(config.enabled, true);
  assert.equal(typeof config.numberingPolicy?.resolveSeriesKey, 'function');
  assert.equal(typeof config.numberingPolicy?.format, 'function');
  assert.equal(typeof config.documentContextProvider, 'function');
});

test('uses independent annual LegendMural order and invoice number formats from the UTC paid year', () => {
  const { numberingPolicy } = resolveCloudflareV3PaidFinalizationConfig();

  assert.equal(numberingPolicy.resolveSeriesKey({ paidAt: paidAt2026 }), '2026');
  assert.equal(numberingPolicy.resolveSeriesKey({ paidAt: paidAt2027 }), '2027');

  assert.equal(
    numberingPolicy.format({ documentType: 'order', value: 1, seriesKey: '2026' }),
    'LM-ORD-2026-000001',
  );
  assert.equal(
    numberingPolicy.format({ documentType: 'invoice', value: 42, seriesKey: '2026' }),
    'LM-INV-2026-000042',
  );
  assert.equal(
    numberingPolicy.format({ documentType: 'invoice', value: 1_000_000, seriesKey: '2026' }),
    'LM-INV-2026-1000000',
  );
});

test('uses the approved Alka Group seller identity and shipping identity as launch billing address', async () => {
  const { documentContextProvider } = resolveCloudflareV3PaidFinalizationConfig();
  const context = await documentContextProvider({ order: order() });

  assert.deepEqual(context.seller, {
    legalName: 'Alka Group',
    tradingName: 'LegendMural',
    registrationNumber: '95153756',
    vatIdentificationNumber: 'NL867022346B01',
    invoiceEmail: 'info@legendmural.com',
    supportEmail: 'info@legendmural.com',
    website: 'https://legendmural.com',
    address: {
      street: 'Schutkolk 4 d 1',
      line2: '',
      postalCode: '6582 DB',
      city: 'Heumen',
      countryCode: 'NL',
    },
  });

  assert.deepEqual(context.billingAddress, {
    street: 'Voorbeeldstraat 10',
    line2: 'Unit B',
    postalCode: '1234 AB',
    city: 'Nijmegen',
    countryCode: 'NL',
  });
  assert.equal(Object.hasOwn(context.billingAddress, 'email'), false);
  assert.equal(Object.hasOwn(context.billingAddress, 'phone'), false);
});

test('extracts approved 21% VAT once from the aggregate VAT-inclusive gross total with half-up rounding', async () => {
  const { documentContextProvider } = resolveCloudflareV3PaidFinalizationConfig();
  const context = await documentContextProvider({ order: order() });

  assert.deepEqual(context.tax, {
    treatmentCode: 'NL_STANDARD_VAT_21',
    jurisdictionCode: 'NL',
    pricingBasis: 'tax_inclusive',
    taxableAmountCents: 3_012,
    taxAmountCents: 633,
    rateBasisPoints: 2_100,
    legalText: null,
  });
  assert.equal(context.tax.taxableAmountCents + context.tax.taxAmountCents, 3_645);
});

test('fails closed when durable gross totals disagree', async () => {
  const { documentContextProvider } = resolveCloudflareV3PaidFinalizationConfig();

  await assert.rejects(
    documentContextProvider({
      order: order({
        amountTotal: 3_646,
      }),
    }),
    /gross total is internally inconsistent/i,
  );
});

test('rejects invalid numbering inputs instead of inventing document identity', () => {
  const { numberingPolicy } = resolveCloudflareV3PaidFinalizationConfig();

  assert.throws(
    () => numberingPolicy.format({ documentType: 'credit-note', value: 1, seriesKey: '2026' }),
    /Unsupported V3 document type/,
  );
  assert.throws(
    () => numberingPolicy.format({ documentType: 'invoice', value: 0, seriesKey: '2026' }),
    /positive safe integer/,
  );
  assert.throws(
    () => numberingPolicy.format({ documentType: 'invoice', value: 1, seriesKey: '26' }),
    /four-digit UTC year/,
  );
});
