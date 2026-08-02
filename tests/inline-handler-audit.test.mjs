import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFamilyInventory,
  buildPatternInventory,
  classifyHandlerCode,
  elementSignature,
  extractInlineHandlerRecords,
  handlerFamily,
  normalizeHandlerCode,
  validateHandlerSyntax,
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

test('compiles handler syntax without executing the handler', () => {
  assert.deepEqual(validateHandlerSyntax("window.location='shop.html';"), { valid: true, error: '' });
  const invalid = validateHandlerSyntax("window.location=\\'shop.html\\';");
  assert.equal(invalid.valid, false);
  assert.match(invalid.error, /token|invalid|unexpected/i);
});

test('maps parameterized handlers into semantic families', () => {
  assert.equal(handlerFamily('event.stopPropagation();'), 'event-stop-propagation');
  assert.equal(handlerFamily("window.location='a.html';"), 'location-assignment');
  assert.equal(handlerFamily("window.location='b.html';"), 'location-assignment');
  assert.equal(handlerFamily('window.legendApp.open()'), 'global-call');
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
  assert.equal(records[0].syntaxValid, true);
  assert.equal(records[1].classification, 'element-state');
});

test('groups exact patterns separately from semantic families', () => {
  const records = [
    ...extractInlineHandlerRecords('<article onclick="window.location=\'a.html\'"></article>', 'a.html'),
    ...extractInlineHandlerRecords('<article onclick="window.location=\'b.html\'"></article>', 'b.html'),
    ...extractInlineHandlerRecords('<button onclick="event.stopPropagation();"></button>', 'a.html'),
    ...extractInlineHandlerRecords('<button onclick="event.stopPropagation();"></button>', 'b.html'),
  ];
  const patterns = buildPatternInventory(records);
  const families = buildFamilyInventory(records);
  assert.equal(patterns.length, 3);
  assert.equal(families.length, 2);
  assert.deepEqual(families.map((family) => [family.family, family.occurrences, family.migrationSignal]), [
    ['event-stop-propagation', 2, 'high'],
    ['location-assignment', 2, 'high'],
  ]);
});
