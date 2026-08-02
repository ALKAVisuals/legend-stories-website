import assert from 'node:assert/strict';
import test from 'node:test';

import { createMobileNavigationController } from '../js/mobile-navigation.mjs';

test('mobile navigation rejects incomplete element contracts', () => {
  assert.throws(
    () => createMobileNavigationController({ menu: {} }),
    /both a trigger button and menu/,
  );
  assert.throws(
    () => createMobileNavigationController({ button: {} }),
    /both a trigger button and menu/,
  );
});

test('mobile navigation requires document and window event targets', () => {
  const button = {};
  const menu = {};
  assert.throws(
    () => createMobileNavigationController({
      button,
      menu,
      documentRef: null,
      windowRef: null,
    }),
    /document and window event targets/,
  );
});
