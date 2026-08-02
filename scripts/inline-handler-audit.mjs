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
  return String(code)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/g, ';');
}

export function classifyHandlerCode(code = '') {
  const normalized = normalizeHandlerCode(code);
  if (!normalized) return 'empty';

  if (/^(?:window\.)?location(?:\.href)?\s*=|^location\.(?:assign|replace)\s*\(/i.test(normalized)) {
    return 'navigation';
  }

  if (/^this\.(?:style\.[\w$]+\s*=|classList\.(?:add|remove|toggle)\s*\(|setAttribute\s*\(|removeAttribute\s*\()/i.test(normalized)
      && !/[;{}]\s*\S/.test(normalized.replace(/;$/, ''))) {
    return 'element-state';
  }

  if (/^(?:(?:window|globalThis)\.)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([\s\S]*\)\s*;?$/.test(normalized)) {
    return 'global-call';
  }

  if (/\b(?:if|else|for|while|switch|try|catch|return)\b|[{}]/.test(normalized)) {
    return 'control-flow';
  }

  const statementCount = normalized.split(';').map((item) => item.trim()).filter(Boolean).length;
  if (statementCount > 1) return 'compound';

  return 'other';
}

export function elementSignature(tagName, attributes = {}) {
  const id = typeof attributes.id === 'string' && attributes.id.trim()
    ? `#${attributes.id.trim()}`
    : '';
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
      records.push({
        page,
        event: name.toLowerCase(),
        tag,
        element: elementSignature(tag, attributes),
        code,
        normalizedCode: normalizeHandlerCode(code),
        classification: classifyHandlerCode(code),
      });
    }
  }

  return records;
}

export function buildPatternInventory(records = []) {
  const groups = new Map();

  for (const record of records) {
    const key = `${record.event}\u0000${record.normalizedCode}`;
    const group = groups.get(key) || {
      event: record.event,
      code: record.code,
      normalizedCode: record.normalizedCode,
      classification: record.classification,
      occurrences: 0,
      pages: new Set(),
      tags: new Set(),
      elements: new Set(),
    };
    group.occurrences += 1;
    group.pages.add(record.page);
    group.tags.add(record.tag);
    group.elements.add(record.element);
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      pages: [...group.pages].sort(),
      tags: [...group.tags].sort(),
      elements: [...group.elements].sort(),
      migrationSignal: group.occurrences > 1 && group.classification === 'global-call'
        ? 'high'
        : group.occurrences > 1 && group.classification === 'element-state'
          ? 'medium'
          : 'review',
    }))
    .sort((a, b) => b.occurrences - a.occurrences
      || a.event.localeCompare(b.event)
      || a.normalizedCode.localeCompare(b.normalizedCode));
}

function countBy(records, key) {
  const counts = new Map();
  for (const record of records) counts.set(record[key], (counts.get(record[key]) || 0) + 1);
  return [...counts.entries()]
    .map(([name, occurrences]) => ({ name, occurrences }))
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
    `- Unique runtime patterns: ${report.summary.uniquePatterns}`,
    `- Repeated runtime patterns: ${report.summary.repeatedPatterns}`,
    `- Occurrences covered by repeated patterns: ${report.summary.repeatedOccurrences}`,
    `- High-signal shared-listener candidates: ${report.summary.highSignalPatterns}`,
    `- Medium-signal element-state candidates: ${report.summary.mediumSignalPatterns}`,
    '',
    '## Runtime events',
    '',
    '| Event | Occurrences |',
    '|---|---:|',
    ...report.events.map((item) => `| \`${escapeTable(item.name)}\` | ${item.occurrences} |`),
    '',
    '## Handler classifications',
    '',
    '| Classification | Occurrences |',
    '|---|---:|',
    ...report.classifications.map((item) => `| \`${escapeTable(item.name)}\` | ${item.occurrences} |`),
    '',
    '## Repeated runtime patterns',
    '',
    '| Occurrences | Pages | Event | Classification | Signal | Code |',
    '|---:|---:|---|---|---|---|',
    ...report.patterns
      .filter((pattern) => pattern.occurrences > 1)
      .map((pattern) => `| ${pattern.occurrences} | ${pattern.pages.length} | \`${pattern.event}\` | \`${pattern.classification}\` | ${pattern.migrationSignal} | \`${escapeTable(truncate(pattern.normalizedCode))}\` |`),
    '',
    '## Review guidance',
    '',
    '- `high`: repeated direct function calls; usually the safest first delegation batch after verifying arguments and DOM scope.',
    '- `medium`: repeated `this`-based element-state changes; suitable for data attributes or a shared listener after checking target semantics.',
    '- `review`: unique, navigation, compound, or control-flow handlers; migrate only after behavior-specific tests exist.',
    '- This report is read-only. It does not remove or rewrite any handler.',
    '',
  ].join('\n');
}

async function walkHtml(directory) {
  const files = [];
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }
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
    .map((entry) => join(root, entry.name))
    .sort();
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
  const repeated = patterns.filter((pattern) => pattern.occurrences > 1);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      runtimePages: runtimeFiles.length,
      templates: templateFiles.length,
      runtimeHandlers: runtimeRecords.length,
      templateHandlers: templateRecords.length,
      eventTypes: new Set(runtimeRecords.map((record) => record.event)).size,
      uniquePatterns: patterns.length,
      repeatedPatterns: repeated.length,
      repeatedOccurrences: repeated.reduce((sum, pattern) => sum + pattern.occurrences, 0),
      highSignalPatterns: repeated.filter((pattern) => pattern.migrationSignal === 'high').length,
      mediumSignalPatterns: repeated.filter((pattern) => pattern.migrationSignal === 'medium').length,
    },
    events: countBy(runtimeRecords, 'event'),
    classifications: countBy(runtimeRecords, 'classification'),
    patterns,
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
  console.log(`Inline handler audit completed: ${report.summary.runtimeHandlers} runtime handlers across ${report.summary.uniquePatterns} patterns; ${report.summary.highSignalPatterns} high-signal repeated patterns.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Inline handler audit failed unexpectedly:', error);
  process.exit(1);
});
