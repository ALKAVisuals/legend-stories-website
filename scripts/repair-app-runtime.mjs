import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const APP_FILE = join(process.cwd(), 'js/app.js');
const source = await readFile(APP_FILE, 'utf8');
const startMarker = '    const fns = [';
const endMarker = '];\n    // Inject discount UI and init after DOM is ready';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error('Could not locate the legacy app initializer block.');
}

const initializer = `    const fns = [
      initStickerClicks,
      initStickerModalClose,
      initEventListeners,
      initBeforeAfter,
      initScrollAnimations,
      initTestimonials,
      initFilters,
      initAddToCart,
      initProductCards,
      initThemeToggle,
      initParticleCanvas,
      initScrollReveal,
      initRelatedProducts,
      initCarousel,
      initVideoPlayer,
      initHoverExpandMobile,
    `;

let repaired = `${source.slice(0, start)}${initializer}${source.slice(end)}`;

const replacements = new Map([
  ["            'The Truth Seeker': 'wisdom-legends.html',", "            'The Truth Seeker': 'music-truth-seeker.html',"],
  ["            'Mamba Mindset': 'music-mamba-mindset.html',", "            'Mamba Mindset': 'sport-mamba-mindset.html',"],
  ["    console.log('[DEBUG] openCheckoutModal called');\n", ''],
  ["    console.log('[DEBUG] drawer:', drawer, 'overlay:', overlay);\n", ''],
  ["      console.log('[DEBUG] drawer or overlay not found!');\n", ''],
  ["    console.log('[DEBUG] checkout drawer opened');\n", ''],
]);

for (const [before, after] of replacements) {
  if (!repaired.includes(before)) {
    throw new Error(`Expected app runtime fragment not found: ${before}`);
  }
  repaired = repaired.replace(before, after);
}

if (repaired.includes("{name:'Iron Soul', page:'combat-iron-soul-combat-legend-mural.html'")) {
  const initStart = repaired.indexOf(startMarker);
  const initEnd = repaired.indexOf(endMarker, initStart);
  const initBlock = repaired.slice(initStart, initEnd);
  if (initBlock.includes("{name:'Iron Soul'")) {
    throw new Error('Product records still exist inside the app initializer.');
  }
}

if (repaired === source) {
  throw new Error('Runtime repair produced no changes.');
}

await writeFile(APP_FILE, repaired, 'utf8');
console.log('Repaired js/app.js initializer, product routes and debug logging.');
