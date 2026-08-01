import {
  createDefaultNeonClient,
  createNeonOrderStore,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
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
      legend_commerce.stripe_events,
      legend_commerce.orders
  `));
}

async function assertRuntimeCannotMutateOutsideContract() {
  await withClient(runtimeUrl, async (client) => {
    for (const statement of [
      'DELETE FROM legend_commerce.orders WHERE false',
      'TRUNCATE TABLE legend_commerce.orders',
    ]) {
      try {
        await client.query(statement);
      } catch (error) {
        if (error?.code === '42501') continue;
        throw error;
      }
      throw new Error('The Neon runtime role has destructive privileges outside the order-store contract.');
    }
  });
}

try {
  const report = await runOrderStoreConformance(async () => {
    await clearSyntheticRecords();
    return createNeonOrderStore({ connectionString: runtimeUrl });
  });

  await assertRuntimeCannotMutateOutsideContract();

  console.log(
    `Real Neon order-store integration passed ${report.checkCount} conformance checks.`,
  );
  for (const check of report.checks) {
    console.log(`- ${check}`);
  }
  console.log('- least-privilege runtime role');
} finally {
  await clearSyntheticRecords();
}
