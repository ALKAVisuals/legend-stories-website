import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'data', 'video', 'collection-video-optimization.json');
const CRF = 26;
const MIN_SSIM = 0.985;
const MIN_PSNR = 38;
const MIN_REDUCTION_PERCENT = 60;
const TARGETS = [
  {
    id: 'collection-video-3',
    path: 'media/welcome/LM Welcome video  mobile   (3).mp4',
    poster: 'media/welcome/collection-video-3-poster.webp',
    expectedSourceBytes: 9250350,
    pages: ['combat-legends.html', 'music-legends.html'],
  },
  {
    id: 'collection-video-5',
    path: 'media/welcome/LM Welcome video  mobile   (5).mp4',
    poster: 'media/welcome/collection-video-5-poster.webp',
    expectedSourceBytes: 12980818,
    pages: ['sport-legends.html', 'wisdom-legends.html'],
  },
];

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) throw new Error(`${command} failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status}): ${(result.stderr || '').trim()}`);
  }
  return result;
}

function probe(file) {
  return JSON.parse(run('ffprobe', [
    '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file,
  ], { capture: true }).stdout);
}

function parseRate(value) {
  const [top, bottom = '1'] = String(value || '0/1').split('/').map(Number);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? top / bottom : 0;
}

function metadata(file) {
  const result = probe(file);
  const video = result.streams.find((stream) => stream.codec_type === 'video');
  const audio = result.streams.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`No video stream found in ${file}.`);
  return {
    bytes: Number(result.format.size || 0),
    durationSeconds: Number(result.format.duration || video.duration || 0),
    video: {
      codec: video.codec_name,
      profile: video.profile || '',
      width: Number(video.width),
      height: Number(video.height),
      pixelFormat: video.pix_fmt || '',
      averageFrameRate: parseRate(video.avg_frame_rate),
      frames: Number(video.nb_frames || 0),
      bitRate: Number(video.bit_rate || 0),
      colorSpace: video.color_space || '',
      colorTransfer: video.color_transfer || '',
      colorPrimaries: video.color_primaries || '',
    },
    audio: audio ? {
      codec: audio.codec_name,
      channels: Number(audio.channels || 0),
      bitRate: Number(audio.bit_rate || 0),
    } : null,
  };
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

function compareMetric(source, candidate, metric) {
  const stderr = run('ffmpeg', [
    '-v', 'info', '-i', source, '-i', candidate,
    '-lavfi', `[0:v:0][1:v:0]${metric}`, '-an', '-f', 'null', '-',
  ], { capture: true }).stderr;
  const match = metric === 'ssim'
    ? stderr.match(/SSIM[^\n]*All:([0-9.]+)/)
    : stderr.match(/PSNR[^\n]*average:([0-9.]+)/);
  if (!match) throw new Error(`Unable to parse ${metric.toUpperCase()} output.`);
  return Number(match[1]);
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

function assertSource(source, target) {
  const errors = [];
  if (source.bytes !== target.expectedSourceBytes) errors.push('unexpected source byte size');
  if (source.video.codec !== 'h264') errors.push('source codec is not h264');
  if (source.video.width !== 640 || source.video.height !== 640) errors.push('source resolution changed');
  if (Math.abs(source.video.averageFrameRate - 30) > 0.001) errors.push('source frame rate changed');
  if (source.video.pixelFormat !== 'yuv420p') errors.push('source pixel format changed');
  if (!source.audio) errors.push('source audio stream is unexpectedly absent');
  if (errors.length) throw new Error(`${target.path}: ${errors.join(', ')}.`);
}

function assertCandidate(source, candidate, target) {
  const errors = [];
  if (candidate.video.codec !== 'h264') errors.push('candidate codec is not h264');
  if (candidate.video.width !== source.video.width || candidate.video.height !== source.video.height) errors.push('resolution changed');
  if (candidate.video.frames !== source.video.frames) errors.push('frame count changed');
  if (candidate.video.pixelFormat !== source.video.pixelFormat) errors.push('pixel format changed');
  if (Math.abs(candidate.video.averageFrameRate - source.video.averageFrameRate) > 0.001) errors.push('frame rate changed');
  if (Math.abs(candidate.durationSeconds - source.durationSeconds) > 0.05) errors.push('duration changed');
  if (candidate.audio) errors.push('audio remains');
  if (errors.length) throw new Error(`${target.path}: ${errors.join(', ')}.`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function addPosterToPage(pagePath, videoPath, posterPath) {
  const absolute = join(ROOT, pagePath);
  let source = await readFile(absolute, 'utf8');
  const encodedVideoPath = encodeURI(videoPath);
  const videoPattern = new RegExp(
    `(<video\\b[^>]*)(>\\s*<source\\b[^>]*src=["']${escapeRegExp(encodedVideoPath)}["'])`,
    'i',
  );
  const match = source.match(videoPattern);
  if (!match) throw new Error(`${pagePath}: active collection video block was not found.`);
  let opening = match[1];
  if (/\bposter=["'][^"']*["']/i.test(opening)) {
    opening = opening.replace(/\bposter=["'][^"']*["']/i, `poster="${posterPath}"`);
  } else {
    opening = `${opening} poster="${posterPath}"`;
  }
  source = source.replace(videoPattern, `${opening}${match[2]}`);
  await writeFile(absolute, source, 'utf8');
}

let existingManifest = null;
try {
  existingManifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

if (existingManifest) {
  for (const target of TARGETS) {
    const entry = existingManifest.videos.find((video) => video.id === target.id);
    if (!entry) throw new Error(`Manifest is missing ${target.id}.`);
    if (await sha256(join(ROOT, target.path)) !== entry.output.sha256) {
      throw new Error(`${target.path}: current video does not match the optimized manifest.`);
    }
    for (const page of target.pages) await addPosterToPage(page, target.path, target.poster);
  }
  console.log('Collection videos already match the optimization manifest.');
  process.exit(0);
}

await mkdir(dirname(MANIFEST_PATH), { recursive: true });
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  encoder: {
    codec: 'libx264', preset: 'slow', crf: CRF,
    pixelFormat: 'yuv420p', color: 'bt709', audio: 'removed', fastStart: true,
  },
  thresholds: {
    minimumSsim: MIN_SSIM,
    minimumPsnr: MIN_PSNR,
    minimumReductionPercent: MIN_REDUCTION_PERCENT,
  },
  videos: [],
};

for (const target of TARGETS) {
  const sourcePath = join(ROOT, target.path);
  const temporaryVideo = `${sourcePath}.optimized.tmp.mp4`;
  const posterPath = join(ROOT, target.poster);
  const temporaryPoster = `${posterPath}.tmp.webp`;
  await rm(temporaryVideo, { force: true });
  await rm(temporaryPoster, { force: true });

  const source = metadata(sourcePath);
  assertSource(source, target);
  const sourceHash = await sha256(sourcePath);

  run('ffmpeg', [
    '-y', '-v', 'error', '-i', sourcePath,
    '-map', '0:v:0', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF),
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-map_metadata', '-1', temporaryVideo,
  ]);

  const output = metadata(temporaryVideo);
  assertCandidate(source, output, target);
  const ssim = compareMetric(sourcePath, temporaryVideo, 'ssim');
  const psnr = compareMetric(sourcePath, temporaryVideo, 'psnr');
  const reductionPercent = (1 - output.bytes / source.bytes) * 100;
  if (ssim < MIN_SSIM || psnr < MIN_PSNR || reductionPercent < MIN_REDUCTION_PERCENT) {
    throw new Error(`${target.path}: candidate failed objective acceptance thresholds.`);
  }
  if (!await hasFastStart(temporaryVideo)) {
    throw new Error(`${target.path}: optimized MP4 is missing fast start.`);
  }

  await mkdir(dirname(posterPath), { recursive: true });
  run('ffmpeg', [
    '-y', '-v', 'error', '-ss', '0.1', '-i', temporaryVideo,
    '-frames:v', '1', '-c:v', 'libwebp', '-quality', '82',
    '-compression_level', '6', temporaryPoster,
  ]);
  const posterInfo = await stat(temporaryPoster);
  if (posterInfo.size <= 0 || posterInfo.size > 300 * 1024) {
    throw new Error(`${target.poster}: poster size is outside the accepted range.`);
  }

  const outputHash = await sha256(temporaryVideo);
  const posterHash = await sha256(temporaryPoster);
  await rename(temporaryVideo, sourcePath);
  await rename(temporaryPoster, posterPath);
  for (const page of target.pages) await addPosterToPage(page, target.path, target.poster);

  manifest.videos.push({
    id: target.id,
    path: target.path,
    poster: target.poster,
    pages: target.pages,
    source: {
      sha256: sourceHash,
      bytes: source.bytes,
      durationSeconds: source.durationSeconds,
      frames: source.video.frames,
      videoBitRate: source.video.bitRate,
      audioBitRate: source.audio.bitRate,
    },
    output: {
      sha256: outputHash,
      bytes: output.bytes,
      durationSeconds: output.durationSeconds,
      frames: output.video.frames,
      videoBitRate: output.video.bitRate,
      ssim,
      psnr,
      reductionPercent,
    },
    posterOutput: { sha256: posterHash, bytes: posterInfo.size },
  });
}

manifest.summary = {
  sourceBytes: manifest.videos.reduce((sum, video) => sum + video.source.bytes, 0),
  outputBytes: manifest.videos.reduce((sum, video) => sum + video.output.bytes, 0),
};
manifest.summary.reductionPercent = 1 - manifest.summary.outputBytes / manifest.summary.sourceBytes;
manifest.summary.reductionPercent *= 100;

await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Optimized ${manifest.videos.length} collection videos: ${(manifest.summary.sourceBytes / 1024 / 1024).toFixed(2)} MB -> ${(manifest.summary.outputBytes / 1024 / 1024).toFixed(2)} MB (${manifest.summary.reductionPercent.toFixed(1)}% reduction).`,
);
