import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(path, from, to) {
  const before = read(path);
  if (!before.includes(from)) throw new Error(`${path}: expected source text not found`);
  const after = before.replace(from, to);
  if (after === before) throw new Error(`${path}: no change`);
  write(path, after);
}

write('server/db/migrations/006_grant_withdrawal_runtime.sql', `BEGIN;\n\nGRANT SELECT ON legend_commerce.orders TO __LEGEND_RUNTIME_ROLE__;\nGRANT SELECT, INSERT ON legend_commerce.withdrawal_requests TO __LEGEND_RUNTIME_ROLE__;\n\nCOMMIT;\n`);

replaceOnce(
  'scripts/run-neon-test-migrations.mjs',
  "  new URL('../server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', import.meta.url),\n];",
  "  new URL('../server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', import.meta.url),\n  new URL('../server/db/migrations/005_create_withdrawal_requests.sql', import.meta.url),\n  new URL('../server/db/migrations/006_grant_withdrawal_runtime.sql', import.meta.url),\n];",
);

replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';",
  "import { createNeonPayPalWebhookStore } from '../server/adapters/neon-paypal-webhook-store.mjs';\nimport { createNeonWithdrawalStore } from '../server/adapters/neon-withdrawal-store.mjs';",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "const PAYPAL_EVENT_ID = 'WH-SYNTHETIC-PAYPAL-001';",
  "const PAYPAL_EVENT_ID = 'WH-SYNTHETIC-PAYPAL-001';\nconst PAYPAL_CUSTOMER_EMAIL = 'paypal-integration@example.invalid';\nconst WITHDRAWAL_AT = 1_800_100_020;",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "    TRUNCATE TABLE\n      legend_commerce.paypal_webhook_events,",
  "    TRUNCATE TABLE\n      legend_commerce.withdrawal_requests,\n      legend_commerce.paypal_webhook_events,",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "      email: 'paypal-integration@example.invalid',",
  "      email: PAYPAL_CUSTOMER_EMAIL,",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "async function inspectRuntimePrivilegeBoundary() {",
  `async function verifyWithdrawalPersistence() {\n  const withdrawalStore = createNeonWithdrawalStore({ connectionString: runtimeUrl });\n  const first = await withdrawalStore.createWithdrawal({\n    orderId: PAYPAL_ORDER_ID,\n    email: PAYPAL_CUSTOMER_EMAIL,\n    withdrawnAt: WITHDRAWAL_AT,\n  });\n  if (!first.created || first.withdrawal.orderId !== PAYPAL_ORDER_ID\n    || !/^LM-WD-[A-F0-9]{16}$/.test(first.withdrawal.confirmationCode)) {\n    throw new Error('Runtime role could not create a valid withdrawal record.');\n  }\n\n  const duplicate = await withdrawalStore.createWithdrawal({\n    orderId: PAYPAL_ORDER_ID,\n    email: PAYPAL_CUSTOMER_EMAIL,\n    withdrawnAt: WITHDRAWAL_AT,\n  });\n  if (duplicate.created || duplicate.withdrawal.confirmationCode !== first.withdrawal.confirmationCode) {\n    throw new Error('Duplicate withdrawal registration was not idempotent.');\n  }\n}\n\nasync function inspectRuntimePrivilegeBoundary() {`,
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "      \"UPDATE legend_commerce.paypal_webhook_events SET event_type = event_type WHERE event_id = 'none'\",",
  "      \"UPDATE legend_commerce.paypal_webhook_events SET event_type = event_type WHERE event_id = 'none'\",\n      'DELETE FROM legend_commerce.withdrawal_requests WHERE false',\n      'TRUNCATE TABLE legend_commerce.withdrawal_requests',\n      \"UPDATE legend_commerce.withdrawal_requests SET confirmation_code = confirmation_code WHERE order_reference = '${PAYPAL_REFERENCE}'\",",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "  await verifyPaypalProviderCompatibilityAndReconciliation();\n  const leastPrivilegeVerified = await inspectRuntimePrivilegeBoundary();",
  "  await verifyPaypalProviderCompatibilityAndReconciliation();\n  await verifyWithdrawalPersistence();\n  const leastPrivilegeVerified = await inspectRuntimePrivilegeBoundary();",
);
replaceOnce(
  'scripts/test-neon-order-store-integration.mjs',
  "  console.log('- PayPal webhook event ledger accepts immutable runtime reservations');",
  "  console.log('- PayPal webhook event ledger accepts immutable runtime reservations');\n  console.log('- withdrawal registration persists idempotently through the runtime role');",
);

const validatorPath = 'scripts/validate-neon-integration-harness.mjs';
replaceOnce(
  validatorPath,
  "  paypalGrants,\n  activationDoc,",
  "  paypalGrants,\n  withdrawalMigration,\n  withdrawalGrants,\n  activationDoc,",
);
replaceOnce(
  validatorPath,
  "  readFile(new URL('server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', ROOT), 'utf8'),\n  readFile(new URL('docs/NEON_INTEGRATION_ACTIVATION.md', ROOT), 'utf8'),",
  "  readFile(new URL('server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', ROOT), 'utf8'),\n  readFile(new URL('server/db/migrations/005_create_withdrawal_requests.sql', ROOT), 'utf8'),\n  readFile(new URL('server/db/migrations/006_grant_withdrawal_runtime.sql', ROOT), 'utf8'),\n  readFile(new URL('docs/NEON_INTEGRATION_ACTIVATION.md', ROOT), 'utf8'),",
);
replaceOnce(
  validatorPath,
  "  '004_grant_paypal_reconciliation_runtime.sql',\n]) {",
  "  '004_grant_paypal_reconciliation_runtime.sql',\n  '005_create_withdrawal_requests.sql',\n  '006_grant_withdrawal_runtime.sql',\n]) {",
);
replaceOnce(
  validatorPath,
  "  'DELETE FROM legend_commerce.paypal_webhook_events WHERE false',\n  'TRUNCATE TABLE legend_commerce.paypal_webhook_events',",
  "  'DELETE FROM legend_commerce.paypal_webhook_events WHERE false',\n  'TRUNCATE TABLE legend_commerce.paypal_webhook_events',\n  'legend_commerce.withdrawal_requests',\n  'createNeonWithdrawalStore',\n  'DELETE FROM legend_commerce.withdrawal_requests WHERE false',\n  'TRUNCATE TABLE legend_commerce.withdrawal_requests',",
);
replaceOnce(
  validatorPath,
  "if (/\\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\\b/.test(paypalGrants)) {\n  errors.push('The PayPal runtime grant migration must not grant destructive or DDL privileges.');\n}\n\nfor (const marker of [",
  `if (/\\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\\b/.test(paypalGrants)) {\n  errors.push('The PayPal runtime grant migration must not grant destructive or DDL privileges.');\n}\n\nfor (const marker of [\n  'CREATE TABLE IF NOT EXISTS legend_commerce.withdrawal_requests',\n  'REFERENCES legend_commerce.orders(reference)',\n]) {\n  if (!withdrawalMigration.includes(marker)) {\n    errors.push(\`Withdrawal migration is missing: \${marker}\`);\n  }\n}\nfor (const marker of [\n  'GRANT SELECT ON legend_commerce.orders',\n  'GRANT SELECT, INSERT ON legend_commerce.withdrawal_requests',\n  '__LEGEND_RUNTIME_ROLE__',\n]) {\n  if (!withdrawalGrants.includes(marker)) {\n    errors.push(\`Withdrawal runtime grant migration is missing: \${marker}\`);\n  }\n}\nif (withdrawalGrants.includes('CURRENT_USER')) {\n  errors.push('Withdrawal runtime grants must target the explicit runtime-role placeholder, not CURRENT_USER.');\n}\nif (/\\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\\b/.test(withdrawalGrants)) {\n  errors.push('The withdrawal runtime grant migration must not grant destructive or DDL privileges.');\n}\n\nfor (const marker of [`,
);

replaceOnce(
  'docs/NEON_INTEGRATION_ACTIVATION.md',
  '3. past in volgorde de migraties `001` t/m `004` toe via de directe migration-URL;',
  '3. past in volgorde de migraties `001` t/m `006` toe via de directe migration-URL, inclusief de withdrawal-ledger en expliciete runtime grants;',
);
replaceOnce(
  'docs/NEON_INTEGRATION_ACTIVATION.md',
  '7. bewijst dat de runtime-rol een PayPal webhook-event kan reserveren maar niet kan deleten of truncaten;',
  '7. bewijst dat de runtime-rol een PayPal webhook-event kan reserveren en een withdrawal-record idempotent kan vastleggen, maar deze ledgers niet kan deleten, truncaten of muteren;',
);

console.log('Updated Neon integration harness for migrations 005/006 and explicit least-privilege withdrawal grants.');
