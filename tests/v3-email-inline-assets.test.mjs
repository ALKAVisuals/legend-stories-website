import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { V3_EMAIL_BRAND_LOGO } from '../server/notifications/v3-email-inline-assets.mjs';

test('embedded V3 email logo stays byte-identical to the canonical repository logo', async () => {
  const canonical = await readFile(new URL('../media/LOGO/lm-logo-transparant.png', import.meta.url));
  const embedded = Buffer.from(V3_EMAIL_BRAND_LOGO.contentBase64, 'base64');

  assert.equal(V3_EMAIL_BRAND_LOGO.contentId, 'legendmural-logo');
  assert.equal(V3_EMAIL_BRAND_LOGO.filename, 'legendmural-logo.png');
  assert.equal(V3_EMAIL_BRAND_LOGO.contentType, 'image/png');
  assert.deepEqual(embedded, canonical);
});
