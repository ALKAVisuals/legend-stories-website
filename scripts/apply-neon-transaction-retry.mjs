import { readFile, writeFile } from 'node:fs/promises';

const adapterPath = new URL('../server/adapters/neon-order-store.mjs', import.meta.url);
let adapter = await readFile(adapterPath, 'utf8');

function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Could not find ${label}.`);
  }
  return source.replace(search, replacement);
}

adapter = replaceOrThrow(
  adapter,
  `async function withSerializableTransaction(clientFactory, connectionString, action) {\n  const client = validateClient(await clientFactory(connectionString));\n  let transactionStarted = false;\n  try {\n    await client.connect();\n    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');\n    transactionStarted = true;\n    const result = await action(client);\n    await client.query('COMMIT');\n    transactionStarted = false;\n    return result;\n  } catch (error) {\n    if (transactionStarted) {\n      try {\n        await client.query('ROLLBACK');\n      } catch {\n        // Preserve the original transaction error.\n      }\n    }\n    throw normalizeDatabaseError(error);\n  } finally {\n    await closeClient(client);\n  }\n}`,
  `const MAX_SERIALIZABLE_ATTEMPTS = 4;\nconst SERIALIZABLE_RETRY_BASE_DELAY_MS = 15;\n\nfunction isRetryableTransactionError(error) {\n  return error instanceof NeonOrderStoreError\n    && error.code === 'ORDER_STORE_RETRYABLE';\n}\n\nfunction transactionRetryDelay(attempt) {\n  return SERIALIZABLE_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1));\n}\n\nasync function waitForTransactionRetry(attempt) {\n  await new Promise((resolve) => {\n    setTimeout(resolve, transactionRetryDelay(attempt));\n  });\n}\n\nasync function withSerializableTransaction(clientFactory, connectionString, action) {\n  let lastError;\n\n  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {\n    const client = validateClient(await clientFactory(connectionString));\n    let transactionStarted = false;\n    try {\n      await client.connect();\n      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');\n      transactionStarted = true;\n      const result = await action(client);\n      await client.query('COMMIT');\n      transactionStarted = false;\n      return result;\n    } catch (error) {\n      if (transactionStarted) {\n        try {\n          await client.query('ROLLBACK');\n        } catch {\n          // Preserve the original transaction error.\n        }\n      }\n\n      const normalized = normalizeDatabaseError(error);\n      lastError = normalized;\n      if (!isRetryableTransactionError(normalized)\n        || attempt === MAX_SERIALIZABLE_ATTEMPTS) {\n        throw normalized;\n      }\n    } finally {\n      await closeClient(client);\n    }\n\n    await waitForTransactionRetry(attempt);\n  }\n\n  throw lastError;\n}`,
  'serializable transaction helper',
);

await writeFile(adapterPath, adapter);

const retryTest = `import test from 'node:test';
import assert from 'node:assert/strict';

import { createNeonOrderStore } from '../server/adapters/neon-order-store.mjs';

const DATABASE_URL = 'postgresql://legend:secret@ep-retry-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const reference = 'f'.repeat(64);

function pendingOrder() {
  return {
    reference,
    status: 'payment_pending',
    amountTotal: 4890,
    currency: 'EUR',
    mode: 'test',
    paymentSessionId: 'cs_test_transaction_retry',
    createdAt: 1_800_000_000,
    updatedAt: 1_800_000_000,
    paidAt: null,
    lastStripeEventCreated: 0,
    version: 0,
    customer: {
      firstname: 'Retry',
      lastname: 'Buyer',
      email: 'retry@example.com',
      street: 'Teststraat 10',
      line2: '',
      zip: '1234 AB',
      city: 'Amsterdam',
      country: 'NL',
    },
    items: [{
      slug: 'combat-grind-cycle',
      page: 'combat-grind-cycle.html',
      name: 'The Grind Cycle',
      image: 'media/stikkers/example.png',
      unitPrice: 49.95,
      quantity: 1,
      lineTotal: 49.95,
    }],
    discount: { code: 'LEGEND10', percent: 10, amount: 5 },
    shipping: {
      deliveryCountry: 'NL',
      zoneCode: 'NL',
      zone: 'Netherlands',
      cost: 3.95,
      freeFrom: 50,
      qualifiesForFreeShipping: false,
    },
    totals: {
      subtotal: 4995,
      discount: 500,
      discountedSubtotal: 4495,
      shipping: 395,
      grandTotal: 4890,
    },
  };
}

function row(order) {
  return {
    reference: order.reference,
    status: order.status,
    amount_total: order.amountTotal,
    currency: order.currency,
    mode: order.mode,
    payment_session_id: order.paymentSessionId,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    paid_at: order.paidAt,
    last_stripe_event_id: null,
    last_stripe_event_type: null,
    last_stripe_event_created: order.lastStripeEventCreated,
    version: order.version,
    customer: structuredClone(order.customer),
    items: structuredClone(order.items),
    discount: structuredClone(order.discount),
    shipping: structuredClone(order.shipping),
    totals: structuredClone(order.totals),
  };
}

test('retries the complete serializable transaction after SQLSTATE 40001', async () => {
  const order = pendingOrder();
  const operations = [];
  let clientCount = 0;

  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      clientCount += 1;
      const attempt = clientCount;
      return {
        async connect() {
          operations.push(\`connect:\${attempt}\`);
        },
        async query(sql) {
          const normalized = String(sql).replace(/\\s+/g, ' ').trim();
          operations.push(\`query:\${attempt}:\${normalized.split(' ')[0]}\`);
          if (normalized === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return { rows: [] };
          if (normalized.startsWith('INSERT INTO legend_commerce.orders')) {
            if (attempt === 1) {
              const error = new Error('serialization failure');
              error.code = '40001';
              throw error;
            }
            return { rows: [row(order)] };
          }
          if (normalized === 'ROLLBACK' || normalized === 'COMMIT') return { rows: [] };
          throw new Error(\`Unexpected SQL query: \${normalized}\`);
        },
        async end() {
          operations.push(\`end:\${attempt}\`);
        },
      };
    },
  });

  const result = await store.persistPendingCheckout(order);

  assert.equal(clientCount, 2);
  assert.equal(result.created, true);
  assert.deepEqual(result.order, order);
  assert.ok(operations.includes('query:1:ROLLBACK'));
  assert.ok(operations.includes('end:1'));
  assert.ok(operations.includes('query:2:COMMIT'));
  assert.ok(operations.includes('end:2'));
});

test('stops after four retryable serializable transaction failures', async () => {
  const order = pendingOrder();
  let clientCount = 0;

  const store = createNeonOrderStore({
    connectionString: DATABASE_URL,
    clientFactory: async () => {
      clientCount += 1;
      return {
        async connect() {},
        async query(sql) {
          const normalized = String(sql).replace(/\\s+/g, ' ').trim();
          if (normalized === 'BEGIN ISOLATION LEVEL SERIALIZABLE') return { rows: [] };
          if (normalized.startsWith('INSERT INTO legend_commerce.orders')) {
            const error = new Error('serialization failure');
            error.code = '40001';
            throw error;
          }
          if (normalized === 'ROLLBACK') return { rows: [] };
          throw new Error(\`Unexpected SQL query: \${normalized}\`);
        },
        async end() {},
      };
    },
  });

  await assert.rejects(
    () => store.persistPendingCheckout(order),
    (error) => error?.code === 'ORDER_STORE_RETRYABLE'
      && error?.details?.sqlState === '40001',
  );
  assert.equal(clientCount, 4);
});
`;

await writeFile(new URL('../tests/neon-transaction-retry.test.mjs', import.meta.url), retryTest);
