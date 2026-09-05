import {
  createDefaultNeonClient,
  validateNeonConnectionString,
} from '../server/adapters/neon-order-store.mjs';
import {
  EXPECTED_SEQUENCE_PRIVILEGES,
  EXPECTED_TABLE_PRIVILEGES,
  EXPECTED_UPDATE_COLUMNS,
  PRIVILEGE_PROOF_CAPABILITY_ROLE,
  PRIVILEGE_PROOF_LOGIN_ROLE,
  TABLE_PRIVILEGES,
} from './neon-runtime-privilege-contract.mjs';

function requireEnvironmentUrl(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the Neon privilege-proof workflow.`);
  return validateNeonConnectionString(value);
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function normalizePgArray(value) {
  if (Array.isArray(value)) return value.map(String).sort();
  const text = String(value ?? '').trim();
  if (!text || text === '{}') return [];
  return text.slice(1, -1).split(',').filter(Boolean).map((item) => item.replace(/^"|"$/g, '')).sort();
}

function expectedBooleanMap(expected) {
  const expectedSet = new Set(expected);
  return Object.fromEntries(TABLE_PRIVILEGES.map((privilege) => [
    `can_${privilege.toLowerCase()}`,
    expectedSet.has(privilege),
  ]));
}

const migrationUrl = requireEnvironmentUrl('NEON_TEST_MIGRATION_URL');
const client = await createDefaultNeonClient(migrationUrl);

try {
  await client.connect();

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
  if (!capability || !login) fail('Least-privilege proof roles are missing.');

  for (const role of [capability, login]) {
    if (role.rolsuper || role.rolcreaterole || role.rolcreatedb || role.rolreplication || role.rolbypassrls || !role.rolinherit) {
      fail('Least-privilege role has forbidden PostgreSQL attributes.', { role: role.rolname, attributes: role });
    }
  }
  if (capability.rolcanlogin) fail('Capability role must be NOLOGIN.');
  if (!login.rolcanlogin) fail('Application proof role must be LOGIN-capable.');

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
  if (!sameMembers(memberships.get(PRIVILEGE_PROOF_CAPABILITY_ROLE) || [], [])) {
    fail('Capability role must not inherit another role.', { memberOf: memberships.get(PRIVILEGE_PROOF_CAPABILITY_ROLE) });
  }
  if (!sameMembers(memberships.get(PRIVILEGE_PROOF_LOGIN_ROLE) || [], [PRIVILEGE_PROOF_CAPABILITY_ROLE])) {
    fail('Application proof role must inherit only the capability role.', { memberOf: memberships.get(PRIVILEGE_PROOF_LOGIN_ROLE) });
  }

  const boundaryResult = await client.query(`
    SELECT
      has_database_privilege($1, current_database(), 'CONNECT') AS db_connect,
      has_database_privilege($1, current_database(), 'CREATE') AS db_create,
      has_schema_privilege($1, 'legend_commerce', 'USAGE') AS schema_usage,
      has_schema_privilege($1, 'legend_commerce', 'CREATE') AS schema_create
  `, [PRIVILEGE_PROOF_LOGIN_ROLE]);
  const boundary = boundaryResult.rows[0];
  if (!boundary?.db_connect || boundary.db_create || !boundary.schema_usage || boundary.schema_create) {
    fail('Application proof role violates the database/schema privilege boundary.', { boundary });
  }

  const tableListResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'legend_commerce' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const actualTables = tableListResult.rows.map((row) => row.table_name).sort();
  const expectedTables = Object.keys(EXPECTED_TABLE_PRIVILEGES).sort();
  if (!sameMembers(actualTables, expectedTables)) {
    fail('Privilege contract table set drifted and requires review.', { actualTables, expectedTables });
  }

  for (const tableName of expectedTables) {
    const privilegeResult = await client.query(`
      SELECT
        has_table_privilege($1, format('legend_commerce.%I', $2), 'SELECT') AS can_select,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'INSERT') AS can_insert,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'UPDATE') AS can_update,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'DELETE') AS can_delete,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'TRUNCATE') AS can_truncate,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'REFERENCES') AS can_references,
        has_table_privilege($1, format('legend_commerce.%I', $2), 'TRIGGER') AS can_trigger
    `, [PRIVILEGE_PROOF_LOGIN_ROLE, tableName]);
    const actual = privilegeResult.rows[0];
    const expected = expectedBooleanMap(EXPECTED_TABLE_PRIVILEGES[tableName]);
    for (const [key, value] of Object.entries(expected)) {
      if (Boolean(actual?.[key]) !== value) {
        fail('Table privilege contract mismatch.', { tableName, privilege: key, actual: actual?.[key], expected: value });
      }
    }
  }

  for (const [tableName, expectedColumns] of Object.entries(EXPECTED_UPDATE_COLUMNS)) {
    const columnsResult = await client.query(`
      SELECT column_name,
             has_column_privilege($1, format('legend_commerce.%I', $2), column_name, 'UPDATE') AS can_update
      FROM information_schema.columns
      WHERE table_schema = 'legend_commerce' AND table_name = $2
      ORDER BY ordinal_position
    `, [PRIVILEGE_PROOF_LOGIN_ROLE, tableName]);
    const actualColumns = columnsResult.rows.filter((row) => row.can_update).map((row) => row.column_name).sort();
    const expectedSorted = [...expectedColumns].sort();
    if (!sameMembers(actualColumns, expectedSorted)) {
      fail('Column-level UPDATE privilege contract mismatch.', { tableName, actualColumns, expectedColumns: expectedSorted });
    }
  }

  for (const [sequenceName, expectedPrivileges] of Object.entries(EXPECTED_SEQUENCE_PRIVILEGES)) {
    const sequenceResult = await client.query(`
      SELECT
        has_sequence_privilege($1, format('legend_commerce.%I', $2), 'USAGE') AS can_usage,
        has_sequence_privilege($1, format('legend_commerce.%I', $2), 'SELECT') AS can_select,
        has_sequence_privilege($1, format('legend_commerce.%I', $2), 'UPDATE') AS can_update
    `, [PRIVILEGE_PROOF_LOGIN_ROLE, sequenceName]);
    const sequence = sequenceResult.rows[0];
    const expectedSet = new Set(expectedPrivileges);
    if (Boolean(sequence?.can_usage) !== expectedSet.has('USAGE')
      || Boolean(sequence?.can_select) !== expectedSet.has('SELECT')
      || Boolean(sequence?.can_update) !== expectedSet.has('UPDATE')) {
      fail('Sequence privilege contract mismatch.', { sequenceName, sequence, expectedPrivileges });
    }
  }

  console.log('Verified isolated Neon least-privilege runtime contract: no admin/create/delete escalation and exact V3 DML grants.');
} finally {
  await client.end();
}
