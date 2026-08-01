import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  extractProductPresentation,
  normalizeTemplateStructure,
  templatizeProductPage,
} from './product-page-template.mjs';

const ROOT = process.cwd();
const CATALOG_FILE = join(ROOT, 'data', 'products', 'catalog.json');
const TEMPLATE_FILE = join(ROOT, 'templates', 'product-page.html');
const REPORT_DIR = join(ROOT, 'reports');
const STRICT = process.argv.includes('--strict');

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}

function excerpt(value, index, radius = 100) {
  const start = Math.max(0, index - radius);
  const end = Math.min(value.length, index + radius);
  return value.slice(start, end);
}

function createBatchSummary(batchId) {
  return {
    batchId,
    total: 0,
    compatible: 0,
    incompatible: 0,
    structureMismatches: 0,
    presentationErrors: 0,
  };
}

function markdownReport(report) {
  const lines = [
    '# Product Page Template Compatibility',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Product pages audited: ${report.summary.total}`,
    `- Compatible with the shared template: ${report.summary.compatible}`,
    `- Incompatible: ${report.summary.incompatible}`,
    '',
    '## Batches',
    '',
    '| Batch | Total | Compatible | Incompatible | Structure mismatches | Presentation errors |',
    '|---|---:|---:|---:|---:|---:|',
    ...report.batches.map((batch) =>
      `| ${batch.batchId} | ${batch.total} | ${batch.compatible} | ${batch.incompatible} | ${batch.structureMismatches} | ${batch.presentationErrors} |`,
    ),
  ];

  const incompatible = report.pages.filter((page) => !page.compatible);
  if (incompatible.length) {
    lines.push(
      '',
      '## Incompatible pages',
      '',
      '| Page | Batch | Reason |',
      '|---|---|---|',
      ...incompatible.map((page) =>
        `| ${page.page} | ${page.batchId} | ${String(page.reason).replaceAll('|', '\\|')} |`,
      ),
    );
  }

  lines.push('');
  return lines.join('\n');
}

const catalog = JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
const template = await readFile(TEMPLATE_FILE, 'utf8');
const normalizedTemplate = normalizeTemplateStructure(template);
const batchSummaries = new Map();
const pages = [];

for (const product of [...catalog.products].sort((a, b) => a.page.localeCompare(b.page))) {
  const batchId = product.batch?.id || 'unclassified';
  const summary = batchSummaries.get(batchId) || createBatchSummary(batchId);
  batchSummaries.set(batchId, summary);
  summary.total += 1;

  const pageResult = {
    page: product.page,
    batchId,
    collection: product.collection,
    compatible: false,
    managed: batchId === '2026-batch-3',
    reason: null,
    structure: null,
  };

  try {
    const html = await readFile(join(ROOT, product.page), 'utf8');
    const candidate = normalizeTemplateStructure(templatizeProductPage(html));

    if (candidate !== normalizedTemplate) {
      const index = firstDifference(normalizedTemplate, candidate);
      pageResult.reason = `Static structure differs near normalized character ${index}.`;
      pageResult.structure = {
        differenceIndex: index,
        templateExcerpt: excerpt(normalizedTemplate, index),
        pageExcerpt: excerpt(candidate, index),
      };
      summary.structureMismatches += 1;
    } else {
      extractProductPresentation(html, product);
      pageResult.compatible = true;
      summary.compatible += 1;
    }
  } catch (error) {
    pageResult.reason = error.message;
    if (!pageResult.structure) summary.presentationErrors += 1;
  }

  if (!pageResult.compatible) summary.incompatible += 1;
  pages.push(pageResult);
}

const batches = [...batchSummaries.values()].sort((a, b) => a.batchId.localeCompare(b.batchId));
const report = {
  generatedAt: new Date().toISOString(),
  template: 'templates/product-page.html',
  summary: {
    total: pages.length,
    compatible: pages.filter((page) => page.compatible).length,
    incompatible: pages.filter((page) => !page.compatible).length,
  },
  batches,
  pages,
};

await mkdir(REPORT_DIR, { recursive: true });
await writeFile(
  join(REPORT_DIR, 'product-page-template-compatibility.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);
await writeFile(
  join(REPORT_DIR, 'product-page-template-compatibility.md'),
  markdownReport(report),
  'utf8',
);

console.log(
  `Product page template audit: ${report.summary.compatible}/${report.summary.total} compatible, ` +
  `${report.summary.incompatible} incompatible.`,
);
for (const batch of batches) {
  console.log(
    `- ${batch.batchId}: ${batch.compatible}/${batch.total} compatible, ` +
    `${batch.incompatible} incompatible.`,
  );
}

const incompatiblePages = pages.filter((page) => !page.compatible);
for (const page of incompatiblePages.slice(0, 20)) {
  console.log(`  • ${page.page}: ${page.reason}`);
}
if (incompatiblePages.length > 20) {
  console.log(`  • …and ${incompatiblePages.length - 20} more; see the uploaded report.`);
}

if (STRICT && incompatiblePages.length) process.exitCode = 1;
