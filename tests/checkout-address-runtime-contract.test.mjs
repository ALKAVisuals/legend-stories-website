import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/shared.css', import.meta.url), 'utf8');

test('checkout address suggestions never block manual entry', () => {
  assert.match(app, /Address suggestions are unavailable\. You can enter the address manually\./);
  assert.match(app, /manualAddressFallback/);
  assert.match(app, /googlePlacesUnavailable/);
  assert.doesNotMatch(app, /Fill in your first name, last name and email before entering the address/);
});

test('iOS address field is normalized and does not refocus itself after a Places failure', () => {
  assert.match(app, /configureStreetAddressInput\(streetInput\)/);
  assert.doesNotMatch(app, /Google address suggestions are temporarily unavailable[\s\S]{0,220}focusTarget:\s*streetInput/);
});

test('Google suggestion list stays above the checkout drawer on mobile', () => {
  assert.match(css, /\.pac-container[\s\S]*z-index:\s*2147483647/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.pac-container[\s\S]*left:\s*12px/);
});
