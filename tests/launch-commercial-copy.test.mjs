import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rewriteLaunchCommercialCopy,
  validateLaunchCommercialOutput,
} from '../scripts/vite-launch-commercial-copy-plugin.mjs';

test('homepage launch copy removes stale price and fixed delivery promises', () => {
  const source = [
    '<span>€49,95</span>',
    '<p>Drag the slider. See what a €49 sticker does to a blank wall.</p>',
    '<h3 class="font-display font-bold text-sm mb-1">Fast shipping</h3><p class="text-text-secondary text-xs leading-relaxed">2 to 4 working days. Ships across Europe.</p>',
    '<p>Your mural gets printed on matte vinyl and lands at your door in 2 to 4 days.</p>',
  ].join('\n');

  const output = rewriteLaunchCommercialCopy(source, { path: '/index.html' });

  assert.match(output, /From €35/);
  assert.match(output, /LegendMural sticker/);
  assert.match(output, /Ships from NL/);
  assert.match(output, /prepared for shipment from the Netherlands/);
  assert.doesNotMatch(output, /€49,95|€49 sticker|2 to 4/i);
});

test('shop launch copy uses current shipping and statutory withdrawal summary', () => {
  const source = [
    '<p>Free shipping over €50. Standard delivery in 2 to 4 working days across Europe.</p>',
    '<p>30 day return window. Not happy? Send it back for a full refund.</p>',
  ].join('\n');

  const output = rewriteLaunchCommercialCopy(source, { path: '/shop.html' });

  assert.match(output, /Free shipping from €69 after discount/);
  assert.match(output, /Netherlands €4,95 · EU €9,95 · United States €9,95 tracked/);
  assert.match(output, /14-day statutory withdrawal period/);
  assert.doesNotMatch(output, /€50|2 to 4|30 day return window/i);
});

test('other pages are not rewritten by the launch-copy transformer', () => {
  const source = '<p>Unless otherwise agreed, delivery is no later than 30 days.</p>';
  assert.equal(rewriteLaunchCommercialCopy(source, { path: '/shipping.html' }), source);
});

test('built-output validation rejects stale public launch promises', () => {
  const root = mkdtempSync(join(tmpdir(), 'legendmural-launch-copy-'));
  const dist = join(root, 'dist');
  mkdirSync(dist, { recursive: true });

  try {
    writeFileSync(join(dist, 'index.html'), '<p>From €35</p><p>2 to 4 working days.</p>', 'utf8');
    writeFileSync(
      join(dist, 'shop.html'),
      '<p>Free shipping from €69 after discount.</p><p>14-day statutory withdrawal period</p>',
      'utf8',
    );

    assert.throws(
      () => validateLaunchCommercialOutput(root),
      /fixed delivery-range promise/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('built-output validation accepts canonical launch copy and legal 30-day fallback', () => {
  const root = mkdtempSync(join(tmpdir(), 'legendmural-launch-copy-'));
  const dist = join(root, 'dist');
  mkdirSync(dist, { recursive: true });

  try {
    writeFileSync(
      join(dist, 'index.html'),
      '<p>From €35</p><p>Available to the Netherlands, supported EU destinations and the United States.</p>',
      'utf8',
    );
    writeFileSync(
      join(dist, 'shop.html'),
      '<p>Free shipping from €69 after discount.</p><p>14-day statutory withdrawal period</p>',
      'utf8',
    );
    writeFileSync(
      join(dist, 'shipping.html'),
      '<p>Delivery times vary. Unless a different delivery time is agreed, delivery is no later than 30 days.</p>',
      'utf8',
    );

    assert.doesNotThrow(() => validateLaunchCommercialOutput(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
