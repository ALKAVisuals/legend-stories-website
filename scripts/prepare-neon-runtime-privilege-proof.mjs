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

function normalizePgArray(value) {
  if (Array.isArray(value)) return value.map(String).sort();
  const text = String(value ?? '').trim();
  if (!text || text === '{}') return [];
  return text.slice(1, -1).split(',').filter(Boolean).map((item) => item.replace(/^"|"$/g, '')).sort();
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

async function ensureProofRoles(client) {
  const capabilityRole = quoteIdentifier(PRIVILEGE_PROOF_CAPABILITY_ROLE);
  const loginRole = quoteIdentifier(PRIVILEGE_PROOF_LOGIN_ROLE);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PRIVILEGE_PROOF_CAPABILITY_ROLE}') THEN
        CREATE ROLE ${capabilityRole}
          NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${PRIVILEGE_PROOF_LOGIN_ROLE}') THEN
        CREATE ROLE ${loginRole}
          LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD NULL;
      END IF;
    END
    $$
  `);

  const roleResult = await client.query(`
    SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin,
           rolreplication, rolbypassrls
    FROM pg_roles
    WHERE rolname IN ($1, $2)
    ORDER BY rolname
  `, [PRIVILEGE_PROOF_CAPABILITY_ROLE, PRIVILEGE_PROOF_LOGIN_ROLE]);
  const roleByName = new Map(roleResult.rows.map((row) => [row.rolname, row]));
  const capability = roleByName.get(PRIVILEGE_PROOF_CAPABILITY_ROLE);
  const login = roleByName.get(PRIVILEGE_PROOF_LOGIN_ROLE);
  if (!capability || !login) throw new Error('Could not resolve isolated Neon privilege-proof roles.');

  for (const role of [capability, login]) {
    if (role.rolsuper || role.rolcreaterole || role.rolcreatedb || role.rolreplication || role.rolbypassrls || !role.rolinherit) {
      throw new Error(`Privilege-proof role ${role.rolname} has forbidden PostgreSQL attributes.`);
    }
  }
  if (capability.rolcanlogin || !login.rolcanlogin) {
    throw new Error('Privilege-proof LOGIN/NOLOGIN role boundary is invalid.');
  }

  const membershipResult = await client.query(`
    SELECT member.rolname AS member_name,
           COALESCE(array_agg(parent.rolname ORDER BY parent.rolname)
             FILTER (WHERE parent.rolname IS NOT NULL), ARRAY[]::name[]) AS member_of
    FROM pg_roles member
    LEFT JOIN pg_auth_members membership ON membership.member = member.oid
    LEFT JOIN pg_roles parent ON parent.oid = membership.roleid
    WHERE member.rolname IN ($1, $2)
    GROUP BY member.rolname
    ORDER BY member.rolname
  `, [PRIVILEGE_PROOF_CAPABILITY_ROLE, PRIVILEGE_PROOF_LOGIN_ROLE]);
  const memberships = new Map(membershipResult.rows.map((row) => [row.member_name, normalizePgArray(row.member_of)]));
  const capabilityMemberships = memberships.get(PRIVILEGE_PROOF_CAPABILITY_ROLE) || [];
  const loginMemberships = memberships.get(PRIVILEGE_PROOF_LOGIN_ROLE) || [];
  if (!sameMembers(capabilityMemberships, [])) {
    throw new Error('Privilege-proof capability role inherits an unexpected role.');
  }
  if (!sameMembers(loginMemberships, [])
    && !sameMembers(loginMemberships, [PRIVILEGE_PROOF_CAPABILITY_ROLE])) {
    throw new Error('Privilege-proof application role inherits an unexpected role.');
  }

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
