import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../css/skipper.css', import.meta.url), 'utf8');
const mobileBlock = css.match(/\/\* Mobile portfolio gallery containment \*\/[\s\S]*$/)?.[0] || '';

test('mobile portfolio gallery stays inside the viewport and remains swipeable', () => {
  assert.match(mobileBlock, /@media \(max-width: 767px\)/);
  assert.match(mobileBlock, /overflow-x:\s*auto/);
  assert.match(mobileBlock, /max-width:\s*100%/);
  assert.match(mobileBlock, /scroll-snap-type:\s*x mandatory/);
  assert.match(mobileBlock, /flex:\s*0 0 min\(82vw, 22rem\)/);
  assert.match(mobileBlock, /aspect-ratio:\s*4 \/ 5/);
});

test('touch layouts do not retain the fixed desktop card widths', () => {
  assert.match(mobileBlock, /\.skp-hover-expand__item--active/);
  assert.match(mobileBlock, /\.skp-hover-expand__item--default/);
  assert.match(mobileBlock, /width:\s*min\(82vw, 22rem\)/);
  assert.match(mobileBlock, /\.skp-hover-expand__label[\s\S]*opacity:\s*1/);
});
