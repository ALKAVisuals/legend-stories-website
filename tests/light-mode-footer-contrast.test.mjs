import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const footerCss = await readFile(new URL('../css/footer-theme.css', import.meta.url), 'utf8');
const viteConfig = await readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8');

test('light mode footer has explicit readable contrast', () => {
  assert.match(footerCss, /html\[data-theme="light"\]\s+footer/);
  assert.match(footerCss, /html\.light-mode\s+footer/);
  assert.match(footerCss, /background:\s*#f1f0ec\s*!important/i);
  assert.match(footerCss, /color:\s*#1a1a1a\s*!important/i);
  assert.match(footerCss, /footer\s+\.text-text-secondary/);
  assert.match(footerCss, /footer\s+\.text-text-muted/);
});

test('footer contrast stylesheet is injected after page styles and emitted in production', () => {
  assert.match(viteConfig, /name:\s*'footer-theme-styles'/);
  assert.match(viteConfig, /order:\s*'post'/);
  assert.match(viteConfig, /href:\s*'\/css\/footer-theme\.css'/);
  assert.match(viteConfig, /generateBundle\(\)/);
  assert.match(viteConfig, /fileName:\s*'css\/footer-theme\.css'/);
  assert.match(viteConfig, /readFileSync\(resolve\(ROOT,\s*'css\/footer-theme\.css'\)/);
});
