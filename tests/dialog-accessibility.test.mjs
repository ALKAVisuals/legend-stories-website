import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDialogController,
  getFocusWrapTarget,
} from '../js/dialog-accessibility.mjs';

test('focus wrapping sends Tab from the last control to the first', () => {
  const controls = [{ id: 'first' }, { id: 'last' }];
  assert.equal(getFocusWrapTarget(controls, controls[1], false), controls[0]);
});

test('focus wrapping sends Shift+Tab from the first control to the last', () => {
  const controls = [{ id: 'first' }, { id: 'last' }];
  assert.equal(getFocusWrapTarget(controls, controls[0], true), controls[1]);
});

test('focus wrapping leaves middle controls unchanged', () => {
  const controls = [{ id: 'first' }, { id: 'middle' }, { id: 'last' }];
  assert.equal(getFocusWrapTarget(controls, controls[1], false), null);
  assert.equal(getFocusWrapTarget(controls, controls[1], true), null);
});

test('dialog controller closes through the application callback on Escape', async () => {
  const listeners = new Map();
  const classes = new Set(['hidden', 'translate-x-full']);
  const attributes = new Map([['aria-hidden', 'true']]);
  const trigger = { isConnected: true, focus() {} };
  let requestedClose = 0;

  const documentRef = {
    activeElement: trigger,
    body: { style: {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const overlay = {
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
    },
    setAttribute(name, value) { attributes.set(name, value); },
  };
  const dialog = {
    tabIndex: -1,
    classList: overlay.classList,
    setAttribute: overlay.setAttribute,
    querySelectorAll() { return []; },
    focus() {},
  };

  const controller = createDialogController({
    dialog,
    overlay,
    documentRef,
    onRequestClose() { requestedClose += 1; },
  });
  controller.open({ trigger });
  await Promise.resolve();

  let prevented = false;
  listeners.get('keydown')({
    key: 'Escape',
    shiftKey: false,
    preventDefault() { prevented = true; },
  });

  assert.equal(prevented, true);
  assert.equal(requestedClose, 1);
  assert.equal(controller.isOpen(), true, 'the application callback owns the final close transition');
});
