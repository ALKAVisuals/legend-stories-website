import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const navigationSource = await readFile(new URL('../js/mobile-navigation.mjs', import.meta.url), 'utf8');
const stylesSource = await readFile(new URL('../css/premium-navigation.css', import.meta.url), 'utf8');

test('premium navigation stylesheet is loaded by the mobile navigation controller', () => {
  assert.match(navigationSource, /css\/premium-navigation\.css/);
  assert.match(navigationSource, /data-premium-navigation-styles/);
  assert.match(navigationSource, /premium-site-header/);
  assert.match(navigationSource, /premium-mobile-menu-panel/);
});

test('announcement bar is refined without changing the active promotion', () => {
  assert.match(navigationSource, /New release/);
  assert.match(navigationSource, /Combat Legends/);
  assert.match(navigationSource, /LEGEND10/);
  assert.match(navigationSource, /10% off/);
  assert.match(stylesSource, /premium-announcement/);
});

test('mobile menu uses a premium drawer and retains accessible close paths', () => {
  assert.match(stylesSource, /#mobile-menu \{/);
  assert.match(stylesSource, /premium-mobile-menu-panel/);
  assert.match(stylesSource, /premium-mobile-menu-cta/);
  assert.match(stylesSource, /#mobile-menu-btn\[aria-expanded="true"\]/);
  assert.match(navigationSource, /event\?\.target === menu/);
  assert.match(navigationSource, /Escape/);
  assert.match(navigationSource, /mobile-menu-open/);
});

test('premium navigation includes responsive, light-mode and reduced-motion treatments', () => {
  assert.match(stylesSource, /@media \(max-width: 767px\)/);
  assert.match(stylesSource, /\[data-theme="light"\] header\.premium-site-header/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
});
