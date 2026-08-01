import { spawnSync } from 'node:child_process';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const ROOT = process.cwd();
const OUTPUT_ROOT = join(ROOT, 'generated', 'video-optimization');
const REPORT_ROOT = join(ROOT, 'reports');
const SOURCES = [
  'media/welcome/LM Welcome video  mobile   (3).mp4',
  'media/welcome/LM Welcome video  mobile   (5).mp4',
];
const CRF_VALUES = [22, 24, 26];
const MIN_SSIM = 0.985;
const MIN_PSNR = 38;
const MIN_REDUCTION_PERCENT = 20;

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

function ffprobe(file) {
  const result = run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file,
  ], { capture: true });
  return JSON.parse(result.stdout);
}

function parseRate(value) {
  const [top, bottom = '1'] = String(value || '0/1').split('/').map(Number);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0 ? top / bottom : 0;
}

function videoMetadata(file) {
  const probe = ffprobe(file);
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`No video stream found in ${file}.`);
  return {
    bytes: Number(probe.format.size || 0),
    durationSeconds: Number(probe.format.duration || video.duration || 0),
    overallBitRate: Number(probe.format.bit_rate || 0),
    video: {
      codec: video.codec_name,
      profile: video.profile || '',
      width: Number(video.width),
      height: Number(video.height),
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
      channels: Number(audio.channels || 0),
      bitRate: Number(audio.bit_rate || 0),
    } : null,
  };
}

function parseMetric(stderr, metric) {
  if (metric === 'ssim') {
    const match = stderr.match(/SSIM[^\n]*All:([0-9.]+)/);
    if (!match) throw new Error(`Unable to parse SSIM output: ${stderr.slice(-1000)}`);
    return Number(match[1]);
  }
  const match = stderr.match(/PSNR[^\n]*average:([0-9.]+)/);
  if (!match) throw new Error(`Unable to parse PSNR output: ${stderr.slice(-1000)}`);
  return Number(match[1]);
}

function compareMetric(source, candidate, metric) {
  const filter = metric === 'ssim' ? 'ssim' : 'psnr';
  const result = run('ffmpeg', [
    '-v', 'info',
    '-i', source,
    '-i', candidate,
    '-lavfi', `[0:v:0][1:v:0]${filter}`,
    '-an',
    '-f', 'null',
    '-',
  ], { capture: true });
  return parseMetric(result.stderr, metric);
}

function assertPreserved(source, candidate, label) {
  const errors = [];
  if (candidate.video.codec !== 'h264') errors.push('codec is not h264');
  if (candidate.video.width !== source.video.width || candidate.video.height !== source.video.height) {
    errors.push('resolution changed');
  }
  if (candidate.video.pixelFormat !== source.video.pixelFormat) errors.push('pixel format changed');
  if (Math.abs(candidate.video.averageFrameRate - source.video.averageFrameRate) > 0.001) {
    errors.push('average frame rate changed');
  }
  if (Math.abs(candidate.durationSeconds - source.durationSeconds) > 0.05) errors.push('duration changed');
  if (candidate.audio) errors.push('audio stream remains');
  if (errors.length) throw new Error(`${label}: ${errors.join(', ')}.`);
}

async function createComparisonFrames(source, candidate, outputDirectory, durationSeconds) {
  const ratios = [0.1, 0.35, 0.6, 0.85];
  const files = [];
  for (const [index, ratio] of ratios.entries()) {
    const timestamp = Math.max(0, durationSeconds * ratio).toFixed(3);
    const output = join(outputDirectory, `comparison-${index + 1}.png`);
    run('ffmpeg', [
      '-y',
      '-v', 'error',
      '-ss', timestamp,
      '-i', source,
      '-ss', timestamp,
      '-i', candidate,
      '-filter_complex', '[0:v:0][1:v:0]hstack=inputs=2',
      '-frames:v', '1',
      output,
    ]);
    files.push(output);
  }
  return files;
}

function formatMegabytes(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

await rm(OUTPUT_ROOT, { recursive: true, force: true });
await mkdir(OUTPUT_ROOT, { recursive: true });
await mkdir(REPORT_ROOT, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  thresholds: {
    minimumSsim: MIN_SSIM,
    minimumPsnr: MIN_PSNR,
    minimumReductionPercent: MIN_REDUCTION_PERCENT,
  },
  sources: [],
};

for (const [sourceIndex, sourcePath] of SOURCES.entries()) {
  const source = resolve(ROOT, sourcePath);
  const sourceMetadata = videoMetadata(source);
  const directory = join(OUTPUT_ROOT, `video-${sourceIndex + 1}`);
  await mkdir(directory, { recursive: true });

  const candidates = [];
  for (const crf of CRF_VALUES) {
    const output = join(directory, `candidate-crf-${crf}.mp4`);
    run('ffmpeg', [
      '-y',
      '-v', 'error',
      '-i', source,
      '-map', '0:v:0',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', String(crf),
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-colorspace', 'bt709',
      '-map_metadata', '-1',
      output,
    ]);

    const metadata = videoMetadata(output);
    assertPreserved(sourceMetadata, metadata, `${sourcePath} CRF ${crf}`);
    const ssim = compareMetric(source, output, 'ssim');
    const psnr = compareMetric(source, output, 'psnr');
    const reductionPercent = (1 - metadata.bytes / sourceMetadata.bytes) * 100;
    candidates.push({
      crf,
      file: output,
      fileName: basename(output),
      ...metadata,
      ssim,
      psnr,
      reductionPercent,
      eligible: ssim >= MIN_SSIM
        && psnr >= MIN_PSNR
        && reductionPercent >= MIN_REDUCTION_PERCENT,
    });
  }

  const eligible = candidates
    .filter((candidate) => candidate.eligible)
    .sort((left, right) => left.bytes - right.bytes || right.ssim - left.ssim);
  if (!eligible.length) {
    throw new Error(`${sourcePath}: no candidate passed the objective quality thresholds.`);
  }
  const selected = eligible[0];
  const selectedDirectory = join(directory, 'selected-comparisons');
  await mkdir(selectedDirectory, { recursive: true });
  const comparisons = await createComparisonFrames(
    source,
    selected.file,
    selectedDirectory,
    sourceMetadata.durationSeconds,
  );

  report.sources.push({
    sourcePath,
    source: sourceMetadata,
    candidates: candidates.map(({ file, ...candidate }) => candidate),
    selected: {
      crf: selected.crf,
      fileName: selected.fileName,
      bytes: selected.bytes,
      sizeMegabytes: formatMegabytes(selected.bytes),
      ssim: selected.ssim,
      psnr: selected.psnr,
      reductionPercent: selected.reductionPercent,
      comparisonFrames: comparisons.map((file) => file.replace(`${ROOT}/`, '')),
    },
  });
}

report.summary = {
  sourceBytes: report.sources.reduce((sum, source) => sum + source.source.bytes, 0),
  selectedBytes: report.sources.reduce((sum, source) => sum + source.selected.bytes, 0),
};
report.summary.reductionPercent = (
  1 - report.summary.selectedBytes / report.summary.sourceBytes
) * 100;

const markdown = [
  '# Video Optimization Evaluation',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Acceptance thresholds',
  '',
  `- SSIM ≥ ${MIN_SSIM}`,
  `- PSNR ≥ ${MIN_PSNR} dB`,
  `- Size reduction ≥ ${MIN_REDUCTION_PERCENT}%`,
  '- Resolution, duration, average frame rate, pixel format, and H.264 delivery preserved.',
  '- Audio removed because every active usage is permanently muted.',
  '',
  '## Candidate results',
  '',
  '| Source | CRF | Size | Reduction | SSIM | PSNR | Eligible |',
  '|---|---:|---:|---:|---:|---:|---|',
  ...report.sources.flatMap((source) => source.candidates.map((candidate) => `| \`${source.sourcePath}\` | ${candidate.crf} | ${formatMegabytes(candidate.bytes).toFixed(2)} MB | ${candidate.reductionPercent.toFixed(1)}% | ${candidate.ssim.toFixed(6)} | ${candidate.psnr.toFixed(2)} dB | ${candidate.eligible ? 'Yes' : 'No'} |`)),
  '',
  '## Selected candidates',
  '',
  ...report.sources.flatMap((source) => [
    `### \`${source.sourcePath}\``,
    '',
    `- Selected CRF: ${source.selected.crf}`,
    `- Size: ${source.selected.sizeMegabytes.toFixed(2)} MB`,
    `- Reduction: ${source.selected.reductionPercent.toFixed(1)}%`,
    `- SSIM: ${source.selected.ssim.toFixed(6)}`,
    `- PSNR: ${source.selected.psnr.toFixed(2)} dB`,
    '',
  ]),
  '## Combined result',
  '',
  `- Original size: ${formatMegabytes(report.summary.sourceBytes).toFixed(2)} MB`,
  `- Selected size: ${formatMegabytes(report.summary.selectedBytes).toFixed(2)} MB`,
  `- Reduction: ${report.summary.reductionPercent.toFixed(1)}%`,
  '',
  'The side-by-side PNG files show the original on the left and the selected candidate on the right.',
  '',
].join('\n');

await Promise.all([
  writeFile(join(REPORT_ROOT, 'video-optimization-evaluation.json'), JSON.stringify(report, null, 2), 'utf8'),
  writeFile(join(REPORT_ROOT, 'video-optimization-evaluation.md'), markdown, 'utf8'),
]);

console.log(
  `Video optimization evaluation passed: ${formatMegabytes(report.summary.sourceBytes).toFixed(2)} MB -> ${formatMegabytes(report.summary.selectedBytes).toFixed(2)} MB (${report.summary.reductionPercent.toFixed(1)}% reduction).`,
);
for (const source of report.sources) {
  console.log(
    `- ${source.sourcePath}: CRF ${source.selected.crf}, SSIM ${source.selected.ssim.toFixed(6)}, PSNR ${source.selected.psnr.toFixed(2)} dB, ${source.selected.reductionPercent.toFixed(1)}% smaller`,
  );
}
