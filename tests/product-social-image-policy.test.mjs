import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { PRODUCT_BROWSER_DERIVATIVES } from '../scripts/lib/product-browser-derivatives.mjs';

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('product social metadata retains original PNG sources', async () => {
  assert.equal(PRODUCT_BROWSER_DERIVATIVES.length, 21);

  for (const image of PRODUCT_BROWSER_DERIVATIVES) {
    const html = await readFile(image.productPage, 'utf8');
    const source = escapeRegExp(image.source);
    const derivative = escapeRegExp(image.derivative);

    const sourceSocialPattern = new RegExp(
      `<meta\\s+(?:property="og:image"|name="twitter:image")\\s+content="[^"]*${source}"`,
      'gi',
    );
    const derivativeSocialPattern = new RegExp(
      `<meta\\s+(?:property="og:image"|name="twitter:image")\\s+content="[^"]*${derivative}"`,
      'gi',
    );
    const structuredDataPattern = new RegExp(
      `<script type="application\\/ld\\+json">[\\s\\S]*?"image":\\s*"[^"]*${source}"[\\s\\S]*?<\\/script>`,
      'i',
    );

    assert.equal(
      [...html.matchAll(sourceSocialPattern)].length,
      2,
      `${image.productPage} must use the original PNG for og:image and twitter:image`,
    );
    assert.equal(
      [...html.matchAll(derivativeSocialPattern)].length,
      0,
      `${image.productPage} must not expose the WebP derivative to social crawlers`,
    );
    assert.match(
      html,
      structuredDataPattern,
      `${image.productPage} must retain the original PNG in Product JSON-LD`,
    );
  }
});
