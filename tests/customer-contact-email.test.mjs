import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
const CUSTOMER_FACING_PREFIXES = [
  'js/',
  'server/',
  'netlify/functions/',
];
const CUSTOMER_FACING_EXTENSIONS = new Set(['.html', '.js', '.mjs']);

function committedCustomerFacingFiles() {
  const tracked = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean)
    .filter((relative) => {
      const isRootHtml = !relative.includes('/') && relative.endsWith('.html');
      const isRuntimeSource = CUSTOMER_FACING_PREFIXES.some((prefix) => relative.startsWith(prefix))
        && CUSTOMER_FACING_EXTENSIONS.has(path.extname(relative));
      return isRootHtml || isRuntimeSource;
    });

  assert.ok(tracked.length > 0, 'Expected committed customer-facing source files.');
  return tracked;
}

function readCommittedFile(relative) {
  return execFileSync('git', ['show', `HEAD:${relative}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('committed customer-facing runtime source never exposes the stale ALKA Visuals email', () => {
  const offenders = committedCustomerFacingFiles()
    .filter((relative) => readCommittedFile(relative).toLowerCase().includes(STALE_EMAIL));

  assert.deepEqual(
    offenders,
    [],
    `Replace stale LegendMural customer contact email ${STALE_EMAIL}.`,
  );
});

test('canonical customer/legal pages expose the approved LegendMural email', () => {
  for (const relative of REQUIRED_PUBLIC_PAGES) {
    const source = readCommittedFile(relative).toLowerCase();
    assert.ok(source.includes(CUSTOMER_EMAIL), `${relative} must expose ${CUSTOMER_EMAIL}.`);
  }
});
