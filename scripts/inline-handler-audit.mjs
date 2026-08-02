import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const posix = (value) => value.split(sep).join('/');

function parseAttributes(source = '') {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return attributes;
}

export function normalizeHandlerCode(code = '') {
  return String(code).trim().replace(/\s+/g, ' ').replace(/\s*;\s*$/g, ';');
}

export function classifyHandlerCode(code = '') {
  const normalized = normalizeHandlerCode(code);
  if (!normalized) return 'empty';
  if (/^(?:window\.)?location(?:\.href)?\s*=|^location\.(?:assign|replace)\s*\(/i.test(normalized)) return 'navigation';
  if (/^this\.(?:style\.[\w$]+\s*=|classList\.(?:add|remove|toggle)\s*\(|setAttribute\s*\(|removeAttribute\s*\()/i.test(normalized)
      && !/[;{}]\s*\S/.test(normalized.replace(/;$/, ''))) return 'element-state';
  if (/\b(?:if|else|for|while|switch|try|catch|return)\b|[{}]/.test(normalized)) return 'control-flow';
  const statementCount = normalized.split(';').map((item) => item.trim()).filter(Boolean).length;
  if (statementCount > 1) return 'compound';
  if (/^(?:(?:window|globalThis)\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([\s\S]*\)\s*;?$/.test(normalized)) return 'global-call';
  return 'other';
}

export function validateHandlerSyntax(code = '') {
  try {
    new Function('event', String(code));
    return { valid: true, error: '' };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function handlerFamily(code = '', classification = classifyHandlerCode(code)) {
  const normalized = normalizeHandlerCode(code);
  if (/^event\.stopPropagation\(\);?$/i.test(normalized)) return 'event-stop-propagation';
  if (classification === 'navigation' && /(?:window\.)?location(?:\.href)?\s*=/i.test(normalized)) return 'location-assignment';
  if (classification === 'navigation' && /location\.(?:assign|replace)\s*\(/i.test(normalized)) return 'location-method';
  if (classification === 'global-call') return 'global-call';
  return classification;
}

export function elementSignature(tagName, attributes = {}) {
  const id = typeof attributes.id === 'string' && attributes.id.trim() ? `#${attributes.id.trim()}` : '';
  const classes = typeof attributes.class === 'string'
    ? attributes.class.trim().split(/\s+/).filter(Boolean).slice(0, 3).map((name) => `.${name}`).join('')
    : '';
  return `${String(tagName || 'unknown').toLowerCase()}${id}${classes}`;
}

export function extractInlineHandlerRecords(html = '', page = '') {
  const markupOnly = String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const records = [];
  const tagPattern = /<([a-z][a-z0-9:-]*)\b([^>]*)>/gi;
  let tagMatch;

  while ((tagMatch = tagPattern.exec(markupOnly))) {
    const tag = tagMatch[1].toLowerCase();
    const attributes = parseAttributes(tagMatch[2]);
    for (const [name, value] of Object.entries(attributes)) {
      if (!/^on[a-z]+$/i.test(name) || typeof value !== 'string') continue;
      const code = value.trim();
      const normalizedCode = normalizeHandlerCode(code);
      const classification = classifyHandlerCode(code);
      const syntax = validateHandlerSyntax(code);
      records.push({
        page,
        event: name.toLowerCase(),
        tag,
        element: elementSignature(tag, attributes),
        code,
        normalizedCode,
        classification,
        family: handlerFamily(code, classification),
        syntaxValid: syntax.valid,
        syntaxError: syntax.error,
      });
    }
  }
  return records;
}

function groupRecords(records, keyBuilder, baseBuilder) {
  const groups = new Map();
  for (const record of records) {
    const key = keyBuilder(record);
    const group = groups.get(key) || {
      ...baseBuilder(record),
      occurrences: 0,
      pages: new Set(),
      tags: new Set(),
      elements: new Set(),
      sampleCodes: new Set(),
      invalidSyntaxOccurrences: 0,
      syntaxErrors: new Set(),
    };
    group.occurrences += 1;
    group.pages.add(record.page);
    group.tags.add(record.tag);
    group.elements.add(record.element);
    group.sampleCodes.add(record.normalizedCode);
    if (!record.syntaxValid) {
      group.invalidSyntaxOccurrences += 1;
      if (record.syntaxError) group.syntaxErrors.add(record.syntaxError);
    }
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => ({
    ...group,
    pages: [...group.pages].sort(),
    tags: [...group.tags].sort(),
    elements: [...group.elements].sort(),
    sampleCodes: [...group.sampleCodes].sort().slice(0, 5),
    syntaxErrors: [...group.syntaxErrors].sort(),
  })).sort((a, b) => b.occurrences - a.occurrences
    || String(a.event).localeCompare(String(b.event))
    || String(a.family || a.normalizedCode).localeCompare(String(b.family || b.normalizedCode)));
}

export function buildPatternInventory(records = []) {
  return groupRecords(
    records,
    (record) => `${record.event}\u0000${record.normalizedCode}`,
    (record) => ({
      event: record.event,
      code: record.code,
      normalizedCode: record.normalizedCode,
      classification: record.classification,
      family: record.family,
      syntaxValid: record.syntaxValid,
      syntaxError: record.syntaxError,
      migrationSignal: record.syntaxValid && ['global-call', 'element-state'].includes(record.classification) ? 'candidate' : 'review',
    }),
  );
}

export function buildFamilyInventory(records = []) {
  return groupRecords(
    records,
    (record) => `${record.event}\u0000${record.family}\u0000${record.tag}`,
    (record) => ({ event: record.event, family: record.family, tag: record.tag, classification: record.classification }),
  ).map((group) => ({
    ...group,
    migrationSignal: group.invalidSyntaxOccurrences > 0
      ? 'fix-first'
      : group.occurrences > 1 && ['event-stop-propagation', 'location-assignment'].includes(group.family)
        ? 'high'
        : group.occurrences > 1
          ? 'review'
          : 'isolated',
  }));
}

function countBy(records, key) {
  const counts = new Map();
  for (const record of records) counts.set(record[key], (counts.get(record[key]) || 0) + 1);
  return [...counts.entries()].map(([name, occurrences]) => ({ name, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));
}

function escapeTable(value = '') {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function truncate(value = '', max = 140) {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function toMarkdown(report) {
  return [
    '# Inline event handler inventory',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Runtime HTML pages scanned: ${report.summary.runtimePages}`,
    `- Source templates scanned: ${report.summary.templates}`,
    `- Runtime inline handlers: ${report.summary.runtimeHandlers}`,
    `- Template inline handlers: ${report.summary.templateHandlers}`,
    `- Runtime event types: ${report.summary.eventTypes}`,
    `- Exact runtime patterns: ${report.summary.uniquePatterns}`,
    `- Semantic handler families: ${report.summary.handlerFamilies}`,
    `- Invalid-syntax handlers: ${report.summary.invalidSyntaxHandlers}`,
    `- Invalid-syntax exact patterns: ${report.summary.invalidSyntaxPatterns}`,
    '',
    '## Runtime events',
    '',
    '| Event | Occurrences |',
    '|---|---:|',
    ...report.events.map((item) => `| \`${escapeTable(item.name)}\` | ${item.occurrences} |`),
    '',
    '## Semantic families',
    '',
    '| Occurrences | Pages | Event | Tag | Family | Signal | Invalid syntax | Sample |',
    '|---:|---:|---|---|---|---|---:|---|',
    ...report.families.map((group) => `| ${group.occurrences} | ${group.pages.length} | \`${group.event}\` | \`${group.tag}\` | \`${group.family}\` | ${group.migrationSignal} | ${group.invalidSyntaxOccurrences} | \`${escapeTable(truncate(group.sampleCodes[0] || ''))}\` |`),
    '',
    '## Invalid syntax',
    '',
    ...(report.invalidSyntax.length
      ? report.invalidSyntax.map((record) => `- \`${record.page}\` — \`${record.element}\`: \`${escapeTable(record.normalizedCode)}\` (${escapeTable(record.syntaxError)})`)
      : ['No inline handler syntax errors detected.']),
    '',
    '## Review guidance',
    '',
    '- `fix-first`: existing handler text does not compile and should be repaired before broader migration.',
    '- `high`: a dominant shared family suitable for a dedicated, tested centralization sprint.',
    '- `review`: repeated behavior that still needs DOM and keyboard analysis.',
    '- `isolated`: a one-off handler; do not generalize without component-specific evidence.',
    '- This report compiles handler text for syntax validation but never executes it.',
    '- This report is read-only and does not remove or rewrite handlers.',
    '',
  ].join('\n');
}

async function walkHtml(directory) {
  const files = [];
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return files; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkHtml(path));
    else if (extname(entry.name).toLowerCase() === '.html') files.push(path);
  }
  return files;
}

export async function buildInlineHandlerAudit(root = ROOT) {
  const runtimeFiles = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => join(root, entry.name)).sort();
  const templateFiles = (await walkHtml(join(root, 'templates'))).sort();

  const runtimeRecords = [];
  for (const file of runtimeFiles) {
    const page = posix(relative(root, file));
    runtimeRecords.push(...extractInlineHandlerRecords(await readFile(file, 'utf8'), page));
  }
  const templateRecords = [];
  for (const file of templateFiles) {
    const page = posix(relative(root, file));
    templateRecords.push(...extractInlineHandlerRecords(await readFile(file, 'utf8'), page));
  }

  const patterns = buildPatternInventory(runtimeRecords);
  const families = buildFamilyInventory(runtimeRecords);
  const invalidSyntax = runtimeRecords.filter((record) => !record.syntaxValid);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      runtimePages: runtimeFiles.length,
      templates: templateFiles.length,
      runtimeHandlers: runtimeRecords.length,
      templateHandlers: templateRecords.length,
      eventTypes: new Set(runtimeRecords.map((record) => record.event)).size,
      uniquePatterns: patterns.length,
      handlerFamilies: families.length,
      invalidSyntaxHandlers: invalidSyntax.length,
      invalidSyntaxPatterns: patterns.filter((pattern) => pattern.invalidSyntaxOccurrences > 0).length,
    },
    events: countBy(runtimeRecords, 'event'),
    classifications: countBy(runtimeRecords, 'classification'),
    families,
    patterns,
    invalidSyntax,
    templateFamilies: buildFamilyInventory(templateRecords),
    templatePatterns: buildPatternInventory(templateRecords),
    runtimeRecords,
    templateRecords,
  };
}

async function main() {
  const report = await buildInlineHandlerAudit(ROOT);
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'inline-handler-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(REPORT_DIR, 'inline-handler-audit.md'), `${toMarkdown(report)}\n`, 'utf8');
  console.log(`Inline handler audit completed: ${report.summary.runtimeHandlers} handlers, ${report.summary.handlerFamilies} semantic families, ${report.summary.invalidSyntaxHandlers} syntax-invalid handlers.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Inline handler audit failed unexpectedly:', error);
  process.exit(1);
});
