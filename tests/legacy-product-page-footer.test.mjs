import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegacyProductPageMarkup } from '../scripts/product-page-template.mjs';

test('legacy footer collection links resolve from their visible labels', () => {
  const legacy = [
    '<ul>',
    '<li><a href="music-legends.html" class="text-sm text-mint font-medium">Combat Legends</a></li>',
    '<li><a href="combat-legends.html" class="text-sm text-mint font-medium">Music Legends</a></li>',
    '</ul>',
  ].join('');

  const normalized = normalizeLegacyProductPageMarkup(legacy);
  assert.match(
    normalized,
    /<li><a href="combat-legends\.html" class="text-sm text-text-secondary hover:text-mint transition-colors">Combat Legends<\/a><\/li>/,
  );
  assert.match(
    normalized,
    /<li><a href="music-legends\.html" class="text-sm text-text-secondary hover:text-mint transition-colors">Music Legends<\/a><\/li>/,
  );
});
