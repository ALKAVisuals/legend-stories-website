import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import {
  LEGACY_STOREFRONT_ORIGIN,
  LEGENDMURAL_PRODUCTION_ORIGIN,
} from '../config/production-origin.mjs';

function rewriteProductionOrigin(source, { homepage = false } = {}) {
  let output = String(source).replaceAll(LEGACY_STOREFRONT_ORIGIN, LEGENDMURAL_PRODUCTION_ORIGIN);
  if (homepage) {
    output = output
      .replace(
        `<meta property="og:url" content="${LEGENDMURAL_PRODUCTION_ORIGIN}/index.html">`,
        `<meta property="og:url" content="${LEGENDMURAL_PRODUCTION_ORIGIN}/">`,
      )
      .replace(
        `<link rel="canonical" href="${LEGENDMURAL_PRODUCTION_ORIGIN}/index.html">`,
        `<link rel="canonical" href="${LEGENDMURAL_PRODUCTION_ORIGIN}/">`,
      );
  }
  return output;
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(filePath));
    else files.push(filePath);
  }
  return files;
}

function validateProductionOutput(root, outDir) {
  const outputRoot = resolve(root, outDir);
  const files = walk(outputRoot);
  const htmlFiles = files.filter((file) => extname(file) === '.html');
  const errors = [];

  if (htmlFiles.length < 100) {
    errors.push(`Expected at least 100 built HTML pages, found ${htmlFiles.length}.`);
  }

  for (const file of files) {
    const extension = extname(file);
    if (!['.html', '.xml', '.txt', '.json'].includes(extension)) continue;
    const source = readFileSync(file, 'utf8');
    if (source.includes(LEGACY_STOREFRONT_ORIGIN)) {
      errors.push(`${relative(outputRoot, file)} still contains the legacy storefront origin.`);
    }
  }

  for (const htmlFile of htmlFiles) {
    const source = readFileSync(htmlFile, 'utf8');
    const page = relative(outputRoot, htmlFile).replaceAll('\\', '/');
    const canonical = source.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1];
    const ogUrl = source.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i)?.[1];

    if (canonical && !canonical.startsWith(`${LEGENDMURAL_PRODUCTION_ORIGIN}/`)) {
      errors.push(`${page} has a non-production canonical URL: ${canonical}`);
    }
    if (ogUrl && !ogUrl.startsWith(`${LEGENDMURAL_PRODUCTION_ORIGIN}/`)) {
      errors.push(`${page} has a non-production Open Graph URL: ${ogUrl}`);
    }
  }

  const homepage = readFileSync(join(outputRoot, 'index.html'), 'utf8');
  if (!homepage.includes(`<link rel="canonical" href="${LEGENDMURAL_PRODUCTION_ORIGIN}/">`)) {
    errors.push('index.html does not use the HTTPS apex production canonical.');
  }
  if (!homepage.includes(`<meta property="og:url" content="${LEGENDMURAL_PRODUCTION_ORIGIN}/">`)) {
    errors.push('index.html does not use the HTTPS apex production Open Graph URL.');
  }

  const sitemapPath = join(outputRoot, 'sitemap.xml');
  if (!existsSync(sitemapPath)) {
    errors.push('dist/sitemap.xml is missing.');
  } else {
    const sitemap = readFileSync(sitemapPath, 'utf8');
    if (!sitemap.includes(`<loc>${LEGENDMURAL_PRODUCTION_ORIGIN}/</loc>`)) {
      errors.push('sitemap.xml does not contain the HTTPS apex homepage URL.');
    }
    if (!sitemap.includes(`${LEGENDMURAL_PRODUCTION_ORIGIN}/`)) {
      errors.push('sitemap.xml does not contain the production origin.');
    }
  }

  const robotsPath = join(outputRoot, 'robots.txt');
  if (!existsSync(robotsPath)) {
    errors.push('dist/robots.txt is missing.');
  } else {
    const robots = readFileSync(robotsPath, 'utf8');
    if (!robots.includes(`Sitemap: ${LEGENDMURAL_PRODUCTION_ORIGIN}/sitemap.xml`)) {
      errors.push('robots.txt does not point to the production sitemap URL.');
    }
  }

  if (errors.length) {
    throw new Error(`Production-origin validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export function productionOriginPlugin({ root, outDir = 'dist' }) {
  const resolvedRoot = resolve(root);
  const resolvedOutDir = resolve(resolvedRoot, outDir);

  return {
    name: 'legendmural-production-origin',
    enforce: 'post',

    transformIndexHtml(html, context) {
      const homepage = context?.path === '/' || context?.path === '/index.html';
      return rewriteProductionOrigin(html, { homepage });
    },

    writeBundle() {
      mkdirSync(resolvedOutDir, { recursive: true });

      const sitemapSource = readFileSync(join(resolvedRoot, 'sitemap.xml'), 'utf8');
      const sitemap = rewriteProductionOrigin(sitemapSource)
        .replace(
          `<loc>${LEGENDMURAL_PRODUCTION_ORIGIN}/index.html</loc>`,
          `<loc>${LEGENDMURAL_PRODUCTION_ORIGIN}/</loc>`,
        );
      writeFileSync(join(resolvedOutDir, 'sitemap.xml'), sitemap, 'utf8');

      const robotsSource = readFileSync(join(resolvedRoot, 'robots.txt'), 'utf8');
      const robots = rewriteProductionOrigin(robotsSource);
      writeFileSync(join(resolvedOutDir, 'robots.txt'), robots, 'utf8');
    },

    closeBundle() {
      validateProductionOutput(resolvedRoot, outDir);
    },
  };
}

export { rewriteProductionOrigin, validateProductionOutput };
