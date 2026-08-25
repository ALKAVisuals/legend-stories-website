import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const stylesheet = await readFile(
  new URL('../css/checkout-controls.css', import.meta.url),
  'utf8',
);

test('checkout country selector declares a dark native color scheme', () => {
  assert.match(
    stylesheet,
    /#checkout-country\s*\{[^}]*color-scheme:\s*dark;/s,
  );
});

test('checkout country options stay readable in dark mode', () => {
  assert.match(stylesheet, /#checkout-country option,/);
  assert.match(stylesheet, /background-color:\s*#111214;/);
  assert.match(stylesheet, /color:\s*#f3f4f6;/);
});

test('checkout country selector has a light-mode native override', () => {
  assert.match(stylesheet, /\[data-theme="light"\] #checkout-country,/);
  assert.match(stylesheet, /color-scheme:\s*light;/);
  assert.match(stylesheet, /background-color:\s*#ffffff;/);
  assert.match(stylesheet, /color:\s*#171717;/);
});
