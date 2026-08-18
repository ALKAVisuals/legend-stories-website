import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const privacy = await readFile(new URL('../privacy.html', import.meta.url), 'utf8');
const retention = await readFile(new URL('../docs/DATA_RETENTION_POLICY.md', import.meta.url), 'utf8');

test('privacy notice describes the current online withdrawal data flow', () => {
  assert.match(privacy, /collect the name you enter, the Order ID and the order email address/i);
  assert.match(privacy, /name and confirmation email are used to create and send the statutory acknowledgement/i);
  assert.match(privacy, /immutable withdrawal record stores the link to the order, the server-side withdrawal timestamp and a confirmation code/i);
  assert.match(privacy, /separate acknowledgement record stores the minimum statement snapshot and delivery information/i);
  assert.match(privacy, /withdrawal declaration, confirmation code, receipt timestamp, delivery status/i);
  assert.match(privacy, /controlled resend when delivery fails/i);
  assert.doesNotMatch(privacy, /we use the Order ID and order email to locate the order\. The withdrawal record stores/i);
});

test('privacy notice identifies Resend and keeps production sending disabled until readiness gates pass', () => {
  assert.match(privacy, /Resend \(Plus Five Five, Inc\.\)/i);
  assert.match(privacy, /primary processing operations and customer data storage are in the United States/i);
  assert.match(privacy, /EU Standard Contractual Clauses/i);
  assert.match(privacy, /Production sending remains disabled until a LegendMural sending domain, approved from identity and server-side API key are configured and a controlled delivery test has passed/i);
});

test('retention policy separates immutable withdrawal evidence from acknowledgement delivery evidence', () => {
  assert.match(retention, /confirmation_code.*Reference assigned to the withdrawal notice/i);
  assert.doesNotMatch(retention, /confirmation_code.*customer received a durable withdrawal reference/i);
  assert.match(retention, /legend_commerce\.withdrawal_acknowledgements/);
  assert.match(retention, /consumer_name.*R5/i);
  assert.match(retention, /confirmation_email.*R5/i);
  assert.match(retention, /declaration.*R5/i);
  assert.match(retention, /delivery_status.*R5/i);
  assert.match(retention, /provider_message_id.*R5/i);
});
