import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CSS_DIR = join(ROOT, 'css');
const REPORT_DIR = join(ROOT, 'reports');
const REPORT_FILE = join(REPORT_DIR, 'css-audit.md');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractSelectors(css) {
  const selectors = [];
  const cleaned = stripComments(css);
  const pattern = /(^|})\s*([^@}{][^{]+)\{/g;
  let match;

  while ((match = pattern.exec(cleaned))) {
    const selectorGroup = match[2].trim();
    for (const selector of selectorGroup.split(',')) {
      const normalized = selector.replace(/\s+/g, ' ').trim();
      if (normalized) selectors.push(normalized);
    }
  }

  return selectors;
}

async function main() {
  const files = (await readdir(CSS_DIR))
    .filter((file) => file.endsWith('.css'))
    .sort();

  const occurrences = new Map();
  const perFile = [];

  for (const file of files) {
    const absolutePath = join(CSS_DIR, file);
    const css = await readFile(absolutePath, 'utf8');
    const selectors = extractSelectors(css);
    perFile.push({ file: relative(ROOT, absolutePath), selectors: selectors.length, bytes: Buffer.byteLength(css) });

    for (const selector of selectors) {
      const entries = occurrences.get(selector) || [];
      entries.push(relative(ROOT, absolutePath));
      occurrences.set(selector, entries);
    }
  }

  const duplicates = [...occurrences.entries()]
    .filter(([, locations]) => locations.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const report = [
    '# CSS Audit',
    '',
    `Stylesheets scanned: ${files.length}`,
    `Repeated selectors: ${duplicates.length}`,
    '',
    '## Stylesheets',
    '',
    '| File | Selectors | Size (KB) |',
    '|---|---:|---:|',
    ...perFile.map((entry) => `| ${entry.file} | ${entry.selectors} | ${(entry.bytes / 1024).toFixed(2)} |`),
    '',
    '## Repeated selectors',
    '',
    ...duplicates.slice(0, 200).flatMap(([selector, locations]) => [
      `### \`${selector.replaceAll('`', '\\`')}\``,
      '',
      ...locations.map((location) => `- ${location}`),
      ''
    ])
  ].join('\n');

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(REPORT_FILE, `${report}\n`, 'utf8');
  console.log(`CSS audit completed: ${duplicates.length} repeated selectors. Report: reports/css-audit.md`);
}

main().catch((error) => {
  console.error('CSS audit failed:', error);
  process.exit(1);
});
