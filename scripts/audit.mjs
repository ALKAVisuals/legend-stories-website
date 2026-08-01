import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname, relative, resolve, sep } from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const STRICT = process.argv.includes('--strict');
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'reports', 'generated']);
const NON_SITE_HTML_DIRS = new Set(['templates']);
const HTML_ATTR_PATTERN = /\b(?:href|src|poster)=(["'])(.*?)\1/gi;
const EXTERNAL_PATTERN = /^(?:https?:|mailto:|tel:|data:|javascript:|#|\/\/)/i;
const LARGE_FILE_THRESHOLD = 1_000_000;
const VERY_LARGE_FILE_THRESHOLD = 5_000_000;

function posix(value) {
  return value.split(sep).join('/');
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }

  return files;
}

function isSiteHtml(file) {
  if (extname(file).toLowerCase() !== '.html') return false;
  const page = posix(relative(ROOT, file));
  return ![...NON_SITE_HTML_DIRS].some((directory) => page.startsWith(`${directory}/`));
}

function stripQueryAndHash(value) {
  return decodeURIComponent(value.split('#')[0].split('?')[0]);
}

function candidatePaths(fromFile, reference) {
  const clean = stripQueryAndHash(reference).replace(/^\.\//, '');
  if (!clean) return [];

  const base = reference.startsWith('/')
    ? resolve(ROOT, clean.slice(1))
    : resolve(dirname(fromFile), clean);

  const candidates = [base];
  if (!extname(base)) {
    candidates.push(`${base}.html`, join(base, 'index.html'));
  }
  return candidates;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function firstMatch(content, pattern) {
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function allMatches(content, pattern) {
  return [...content.matchAll(pattern)].map((match) => match[1].trim());
}

function bytes(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${value} B`;
}

async function main() {
  const files = await walk(ROOT);
  const htmlFiles = files.filter(isSiteHtml);
  const inventory = [];
  const missingReferences = [];
  const placeholderLinks = [];
  const metadata = [];

  for (const file of files) {
    const info = await stat(file);
    inventory.push({ path: posix(relative(ROOT, file)), bytes: info.size });
  }

  for (const file of htmlFiles) {
    const content = await readFile(file, 'utf8');
    const page = posix(relative(ROOT, file));
    let attributeMatch;

    while ((attributeMatch = HTML_ATTR_PATTERN.exec(content)) !== null) {
      const reference = attributeMatch[2].trim();
      if (!reference || EXTERNAL_PATTERN.test(reference)) {
        if (reference === '#') placeholderLinks.push({ page, reference });
        continue;
      }

      const candidates = candidatePaths(file, reference);
      const found = (await Promise.all(candidates.map(exists))).some(Boolean);
      if (!found) missingReferences.push({ page, reference });
    }

    const title = firstMatch(content, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = firstMatch(content, /<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)
      ?? firstMatch(content, /<meta\s+content=["']([^"']*)["']\s+name=["']description["'][^>]*>/i);
    const canonical = firstMatch(content, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["'][^>]*>/i)
      ?? firstMatch(content, /<link\s+href=["']([^"']*)["']\s+rel=["']canonical["'][^>]*>/i);
    const h1s = allMatches(content, /<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)
      .map((value) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

    metadata.push({
      page,
      title,
      description,
      canonical,
      h1Count: h1s.length,
      h1s,
      legacyOrigin: content.includes('https://alkavisuals.github.io/legend-stories-website'),
    });
  }

  inventory.sort((a, b) => b.bytes - a.bytes);
  const largeFiles = inventory.filter((item) => item.bytes >= LARGE_FILE_THRESHOLD);
  const veryLargeFiles = inventory.filter((item) => item.bytes >= VERY_LARGE_FILE_THRESHOLD);
  const missingMetadata = metadata.filter((item) => !item.title || !item.description || !item.canonical || item.h1Count !== 1);

  const duplicateTitles = Object.entries(
    metadata.reduce((groups, item) => {
      if (!item.title) return groups;
      groups[item.title] ??= [];
      groups[item.title].push(item.page);
      return groups;
    }, {}),
  ).filter(([, pages]) => pages.length > 1).map(([title, pages]) => ({ title, pages }));

  const report = {
    generatedAt: new Date().toISOString(),
    strict: STRICT,
    summary: {
      files: inventory.length,
      htmlPages: htmlFiles.length,
      totalBytes: inventory.reduce((sum, item) => sum + item.bytes, 0),
      missingReferences: missingReferences.length,
      placeholderLinks: placeholderLinks.length,
      metadataIssues: missingMetadata.length,
      duplicateTitles: duplicateTitles.length,
      largeFiles: largeFiles.length,
      veryLargeFiles: veryLargeFiles.length,
      legacyOriginPages: metadata.filter((item) => item.legacyOrigin).length,
    },
    missingReferences,
    placeholderLinks,
    metadataIssues: missingMetadata,
    duplicateTitles,
    largestFiles: inventory.slice(0, 50),
    largeFiles,
    veryLargeFiles,
    pages: metadata,
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'audit-report.json'), `${JSON.stringify(report, null, 2)}\n`);

  const markdown = [
    '# LegendMural repository audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Files scanned: ${report.summary.files}`,
    `- HTML pages: ${report.summary.htmlPages}`,
    `- Repository working-tree size: ${bytes(report.summary.totalBytes)}`,
    `- Missing internal references: ${report.summary.missingReferences}`,
    `- Placeholder links: ${report.summary.placeholderLinks}`,
    `- Pages with metadata/H1 issues: ${report.summary.metadataIssues}`,
    `- Duplicate titles: ${report.summary.duplicateTitles}`,
    `- Files over 1 MB: ${report.summary.largeFiles}`,
    `- Files over 5 MB: ${report.summary.veryLargeFiles}`,
    `- Pages containing legacy GitHub Pages origin: ${report.summary.legacyOriginPages}`,
    '',
    '## Largest files',
    '',
    '| File | Size |',
    '|---|---:|',
    ...report.largestFiles.slice(0, 25).map((item) => `| \`${item.path}\` | ${bytes(item.bytes)} |`),
    '',
    '## Missing internal references',
    '',
    ...(missingReferences.length
      ? missingReferences.map((item) => `- \`${item.page}\` → \`${item.reference}\``)
      : ['None detected.']),
    '',
    '## Placeholder links',
    '',
    ...(placeholderLinks.length
      ? placeholderLinks.map((item) => `- \`${item.page}\` → \`${item.reference}\``)
      : ['None detected.']),
    '',
    '## Metadata and H1 issues',
    '',
    ...(missingMetadata.length
      ? missingMetadata.map((item) => `- \`${item.page}\`: title=${Boolean(item.title)}, description=${Boolean(item.description)}, canonical=${Boolean(item.canonical)}, h1Count=${item.h1Count}`)
      : ['None detected.']),
    '',
    '## Duplicate titles',
    '',
    ...(duplicateTitles.length
      ? duplicateTitles.map((item) => `- **${item.title}**: ${item.pages.map((page) => `\`${page}\``).join(', ')}`)
      : ['None detected.']),
    '',
  ].join('\n');

  await writeFile(join(REPORT_DIR, 'audit-report.md'), markdown);

  console.log(markdown);

  const criticalCount = missingReferences.length + missingMetadata.length + duplicateTitles.length;
  if (STRICT && criticalCount > 0) {
    console.error(`\nAudit failed in strict mode with ${criticalCount} critical issue(s).`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Audit failed unexpectedly:', error);
  process.exitCode = 1;
});
