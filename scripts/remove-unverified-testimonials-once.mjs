import { readFile, writeFile } from 'node:fs/promises';

const indexPath = 'index.html';
const validatorPath = 'scripts/validate-shared-form-semantics.mjs';

let index = await readFile(indexPath, 'utf8');
const startMarker = '    <!-- TESTIMONIALS — Axis card pattern -->';
const endMarker = '    <!-- SHOP PREVIEW — Swiper Card Swipe Carousel (All 20 Batch 3 Products) -->';
const start = index.indexOf(startMarker);
const end = index.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) {
  throw new Error('Exact testimonial section boundaries were not found.');
}
index = `${index.slice(0, start)}${index.slice(end)}`;
if (/Rik van Dijk|Pieter Bakker|Anna de Wit|Jonas Peeters|testimonial-dot|testimonial-track/.test(index)) {
  throw new Error('Unverified testimonial content remains after the exact section removal.');
}
await writeFile(indexPath, index);

let validator = await readFile(validatorPath, 'utf8');
const controlsStart = "const testimonialControls = index.match(/<button\\b[^>]*class=[\"'][^\"']*testimonial-dot[^\"']*[\"'][^>]*aria-label=[\"']Show testimonial [1-4][\"'][^>]*aria-pressed=[\"'](?:true|false)[\"'][^>]*><\\/button>/gi) || [];\nif (testimonialControls.length !== 4) {\n  errors.push(`index.html: expected 4 named testimonial controls, found ${testimonialControls.length}`);\n}\n";
if (!validator.includes(controlsStart)) {
  throw new Error('Expected testimonial control validator block was not found.');
}
validator = validator.replace(controlsStart, "if (/\\btestimonial-dot\\b/i.test(index) || /\\btestimonial-track\\b/i.test(index)) {\n  errors.push('index.html: unverified testimonial controls unexpectedly returned');\n}\n");

const appCheck = "if (!app.includes(\"dot.setAttribute('aria-pressed', i === index ? 'true' : 'false');\")) {\n  errors.push('js/app.js: testimonial pressed state is not synchronized');\n}\n";
if (!validator.includes(appCheck)) {
  throw new Error('Expected testimonial app validator block was not found.');
}
validator = validator.replace(appCheck, '');
await writeFile(validatorPath, validator);

console.log('Removed unverified testimonial section and updated its stale validator requirements.');
