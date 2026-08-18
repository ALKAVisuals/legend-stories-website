import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const privacy = await readFile(new URL('../privacy.html', import.meta.url), 'utf8');
const retention = await readFile(new URL('../docs/DATA_RETENTION_POLICY.md', import.meta.url), 'utf8');

test('privacy notice describes the current online withdrawal data flow', () => {
  assert.match(privacy, /collect the name you enter, the Order ID and the order email address/i);
  assert.match(privacy, /name and confirmation email are used to create and send the statutory acknowledgement/i);
  assert.match(privacy, /durable withdrawal database record stores the link to the order, the server-side withdrawal timestamp and a confirmation code/i);
  assert.doesNotMatch(privacy, /we use the Order ID and order email to locate the order\. The withdrawal record stores/i);
});

test('privacy notice identifies Resend and keeps production sending disabled until readiness gates pass', () => {
  assert.match(privacy, /Resend \(Plus Five Five, Inc\.\)/i);
  assert.match(privacy, /primary processing operations and customer data storage are in the United States/i);
  assert.match(privacy, /EU Standard Contractual Clauses/i);
  assert.match(privacy, /Production sending remains disabled until a LegendMural sending domain, approved from identity and server-side API key are configured and a controlled delivery test has passed/i);
});

test('retention policy does not treat confirmation-code creation as proof of delivery', () => {
  assert.match(retention, /confirmation_code.*Reference assigned to the withdrawal notice/i);
  assert.doesNotMatch(retention, /confirmation_code.*customer received a durable withdrawal reference/i);
});
