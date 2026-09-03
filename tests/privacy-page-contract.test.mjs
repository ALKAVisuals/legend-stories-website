import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const privacy = await readFile(new URL('../privacy.html', import.meta.url), 'utf8');

test('Privacy page reflects the audited storefront data flows', () => {
  assert.match(privacy, /homepage contact form/i);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /sessionStorage/);
  assert.match(privacy, /Google Fonts/);
  assert.match(privacy, /jsDelivr/);
  assert.match(privacy, /Resend \(Plus Five Five, Inc\.\)/);
  assert.match(privacy, /advertising pixels or behavioural analytics trackers/i);
});

test('Privacy page contains the approved retention policy', () => {
  assert.match(privacy, /7 years/);
  assert.match(privacy, /10 years after the end of the year in which the supply took place/);
  assert.match(privacy, /12 months after the request is resolved/);
  assert.match(privacy, /5 years/);
  assert.match(privacy, /do not imply that every category is currently subject to an automated deletion process/i);
});

test('stale launch-readiness and Google Places wording cannot return', () => {
  assert.doesNotMatch(privacy, /Google address\/place functionality/i);
  assert.doesNotMatch(privacy, /definitive production retention schedule/i);
  assert.doesNotMatch(privacy, /Production sending remains disabled/i);
  assert.doesNotMatch(privacy, /server-side API key/i);
  assert.match(privacy, /Last updated: 3 September 2026\./);
});
