import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  LEGACY_STOREFRONT_ORIGIN,
  LEGENDMURAL_PRODUCTION_ORIGIN,
} from '../config/production-origin.mjs';

const ROOT = process.cwd();

function metadataValue(html, pattern) {
  return html.match(pattern)?.[1] || '';
}

test('tracked public HTML uses the final LegendMural origin for canonical and Open Graph URLs', async () => {
  const htmlFiles = (await readdir(ROOT)).filter((file) => file.endsWith('.html')).sort();
  assert.ok(htmlFiles.length >= 100, `expected at least 100 public HTML pages, found ${htmlFiles.length}`);

  for (const file of htmlFiles) {
    const html = await readFile(join(ROOT, file), 'utf8');
    assert.ok(!html.includes(LEGACY_STOREFRONT_ORIGIN), `${file}: legacy storefront origin remains`);

    const canonical = metadataValue(
      html,
      /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i,
    );
    const ogUrl = metadataValue(
      html,
      /<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i,
    );

    if (canonical) {
      assert.ok(
        canonical === `${LEGENDMURAL_PRODUCTION_ORIGIN}/`
          || canonical.startsWith(`${LEGENDMURAL_PRODUCTION_ORIGIN}/`),
        `${file}: canonical is not on the final production origin: ${canonical}`,
      );
    }
    if (ogUrl) {
      assert.ok(
        ogUrl === `${LEGENDMURAL_PRODUCTION_ORIGIN}/`
          || ogUrl.startsWith(`${LEGENDMURAL_PRODUCTION_ORIGIN}/`),
        `${file}: Open Graph URL is not on the final production origin: ${ogUrl}`,
      );
    }
  }

  const homepage = await readFile(join(ROOT, 'index.html'), 'utf8');
  assert.match(
    homepage,
    new RegExp(`<link rel="canonical" href="${LEGENDMURAL_PRODUCTION_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/">`),
  );
  assert.match(
    homepage,
    new RegExp(`<meta property="og:url" content="${LEGENDMURAL_PRODUCTION_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/">`),
  );
});

test('central product catalog uses legendmural.com canonicals for all 111 products', async () => {
  const catalog = JSON.parse(await readFile(join(ROOT, 'data', 'products', 'catalog.json'), 'utf8'));
  assert.equal(catalog.productCount, 111);
  assert.equal(catalog.products.length, 111);

  for (const product of catalog.products) {
    assert.equal(
      product.canonical,
      `${LEGENDMURAL_PRODUCTION_ORIGIN}/${product.page}`,
      `${product.page}: central catalog canonical mismatch`,
    );
  }
});

test('sitemap and robots point at the final production origin', async () => {
  const sitemap = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
  const robots = await readFile(join(ROOT, 'robots.txt'), 'utf8');

  assert.ok(!sitemap.includes(LEGACY_STOREFRONT_ORIGIN), 'sitemap still contains legacy storefront origin');
  assert.ok(!robots.includes(LEGACY_STOREFRONT_ORIGIN), 'robots still contains legacy storefront origin');
  assert.ok(sitemap.includes(`<loc>${LEGENDMURAL_PRODUCTION_ORIGIN}/</loc>`), 'sitemap is missing the apex homepage URL');
  assert.ok(!sitemap.includes(`<loc>${LEGENDMURAL_PRODUCTION_ORIGIN}/index.html</loc>`), 'sitemap still exposes index.html as the homepage canonical');
  assert.ok(robots.includes(`Sitemap: ${LEGENDMURAL_PRODUCTION_ORIGIN}/sitemap.xml`), 'robots does not point at the final sitemap');
});
