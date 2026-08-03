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

test('announcement bar is collection-aware and removes emoji presentation', () => {
  assert.match(navigationSource, /removeEmoji/);
  assert.match(navigationSource, /Extended_Pictographic/);
  assert.match(navigationSource, /new\\s\+drop/);
  assert.match(navigationSource, /premium-announcement-collection/);
  assert.match(navigationSource, /LEGEND\\d\+/);
  assert.match(stylesSource, /premium-announcement/);
  assert.doesNotMatch(navigationSource, /🔥/u);
});

test('mobile menu is portaled outside the filtered header and fills the viewport', () => {
  assert.match(navigationSource, /portalMobileMenu/);
  assert.match(navigationSource, /documentRef\?\.body/);
  assert.match(navigationSource, /body\.append\(menu\)/);
  assert.match(navigationSource, /aria-modal/);
  assert.match(navigationSource, /data-mobile-menu-close/);
  assert.match(stylesSource, /height:\s*100dvh/);
  assert.match(stylesSource, /width:\s*100vw/);
  assert.match(stylesSource, /premium-mobile-menu-topbar/);
  assert.match(stylesSource, /premium-mobile-menu-close/);
});

test('mobile menu keeps accessible close paths without emoji or glyph arrows', () => {
  assert.match(stylesSource, /#mobile-menu \{/);
  assert.match(stylesSource, /premium-mobile-menu-cta/);
  assert.match(navigationSource, /event\?\.target/);
  assert.match(navigationSource, /Escape/);
  assert.match(navigationSource, /mobile-menu-open/);
  assert.match(stylesSource, /border-top:/);
  assert.match(stylesSource, /border-right:/);
  assert.doesNotMatch(stylesSource, /content:\s*['"]↗['"]/u);
});

test('premium navigation includes responsive, light-mode and reduced-motion treatments', () => {
  assert.match(stylesSource, /@media \(max-width: 767px\)/);
  assert.match(stylesSource, /@media \(max-width: 480px\)/);
  assert.match(stylesSource, /\[data-theme="light"\] header\.premium-site-header/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
});
