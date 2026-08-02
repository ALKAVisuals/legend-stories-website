import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'details']);
const INTERACTIVE_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'switch', 'menuitem', 'option', 'tab']);
const PURCHASE_FILE_PATTERN = /(?:^|[-_])(checkout|payment|order|cart|winkelwagen|betaling)(?:[-_.]|$)/i;
const COLLECTION_FILE_PATTERN = /(?:collection|collectie|(?:combat|music|sport|wisdom)-legends)\.html$/i;
const AUTOCOMPLETE_EXPECTATIONS = [
  { pattern: /(?:first|given)[-_ ]?name/i, token: 'given-name' },
  { pattern: /(?:last|family|sur)[-_ ]?name/i, token: 'family-name' },
  { pattern: /email/i, token: 'email' },
  { pattern: /(?:phone|tel)/i, token: 'tel' },
  { pattern: /(?:street|address(?:-line)?1)/i, token: 'street-address' },
  { pattern: /(?:postal|postcode|zip)/i, token: 'postal-code' },
  { pattern: /city/i, token: 'address-level2' },
  { pattern: /country/i, token: 'country' },
];

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

function stripNonMarkup(html = '') {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '');
}

function textContent(html = '') {
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function elementSignature(tag, attributes = {}) {
  const id = typeof attributes.id === 'string' && attributes.id.trim()
    ? `#${attributes.id.trim()}`
    : '';
  const classes = typeof attributes.class === 'string'
    ? attributes.class.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((name) => `.${name}`).join('')
    : '';
  return `<${String(tag || 'unknown').toLowerCase()}${id}${classes}>`;
}

export function hasAccessibleName(attributes = {}, innerHtml = '', tag = '') {
  const ariaLabel = typeof attributes['aria-label'] === 'string' ? attributes['aria-label'].trim() : '';
  const labelledBy = typeof attributes['aria-labelledby'] === 'string' ? attributes['aria-labelledby'].trim() : '';
  const title = typeof attributes.title === 'string' ? attributes.title.trim() : '';
  if (ariaLabel || labelledBy || title) return true;

  if (tag === 'input') {
    const type = String(attributes.type || 'text').toLowerCase();
    if (['button', 'submit', 'reset'].includes(type)) {
      return typeof attributes.value === 'string' && attributes.value.trim().length > 0;
    }
    if (type === 'image') return typeof attributes.alt === 'string' && attributes.alt.trim().length > 0;
  }

  return textContent(innerHtml).length > 0;
}

export function headingLevels(html = '') {
  const levels = [];
  const pattern = /<h([1-6])\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(stripNonMarkup(html)))) levels.push(Number(match[1]));
  return levels;
}

export function findHeadingJumps(levels = []) {
  const jumps = [];
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      jumps.push({ from: levels[index - 1], to: levels[index], index });
    }
  }
  return jumps;
}

export function classifyPage(page = '', html = '') {
  const filename = String(page).toLowerCase();
  const markup = String(html).slice(0, 40000);
  if (PURCHASE_FILE_PATTERN.test(filename)) return 'purchase-flow';
  if (/data-product-(?:id|slug|page)|product-detail|product-page|"@type"\s*:\s*"Product"/i.test(markup)) return 'product';
  if (COLLECTION_FILE_PATTERN.test(filename) || /data-collection-page|collection-hero/i.test(markup)) return 'collection';
  if (filename === 'index.html') return 'home';
  return 'general';
}

export function expectedAutocompleteToken(attributes = {}) {
  const hint = `${attributes.id || ''} ${attributes.name || ''}`;
  return AUTOCOMPLETE_EXPECTATIONS.find((entry) => entry.pattern.test(hint))?.token || '';
}

function hasPurchaseSurface(markup = '') {
  return /id=["']checkout-(?:modal|drawer|firstname|email|country)["']|>\s*Shipping address\s*</i.test(markup);
}

function issue(page, severity, code, message, element = '') {
  return { page, severity, code, message, element };
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.entries()]
    .map(([name, occurrences]) => ({ name, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name));
}

function groupIssues(issues = []) {
  const groups = new Map();
  for (const item of issues) {
    const key = [item.severity, item.code, item.message, item.element].join('\u0000');
    const group = groups.get(key) || { ...item, occurrences: 0, pages: new Set() };
    group.occurrences += 1;
    group.pages.add(item.page);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, pages: [...group.pages].sort() }))
    .sort((a, b) => b.occurrences - a.occurrences
      || a.severity.localeCompare(b.severity)
      || a.code.localeCompare(b.code)
      || a.element.localeCompare(b.element));
}

function controlIsLabelled(attributes, labelsFor, wrappedControlIds) {
  const ariaLabel = typeof attributes['aria-label'] === 'string' && attributes['aria-label'].trim();
  const labelledBy = typeof attributes['aria-labelledby'] === 'string' && attributes['aria-labelledby'].trim();
  if (ariaLabel || labelledBy) return true;
  const id = typeof attributes.id === 'string' ? attributes.id.trim() : '';
  return Boolean(id && (labelsFor.has(id) || wrappedControlIds.has(id)));
}

function auditPage(page, html) {
  const markup = stripNonMarkup(html);
  const type = classifyPage(page, html);
  const purchaseSurface = hasPurchaseSurface(markup);
  const issues = [];
  const stats = {
    page,
    type,
    purchaseSurface,
    images: 0,
    forms: 0,
    controls: 0,
    dialogs: 0,
    buttons: 0,
    links: 0,
    headings: 0,
    liveRegions: 0,
  };

  const htmlTag = markup.match(/<html\b([^>]*)>/i);
  const htmlAttributes = parseAttributes(htmlTag?.[1] || '');
  if (!htmlTag || typeof htmlAttributes.lang !== 'string' || !htmlAttributes.lang.trim()) {
    issues.push(issue(page, 'error', 'html-lang', 'The document has no non-empty html lang attribute.', '<html>'));
  }
  if (!/<title\b[^>]*>\s*[^<]+\s*<\/title>/i.test(markup)) {
    issues.push(issue(page, 'error', 'document-title', 'The document has no non-empty title.', '<title>'));
  }
  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(markup)) {
    issues.push(issue(page, 'error', 'viewport', 'The document has no viewport meta tag.', '<head>'));
  }

  const mainCount = (markup.match(/<main\b/gi) || []).length;
  if (mainCount !== 1) {
    issues.push(issue(page, mainCount === 0 ? 'warning' : 'error', 'main-landmark', `Expected exactly one main landmark, found ${mainCount}.`, '<main>'));
  }

  const levels = headingLevels(markup);
  stats.headings = levels.length;
  const h1Count = levels.filter((level) => level === 1).length;
  if (h1Count !== 1) {
    issues.push(issue(page, h1Count === 0 ? 'warning' : 'error', 'h1-count', `Expected exactly one h1, found ${h1Count}.`, '<h1>'));
  }
  for (const jump of findHeadingJumps(levels)) {
    issues.push(issue(page, 'review', 'heading-jump', `Heading level jumps from h${jump.from} to h${jump.to}.`, `heading index ${jump.index}`));
  }

  const ids = new Map();
  const allTagPattern = /<([a-z][a-z0-9:-]*)\b([^>]*)>/gi;
  let tagMatch;
  while ((tagMatch = allTagPattern.exec(markup))) {
    const tag = tagMatch[1].toLowerCase();
    const attributes = parseAttributes(tagMatch[2]);
    const signature = elementSignature(tag, attributes);
    if (typeof attributes.id === 'string' && attributes.id.trim()) {
      const id = attributes.id.trim();
      ids.set(id, (ids.get(id) || 0) + 1);
    }

    const handlers = Object.keys(attributes).filter((name) => /^on[a-z]+$/.test(name));
    if (handlers.length && !INTERACTIVE_TAGS.has(tag)) {
      const role = typeof attributes.role === 'string' ? attributes.role.toLowerCase() : '';
      const tabindex = attributes.tabindex;
      if (!INTERACTIVE_ROLES.has(role) || tabindex === undefined) {
        issues.push(issue(page, 'warning', 'non-native-interactive', `Non-native <${tag}> uses ${handlers.join(', ')} without a complete keyboard contract.`, signature));
      }
    }

    if (attributes.target === '_blank') {
      const rel = typeof attributes.rel === 'string' ? attributes.rel.toLowerCase().split(/\s+/) : [];
      if (!rel.includes('noopener')) {
        issues.push(issue(page, 'warning', 'target-blank-rel', 'A target=_blank link is missing rel=noopener.', signature));
      }
    }
  }
  for (const [id, occurrences] of ids) {
    if (occurrences > 1) issues.push(issue(page, 'error', 'duplicate-id', `Duplicate id "${id}" appears ${occurrences} times.`, `#${id}`));
  }

  const imagePattern = /<img\b([^>]*)>/gi;
  let imageMatch;
  while ((imageMatch = imagePattern.exec(markup))) {
    stats.images += 1;
    const attributes = parseAttributes(imageMatch[1]);
    if (attributes.alt === undefined) {
      issues.push(issue(page, 'error', 'image-alt-missing', 'Image has no alt attribute.', elementSignature('img', attributes)));
    }
  }

  const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let buttonMatch;
  while ((buttonMatch = buttonPattern.exec(markup))) {
    stats.buttons += 1;
    const attributes = parseAttributes(buttonMatch[1]);
    if (!hasAccessibleName(attributes, buttonMatch[2], 'button')) {
      issues.push(issue(page, 'error', 'button-name', 'Button has no accessible name.', elementSignature('button', attributes)));
    }
  }

  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(markup))) {
    stats.links += 1;
    const attributes = parseAttributes(linkMatch[1]);
    const signature = elementSignature('a', attributes);
    if (!hasAccessibleName(attributes, linkMatch[2], 'a')) {
      issues.push(issue(page, 'error', 'link-name', 'Link has no accessible name.', signature));
    }
    if (typeof attributes.href !== 'string' || !attributes.href.trim()) {
      issues.push(issue(page, 'warning', 'link-href', 'Anchor has no non-empty href.', signature));
    }
  }

  const labelsFor = new Set();
  const wrappedControlIds = new Set();
  const labelPattern = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
  let labelMatch;
  while ((labelMatch = labelPattern.exec(markup))) {
    const attributes = parseAttributes(labelMatch[1]);
    if (typeof attributes.for === 'string' && attributes.for.trim()) labelsFor.add(attributes.for.trim());
    const nestedPattern = /<(?:input|select|textarea)\b([^>]*)>/gi;
    let nested;
    while ((nested = nestedPattern.exec(labelMatch[2]))) {
      const nestedAttributes = parseAttributes(nested[1]);
      if (typeof nestedAttributes.id === 'string' && nestedAttributes.id.trim()) wrappedControlIds.add(nestedAttributes.id.trim());
    }
  }

  const controlPattern = /<(input|select|textarea)\b([^>]*)>/gi;
  let controlMatch;
  while ((controlMatch = controlPattern.exec(markup))) {
    const tag = controlMatch[1].toLowerCase();
    const attributes = parseAttributes(controlMatch[2]);
    const inputType = tag === 'input' ? String(attributes.type || 'text').toLowerCase() : tag;
    if (inputType === 'hidden') continue;
    stats.controls += 1;
    const signature = elementSignature(tag, attributes);

    if (!controlIsLabelled(attributes, labelsFor, wrappedControlIds) && !hasAccessibleName(attributes, '', tag)) {
      issues.push(issue(page, 'error', 'control-label', `${tag} control has no associated label or accessible name.`, signature));
    }

    if (purchaseSurface) {
      const expectedToken = expectedAutocompleteToken(attributes);
      const actualToken = typeof attributes.autocomplete === 'string' ? attributes.autocomplete.trim().toLowerCase() : '';
      if (expectedToken && actualToken !== expectedToken) {
        issues.push(issue(page, 'review', 'autocomplete-token', `Expected autocomplete="${expectedToken}" for this purchase-flow field; found ${actualToken ? `"${actualToken}"` : 'none'}.`, signature));
      }
    }
  }

  const formPattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch;
  while ((formMatch = formPattern.exec(markup))) {
    stats.forms += 1;
    const inner = formMatch[2];
    const submit = /<button\b[^>]*type=["']submit["'][^>]*>|<input\b[^>]*type=["']submit["'][^>]*>/i.test(inner)
      || /<button\b(?![^>]*type=["'](?:button|reset)["'])[^>]*>/i.test(inner);
    if (!submit) issues.push(issue(page, 'warning', 'form-submit', 'Form has no detectable submit control.', '<form>'));
  }

  const dialogPattern = /<([a-z][a-z0-9:-]*)\b([^>]*(?:role=["']dialog["']|aria-modal=["']true["'])[^>]*)>/gi;
  let dialogMatch;
  while ((dialogMatch = dialogPattern.exec(markup))) {
    stats.dialogs += 1;
    const tag = dialogMatch[1].toLowerCase();
    const attributes = parseAttributes(dialogMatch[2]);
    const signature = elementSignature(tag, attributes);
    if (!hasAccessibleName(attributes, '', tag)) {
      issues.push(issue(page, 'error', 'dialog-name', 'Dialog or modal has no aria-label or aria-labelledby.', signature));
    }
    if (attributes.role === 'dialog' && attributes['aria-modal'] !== 'true') {
      issues.push(issue(page, 'review', 'dialog-modality', 'Dialog role is present without aria-modal="true"; verify whether the background is intended to remain interactive.', signature));
    }
    if (attributes['data-focus-managed'] !== 'true') {
      issues.push(issue(page, 'review', 'dialog-focus-lifecycle', 'Verify focus entry, focus containment, Escape handling and focus restoration for this dialog.', signature));
    }
  }

  stats.liveRegions = (markup.match(/aria-live\s*=|role\s*=\s*["'](?:status|alert)["']/gi) || []).length;
  if (purchaseSurface && stats.liveRegions === 0) {
    issues.push(issue(page, 'review', 'purchase-feedback', 'The shared purchase surface has no detectable status or alert live region for validation and submission feedback.', '#checkout-modal'));
  }

  return { page, type, purchaseSurface, stats, issues };
}

function escapeTable(value = '') {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function toMarkdown(report) {
  return [
    '# Accessibility and purchase-flow audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Runtime pages scanned: ${report.summary.pages}`,
    `- Dedicated purchase-flow pages: ${report.summary.purchaseFlowPages}`,
    `- Pages carrying the shared purchase surface: ${report.summary.purchaseSurfacePages}`,
    `- Errors: ${report.summary.errors}`,
    `- Warnings: ${report.summary.warnings}`,
    `- Review items: ${report.summary.reviewItems}`,
    `- Unique finding groups: ${report.summary.findingGroups}`,
    `- Images: ${report.summary.images}`,
    `- Forms: ${report.summary.forms}`,
    `- Form controls: ${report.summary.controls}`,
    `- Dialogs/modals: ${report.summary.dialogs}`,
    '',
    '## Page types',
    '',
    '| Type | Pages |',
    '|---|---:|',
    ...report.pageTypes.map((item) => `| \`${escapeTable(item.name)}\` | ${item.occurrences} |`),
    '',
    '## Finding types',
    '',
    '| Code | Occurrences |',
    '|---|---:|',
    ...report.issueCodes.map((item) => `| \`${escapeTable(item.name)}\` | ${item.occurrences} |`),
    '',
    '## Consolidated findings',
    '',
    '| Severity | Occurrences | Pages | Code | Element | Finding |',
    '|---|---:|---:|---|---|---|',
    ...report.issueGroups.map((item) => `| ${item.severity} | ${item.occurrences} | ${item.pages.length} | \`${escapeTable(item.code)}\` | \`${escapeTable(item.element)}\` | ${escapeTable(item.message)} |`),
    '',
    '## Interpretation',
    '',
    '- Repeated findings usually originate from a shared header, cart drawer, checkout modal, footer or product template; they should be fixed once at the source rather than page by page.',
    '- `error` is a deterministic static defect such as a missing label, accessible name, language, title or unique ID.',
    '- `warning` is a likely semantic or keyboard defect that needs component-level review.',
    '- `review` identifies behavior that static HTML cannot prove, including focus lifecycle, live feedback, heading intent and autocomplete policy.',
    '- Empty `alt=""` is treated as an intentional decorative alternative and is not reported; only missing alt attributes fail.',
    '- This audit does not replace keyboard, screen-reader, contrast, zoom, responsive or real hosted-checkout testing.',
    '- The audit is read-only and never modifies storefront markup.',
    '',
  ].join('\n');
}

export async function buildAccessibilityPurchaseFlowAudit(root = ROOT) {
  const files = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => join(root, entry.name))
    .sort();

  const pages = [];
  for (const file of files) {
    const page = posix(relative(root, file));
    pages.push(auditPage(page, await readFile(file, 'utf8')));
  }

  const issues = pages.flatMap((page) => page.issues);
  const severity = countBy(issues, 'severity');
  const getSeverity = (name) => severity.find((item) => item.name === name)?.occurrences || 0;
  const issueGroups = groupIssues(issues);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      pages: pages.length,
      purchaseFlowPages: pages.filter((page) => page.type === 'purchase-flow').length,
      purchaseSurfacePages: pages.filter((page) => page.purchaseSurface).length,
      errors: getSeverity('error'),
      warnings: getSeverity('warning'),
      reviewItems: getSeverity('review'),
      findingGroups: issueGroups.length,
      images: pages.reduce((sum, page) => sum + page.stats.images, 0),
      forms: pages.reduce((sum, page) => sum + page.stats.forms, 0),
      controls: pages.reduce((sum, page) => sum + page.stats.controls, 0),
      dialogs: pages.reduce((sum, page) => sum + page.stats.dialogs, 0),
    },
    severities: severity,
    pageTypes: countBy(pages, 'type'),
    issueCodes: countBy(issues, 'code'),
    issueGroups,
    pages,
    issues,
  };
}

async function main() {
  const report = await buildAccessibilityPurchaseFlowAudit(ROOT);
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'accessibility-purchase-flow-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(REPORT_DIR, 'accessibility-purchase-flow-audit.md'), `${toMarkdown(report)}\n`, 'utf8');
  console.log(`Accessibility audit completed: ${report.summary.pages} pages, ${report.summary.findingGroups} finding groups, ${report.summary.errors} errors, ${report.summary.warnings} warnings, ${report.summary.reviewItems} review items.`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Accessibility audit failed unexpectedly:', error);
  process.exit(1);
});
