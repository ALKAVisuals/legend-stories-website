import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const REPORT_DIR = join(ROOT, 'reports');
const RUNTIME_REGISTRY = join(DIST, 'data/product-registry.json');
const RELATED_PRODUCTS_MODULE = join(DIST, 'js/catalog/related-products.mjs');
const COLLECTION_VIDEO_CONTROLLER = join(DIST, 'js/collection-video.mjs');
const COLLECTION_VIDEO_POLICY = join(DIST, 'js/media/collection-video-policy.mjs');
const COLLECTION_VIDEO_MANIFEST = join(ROOT, 'data/video/collection-video-optimization.json');
const BASELINE = JSON.parse(
  await readFile(join(ROOT, 'config/build-validation-baseline.json'), 'utf8')
);

const allowedMissingReferences = new Set(
  (BASELINE.allowedMissingReferences || []).map(
    ({ page, reference }) => `${page}::${reference}`
  )
);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolutePath));
    else files.push(absolutePath);
  }

  return files;
}

function extractLocalReferences(html) {
  const references = [];
  const pattern = /(?:\s|<)(?:href|src|data-src|poster)=["']([^"']+)["']/gi;
  let match;

  while ((match = pattern.exec(html))) {
    const value = match[1].trim();
    if (
      !value ||
      value.startsWith('#') ||
      value.startsWith('http:') ||
      value.startsWith('https:') ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:') ||
      value.startsWith('data:') ||
      value.startsWith('javascript:')
    ) continue;

    references.push(value.split('#')[0].split('?')[0]);
  }

  return references.filter(Boolean);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function validateRuntimeArtifacts(errors) {
  try {
    const registry = JSON.parse(await readFile(RUNTIME_REGISTRY, 'utf8'));
    if (registry.schemaVersion !== 1) errors.push('data/product-registry.json: unsupported schemaVersion.');
    if (!Array.isArray(registry.products)) errors.push('data/product-registry.json: products must be an array.');
    if (registry.productCount !== registry.products?.length) {
      errors.push('data/product-registry.json: productCount differs from products array length.');
    }
    if ((registry.products?.length || 0) < 100) {
      errors.push(`data/product-registry.json: expected at least 100 products, found ${registry.products?.length || 0}.`);
    }
  } catch (error) {
    errors.push(`data/product-registry.json: missing or invalid (${error.message}).`);
  }

  try {
    const moduleSource = await readFile(RELATED_PRODUCTS_MODULE, 'utf8');
    if (!/export\s+(?:async\s+)?function\s+loadProductRegistry\b/.test(moduleSource)) {
      errors.push('js/catalog/related-products.mjs: expected registry loader export is missing.');
    }
    if (!/export\s+(?:async\s+)?function\s+selectRelatedProducts\b/.test(moduleSource)) {
      errors.push('js/catalog/related-products.mjs: expected related-product selector export is missing.');
    }
  } catch (error) {
    errors.push(`js/catalog/related-products.mjs: missing or unreadable (${error.message}).`);
  }

  try {
    const [controller, policy] = await Promise.all([
      readFile(COLLECTION_VIDEO_CONTROLLER, 'utf8'),
      readFile(COLLECTION_VIDEO_POLICY, 'utf8'),
    ]);
    if (!controller.includes("from './media/collection-video-policy.mjs'")) {
      errors.push('js/collection-video.mjs: policy module import is missing.');
    }
    if (!controller.includes("video[data-collection-video]")) {
      errors.push('js/collection-video.mjs: collection video selector is missing.');
    }
    if (!policy.includes('evaluateCollectionVideoPolicy')) {
      errors.push('js/media/collection-video-policy.mjs: policy export is missing.');
    }
  } catch (error) {
    errors.push(`Collection video runtime modules are missing or unreadable (${error.message}).`);
  }
}

async function validateDeferredCollectionMedia(errors) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(COLLECTION_VIDEO_MANIFEST, 'utf8'));
  } catch (error) {
    errors.push(`Collection video manifest is missing or invalid (${error.message}).`);
    return;
  }

  if (!Array.isArray(manifest.videos) || manifest.videos.length !== 2) {
    errors.push('Collection video manifest must contain exactly two approved videos.');
    return;
  }

  for (const entry of manifest.videos) {
    for (const [path, expected, label] of [
      [entry.path, entry.output, 'video'],
      [entry.poster, entry.posterOutput, 'poster'],
    ]) {
      const outputPath = join(DIST, path);
      try {
        const outputInfo = await stat(outputPath);
        if (!outputInfo.isFile()) {
          errors.push(`${path}: built deferred ${label} is not a file.`);
          continue;
        }
        if (outputInfo.size !== expected.bytes) {
          errors.push(`${path}: built deferred ${label} size differs from the manifest.`);
        }
        if (await sha256(outputPath) !== expected.sha256) {
          errors.push(`${path}: built deferred ${label} hash differs from the manifest.`);
        }
      } catch (error) {
        errors.push(`${path}: built deferred ${label} is missing (${error.message}).`);
      }
    }
  }
}

async function persistReport({ errors, htmlFiles, files, allowedBaselineHits }) {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      htmlPages: htmlFiles.length,
      outputFiles: files.length,
      errors: errors.length,
      allowedBaselineReferences: allowedBaselineHits.length,
    },
    errors,
    allowedBaselineHits,
  };

  const markdown = [
    '# Production Build Validation',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- HTML pages: ${report.summary.htmlPages}`,
    `- Output files: ${report.summary.outputFiles}`,
    `- Errors: ${report.summary.errors}`,
    `- Allowed baseline references: ${report.summary.allowedBaselineReferences}`,
    '',
    '## Errors',
    '',
    ...(errors.length ? errors.map((error) => `- ${error}`) : ['None detected.']),
    '',
    '## Allowed baseline references',
    '',
    ...(allowedBaselineHits.length ? allowedBaselineHits.map((entry) => `- ${entry}`) : ['None detected.']),
    '',
  ].join('\n');

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'build-validation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(REPORT_DIR, 'build-validation.md'), markdown, 'utf8');
}

async function main() {
  await access(DIST);
  const files = await walk(DIST);
  const htmlFiles = files.filter((file) => extname(file) === '.html');
  const errors = [];
  const allowedBaselineHits = [];

  if (htmlFiles.length < 100) {
    errors.push(`Expected at least 100 built HTML pages, found ${htmlFiles.length}.`);
  }

  await validateRuntimeArtifacts(errors);
  await validateDeferredCollectionMedia(errors);

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    const relativeHtml = relative(DIST, htmlFile).replaceAll('\\', '/');

    if (!/<title>[^<]+<\/title>/i.test(html)) errors.push(`${relativeHtml}: missing non-empty title.`);
    if (!/<meta\s+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html)) errors.push(`${relativeHtml}: missing non-empty meta description.`);
    if (!/<h1(?:\s|>)/i.test(html)) errors.push(`${relativeHtml}: missing H1.`);

    for (const reference of extractLocalReferences(html)) {
      let normalized;
      try {
        normalized = decodeURIComponent(reference.replace(/^\.\//, ''));
      } catch {
        errors.push(`${relativeHtml}: built reference is not valid URI encoding: ${reference}`);
        continue;
      }
      const candidates = normalized.startsWith('/')
        ? [join(DIST, normalized.slice(1))]
        : [join(htmlFile, '..', normalized), join(DIST, normalized)];

      let found = false;
      for (const candidate of candidates) {
        try {
          const candidateStat = await stat(candidate);
          if (candidateStat.isFile() || candidateStat.isDirectory()) {
            found = true;
            break;
          }
        } catch {
          // Try the next candidate.
        }
      }

      if (!found) {
        const key = `${relativeHtml}::${reference}`;
        if (allowedMissingReferences.has(key)) {
          allowedBaselineHits.push(key);
        } else {
          errors.push(`${relativeHtml}: built reference not found: ${reference}`);
        }
      }
    }
  }

  await persistReport({ errors, htmlFiles, files, allowedBaselineHits });

  if (errors.length > 0) {
    console.error('\nBuild validation failed:\n');
    errors.slice(0, 100).forEach((error) => console.error(`- ${error}`));
    if (errors.length > 100) console.error(`- ...and ${errors.length - 100} more.`);
    process.exit(1);
  }

  console.log(`Build validation passed for ${htmlFiles.length} HTML pages and ${files.length} output files.`);
  if (allowedBaselineHits.length > 0) {
    console.warn(`Allowed ${allowedBaselineHits.length} documented baseline reference(s):`);
    allowedBaselineHits.forEach((entry) => console.warn(`- ${entry}`));
  }
}

main().catch(async (error) => {
  console.error('Build validation failed unexpectedly:', error);
  try {
    await mkdir(REPORT_DIR, { recursive: true });
    await writeFile(
      join(REPORT_DIR, 'build-validation-crash.txt'),
      `${error.stack || error.message || String(error)}\n`,
      'utf8',
    );
  } catch {
    // Preserve the original failure.
  }
  process.exit(1);
});
