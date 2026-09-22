import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('public storefront contains no Google Knowledge Graph credential or client fetch', async () => {
  const [app, homepage] = await Promise.all([
    readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
  ]);

  assert.equal(app.includes('GP_API_KEY'), false);
  assert.equal(app.includes('kgsearch.googleapis.com'), false);
  assert.equal(app.includes('fetchStickerFact'), false);
  assert.equal(homepage.includes('id="sticker-modal"'), false);
});
