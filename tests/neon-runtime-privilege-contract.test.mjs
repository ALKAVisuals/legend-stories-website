import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  EXPECTED_SEQUENCE_PRIVILEGES,
  EXPECTED_TABLE_PRIVILEGES,
  EXPECTED_UPDATE_COLUMNS,
  PRIVILEGE_PROOF_CAPABILITY_ROLE,
  PRIVILEGE_PROOF_LOGIN_ROLE,
} from '../scripts/neon-runtime-privilege-contract.mjs';

const prepSource = await readFile(new URL('../scripts/prepare-neon-runtime-privilege-proof.mjs', import.meta.url), 'utf8');
const verifySource = await readFile(new URL('../scripts/verify-neon-runtime-privileges.mjs', import.meta.url), 'utf8');
const workflowSource = await readFile(new URL('../.github/workflows/neon-order-store-integration.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const sorted = (values) => [...values].sort();

test('runtime privilege contract covers the complete current commerce table set with no destructive table rights', () => {
  assert.deepEqual(sorted(Object.keys(EXPECTED_TABLE_PRIVILEGES)), sorted([
    'orders',
    'stripe_events',
    'paypal_webhook_events',
    'withdrawal_requests',
    'withdrawal_acknowledgements',
    'order_notifications',
    'invoices',
    'document_number_series',
  ]));

  for (const [tableName, privileges] of Object.entries(EXPECTED_TABLE_PRIVILEGES)) {
    assert.ok(privileges.includes('SELECT'), `${tableName} must remain readable by the storefront runtime`);
    assert.ok(!privileges.includes('DELETE'), `${tableName} may not grant DELETE`);
    assert.ok(!privileges.includes('TRUNCATE'), `${tableName} may not grant TRUNCATE`);
    assert.ok(!privileges.includes('REFERENCES'), `${tableName} may not grant REFERENCES`);
    assert.ok(!privileges.includes('TRIGGER'), `${tableName} may not grant TRIGGER`);
  }

  assert.deepEqual(EXPECTED_TABLE_PRIVILEGES.invoices, ['SELECT', 'INSERT']);
  assert.deepEqual(EXPECTED_TABLE_PRIVILEGES.document_number_series, ['SELECT', 'INSERT']);
  assert.deepEqual(EXPECTED_UPDATE_COLUMNS.document_number_series, ['next_value', 'updated_at']);
  assert.deepEqual(EXPECTED_SEQUENCE_PRIVILEGES.invoices_id_seq, ['USAGE']);
});

test('isolated proof roles are clearly non-production and are hardened before grants are applied', () => {
  assert.match(PRIVILEGE_PROOF_CAPABILITY_ROLE, /^legendmural_ci_/);
  assert.match(PRIVILEGE_PROOF_LOGIN_ROLE, /^legendmural_ci_/);
  assert.match(prepSource, /NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT/);
  assert.match(prepSource, /LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT PASSWORD NULL/);
  assert.match(prepSource, /REVOKE neon_superuser FROM/);
  assert.match(prepSource, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA legend_commerce/);
  assert.match(prepSource, /REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA legend_commerce/);
  assert.doesNotMatch(prepSource, /PRODUCTION_DATABASE_URL|NETLIFY_DATABASE_URL|DATABASE_URL/);
});

test('proof setup derives grants only from the canonical runtime grant migrations', () => {
  for (const migrationNumber of ['002', '004', '006', '008', '010', '012']) {
    assert.match(prepSource, new RegExp(`${migrationNumber}_[^']+\\.sql`));
  }
  for (const migrationNumber of ['001', '003', '005', '007', '009', '011', '013', '014', '015']) {
    assert.doesNotMatch(prepSource, new RegExp(`new URL\\('../server/db/migrations/${migrationNumber}_`));
  }
});

test('effective privilege verifier checks admin attributes, memberships, schema boundary and exact negative DML rights', () => {
  assert.match(verifySource, /rolsuper/);
  assert.match(verifySource, /rolcreaterole/);
  assert.match(verifySource, /rolcreatedb/);
  assert.match(verifySource, /rolreplication/);
  assert.match(verifySource, /rolbypassrls/);
  assert.match(verifySource, /Application proof role must inherit only the capability role/);
  assert.match(verifySource, /has_database_privilege\(\$1, current_database\(\), 'CREATE'\)/);
  assert.match(verifySource, /has_schema_privilege\(\$1, 'legend_commerce', 'CREATE'\)/);
  assert.match(verifySource, /'DELETE'\) AS can_delete/);
  assert.match(verifySource, /'TRUNCATE'\) AS can_truncate/);
  assert.match(verifySource, /has_column_privilege/);
  assert.match(verifySource, /has_sequence_privilege/);
});

test('real Neon workflow runs privilege setup and verification before functional conformance', () => {
  assert.equal(
    packageJson.scripts['prepare:neon:runtime-privilege-proof'],
    'node scripts/prepare-neon-runtime-privilege-proof.mjs',
  );
  assert.equal(
    packageJson.scripts['verify:neon:runtime-privileges'],
    'node scripts/verify-neon-runtime-privileges.mjs',
  );

  const migrateIndex = workflowSource.indexOf('npm run migrate:neon:test');
  const prepareIndex = workflowSource.indexOf('npm run prepare:neon:runtime-privilege-proof');
  const verifyIndex = workflowSource.indexOf('npm run verify:neon:runtime-privileges');
  const conformanceIndex = workflowSource.indexOf('npm run test:neon:integration');
  assert.ok(migrateIndex >= 0 && prepareIndex > migrateIndex && verifyIndex > prepareIndex && conformanceIndex > verifyIndex);
});
