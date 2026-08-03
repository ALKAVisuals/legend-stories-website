import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function count(source, needle) {
  return source.split(needle).length - 1;
}

test('all automatic storefront motion uses the shared gate', () => {
  assert.equal(count(appSource, "import('./motion-preferences.mjs')"), 1);
  assert.equal(count(appSource, 'createAutomaticMotionGate({'), 3);
  assert.match(appSource, /testimonialMotionGate\.subscribe/);
  assert.match(appSource, /particleMotionGate\.subscribe/);
  assert.match(appSource, /relatedMotionGate\.subscribe/);
});

test('legacy unconditional autoplay loops stay removed', () => {
  const testimonialBlock = appSource.match(/function initTestimonials\(\)[\s\S]*?function nextTestimonial/)?.[0] || '';
  const relatedBlock = appSource.match(/async function initRelatedProducts\(\)[\s\S]*?function initCarousel/)?.[0] || '';
  assert.doesNotMatch(testimonialBlock, /setInterval\(/);
  assert.doesNotMatch(relatedBlock, /setTimeout\(startAutoScroll/);
  assert.match(appSource, /window\.cancelAnimationFrame\(frameId\)/);
});

test('the permanent quality chain validates motion preferences once', () => {
  assert.equal(
    packageJson.scripts['validate:motion-preferences'],
    'node scripts/validate-motion-preferences.mjs',
  );
  assert.equal(
    count(packageJson.scripts.quality, 'npm run validate:motion-preferences'),
    1,
  );
});
