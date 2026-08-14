import { readFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const [adapter, baseMigration, paypalMigration, paypalGrants, decision] = await Promise.all([
  readFile(new URL('server/adapters/neon-order-store.mjs', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/001_create_order_store.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/003_add_paypal_reconciliation.sql', ROOT), 'utf8'),
  readFile(new URL('server/db/migrations/004_grant_paypal_reconciliation_runtime.sql', ROOT), 'utf8'),
  readFile(new URL('docs/adr/0001-neon-postgres-order-store.md', ROOT), 'utf8'),
]);

const errors = [];
const requireSource = (source, fragment, message) => {
  if (!source.includes(fragment)) errors.push(message);
};

requireSource(
  adapter,
  "import('@neondatabase/serverless')",
  'The Neon driver must remain dynamically loaded until activation dependencies are installed.',
);
requireSource(
  adapter,
  "import('ws')",
  'Interactive Neon transactions must configure a server-side WebSocket implementation.',
);
requireSource(
  adapter,
  "client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')",
  'Every Neon write transaction must use SERIALIZABLE isolation.',
);
requireSource(
  adapter,
  'FOR UPDATE',
  'Payment event processing and idempotent retries must lock the order row.',
);
requireSource(
  adapter,
  'ON CONFLICT (event_id) DO NOTHING',
  'Stripe event IDs must be reserved idempotently.',
);
requireSource(
  adapter,
  'WHERE reference = $1 AND version = $2',
  'Order status updates must enforce optimistic version matching.',
);
requireSource(
  adapter,
  "url.hostname.endsWith('.neon.tech')",
  'Runtime database URLs must be restricted to Neon hosts.',
);
requireSource(
  adapter,
  "['require', 'verify-full'].includes(sslMode)",
  'Runtime database URLs must require TLS.',
);
requireSource(
  adapter,
  "await client.query('ROLLBACK')",
  'Failed transactions must be rolled back before the client closes.',
);
requireSource(
  adapter,
  'await client.end()',
  'Serverless Neon clients must be closed after every request operation.',
);

if (/postgres(?:ql)?:\/\/[^\s'"`]+:[^\s'"`]+@ep-/i.test(adapter)) {
  errors.push('The Neon adapter must not contain a real or example embedded database credential.');
}
if (/process\.env\.DATABASE_MIGRATION_URL/.test(adapter)) {
  errors.push('Runtime request handlers must never use the migration connection string.');
}

for (const fragment of [
  'CREATE SCHEMA IF NOT EXISTS legend_commerce',
  'CREATE TABLE IF NOT EXISTS legend_commerce.orders',
  'CREATE TABLE IF NOT EXISTS legend_commerce.stripe_events',
  'reference text PRIMARY KEY',
  'payment_session_id text NOT NULL UNIQUE',
  'event_id text PRIMARY KEY',
  "CHECK (currency = 'EUR')",
  "CHECK (mode IN ('test', 'live'))",
  'CHECK (version >= 0)',
  'customer jsonb NOT NULL',
  'items jsonb NOT NULL',
]) {
  requireSource(baseMigration, fragment, `Base database migration is missing required contract: ${fragment}`);
}

for (const fragment of [
  'DROP CONSTRAINT IF EXISTS orders_session_format',
  'ADD COLUMN IF NOT EXISTS payment_provider text',
  'GENERATED ALWAYS AS',
  "THEN 'stripe'::text",
  "THEN 'paypal'::text",
  'CHECK (payment_provider IS NOT NULL)',
  "CHECK (payment_provider IN ('stripe', 'paypal'))",
  'CREATE TABLE IF NOT EXISTS legend_commerce.paypal_webhook_events',
  'event_id text PRIMARY KEY',
  'order_reference text NOT NULL',
  'paypal_order_id text NOT NULL',
  "CHECK (mode IN ('test', 'live'))",
  'Full provider payloads are intentionally not stored',
]) {
  requireSource(paypalMigration, fragment, `PayPal reconciliation migration is missing required contract: ${fragment}`);
}

requireSource(
  paypalGrants,
  'GRANT SELECT, INSERT',
  'PayPal webhook ledger must expose only read/insert runtime privileges.',
);
requireSource(
  paypalGrants,
  'ON TABLE legend_commerce.paypal_webhook_events',
  'PayPal webhook runtime grant must target only its event ledger.',
);
if (/\b(DELETE|TRUNCATE|CREATE|DROP|ALTER)\b/.test(paypalGrants)) {
  errors.push('PayPal webhook runtime grants must not include destructive or DDL privileges.');
}

requireSource(
  decision,
  '**Neon Postgres**',
  'The provider decision must explicitly select Neon Postgres.',
);
requireSource(
  decision,
  '**Netlify Functions**',
  'The provider decision must document the future server adapter boundary.',
);
requireSource(
  decision,
  'does **not**',
  'The provider decision must retain a clear non-activation boundary.',
);

if (errors.length) {
  console.error('Neon order-store validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Neon order-store validation passed with TLS-only access, serializable writes, provider-derived payment identity and a least-privilege PayPal reconciliation ledger.');
