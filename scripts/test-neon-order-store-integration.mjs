import {
  createDefaultNeonClient,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import { createPendingOrderRecord } from '../server/orders/order-status.mjs';
import { runOrderStoreConformance } from '../server/orders/store-conformance.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for the Neon integration workflow.`);
  }
  return validateNeonConnectionString(value);
}

const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const PAYPAL_REFERENCE = 'f'.repeat(64);
const PAYPAL_ORDER_ID = '5O190127TN364715T';

async function withClient(connectionString, action) {
  const client = await createDefaultNeonClient(connectionString);
  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.end();
  }
}

async function clearSyntheticRecords() {
  await withClient(migrationUrl, (client) => client.query(`
    TRUNCATE TABLE
      legend_commerce.paypal_webhook_events,
      legend_commerce.stripe_events,
      legend_commerce.orders
  `));
}

function paypalPendingOrder() {
  const createdAt = 1_800_100_000;
  return {
    ...createPendingOrderRecord({
      reference: PAYPAL_REFERENCE,
      amountTotal: 4500,
      currency: 'EUR',
      mode: 'test',
      paymentSessionId: PAYPAL_ORDER_ID,
      createdAt,
    }),
    customer: {
      firstname: 'PayPal',
      lastname: 'Integration',
      email: 'paypal-integration@example.invalid',
      street: 'Teststraat 1',
      line2: '',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    items: [{
      slug: 'paypal-schema-fixture',
      page: 'paypal-schema-fixture.html',
      sku: 'PAYPAL-SCHEMA-FIXTURE',
      name: 'PayPal schema fixture',
      image: 'media/stikkers/paypal-schema-fixture.png',
      variantId: 'statement',
      variantLabel: 'Statement',
      sizeLabel: '50 × 50 cm',
      widthCm: 50,
      heightCm: 50,
      longestSideCm: 50,
      sizeCm: 50,
      unitPrice: 45,
      quantity: 1,
      lineTotal: 45,
    }],
    discount: { code: null, percent: 0, amount: 0 },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 0,
      freeFrom: 69,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 4500,
      discount: 0,
      discountedSubtotal: 4500,
      shipping: 0,
      grandTotal: 4500,
    },
  };
}

async function verifyPaypalProviderCompatibility() {
  const store = createNeonOrderStore({ connectionString: runtimeUrl });
  const persisted = await store.persistPendingCheckout(paypalPendingOrder());
  if (!persisted.created || persisted.order.paymentSessionId !== PAYPAL_ORDER_ID) {
    throw new Error('PayPal pending order could not be persisted through the runtime store.');
  }

  await withClient(runtimeUrl, async (client) => {
    const providerResult = await client.query(
      'SELECT payment_provider FROM legend_commerce.orders WHERE reference = $1',
      [PAYPAL_REFERENCE],
    );
    if (providerResult.rows?.[0]?.payment_provider !== 'paypal') {
      throw new Error('Neon did not derive payment_provider=paypal for the PayPal order ID.');
    }

    const eventResult = await client.query(`
      INSERT INTO legend_commerce.paypal_webhook_events (
        event_id, event_type, order_reference, paypal_order_id,
        paypal_capture_id, mode, paypal_created_at, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING event_id
    `, [
      'WH-SYNTHETIC-PAYPAL-001',
      'CHECKOUT.ORDER.APPROVED',
      PAYPAL_REFERENCE,
      PAYPAL_ORDER_ID,
      null,
      'test',
      1_800_100_010,
      1_800_100_011,
    ]);
    if (eventResult.rows?.[0]?.event_id !== 'WH-SYNTHETIC-PAYPAL-001') {
      throw new Error('Runtime role could not reserve a PayPal webhook event.');
    }
  });
}

async function inspectRuntimePrivilegeBoundary() {
  return withClient(runtimeUrl, async (client) => {
    let leastPrivilegeVerified = true;

    for (const statement of [
      'DELETE FROM legend_commerce.orders WHERE false',
      'TRUNCATE TABLE legend_commerce.orders',
      'DELETE FROM legend_commerce.paypal_webhook_events WHERE false',
      'TRUNCATE TABLE legend_commerce.paypal_webhook_events',
    ]) {
      try {
        await client.query(statement);
        leastPrivilegeVerified = false;
      } catch (error) {
        if (error?.code === '42501') continue;
        throw error;
      }
    }

    return leastPrivilegeVerified;
  });
}

try {
  const report = await runOrderStoreConformance(async () => {
    await clearSyntheticRecords();
    return createNeonOrderStore({ connectionString: runtimeUrl });
  });

  await clearSyntheticRecords();
  await verifyPaypalProviderCompatibility();
  const leastPrivilegeVerified = await inspectRuntimePrivilegeBoundary();

  console.log(
    `Real Neon order-store integration passed ${report.checkCount} conformance checks.`,
  );
  for (const check of report.checks) {
    console.log(`- ${check}`);
  }
  console.log('- PayPal order IDs persist with derived payment_provider=paypal');
  console.log('- PayPal webhook event ledger accepts runtime event reservations');

  if (leastPrivilegeVerified) {
    console.log('- least-privilege runtime role');
  } else {
    console.warn(
      '::warning::The isolated Neon runtime role is Neon-managed and has broader privileges than the order-store contract. The integration is operational, but a dedicated least-privilege production role is still required before live payments are enabled.',
    );
  }
} finally {
  await clearSyntheticRecords();
}
