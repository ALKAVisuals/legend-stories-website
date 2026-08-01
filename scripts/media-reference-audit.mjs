import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import {
  extname,
  join,
  relative,
  sep,
} from 'node:path';

const ROOT = process.cwd();
const MEDIA_ROOT = join(ROOT, 'media');
const REPORT_ROOT = join(ROOT, 'reports');
const TEXT_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.mjs', '.cjs', '.json', '.xml', '.txt', '.md', '.yml', '.yaml',
]);
const MEDIA_EXTENSIONS = new Set([
  '.avif', '.gif', '.jpeg', '.jpg', '.mov', '.mp4', '.png', '.svg', '.webm', '.webp',
]);
const ACTIVE_PREFIXES = ['css/', 'data/', 'js/'];
const IGNORED_DIRECTORIES = new Set([
  '.git', 'dist', 'generated', 'node_modules', 'reports',
]);
const LARGE_BYTES = 1024 * 1024;

function normalizePath(path) {
  return path.split(sep).join('/');
}

function isActiveReferenceSource(path) {
  if (!path.includes('/') && extname(path).toLowerCase() === '.html') return true;
  return ACTIVE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

async function walk(directory, { ignoreDirectories = true } = {}) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirectories && entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path, { ignoreDirectories }));
    else output.push(path);
  }
  return output;
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function referenceVariants(mediaPath) {
  const encoded = encodeURI(mediaPath);
  const encodedSegments = mediaPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return [...new Set([
    mediaPath,
    encoded,
    encodedSegments,
    mediaPath.replaceAll(' ', '%20'),
  ])];
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let position = 0;
  while (true) {
    const match = source.indexOf(needle, position);
    if (match < 0) return count;
    count += 1;
    position = match + needle.length;
  }
}

async function hashFile(path) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function inspectVideoTags(sourcePath, source) {
  if (extname(sourcePath).toLowerCase() !== '.html') return [];
  const tags = source.match(/<video\b[\s\S]*?<\/video>/gi) || [];
  return tags.map((tag, index) => {
    const openingTag = tag.match(/<video\b[^>]*>/i)?.[0] || '';
    const preload = openingTag.match(/\bpreload\s*=\s*["']([^"']+)["']/i)?.[1] || 'browser-default';
    const sources = [...tag.matchAll(/<(?:source|video)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)]
      .map((match) => match[1]);
    return {
      source: sourcePath,
      index: index + 1,
      preload,
      autoplay: /\bautoplay\b/i.test(openingTag),
      muted: /\bmuted\b/i.test(openingTag),
      loop: /\bloop\b/i.test(openingTag),
      playsinline: /\bplaysinline\b/i.test(openingTag),
      poster: openingTag.match(/\bposter\s*=\s*["']([^"']+)["']/i)?.[1] || '',
      sources,
    };
  });
}

const [mediaFiles, repositoryFiles] = await Promise.all([
  walk(MEDIA_ROOT, { ignoreDirectories: false }),
  walk(ROOT),
]);

const mediaRecords = [];
for (const file of mediaFiles) {
  const extension = extname(file).toLowerCase();
  if (!MEDIA_EXTENSIONS.has(extension)) continue;
  const info = await stat(file);
  mediaRecords.push({
    absolutePath: file,
    path: normalizePath(relative(ROOT, file)),
    extension: extension.slice(1),
    type: ['.mp4', '.webm', '.mov'].includes(extension) ? 'video' : 'image',
    bytes: info.size,
    sha256: await hashFile(file),
    activeReferences: [],
    ancillaryReferences: [],
  });
}
mediaRecords.sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path));

const sourceRecords = [];
const videoTags = [];
for (const file of repositoryFiles) {
  const extension = extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) continue;
  const path = normalizePath(relative(ROOT, file));
  const source = await readFile(file, 'utf8');
  sourceRecords.push({
    path,
    source,
    active: isActiveReferenceSource(path),
  });
  videoTags.push(...inspectVideoTags(path, source));
}

for (const media of mediaRecords) {
  const variants = referenceVariants(media.path);
  for (const sourceRecord of sourceRecords) {
    let count = 0;
    for (const variant of variants) {
      count += countOccurrences(sourceRecord.source, variant);
    }
    if (!count) continue;
    const reference = { source: sourceRecord.path, count };
    if (sourceRecord.active) media.activeReferences.push(reference);
    else media.ancillaryReferences.push(reference);
  }
}

const hashGroups = new Map();
for (const media of mediaRecords) {
  const group = hashGroups.get(media.sha256) || [];
  group.push(media);
  hashGroups.set(media.sha256, group);
}
const duplicateGroups = [...hashGroups.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([sha256, files]) => ({
    sha256,
    bytesEach: files[0].bytes,
    recoverableBytes: files[0].bytes * (files.length - 1),
    files: files.map((file) => file.path).sort(),
  }))
  .sort((left, right) => right.recoverableBytes - left.recoverableBytes);

const videos = mediaRecords.filter((media) => media.type === 'video');
const activeMedia = mediaRecords.filter((media) => media.activeReferences.length > 0);
const unreferencedMedia = mediaRecords.filter((media) => media.activeReferences.length === 0);
const fullyOrphanedMedia = unreferencedMedia.filter((media) => media.ancillaryReferences.length === 0);
const largeUnreferencedMedia = unreferencedMedia.filter((media) => media.bytes >= LARGE_BYTES);
const duplicateBytes = duplicateGroups.reduce((sum, group) => sum + group.recoverableBytes, 0);

function referencesLabel(media) {
  if (!media.activeReferences.length) return 'None';
  return media.activeReferences
    .map((reference) => `${reference.source} (${reference.count})`)
    .join('<br>');
}

const markdown = [
  '# Media Reference Audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Summary',
  '',
  `- Media files: ${mediaRecords.length}`,
  `- Actively referenced media: ${activeMedia.length}`,
  `- Media without storefront references: ${unreferencedMedia.length}`,
  `- Fully orphaned media: ${fullyOrphanedMedia.length}`,
  `- Unreferenced files >= 1 MB: ${largeUnreferencedMedia.length}`,
  `- Exact duplicate groups: ${duplicateGroups.length}`,
  `- Potential exact-duplicate recovery: ${formatBytes(duplicateBytes)}`,
  `- HTML video elements: ${videoTags.length}`,
  '',
  '## Video inventory',
  '',
  '| File | Size | Active references | Ancillary references |',
  '|---|---:|---|---:|',
  ...videos.map((video) => `| \`${video.path}\` | ${formatBytes(video.bytes)} | ${referencesLabel(video)} | ${video.ancillaryReferences.length} |`),
  '',
  '## HTML video loading',
  '',
  ...(videoTags.length
    ? [
        '| Page | Video | Preload | Autoplay | Poster | Sources |',
        '|---|---:|---|---|---|---|',
        ...videoTags.map((tag) => `| \`${tag.source}\` | ${tag.index} | ${tag.preload} | ${tag.autoplay ? 'Yes' : 'No'} | ${tag.poster || 'None'} | ${tag.sources.join('<br>') || 'None'} |`),
      ]
    : ['No HTML video elements detected.']),
  '',
  '## Large files without storefront references',
  '',
  ...(largeUnreferencedMedia.length
    ? [
        '| File | Type | Size | Ancillary references |',
        '|---|---|---:|---:|',
        ...largeUnreferencedMedia.map((media) => `| \`${media.path}\` | ${media.type} | ${formatBytes(media.bytes)} | ${media.ancillaryReferences.length} |`),
      ]
    : ['None detected.']),
  '',
  '## Exact duplicate groups',
  '',
  ...(duplicateGroups.length
    ? duplicateGroups.flatMap((group, index) => [
        `### Group ${index + 1} — ${formatBytes(group.bytesEach)} each`,
        '',
        `Potential recovery: ${formatBytes(group.recoverableBytes)}`,
        '',
        ...group.files.map((file) => `- \`${file}\``),
        '',
      ])
    : ['None detected.', '']),
  '## Interpretation',
  '',
  '- “Active references” are references from root HTML pages and runtime files under `css/`, `data/`, or `js/`.',
  '- “Ancillary references” come from scripts, tests, documentation, configuration, or workflows and do not prove browser delivery.',
  '- Files are not deleted automatically. Every cleanup requires a separate reviewed change.',
  '',
].join('\n');

const json = {
  generatedAt: new Date().toISOString(),
  summary: {
    mediaFiles: mediaRecords.length,
    activelyReferencedMedia: activeMedia.length,
    unreferencedMedia: unreferencedMedia.length,
    fullyOrphanedMedia: fullyOrphanedMedia.length,
    largeUnreferencedMedia: largeUnreferencedMedia.length,
    exactDuplicateGroups: duplicateGroups.length,
    potentialDuplicateRecoveryBytes: duplicateBytes,
    htmlVideoElements: videoTags.length,
  },
  videos: videos.map(({ absolutePath, ...video }) => video),
  videoTags,
  largeUnreferencedMedia: largeUnreferencedMedia.map(({ absolutePath, ...media }) => media),
  duplicateGroups,
};

await mkdir(REPORT_ROOT, { recursive: true });
await Promise.all([
  writeFile(join(REPORT_ROOT, 'media-references.md'), markdown, 'utf8'),
  writeFile(join(REPORT_ROOT, 'media-references.json'), JSON.stringify(json, null, 2), 'utf8'),
]);

console.log(
  `Media reference audit completed: ${mediaRecords.length} files, ${videos.length} videos, ${unreferencedMedia.length} without storefront references, ${duplicateGroups.length} exact duplicate groups.`,
);
for (const video of videos) {
  console.log(
    `- ${video.path}: ${formatBytes(video.bytes)}, ${video.activeReferences.length} active reference source(s), ${video.ancillaryReferences.length} ancillary source(s)`,
  );
}
