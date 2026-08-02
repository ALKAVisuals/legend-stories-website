import { spawnSync } from 'node:child_process';
import { open, readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';

import { parseSingleVideoSource } from './lib/video-source-attributes.mjs';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const COLLECTION_PAGES = [
  'combat-legends.html',
  'music-legends.html',
  'sport-legends.html',
  'wisdom-legends.html',
];

function normalizePath(value) {
  return value.replaceAll('\\', '/');
}

function parseRate(value) {
  const [numerator, denominator = '1'] = String(value || '0/1').split('/');
  const top = Number(numerator);
  const bottom = Number(denominator);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0
    ? top / bottom
    : 0;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function runFfprobe(file) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    throw new Error(`ffprobe is unavailable: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${file}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

async function inspectMp4AtomOrder(file) {
  const handle = await open(file, 'r');
  try {
    const stats = await handle.stat();
    let position = 0;
    let moovOffset = -1;
    let mdatOffset = -1;
    const boxes = [];

    while (position + 8 <= stats.size) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, position);
      if (bytesRead < 8) break;

      let size = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      let headerSize = 8;
      if (size === 1) {
        if (bytesRead < 16) break;
        const extended = header.readBigUInt64BE(8);
        if (extended > BigInt(Number.MAX_SAFE_INTEGER)) break;
        size = Number(extended);
        headerSize = 16;
      } else if (size === 0) {
        size = stats.size - position;
      }
      if (size < headerSize || position + size > stats.size) break;

      boxes.push({ type, offset: position, size });
      if (type === 'moov') moovOffset = position;
      if (type === 'mdat') mdatOffset = position;
      position += size;
    }

    return {
      boxes,
      moovOffset,
      mdatOffset,
      fastStart: moovOffset >= 0 && mdatOffset >= 0 && moovOffset < mdatOffset,
    };
  } finally {
    await handle.close();
  }
}

async function discoverActiveVideos() {
  const videos = new Map();
  for (const page of COLLECTION_PAGES) {
    const source = await readFile(join(ROOT, page), 'utf8');
    for (const match of source.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi)) {
      const attributes = match[1];
      const body = match[2];
      const sourceDetails = parseSingleVideoSource(body, {
        label: `${page} collection video`,
      });
      if (!sourceDetails) continue;

      const decoded = decodeURIComponent(sourceDetails.value);
      const path = normalizePath(decoded.replace(/^\.\//, ''));
      const record = videos.get(path) || {
        path,
        pages: [],
        deferred: sourceDetails.deferred,
        sourceAttribute: sourceDetails.attribute,
        autoplay: /\bautoplay\b/i.test(attributes),
        loop: /\bloop\b/i.test(attributes),
        muted: /\bmuted\b/i.test(attributes),
        playsinline: /\bplaysinline\b/i.test(attributes),
        preload: attributes.match(/\bpreload=["']([^"']+)["']/i)?.[1] || 'browser-default',
        poster: attributes.match(/\bposter=["']([^"']+)["']/i)?.[1] || '',
        policyId: attributes.match(/\bdata-collection-video=["']([^"']+)["']/i)?.[1] || '',
      };
      if (record.deferred !== sourceDetails.deferred
        || record.sourceAttribute !== sourceDetails.attribute) {
        throw new Error(`${page}: collection video loading mode is inconsistent for ${path}.`);
      }
      record.pages.push(page);
      videos.set(path, record);
    }
  }
  return [...videos.values()].sort((left, right) => left.path.localeCompare(right.path));
}

const activeVideos = await discoverActiveVideos();
if (!activeVideos.length) {
  throw new Error('No active collection videos were discovered.');
}

const records = [];
for (const active of activeVideos) {
  const absolutePath = resolve(ROOT, active.path);
  if (extname(absolutePath).toLowerCase() !== '.mp4') {
    throw new Error(`Unsupported active video format: ${active.path}`);
  }

  const probe = runFfprobe(absolutePath);
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`No video stream found in ${active.path}.`);

  const atomOrder = await inspectMp4AtomOrder(absolutePath);
  const durationSeconds = Number(probe.format.duration || video.duration || 0);
  const bytes = Number(probe.format.size || 0);
  const bitRate = Number(probe.format.bit_rate || video.bit_rate || 0);

  records.push({
    ...active,
    fileName: basename(active.path),
    bytes,
    durationSeconds,
    container: probe.format.format_name,
    overallBitRate: bitRate,
    video: {
      codec: video.codec_name,
      profile: video.profile || '',
      width: video.width,
      height: video.height,
      pixelFormat: video.pix_fmt || '',
      averageFrameRate: parseRate(video.avg_frame_rate),
      nominalFrameRate: parseRate(video.r_frame_rate),
      frames: Number(video.nb_frames || 0),
      bitRate: Number(video.bit_rate || 0),
      colorSpace: video.color_space || '',
      colorTransfer: video.color_transfer || '',
      colorPrimaries: video.color_primaries || '',
    },
    audio: audio ? {
      codec: audio.codec_name,
      channels: audio.channels,
      sampleRate: Number(audio.sample_rate || 0),
      bitRate: Number(audio.bit_rate || 0),
    } : null,
    mp4: atomOrder,
    estimatedMegabits: (bytes * 8) / 1_000_000,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    activeVideoFiles: records.length,
    collectionPages: COLLECTION_PAGES.length,
    totalBytes: records.reduce((sum, record) => sum + record.bytes, 0),
    deferredFiles: records.filter((record) => record.deferred).length,
    immediateFiles: records.filter((record) => !record.deferred).length,
    autoplayFiles: records.filter((record) => record.autoplay).length,
    filesWithoutPoster: records.filter((record) => !record.poster).length,
    filesWithoutFastStart: records.filter((record) => !record.mp4.fastStart).length,
    filesWithAudio: records.filter((record) => record.audio).length,
  },
  videos: records,
};

const markdown = [
  '# Active Video Metadata Audit',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  '',
  `- Active video files: ${report.summary.activeVideoFiles}`,
  `- Collection pages: ${report.summary.collectionPages}`,
  `- Total active video size: ${formatBytes(report.summary.totalBytes)}`,
  `- Deferred source files: ${report.summary.deferredFiles}`,
  `- Immediate source files: ${report.summary.immediateFiles}`,
  `- Declarative autoplay files: ${report.summary.autoplayFiles}`,
  `- Files without poster: ${report.summary.filesWithoutPoster}`,
  `- Files without MP4 fast start: ${report.summary.filesWithoutFastStart}`,
  `- Files with audio streams: ${report.summary.filesWithAudio}`,
  '',
  '## Files',
  '',
  '| File | Pages | Delivery | Preload | Size | Duration | Video | FPS | Bitrate | Audio | Fast start |',
  '|---|---|---|---|---:|---:|---|---:|---:|---|---|',
  ...records.map((record) => [
    `\`${record.path}\``,
    record.pages.map((page) => `\`${page}\``).join('<br>'),
    record.deferred ? `Deferred (${record.policyId || 'policy missing'})` : 'Immediate',
    record.preload,
    formatBytes(record.bytes),
    `${record.durationSeconds.toFixed(2)} s`,
    `${record.video.codec} ${record.video.width}×${record.video.height} ${record.video.pixelFormat}`,
    record.video.averageFrameRate.toFixed(3),
    record.overallBitRate ? `${Math.round(record.overallBitRate / 1000)} kb/s` : 'Unknown',
    record.audio ? `${record.audio.codec}, ${record.audio.channels} ch` : 'None',
    record.mp4.fastStart ? 'Yes' : 'No',
  ].join(' | ')).map((row) => `| ${row} |`),
  '',
  '## Delivery constraints',
  '',
  '- Preserve source resolution, display aspect ratio, duration, average frame rate, and approved hashes.',
  '- Keep audio removed while every active usage is permanently muted.',
  '- Keep MP4 fast start and the approved WebP posters.',
  '- Keep source URLs deferred until the browser policy allows motion and data usage.',
  '- Keep declarative autoplay removed; controller playback must respect viewport and user preferences.',
  '',
].join('\n');

await mkdir(REPORT_DIR, { recursive: true });
await Promise.all([
  writeFile(join(REPORT_DIR, 'video-metadata.json'), JSON.stringify(report, null, 2), 'utf8'),
  writeFile(join(REPORT_DIR, 'video-metadata.md'), markdown, 'utf8'),
]);

console.log(
  `Video metadata audit completed for ${records.length} active files (${formatBytes(report.summary.totalBytes)}), deferred=${report.summary.deferredFiles}, immediate=${report.summary.immediateFiles}, autoplay=${report.summary.autoplayFiles}.`,
);
for (const record of records) {
  console.log(
    `- ${record.path}: ${record.video.codec} ${record.video.width}x${record.video.height} @ ${record.video.averageFrameRate.toFixed(3)} fps, ${formatBytes(record.bytes)}, ${record.durationSeconds.toFixed(2)}s, delivery=${record.deferred ? 'deferred' : 'immediate'}, source=${record.sourceAttribute}, preload=${record.preload}, audio=${record.audio ? 'yes' : 'no'}, fastStart=${record.mp4.fastStart ? 'yes' : 'no'}`,
  );
}
