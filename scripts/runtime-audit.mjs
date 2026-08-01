import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const EXTERNAL_REFERENCE = /^(?:https?:|\/\/|data:|javascript:|mailto:|tel:|#)/i;
const NON_EXECUTABLE_TYPES = new Set(['application/ld+json', 'application/json']);
const BROWSER_PROVIDED_GLOBALS = new Set(['location']);

const posix = (value) => value.split(sep).join('/');
const stripQueryAndHash = (value = '') => value.split('#')[0].split('?')[0];

function parseAttributes(source = '') {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? true;
  }
  return attributes;
}

export function extractScriptTags(html = '') {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attributes = parseAttributes(match[1]);
    const type = String(attributes.type || '').toLowerCase();
    scripts.push({
      src: typeof attributes.src === 'string' ? attributes.src.trim() : '',
      type,
      module: type === 'module',
      async: attributes.async === true || attributes.async === '',
      defer: attributes.defer === true || attributes.defer === '',
      executable: !NON_EXECUTABLE_TYPES.has(type),
      inlineBytes: Buffer.byteLength(match[2] || ''),
    });
  }
  return scripts;
}

export function extractInlineHandlers(html = '') {
  const markupOnly = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '');
  const handlers = [];
  for (const tag of markupOnly.match(/<[a-z][^>]*>/gi) || []) {
    const attributes = parseAttributes(tag.replace(/^<[a-z0-9:-]+/i, '').replace(/>$/, ''));
    for (const [name, value] of Object.entries(attributes)) {
      if (/^on[a-z]+$/i.test(name) && typeof value === 'string') {
        handlers.push({ event: name.toLowerCase(), code: value });
      }
    }
  }
  return handlers;
}

export function extractGlobalAssignments(source = '') {
  const globals = new Set();
  const pattern = /(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=/g;
  let match;
  while ((match = pattern.exec(source))) globals.add(match[1]);
  return [...globals].sort();
}

function windowRoots(source = '') {
  const roots = new Set();
  const pattern = /(?:window|globalThis)\.([A-Za-z_$][\w$]*)/g;
  let match;
  while ((match = pattern.exec(source))) roots.add(match[1]);
  return [...roots].sort();
}

export function extractDynamicHandlerGlobalRoots(source = '') {
  const roots = new Set();
  for (const line of source.split('\n')) {
    if (!/on[a-z]+\s*=/.test(line)) continue;
    for (const root of windowRoots(line)) roots.add(root);
  }
  return [...roots].sort();
}

export function extractHtmlReferencesFromJs(source = '') {
  const references = new Set();
  const pattern = /["'`]([^"'`]*?\.html(?:[?#][^"'`]*)?)["'`]/g;
  let match;
  while ((match = pattern.exec(source))) {
    const value = stripQueryAndHash(match[1].trim());
    if (value && !EXTERNAL_REFERENCE.test(value) && !value.includes('${')) references.add(value);
  }
  return [...references].sort();
}

export function validateAppInitializer(source = '') {
  const startMarker = 'const fns = [';
  const endMarker = '];\n    // Inject discount UI and init after DOM is ready';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) return ['js/app.js: initialization function list could not be located.'];

  const entries = source
    .slice(start + startMarker.length, end)
    .split(',')
    .map((entry) => entry.replace(/\/\/.*$/gm, '').trim())
    .filter(Boolean);
  const errors = [];
  if (entries.length === 0) errors.push('js/app.js: initialization function list is empty.');
  for (const entry of entries) {
    if (!/^[A-Za-z_$][\w$]*$/.test(entry)) {
      errors.push(`js/app.js: non-function initializer entry detected: ${entry.slice(0, 80)}.`);
    }
  }
  return errors;
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function localReferencePath(reference) {
  const clean = stripQueryAndHash(reference).replace(/^\.\//, '').replace(/^\//, '');
  return resolve(ROOT, clean);
}

function scriptSequence(scripts) {
  const local = scripts
    .filter((script) => script.src && !EXTERNAL_REFERENCE.test(script.src))
    .map((script) => `${script.module ? 'module' : 'classic'}:${stripQueryAndHash(script.src)}`);
  return local.length ? local.join(' → ') : '(no local scripts)';
}

function toMarkdown(report) {
  return [
    '# Browser Runtime Contract Audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Site pages scanned: ${report.summary.pages}`,
    `- Browser JavaScript files checked: ${report.summary.browserJsFiles}`,
    `- Local script references: ${report.summary.localScriptReferences}`,
    `- Classic script references: ${report.summary.classicScriptReferences}`,
    `- Module script references: ${report.summary.moduleScriptReferences}`,
    `- Executable inline scripts: ${report.summary.inlineExecutableScripts}`,
    `- Inline event handlers: ${report.summary.inlineHandlers}`,
    `- Script-order variants: ${report.summary.scriptOrderVariants}`,
    `- Exported browser globals: ${report.summary.exportedGlobals}`,
    `- Errors: ${report.summary.errors}`,
    `- Warnings: ${report.summary.warnings}`,
    '',
    '## Script order variants',
    '',
    '| Pages | Sequence |',
    '|---:|---|',
    ...report.scriptOrderVariants.map((item) => `| ${item.pages.length} | ${item.sequence.replaceAll('|', '\\|')} |`),
    '',
    '## Exported browser globals',
    '',
    ...(report.exportedGlobals.length ? report.exportedGlobals.map((name) => `- \`${name}\``) : ['None detected.']),
    '',
    '## Errors',
    '',
    ...(report.errors.length ? report.errors.map((error) => `- ${error}`) : ['None detected.']),
    '',
    '## Warnings',
    '',
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ['None detected.']),
    '',
  ].join('\n');
}

export async function buildRuntimeAudit(root = ROOT) {
  const htmlFiles = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
    .map((entry) => join(root, entry.name))
    .sort();
  const browserJsFiles = (await walk(join(root, 'js')))
    .filter((file) => extname(file).toLowerCase() === '.js')
    .sort();

  const errors = [];
  const warnings = [];
  const pages = [];
  const sequences = new Map();
  const exportedGlobals = new Set();
  const requiredHandlerGlobals = new Set();
  const jsSources = new Map();
  let localScriptReferences = 0;
  let classicScriptReferences = 0;
  let moduleScriptReferences = 0;
  let inlineExecutableScripts = 0;
  let inlineHandlers = 0;

  for (const file of browserJsFiles) {
    const source = await readFile(file, 'utf8');
    const fileName = posix(relative(root, file));
    jsSources.set(fileName, source);
    extractGlobalAssignments(source).forEach((name) => exportedGlobals.add(name));
    extractDynamicHandlerGlobalRoots(source).forEach((name) => requiredHandlerGlobals.add(name));

    const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (syntax.status !== 0) {
      errors.push(`${fileName}: JavaScript syntax check failed: ${(syntax.stderr || syntax.stdout).trim()}`);
    }
    for (const reference of extractHtmlReferencesFromJs(source)) {
      if (!(await exists(localReferencePath(reference)))) {
        errors.push(`${fileName}: static HTML route does not exist: ${reference}`);
      }
    }
  }

  const appSource = jsSources.get('js/app.js');
  if (!appSource) errors.push('js/app.js: browser runtime entry is missing.');
  else {
    errors.push(...validateAppInitializer(appSource));
    if (/console\.log\(\s*["']\[DEBUG\]/.test(appSource)) {
      errors.push('js/app.js: checkout debug logging remains in the production runtime.');
    }
  }

  for (const file of htmlFiles) {
    const page = posix(relative(root, file));
    const html = await readFile(file, 'utf8');
    const scripts = extractScriptTags(html);
    const handlers = extractInlineHandlers(html);
    const localScripts = scripts.filter((script) => script.src && !EXTERNAL_REFERENCE.test(script.src));
    const localSources = localScripts.map((script) => stripQueryAndHash(script.src));

    localScriptReferences += localScripts.length;
    classicScriptReferences += localScripts.filter((script) => !script.module).length;
    moduleScriptReferences += localScripts.filter((script) => script.module).length;
    inlineExecutableScripts += scripts.filter((script) => !script.src && script.executable && script.inlineBytes > 0).length;
    inlineHandlers += handlers.length;

    for (const duplicate of new Set(localSources.filter((src, index) => localSources.indexOf(src) !== index))) {
      errors.push(`${page}: duplicate local script reference ${duplicate}.`);
    }
    for (const script of localScripts) {
      if (!(await exists(localReferencePath(script.src)))) {
        errors.push(`${page}: local script not found: ${script.src}.`);
      }
    }
    handlers.forEach((handler) => windowRoots(handler.code).forEach((name) => requiredHandlerGlobals.add(name)));

    const sequence = scriptSequence(scripts);
    const sequencePages = sequences.get(sequence) || [];
    sequencePages.push(page);
    sequences.set(sequence, sequencePages);
    pages.push({ page, scripts, inlineHandlers: handlers });
  }

  for (const name of requiredHandlerGlobals) {
    if (!exportedGlobals.has(name) && !BROWSER_PROVIDED_GLOBALS.has(name)) {
      errors.push(`Runtime handler requires window.${name}, but no local browser script exports it.`);
    }
  }

  if (classicScriptReferences) warnings.push(`${classicScriptReferences} classic local script references remain on the compatibility runtime path.`);
  if (inlineExecutableScripts) errors.push(`${inlineExecutableScripts} executable inline script blocks are not allowed.`);
  if (inlineHandlers) warnings.push(`${inlineHandlers} inline event handlers remain and require a documented global contract.`);

  const scriptOrderVariants = [...sequences.entries()]
    .map(([sequence, variantPages]) => ({ sequence, pages: variantPages.sort() }))
    .sort((a, b) => b.pages.length - a.pages.length || a.sequence.localeCompare(b.sequence));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      pages: htmlFiles.length,
      browserJsFiles: browserJsFiles.length,
      localScriptReferences,
      classicScriptReferences,
      moduleScriptReferences,
      inlineExecutableScripts,
      inlineHandlers,
      scriptOrderVariants: scriptOrderVariants.length,
      exportedGlobals: exportedGlobals.size,
      errors: errors.length,
      warnings: warnings.length,
    },
    exportedGlobals: [...exportedGlobals].sort(),
    requiredHandlerGlobals: [...requiredHandlerGlobals].sort(),
    browserProvidedGlobals: [...BROWSER_PROVIDED_GLOBALS].sort(),
    scriptOrderVariants,
    pages,
    errors,
    warnings,
  };
}

async function main() {
  const report = await buildRuntimeAudit(ROOT);
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'runtime-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(join(REPORT_DIR, 'runtime-audit.md'), `${toMarkdown(report)}\n`, 'utf8');
  console.log(`Runtime audit completed: ${report.summary.pages} pages, ${report.summary.browserJsFiles} browser scripts, ${report.summary.errors} errors, ${report.summary.warnings} warnings.`);
  report.errors.forEach((error) => console.error(`- ${error}`));
  report.warnings.forEach((warning) => console.warn(`- ${warning}`));
  if (report.summary.errors > 0) process.exit(1);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) main().catch((error) => {
  console.error('Runtime audit failed unexpectedly:', error);
  process.exit(1);
});
