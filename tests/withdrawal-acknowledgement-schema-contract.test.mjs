import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const createSql = await readFile(new URL('../server/db/migrations/007_create_withdrawal_acknowledgements.sql', import.meta.url), 'utf8');
const grantSql = await readFile(new URL('../server/db/migrations/008_grant_withdrawal_acknowledgement_runtime.sql', import.meta.url), 'utf8');

test('withdrawal acknowledgement migration stores the statutory statement snapshot and delivery state separately', () => {
  assert.match(createSql, /CREATE TABLE IF NOT EXISTS legend_commerce\.withdrawal_acknowledgements/);
  for (const field of [
    'consumer_name',
    'confirmation_email',
    'declaration',
    'delivery_status',
    'delivery_attempts',
    'last_attempt_at',
    'sent_at',
    'provider_message_id',
    'last_error_code',
  ]) {
    assert.match(createSql, new RegExp(`\\b${field}\\b`));
  }
  assert.match(createSql, /REFERENCES legend_commerce\.withdrawal_requests\(order_reference\) ON DELETE RESTRICT/);
  assert.match(createSql, /delivery_status IN \('pending', 'sent', 'failed'\)/);
});

test('runtime may update delivery metadata but not the immutable statement snapshot', () => {
  assert.match(grantSql, /GRANT SELECT, INSERT ON legend_commerce\.withdrawal_acknowledgements/);
  assert.match(grantSql, /GRANT UPDATE \(/);
  for (const mutableField of [
    'delivery_status',
    'delivery_attempts',
    'last_attempt_at',
    'sent_at',
    'provider_message_id',
    'last_error_code',
    'updated_at',
  ]) {
    assert.match(grantSql, new RegExp(`\\b${mutableField}\\b`));
  }
  const updateGrant = grantSql.match(/GRANT UPDATE \(([\s\S]*?)\) ON/)[1];
  for (const immutableField of [
    'order_reference',
    'payment_session_id',
    'confirmation_code',
    'consumer_name',
    'confirmation_email',
    'declaration',
    'withdrawn_at',
  ]) {
    assert.doesNotMatch(updateGrant, new RegExp(`\\b${immutableField}\\b`));
  }
  assert.doesNotMatch(grantSql, /GRANT\s+(?:UPDATE|DELETE|TRUNCATE)\s+ON\s+legend_commerce\.withdrawal_acknowledgements/i);
});
