import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STALE_EMAIL = 'info@alkavisuals.nl';
const CUSTOMER_EMAIL = 'info@legendmural.com';
const REQUIRED_PUBLIC_PAGES = [
  'company.html',
  'terms.html',
  'privacy.html',
  'returns.html',
];

function collectFiles(directory, extensions) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolute, extensions);
    return extensions.has(path.extname(entry.name)) ? [absolute] : [];
  });
}

function runtimeCustomerFacingFiles() {
  const rootHtml = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(ROOT, entry.name));

  const runtimeExtensions = new Set(['.html', '.js', '.mjs']);
  return [
    ...rootHtml,
    ...collectFiles(path.join(ROOT, 'js'), runtimeExtensions),
    ...collectFiles(path.join(ROOT, 'server'), runtimeExtensions),
    ...collectFiles(path.join(ROOT, 'netlify', 'functions'), runtimeExtensions),
  ];
}

test('customer-facing runtime source never exposes the stale ALKA Visuals email', () => {
  const offenders = runtimeCustomerFacingFiles()
    .filter((file) => fs.readFileSync(file, 'utf8').toLowerCase().includes(STALE_EMAIL));

  assert.deepEqual(
    offenders.map((file) => path.relative(ROOT, file)),
    [],
    `Replace stale LegendMural customer contact email ${STALE_EMAIL}.`,
  );
});

test('canonical customer/legal pages expose the approved LegendMural email', () => {
  for (const relative of REQUIRED_PUBLIC_PAGES) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8').toLowerCase();
    assert.ok(source.includes(CUSTOMER_EMAIL), `${relative} must expose ${CUSTOMER_EMAIL}.`);
  }
});
