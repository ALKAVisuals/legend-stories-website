import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractDynamicHandlerGlobalRoots,
  extractGlobalAssignments,
  extractHtmlReferencesFromJs,
  extractInlineHandlers,
  extractScriptTags,
  validateAppInitializer,
} from '../scripts/runtime-audit.mjs';

test('extracts classic, module and non-executable script contracts', () => {
  const scripts = extractScriptTags(`
    <script src="js/app.js"></script>
    <script type="module" src="js/runtime.mjs"></script>
    <script type="application/ld+json">{"@type":"Product"}</script>
    <script>window.inlineBoot = true;</script>
  `);

  assert.equal(scripts.length, 4);
  assert.equal(scripts[0].src, 'js/app.js');
  assert.equal(scripts[0].module, false);
  assert.equal(scripts[1].module, true);
  assert.equal(scripts[2].executable, false);
  assert.equal(scripts[3].executable, true);
  assert.ok(scripts[3].inlineBytes > 0);
});

test('extracts inline event handlers from markup only', () => {
  const handlers = extractInlineHandlers(`
    <button onclick="window.legendApp.removeItem(1)" onkeydown='window.keys.handle(event)'>Remove</button>
    <script>const template = '<button onclick="window.fake.run()">';</script>
  `);

  assert.deepEqual(handlers, [
    { event: 'onclick', code: 'window.legendApp.removeItem(1)' },
    { event: 'onkeydown', code: 'window.keys.handle(event)' },
  ]);
});

test('extracts browser global assignments and dynamic handler dependencies', () => {
  const source = `
    window.legendApp = { removeItem() {} };
    globalThis.initMap = function () {};
    const html = '<button onclick="window.legendApp.removeItem(1)">';
  `;

  assert.deepEqual(extractGlobalAssignments(source), ['initMap', 'legendApp']);
  assert.deepEqual(extractDynamicHandlerGlobalRoots(source), ['legendApp']);
});

test('extracts static local HTML routes from JavaScript', () => {
  const source = `
    const first = 'music-truth-seeker.html';
    const second = "sport-mamba-mindset.html?source=card";
    const external = 'https://example.com/external.html';
    const dynamic = \`products/\${slug}.html\`;
  `;

  assert.deepEqual(extractHtmlReferencesFromJs(source), [
    'music-truth-seeker.html',
    'sport-mamba-mindset.html',
  ]);
});

test('accepts an initializer containing function identifiers only', () => {
  const source = `
    function init() {
      const fns = [
        initCart,
        initMenu,
      ];
    // Inject discount UI and init after DOM is ready
    }
  `;

  assert.deepEqual(validateAppInitializer(source), []);
});

test('rejects product records inside the initializer', () => {
  const source = `
    function init() {
      const fns = [
        initCart,
        { name: 'Broken record' },
      ];
    // Inject discount UI and init after DOM is ready
    }
  `;

  const errors = validateAppInitializer(source);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /non-function initializer entry/);
});
