import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'data', 'video', 'collection-video-optimization.json');
const EXPECTED_IDS = new Set(['collection-video-3', 'collection-video-5']);

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function probe(file) {
  return JSON.parse(run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ]));
}

function parseRate(value) {
  const [top, bottom = '1'] = String(value || '0/1').split('/').map(Number);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? top / bottom : 0;
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function hasFastStart(file) {
  const data = await readFile(file);
  let position = 0;
  let moovOffset = -1;
  let mdatOffset = -1;
  while (position + 8 <= data.length) {
    let size = data.readUInt32BE(position);
    const type = data.toString('ascii', position + 4, position + 8);
    let headerSize = 8;
    if (size === 1) {
      if (position + 16 > data.length) break;
      const extended = data.readBigUInt64BE(position + 8);
      if (extended > BigInt(Number.MAX_SAFE_INTEGER)) break;
      size = Number(extended);
      headerSize = 16;
    } else if (size === 0) {
      size = data.length - position;
    }
    if (size < headerSize || position + size > data.length) break;
    if (type === 'moov') moovOffset = position;
    if (type === 'mdat') mdatOffset = position;
    position += size;
  }
  return moovOffset >= 0 && mdatOffset >= 0 && moovOffset < mdatOffset;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const errors = [];

if (manifest.schemaVersion !== 1) errors.push('Manifest schemaVersion must be 1.');
if (!Array.isArray(manifest.videos) || manifest.videos.length !== 2) {
  errors.push('Manifest must contain exactly two optimized videos.');
}
if (manifest.encoder?.crf !== 26 || manifest.encoder?.preset !== 'slow') {
  errors.push('Manifest must retain the approved CRF 26 slow encoder profile.');
}
if (manifest.encoder?.audio !== 'removed' || manifest.encoder?.fastStart !== true) {
  errors.push('Manifest must require removed audio and MP4 fast start.');
}

for (const entry of manifest.videos || []) {
  if (!EXPECTED_IDS.has(entry.id)) {
    errors.push(`Unexpected optimized video ID: ${entry.id}.`);
    continue;
  }
  EXPECTED_IDS.delete(entry.id);

  const videoPath = join(ROOT, entry.path);
  const posterPath = join(ROOT, entry.poster);
  const videoInfo = await stat(videoPath);
  const posterInfo = await stat(posterPath);
  const videoHash = await sha256(videoPath);
  const posterHash = await sha256(posterPath);

  if (videoHash !== entry.output.sha256) errors.push(`${entry.path}: SHA-256 differs from manifest.`);
  if (videoInfo.size !== entry.output.bytes) errors.push(`${entry.path}: byte size differs from manifest.`);
  if (posterHash !== entry.posterOutput.sha256) errors.push(`${entry.poster}: SHA-256 differs from manifest.`);
  if (posterInfo.size !== entry.posterOutput.bytes) errors.push(`${entry.poster}: byte size differs from manifest.`);
  if (posterInfo.size <= 0 || posterInfo.size > 300 * 1024) errors.push(`${entry.poster}: poster size is invalid.`);

  const result = probe(videoPath);
  const video = result.streams.find((stream) => stream.codec_type === 'video');
  const audio = result.streams.find((stream) => stream.codec_type === 'audio');
  if (!video) {
    errors.push(`${entry.path}: video stream is missing.`);
  } else {
    if (video.codec_name !== 'h264' || video.profile !== 'High') errors.push(`${entry.path}: H.264 High profile is not preserved.`);
    if (Number(video.width) !== 640 || Number(video.height) !== 640) errors.push(`${entry.path}: resolution is not 640×640.`);
    if (video.pix_fmt !== 'yuv420p') errors.push(`${entry.path}: pixel format is not yuv420p.`);
    if (Math.abs(parseRate(video.avg_frame_rate) - 30) > 0.001) errors.push(`${entry.path}: average frame rate is not 30 fps.`);
    if (Number(video.nb_frames || 0) !== entry.output.frames) errors.push(`${entry.path}: frame count differs from manifest.`);
    if (video.color_space !== 'bt709' || video.color_transfer !== 'bt709' || video.color_primaries !== 'bt709') {
      errors.push(`${entry.path}: BT.709 color metadata is incomplete.`);
    }
  }
  if (audio) errors.push(`${entry.path}: unused audio stream remains.`);
  if (Math.abs(Number(result.format.duration || 0) - entry.output.durationSeconds) > 0.01) {
    errors.push(`${entry.path}: duration differs from manifest.`);
  }
  if (!await hasFastStart(videoPath)) errors.push(`${entry.path}: MP4 fast start is missing.`);
  if (entry.output.ssim < manifest.thresholds.minimumSsim) errors.push(`${entry.path}: SSIM is below threshold.`);
  if (entry.output.psnr < manifest.thresholds.minimumPsnr) errors.push(`${entry.path}: PSNR is below threshold.`);
  if (entry.output.reductionPercent < manifest.thresholds.minimumReductionPercent) errors.push(`${entry.path}: size reduction is below threshold.`);

  const posterProbe = probe(posterPath);
  const posterStream = posterProbe.streams.find((stream) => stream.codec_type === 'video');
  if (!posterStream || Number(posterStream.width) !== 640 || Number(posterStream.height) !== 640) {
    errors.push(`${entry.poster}: poster dimensions are not 640×640.`);
  }

  const encodedVideoPath = encodeURI(entry.path);
  for (const page of entry.pages || []) {
    const source = await readFile(join(ROOT, page), 'utf8');
    const block = source.match(new RegExp(
      `<video\\b([^>]*)>\\s*<source\\b[^>]*src=["']${escapeRegExp(encodedVideoPath)}["'][^>]*>`,
      'i',
    ));
    if (!block) {
      errors.push(`${page}: optimized collection video block is missing.`);
      continue;
    }
    const attributes = block[1];
    for (const required of ['autoplay', 'muted', 'loop', 'playsinline']) {
      if (!new RegExp(`\\b${required}\\b`, 'i').test(attributes)) {
        errors.push(`${page}: video is missing ${required}.`);
      }
    }
    if (!new RegExp(`\\bposter=["']${escapeRegExp(entry.poster)}["']`, 'i').test(attributes)) {
      errors.push(`${page}: video poster does not match the manifest.`);
    }
    if (!/\bpreload=["']metadata["']/i.test(attributes)) {
      errors.push(`${page}: video preload must remain metadata.`);
    }
  }
}

if (EXPECTED_IDS.size) errors.push(`Missing optimized video IDs: ${[...EXPECTED_IDS].join(', ')}.`);
const calculatedSourceBytes = (manifest.videos || []).reduce((sum, entry) => sum + entry.source.bytes, 0);
const calculatedOutputBytes = (manifest.videos || []).reduce((sum, entry) => sum + entry.output.bytes, 0);
const calculatedReduction = (1 - calculatedOutputBytes / calculatedSourceBytes) * 100;
if (manifest.summary.sourceBytes !== calculatedSourceBytes || manifest.summary.outputBytes !== calculatedOutputBytes) {
  errors.push('Manifest summary bytes do not reconcile.');
}
if (Math.abs(manifest.summary.reductionPercent - calculatedReduction) > 0.000001) {
  errors.push('Manifest summary reduction does not reconcile.');
}
if (calculatedReduction < 60) errors.push('Combined optimized video reduction is below 60%.');

if (errors.length) {
  console.error('Optimized collection video validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Optimized collection video validation passed: ${(calculatedSourceBytes / 1024 / 1024).toFixed(2)} MB -> ${(calculatedOutputBytes / 1024 / 1024).toFixed(2)} MB (${calculatedReduction.toFixed(1)}% reduction), no audio, posters present, all hashes verified.`,
);
