import { readFile } from 'node:fs/promises';

import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import {
  PRIVILEGE_PROOF_CAPABILITY_ROLE,
  PRIVILEGE_PROOF_LOGIN_ROLE,
} from './neon-runtime-privilege-contract.mjs';

const GRANT_MIGRATIONS = [
  new URL('../server/db/migrations/002_grant_order_store_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/006_grant_withdrawal_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/008_grant_withdrawal_acknowledgement_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/010_grant_order_notifications_runtime.sql', import.meta.url),
  new URL('../server/db/migrations/012_grant_v3_order_invoice_runtime.sql', import.meta.url),
];

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Neon privilege-proof workflow.`);
  return validateNeonConnectionString(value);
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

async function ensureProofRoles(client) {
  const capabilityRole = quoteIdentifier(PRIVILEGE_PROOF_CAPABILITY_ROLE);
  const loginRole = quoteIdentifier(PRIVILEGE_PROOF_LOGIN_ROLE);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PRIVILEGE_PROOF_CAPABILITY_ROLE}') THEN
        CREATE ROLE ${capabilityRole};
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PRIVILEGE_PROOF_LOGIN_ROLE}') THEN
        CREATE ROLE ${loginRole} LOGIN;
      END IF;
    END
    $$
  `);

  await client.query(`ALTER ROLE ${capabilityRole} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT`);
  await client.query(`ALTER ROLE ${loginRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD NULL`);

  await client.query(`REVOKE neon_superuser FROM ${capabilityRole}`);
  await client.query(`REVOKE neon_superuser FROM ${loginRole}`);
  await client.query(`REVOKE ${capabilityRole} FROM ${loginRole}`);

  await client.query(`REVOKE ALL PRIVILEGES ON SCHEMA legend_commerce FROM ${capabilityRole}`);
  await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA legend_commerce FROM ${capabilityRole}`);
  await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA legend_commerce FROM ${capabilityRole}`);

  await client.query(`REVOKE ALL PRIVILEGES ON SCHEMA legend_commerce FROM ${loginRole}`);
  await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA legend_commerce FROM ${loginRole}`);
  await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA legend_commerce FROM ${loginRole}`);
}

const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const client = await createDefaultNeonClient(migrationUrl);

try {
  await client.connect();
  await ensureProofRoles(client);

  for (const migrationUrlObject of GRANT_MIGRATIONS) {
    let migration = await readFile(migrationUrlObject, 'utf8');
    migration = migration.replaceAll(
      '__LEGEND_RUNTIME_ROLE__',
      quoteIdentifier(PRIVILEGE_PROOF_CAPABILITY_ROLE),
    );
    if (migration.includes('__LEGEND_RUNTIME_ROLE__')) {
      throw new Error(`Grant migration ${migrationUrlObject.pathname} contains an unresolved role placeholder.`);
    }
    await client.query(migration);
  }

  await client.query(`GRANT ${quoteIdentifier(PRIVILEGE_PROOF_CAPABILITY_ROLE)} TO ${quoteIdentifier(PRIVILEGE_PROOF_LOGIN_ROLE)}`);
  console.log('Prepared isolated least-privilege Neon runtime proof roles.');
} finally {
  await client.end();
}
