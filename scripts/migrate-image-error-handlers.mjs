import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const INLINE_HANDLER = ' onerror="this.style.display=\'none\'"';
const DATA_ATTRIBUTE = ' data-hide-on-error';
const LISTENER_MARKER = "image?.matches?.('img[data-hide-on-error]')";
const LISTENER_BLOCK = `

  // Hide decorative images that fail to load without inline event handlers.
  function hideBrokenImage(event) {
    const image = event.target;
    if (image?.matches?.('img[data-hide-on-error]')) {
      image.style.display = 'none';
    }
  }
  document.addEventListener('error', hideBrokenImage, true);`;

async function replaceHandlers(path) {
  const source = await readFile(path, 'utf8');
  const matches = source.split(INLINE_HANDLER).length - 1;
  if (matches === 0) return { changed: false, replacements: 0 };
  const migrated = source.replaceAll(INLINE_HANDLER, DATA_ATTRIBUTE);
  await writeFile(path, migrated, 'utf8');
  return { changed: true, replacements: matches };
}

const appPath = join(ROOT, 'js/app.js');
let appSource = await readFile(appPath, 'utf8');
if (!appSource.includes(LISTENER_MARKER)) {
  const strictMarker = "  'use strict';";
  if (!appSource.includes(strictMarker)) {
    throw new Error('js/app.js: strict-mode marker was not found.');
  }
  appSource = appSource.replace(strictMarker, `${strictMarker}${LISTENER_BLOCK}`);
  await writeFile(appPath, appSource, 'utf8');
  console.log('js/app.js: installed the shared image-error capture listener.');
}

const templateResult = await replaceHandlers(join(ROOT, 'templates/product-page.html'));
if (templateResult.replacements !== 0 && templateResult.replacements !== 2) {
  throw new Error(`Product template: expected 2 inline handlers, found ${templateResult.replacements}.`);
}

const rootHtml = (await readdir(ROOT, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.html')
  .map((entry) => entry.name)
  .sort();
let rootReplacements = 0;
let changedPages = 0;
for (const page of rootHtml) {
  const result = await replaceHandlers(join(ROOT, page));
  rootReplacements += result.replacements;
  if (result.changed) changedPages += 1;
}
if (rootReplacements !== 0 && rootReplacements !== 236) {
  throw new Error(`Root pages: expected 236 inline image handlers, found ${rootReplacements}.`);
}

const packagePath = join(ROOT, 'package.json');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:image-error-fallbacks'] = 'node scripts/validate-image-error-fallbacks.mjs';
if (!packageJson.scripts.quality.includes('validate:image-error-fallbacks')) {
  packageJson.scripts.quality = packageJson.scripts.quality.replace(
    'npm run audit:runtime &&',
    'npm run audit:runtime && npm run validate:image-error-fallbacks &&',
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log(`Image-error migration complete: template=${templateResult.replacements}, root=${rootReplacements}, changedPages=${changedPages}.`);
