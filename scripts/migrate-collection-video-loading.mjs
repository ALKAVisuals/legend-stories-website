import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(
  await readFile(join(ROOT, 'data/video/collection-video-optimization.json'), 'utf8'),
);
const MODULE_SCRIPT = '  <script type="module" src="js/collection-video.mjs"></script>';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addBooleanAttribute(openingTag, attribute) {
  return new RegExp(`\\b${attribute}(?:=["'][^"']*["'])?`, 'i').test(openingTag)
    ? openingTag
    : openingTag.replace(/>$/, ` ${attribute}>`);
}

function addValueAttribute(openingTag, attribute, value) {
  const pattern = new RegExp(`\\b${attribute}=["'][^"']*["']`, 'i');
  if (pattern.test(openingTag)) {
    return openingTag.replace(pattern, `${attribute}="${value}"`);
  }
  return openingTag.replace(/>$/, ` ${attribute}="${value}">`);
}

for (const video of manifest.videos) {
  const encodedPath = encodeURI(video.path);
  const sourcePattern = new RegExp(
    `<source\\b([^>]*)\\bsrc=["']${escapeRegExp(encodedPath)}["']([^>]*)>`,
    'i',
  );
  const deferredSourcePattern = new RegExp(
    `<source\\b([^>]*)\\bdata-src=["']${escapeRegExp(encodedPath)}["']([^>]*)>`,
    'i',
  );

  for (const page of video.pages) {
    const path = join(ROOT, page);
    let source = await readFile(path, 'utf8');
    const videoBlocks = [...source.matchAll(/<video\b[^>]*>[\s\S]*?<\/video>/gi)];
    const matches = videoBlocks.filter((match) => (
      sourcePattern.test(match[0]) || deferredSourcePattern.test(match[0])
    ));
    if (matches.length !== 1) {
      throw new Error(`${page}: expected exactly one ${video.id} block, found ${matches.length}.`);
    }

    const originalBlock = matches[0][0];
    const openingTag = originalBlock.match(/^<video\b[^>]*>/i)?.[0];
    if (!openingTag) throw new Error(`${page}: video opening tag is missing.`);

    let updatedOpening = openingTag
      .replace(/\s+autoplay(?:=["'][^"']*["'])?/i, '')
      .replace(/\s+preload=["'][^"']*["']/i, '');
    updatedOpening = addValueAttribute(updatedOpening, 'preload', 'none');
    updatedOpening = addValueAttribute(updatedOpening, 'data-collection-video', video.id);
    updatedOpening = addValueAttribute(updatedOpening, 'aria-hidden', 'true');
    updatedOpening = addValueAttribute(updatedOpening, 'tabindex', '-1');
    updatedOpening = addBooleanAttribute(updatedOpening, 'muted');
    updatedOpening = addBooleanAttribute(updatedOpening, 'loop');
    updatedOpening = addBooleanAttribute(updatedOpening, 'playsinline');

    let updatedBlock = originalBlock.replace(openingTag, updatedOpening);
    if (sourcePattern.test(updatedBlock)) {
      updatedBlock = updatedBlock.replace(sourcePattern, (_match, before, after) => (
        `<source${before}data-src="${encodedPath}"${after}>`
      ));
    }
    if (!deferredSourcePattern.test(updatedBlock)) {
      throw new Error(`${page}: deferred video source was not created.`);
    }
    if (/\bautoplay\b/i.test(updatedOpening)) {
      throw new Error(`${page}: autoplay attribute remains.`);
    }

    source = source.replace(originalBlock, updatedBlock);
    if (!source.includes(MODULE_SCRIPT.trim())) {
      const anchor = '  <script src="js/componentry.js"></script>';
      if (!source.includes(anchor)) {
        throw new Error(`${page}: componentry script anchor is missing.`);
      }
      source = source.replace(anchor, `${MODULE_SCRIPT}\n${anchor}`);
    }

    await writeFile(path, source, 'utf8');
  }
}

console.log('Migrated collection videos to deferred, preference-aware loading.');
