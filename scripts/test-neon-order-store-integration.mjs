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

async function inspectRuntimePrivilegeBoundary() {
  return withClient(runtimeUrl, async (client) => {
    let leastPrivilegeVerified = true;

    for (const statement of [
      'DELETE FROM legend_commerce.orders WHERE false',
      'TRUNCATE TABLE legend_commerce.orders',
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

  const leastPrivilegeVerified = await inspectRuntimePrivilegeBoundary();

  console.log(
    `Real Neon order-store integration passed ${report.checkCount} conformance checks.`,
  );
  for (const check of report.checks) {
    console.log(`- ${check}`);
  }

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
