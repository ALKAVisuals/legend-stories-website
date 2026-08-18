import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const [
  packageSource,
  workflow,
  migrationRunner,
  integrationRunner,
  baseGrants,
  paypalMigration,
  paypalGrants,
  withdrawalMigration,
  withdrawalGrants,
  activationDoc,
] = await Promise.all([
  readFile(new URL('package.json', ROOT), 'utf8'),
  readFile(new URL('.github/workflows/neon-order-store-integration.yml', ROOT), 'utf8'),
  readFile(new URL('scripts/run-neon-test-migrations.mjs', ROOT), 'utf8'),
  readFile(new URL('scripts/test-neon-order-store-integration.mjs', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/002_grant_order_store_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/003_add_paypal_reconciliation.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/005_create_withdrawal_requests.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/006_grant_withdrawal_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('docs/NEON_INTEGRATION_ACTIVATION.md', ROOT), 'utf8'),
]);

const pkg = JSON.parse(packageSource);
const errors = [];

for (const [name, expected] of [
  ['@neondatabase/serverless', '1.0.2'],
  ['ws', '8.21.1'],
]) {
  if (pkg.dependencies?.[name] !== expected) {
    errors.push(`${name} must be pinned exactly to ${expected}.`);
  }
}

for (const [name, expected] of [
  ['migrate:neon:test', 'node scripts/run-neon-test-migrations.mjs'],
  ['test:neon:integration', 'node scripts/test-neon-order-store-integration.mjs'],
  ['validate:neon-integration', 'node scripts/validate-neon-integration-harness.mjs'],
]) {
  if (pkg.scripts?.[name] !== expected) {
    errors.push(`package.json is missing the exact ${name} script.`);
  }
}

if (!/^on:\n  workflow_dispatch:\s*$/m.test(workflow)) {
  errors.push('The Neon integration workflow must be manual workflow_dispatch only.');
}
if (/\n  (push|pull_request|schedule):/.test(workflow)) {
  errors.push('The Neon integration workflow must not run automatically.');
}
if (!workflow.includes('permissions:\n  contents: read')) {
  errors.push('The Neon integration workflow must keep repository permissions read-only.');
}
for (const secret of ['NEON_TEST_DATABASE_URL', 'NEON_TEST_MIGRATION_URL']) {
  const secretExpression = `${secret}: $` + `{{ secrets.${secret} }}`;
  if (!workflow.includes(secretExpression)) {
    errors.push(`The workflow must source ${secret} only from GitHub secrets.`);
  }
  if (new RegExp(`echo[^\\n]*\\$${secret}`).test(workflow)) {
    errors.push(`The workflow must never echo ${secret}.`);
  }
}
if (!workflow.includes('environment: neon-integration')) {
  errors.push('The real database job must use the neon-integration environment.');
}
if (!workflow.includes('npm ci')) {
  errors.push('The real database job must install the exact dependency lock.');
}
if (!workflow.includes('npm run migrate:neon:test')
  || !workflow.includes('npm run test:neon:integration')) {
  errors.push('The workflow must run migrations before real conformance tests.');
}

for (const marker of [
  "migrationConfig.hostname.includes('-pooler.')",
  'Migration and runtime URLs must use separate Neon database roles.',
  '__LEGEND_RUNTIME_ROLE__',
  'quoteIdentifier(runtimeRole)',
  '003_add_paypal_reconciliation.sql',
  '004_grant_paypal_reconciliation_runtime.sql',
  '005_create_withdrawal_requests.sql',
  '006_grant_withdrawal_runtime.sql',
]) {
  if (!migrationRunner.includes(marker)) {
    errors.push(`Migration runner is missing safety marker: ${marker}`);
  }
}

for (const marker of [
  'runOrderStoreConformance',
  'clearSyntheticRecords',
  'finally',
  'legend_commerce.paypal_webhook_events',
  'payment_provider',
  "!== 'paypal'",
  'DELETE FROM legend_commerce.orders WHERE false',
  'TRUNCATE TABLE legend_commerce.orders',
  'DELETE FROM legend_commerce.paypal_webhook_events WHERE false',
  'TRUNCATE TABLE legend_commerce.paypal_webhook_events',
  'legend_commerce.withdrawal_requests',
  'createNeonWithdrawalStore',
  'DELETE FROM legend_commerce.withdrawal_requests WHERE false',
  'TRUNCATE TABLE legend_commerce.withdrawal_requests',
  "error?.code === '42501'",
]) {
  if (!integrationRunner.includes(marker)) {
    errors.push(`Integration runner is missing safety marker: ${marker}`);
  }
}

for (const statement of [
  'GRANT USAGE ON SCHEMA legend_commerce',
  'GRANT SELECT, INSERT, UPDATE',
  'GRANT SELECT, INSERT',
]) {
  if (!baseGrants.includes(statement)) {
    errors.push(`Base runtime grant migration is missing: ${statement}`);
  }
}
if (/\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/.test(baseGrants)) {
  errors.push('The base runtime grant migration must not grant destructive or DDL privileges.');
}

for (const marker of [
  'ADD COLUMN IF NOT EXISTS payment_provider text',
  'GENERATED ALWAYS AS',
  'CREATE TABLE IF NOT EXISTS legend_commerce.paypal_webhook_events',
]) {
  if (!paypalMigration.includes(marker)) {
    errors.push(`PayPal reconciliation migration is missing: ${marker}`);
  }
}
for (const marker of [
  'GRANT SELECT, INSERT',
  'ON TABLE legend_commerce.paypal_webhook_events',
  '__LEGEND_RUNTIME_ROLE__',
]) {
  if (!paypalGrants.includes(marker)) {
    errors.push(`PayPal runtime grant migration is missing: ${marker}`);
  }
}
if (/\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/.test(paypalGrants)) {
  errors.push('The PayPal runtime grant migration must not grant destructive or DDL privileges.');
}

for (const marker of [
  'CREATE TABLE IF NOT EXISTS legend_commerce.withdrawal_requests',
  'REFERENCES legend_commerce.orders(reference)',
]) {
  if (!withdrawalMigration.includes(marker)) {
    errors.push(`Withdrawal migration is missing: ${marker}`);
  }
}
for (const marker of [
  'GRANT SELECT ON legend_commerce.orders',
  'GRANT SELECT, INSERT ON legend_commerce.withdrawal_requests',
  '__LEGEND_RUNTIME_ROLE__',
]) {
  if (!withdrawalGrants.includes(marker)) {
    errors.push(`Withdrawal runtime grant migration is missing: ${marker}`);
  }
}
if (withdrawalGrants.includes('CURRENT_USER')) {
  errors.push('Withdrawal runtime grants must target the explicit runtime-role placeholder, not CURRENT_USER.');
}
if (/\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/.test(withdrawalGrants)) {
  errors.push('The withdrawal runtime grant migration must not grant destructive or DDL privileges.');
}

for (const marker of [
  'NEON_TEST_DATABASE_URL',
  'NEON_TEST_MIGRATION_URL',
  'workflow_dispatch',
  'does not touch Netlify',
  'PayPal',
]) {
  if (!activationDoc.includes(marker)) {
    errors.push(`Neon activation documentation is missing: ${marker}`);
  }
}

if (errors.length) {
  console.error('Neon integration harness validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Neon integration harness validation passed with pinned drivers, manual execution, PayPal-compatible migrations, least-privilege grants and guaranteed fixture cleanup.');
