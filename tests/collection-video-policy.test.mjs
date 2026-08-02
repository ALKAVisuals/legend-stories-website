import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateCollectionVideoPolicy,
  normalizeEffectiveType,
  readConnectionPreferences,
} from '../js/media/collection-video-policy.mjs';

test('normalizes connection values', () => {
  assert.equal(normalizeEffectiveType('  4G '), '4g');
  assert.equal(normalizeEffectiveType(null), '');
  assert.deepEqual(readConnectionPreferences(), {
    saveData: false,
    effectiveType: '',
  });
});

test('plays only when visible, allowed, and the document is active', () => {
  const visible = evaluateCollectionVideoPolicy({
    intersecting: true,
    effectiveType: '4g',
  });
  assert.equal(visible.mayLoad, true);
  assert.equal(visible.shouldPlay, true);
  assert.equal(visible.reason, 'allowed');

  const hidden = evaluateCollectionVideoPolicy({
    intersecting: true,
    documentHidden: true,
    effectiveType: '4g',
  });
  assert.equal(hidden.mayLoad, true);
  assert.equal(hidden.shouldPlay, false);
});

test('honors reduced motion and Save-Data', () => {
  assert.deepEqual(
    evaluateCollectionVideoPolicy({ reducedMotion: true, intersecting: true }),
    {
      mayLoad: false,
      shouldPlay: false,
      reason: 'reduced-motion',
      effectiveType: '',
    },
  );
  assert.equal(
    evaluateCollectionVideoPolicy({ saveData: true, intersecting: true }).reason,
    'save-data',
  );
});

test('keeps slow connections on the poster', () => {
  for (const effectiveType of ['slow-2g', '2g', ' 2G ']) {
    const policy = evaluateCollectionVideoPolicy({ effectiveType, intersecting: true });
    assert.equal(policy.mayLoad, false);
    assert.equal(policy.reason, 'constrained-network');
  }
  assert.equal(
    evaluateCollectionVideoPolicy({ effectiveType: '3g', intersecting: true }).mayLoad,
    true,
  );
});

test('user motion preference takes precedence over network preferences', () => {
  const policy = evaluateCollectionVideoPolicy({
    reducedMotion: true,
    saveData: true,
    effectiveType: '2g',
    intersecting: true,
  });
  assert.equal(policy.reason, 'reduced-motion');
});
