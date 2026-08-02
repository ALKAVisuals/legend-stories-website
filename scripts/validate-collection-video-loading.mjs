import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const manifest = JSON.parse(
  await readFile(join(ROOT, 'data/video/collection-video-optimization.json'), 'utf8'),
);
const [controller, policy] = await Promise.all([
  readFile(join(ROOT, 'js/collection-video.mjs'), 'utf8'),
  readFile(join(ROOT, 'js/media/collection-video-policy.mjs'), 'utf8'),
]);
const errors = [];
const MODULE_SCRIPT = '<script type="module" src="js/collection-video.mjs"></script>';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

for (const entry of manifest.videos || []) {
  const encodedPath = encodeURI(entry.path);
  for (const page of entry.pages || []) {
    const source = await readFile(join(ROOT, page), 'utf8');
    const videoBlocks = [...source.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)]
      .filter((match) => match[0].includes(encodedPath));

    if (videoBlocks.length !== 1) {
      errors.push(`${page}: expected one ${entry.id} video block, found ${videoBlocks.length}.`);
      continue;
    }

    const attributes = videoBlocks[0][1];
    const body = videoBlocks[0][2];
    const sourceTag = body.match(/<source\b[^>]*>/i)?.[0] || '';

    if (/\bautoplay\b/i.test(attributes)) {
      errors.push(`${page}: declarative autoplay must be absent.`);
    }
    for (const required of ['muted', 'loop', 'playsinline']) {
      if (!new RegExp(`\\b${required}\\b`, 'i').test(attributes)) {
        errors.push(`${page}: ${required} is missing.`);
      }
    }
    if (!/\bpreload=["']none["']/i.test(attributes)) {
      errors.push(`${page}: preload must be none.`);
    }
    if (!new RegExp(`\\bposter=["']${escapeRegExp(entry.poster)}["']`, 'i').test(attributes)) {
      errors.push(`${page}: poster does not match the optimization manifest.`);
    }
    if (!new RegExp(`\\bdata-collection-video=["']${escapeRegExp(entry.id)}["']`, 'i').test(attributes)) {
      errors.push(`${page}: data-collection-video does not match ${entry.id}.`);
    }
    if (!/\baria-hidden=["']true["']/i.test(attributes) || !/\btabindex=["']-1["']/i.test(attributes)) {
      errors.push(`${page}: decorative video accessibility attributes are incomplete.`);
    }

    if (/\sdata-(?:data-)+src=/i.test(sourceTag)) {
      errors.push(`${page}: deferred source attribute contains repeated data- prefixes.`);
    }
    const deferredAttributes = [...sourceTag.matchAll(/(?:^|\s)data-src=(["'])([^"']+)\1/gi)];
    if (deferredAttributes.length !== 1) {
      errors.push(`${page}: expected exactly one data-src attribute, found ${deferredAttributes.length}.`);
    } else if (deferredAttributes[0][2] !== encodedPath) {
      errors.push(`${page}: deferred source URL does not match the optimization manifest.`);
    }
    if (/(?:^|\s)src=(["'])/i.test(sourceTag)) {
      errors.push(`${page}: source URL is still eagerly exposed through src.`);
    }
    if ((source.match(new RegExp(escapeRegExp(MODULE_SCRIPT), 'g')) || []).length !== 1) {
      errors.push(`${page}: controller module must be loaded exactly once.`);
    }
  }
}

for (const marker of [
  "import {\n  evaluateCollectionVideoPolicy,",
  "const VIDEO_SELECTOR = 'video[data-collection-video]'",
  "source of video.querySelectorAll('source[data-src]')",
  'source.src = source.dataset.src',
  "window.matchMedia?.(REDUCED_MOTION_QUERY)",
  'navigator.connection',
  "'IntersectionObserver' in window",
  "document.addEventListener('visibilitychange'",
  "connection?.addEventListener?.('change'",
  "window.addEventListener('pagehide'",
  'video.pause()',
  'await video.play()',
]) {
  if (!controller.includes(marker)) {
    errors.push(`Collection video controller is missing: ${marker}`);
  }
}

for (const marker of [
  "new Set(['slow-2g', '2g'])",
  "reason = 'reduced-motion'",
  "reason = 'save-data'",
  "reason = 'constrained-network'",
  'const shouldPlay = mayLoad && intersecting && !documentHidden',
]) {
  if (!policy.includes(marker)) {
    errors.push(`Collection video policy is missing: ${marker}`);
  }
}

if (errors.length) {
  console.error('Collection video loading validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  'Collection video loading validation passed: four pages use posters and exact deferred sources with reduced-motion, Save-Data, network, viewport and visibility controls.',
);
