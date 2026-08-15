import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const errors = [];
const handlerPattern = /\sonerror\s*=/gi;
const markerPattern = /<img\b[^>]*\bdata-hide-on-error\b[^>]*>/gi;

const appSource = await readFile(join(ROOT, 'js/app.js'), 'utf8');
for (const marker of [
  "image?.matches?.('img[data-hide-on-error]')",
  "document.addEventListener('error', hideBrokenImage, true)",
  "image.style.display = 'none'",
]) {
  if (!appSource.includes(marker)) errors.push(`js/app.js is missing: ${marker}`);
}

const template = await readFile(join(ROOT, 'templates/product-page.html'), 'utf8');
const templateHandlers = template.match(handlerPattern) || [];
const templateMarkers = template.match(markerPattern) || [];
if (templateHandlers.length) {
  errors.push(`templates/product-page.html still contains ${templateHandlers.length} inline onerror handlers.`);
}
if (templateMarkers.length !== 2) {
  errors.push(`templates/product-page.html must contain exactly 2 data-hide-on-error images; found ${templateMarkers.length}.`);
}

const pages = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
  .map((entry) => entry.name)
  .sort();
let totalMarkers = 0;
let runtimePages = 0;
for (const page of pages) {
  const source = await readFile(join(ROOT, page), 'utf8');
  const handlers = source.match(handlerPattern) || [];
  const markers = source.match(markerPattern) || [];
  const usesAppRuntime = /<script\b[^>]*\bsrc=["']js\/app\.js["']/i.test(source);

  if (handlers.length) errors.push(`${page}: ${handlers.length} inline onerror handlers remain.`);
  if (usesAppRuntime) {
    runtimePages += 1;
    if (markers.length !== 2) {
      errors.push(`${page}: app runtime pages must contain exactly 2 managed logo fallbacks; found ${markers.length}.`);
    }
  } else if (markers.length) {
    errors.push(`${page}: data-hide-on-error requires js/app.js, but the runtime is not loaded.`);
  }
  totalMarkers += markers.length;
}

if (runtimePages < 1) {
  errors.push('Expected at least one app-runtime page.');
}
if (totalMarkers !== runtimePages * 2) {
  errors.push(`Expected ${runtimePages * 2} managed image fallbacks, found ${totalMarkers}.`);
}

if (errors.length) {
  console.error('Image-error fallback validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Image-error fallback validation passed: ${runtimePages} runtime pages, ${totalMarkers} managed images, 0 inline onerror handlers.`,
);
