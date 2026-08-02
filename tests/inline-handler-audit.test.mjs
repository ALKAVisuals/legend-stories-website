import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPatternInventory,
  classifyHandlerCode,
  elementSignature,
  extractInlineHandlerRecords,
  normalizeHandlerCode,
} from '../scripts/inline-handler-audit.mjs';

test('normalizes whitespace without changing handler meaning', () => {
  assert.equal(normalizeHandlerCode('  openCart(  );  '), 'openCart( );');
});

test('classifies common handler shapes', () => {
  assert.equal(classifyHandlerCode("location.href='shop.html'"), 'navigation');
  assert.equal(classifyHandlerCode("this.classList.add('active')"), 'element-state');
  assert.equal(classifyHandlerCode('window.cart.open()'), 'global-call');
  assert.equal(classifyHandlerCode('if (ready) { openCart(); }'), 'control-flow');
  assert.equal(classifyHandlerCode('first(); second();'), 'compound');
});

test('builds compact element signatures', () => {
  assert.equal(elementSignature('button', { id: 'buy', class: 'btn primary wide extra' }), 'button#buy.btn.primary.wide');
});

test('extracts handlers while ignoring scripts and styles', () => {
  const html = `
    <button id="buy" class="btn primary" onclick="openCart()">Buy</button>
    <img src="x.jpg" onload="this.classList.add('ready')">
    <script>const fake = '<a onclick="bad()">';</script>
    <style>.x{background:url("onclick='bad()'")}</style>
  `;
  const records = extractInlineHandlerRecords(html, 'index.html');
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.event), ['onclick', 'onload']);
  assert.equal(records[0].element, 'button#buy.btn.primary');
  assert.equal(records[0].classification, 'global-call');
  assert.equal(records[1].classification, 'element-state');
});

test('groups repeated patterns and assigns migration signals', () => {
  const records = [
    ...extractInlineHandlerRecords('<button onclick="openCart()"></button>', 'a.html'),
    ...extractInlineHandlerRecords('<a onclick="openCart()"></a>', 'b.html'),
    ...extractInlineHandlerRecords('<div onclick="this.classList.toggle(\'open\')"></div>', 'c.html'),
    ...extractInlineHandlerRecords('<span onclick="this.classList.toggle(\'open\')"></span>', 'd.html'),
  ];
  const patterns = buildPatternInventory(records);
  assert.equal(patterns.length, 2);
  assert.equal(patterns[0].occurrences, 2);
  assert.deepEqual(new Set(patterns.map((pattern) => pattern.migrationSignal)), new Set(['high', 'medium']));
});
