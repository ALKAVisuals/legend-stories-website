import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import { createNeonV3InvoiceAccessAuditStore } from '../server/adapters/neon-v3-invoice-access-audit-store.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Neon invoice-access audit proof.`);
  return validateNeonConnectionString(value);
}

async function withClient(connectionString, action) {
  const client = await createDefaultNeonClient(connectionString);
  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.end();
  }
}

const runtimeUrl = requireEnvironmentUrl('NEON_TEST_DATABASE_URL');
const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const orderReference = 'd'.repeat(64);
const invoiceId = 900077;
const timestamps = [1_800_300_000, 1_800_300_010];
let clockIndex = 0;

async function clearFixture() {
  await withClient(migrationUrl, (client) => client.query(
    'DELETE FROM legend_commerce.invoice_access_audit WHERE order_reference = $1',
    [orderReference],
  ));
}

try {
  await clearFixture();

  const auditStore = createNeonV3InvoiceAccessAuditStore({
    connectionString: runtimeUrl,
    clock: () => timestamps[Math.min(clockIndex++, timestamps.length - 1)],
  });

  const customer = await auditStore.recordInvoiceAccess({
    channel: 'customer',
    orderReference,
    invoiceId,
    outcome: 'success',
    reasonCode: 'download_success',
  });
  const dashboard = await auditStore.recordInvoiceAccess({
    channel: 'dashboard',
    orderReference,
    invoiceId,
    outcome: 'unavailable',
    reasonCode: 'storage_unavailable',
  });

  if (customer.occurredAt !== timestamps[0]
    || customer.retainUntil !== timestamps[0] + 7_776_000
    || dashboard.occurredAt !== timestamps[1]
    || dashboard.retainUntil !== timestamps[1] + 7_776_000) {
    throw new Error('Invoice-access audit adapter did not apply the locked 90-day normal retention window.');
  }

  const rows = await withClient(migrationUrl, async (client) => {
    const result = await client.query(
      `SELECT event_id::text, order_reference, invoice_id, channel, outcome,
              reason_code, occurred_at, retain_until
       FROM legend_commerce.invoice_access_audit
       WHERE order_reference = $1
       ORDER BY occurred_at`,
      [orderReference],
    );
    return result.rows || [];
  });

  if (rows.length !== 2) {
    throw new Error(`Expected 2 durable invoice-access audit rows, found ${rows.length}.`);
  }

  const [storedCustomer, storedDashboard] = rows;
  if (storedCustomer.order_reference !== orderReference
    || Number(storedCustomer.invoice_id) !== invoiceId
    || storedCustomer.channel !== 'customer'
    || storedCustomer.outcome !== 'success'
    || storedCustomer.reason_code !== 'download_success'
    || Number(storedCustomer.occurred_at) !== timestamps[0]
    || Number(storedCustomer.retain_until) !== timestamps[0] + 7_776_000) {
    throw new Error('Customer invoice-access audit row did not persist the expected minimal durable contract.');
  }

  if (storedDashboard.order_reference !== orderReference
    || Number(storedDashboard.invoice_id) !== invoiceId
    || storedDashboard.channel !== 'dashboard'
    || storedDashboard.outcome !== 'unavailable'
    || storedDashboard.reason_code !== 'storage_unavailable'
    || Number(storedDashboard.occurred_at) !== timestamps[1]
    || Number(storedDashboard.retain_until) !== timestamps[1] + 7_776_000) {
    throw new Error('Dashboard invoice-access audit row did not persist the expected minimal durable contract.');
  }

  console.log('Proved durable V3 invoice-access audit persistence on isolated Neon.');
  console.log('- customer and dashboard channels persist only the approved minimal event fields');
  console.log('- normal retention eligibility is initialized exactly 90 days after occurrence');
} finally {
  await clearFixture();
}
