import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSingleVideoSource,
  parseVideoSourceAttribute,
} from '../scripts/lib/video-source-attributes.mjs';

test('parses an exact deferred data-src attribute', () => {
  const result = parseVideoSourceAttribute(
    '<source data-src="media/welcome/video.mp4" type="video/mp4">',
  );

  assert.deepEqual(result, {
    attribute: 'data-src',
    value: 'media/welcome/video.mp4',
    deferred: true,
  });
});

test('parses an eager src attribute separately', () => {
  const result = parseVideoSourceAttribute(
    '<source src="media/welcome/video.mp4" type="video/mp4">',
  );

  assert.deepEqual(result, {
    attribute: 'src',
    value: 'media/welcome/video.mp4',
    deferred: false,
  });
});

test('does not misclassify the src suffix inside data-src', () => {
  const result = parseSingleVideoSource(
    '<source data-src="media/welcome/video.mp4" type="video/mp4">',
    { label: 'collection video' },
  );

  assert.equal(result.attribute, 'data-src');
  assert.equal(result.deferred, true);
});

test('rejects repeated data prefixes and ambiguous source attributes', () => {
  assert.throws(
    () => parseVideoSourceAttribute('<source data-data-src="video.mp4">'),
    /repeated data- prefixes/,
  );
  assert.throws(
    () => parseVideoSourceAttribute('<source src="a.mp4" data-src="b.mp4">'),
    /exactly one src or data-src attribute/,
  );
});

test('requires one active source when a video contains source tags', () => {
  assert.throws(
    () => parseSingleVideoSource(
      '<source data-src="a.mp4"><source data-src="b.mp4">',
      { label: 'collection video' },
    ),
    /exactly one active video source/,
  );
  assert.equal(parseSingleVideoSource('<track kind="captions">'), null);
});
