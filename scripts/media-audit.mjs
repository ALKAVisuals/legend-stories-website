import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const MEDIA_DIR = join(ROOT, 'media');
const REPORT_DIR = join(ROOT, 'reports');
const CONFIG = JSON.parse(await readFile(join(ROOT, 'config/media-budgets.json'), 'utf8'));
const STRICT = process.argv.includes('--strict');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolutePath));
    else files.push(absolutePath);
  }
  return files;
}

function typeFor(file) {
  const extension = extname(file).toLowerCase().slice(1);
  if (['mp4', 'webm', 'mov'].includes(extension)) return 'video';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'gif'].includes(extension)) return 'image';
  return 'other';
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

async function main() {
  const files = await walk(MEDIA_DIR);
  const records = [];

  for (const file of files) {
    const fileStat = await stat(file);
    records.push({
      path: relative(ROOT, file).replaceAll('\\', '/'),
      bytes: fileStat.size,
      type: typeFor(file),
      extension: extname(file).toLowerCase().slice(1)
    });
  }

  records.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
  const large = records.filter((record) => record.bytes >= CONFIG.repositoryWarnings.largeFileBytes);
  const critical = records.filter((record) => record.bytes >= CONFIG.repositoryWarnings.criticalFileBytes);
  const totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);

  const byType = records.reduce((summary, record) => {
    summary[record.type] ??= { count: 0, bytes: 0 };
    summary[record.type].count += 1;
    summary[record.type].bytes += record.bytes;
    return summary;
  }, {});

  const report = [
    '# Media Audit',
    '',
    `Files scanned: ${records.length}`,
    `Total media size: ${formatBytes(totalBytes)}`,
    `Files >= 1 MB: ${large.length}`,
    `Files >= 5 MB: ${critical.length}`,
    '',
    '## Summary by type',
    '',
    '| Type | Files | Size |',
    '|---|---:|---:|',
    ...Object.entries(byType).map(([type, value]) => `| ${type} | ${value.count} | ${formatBytes(value.bytes)} |`),
    '',
    '## Largest files',
    '',
    '| File | Type | Size |',
    '|---|---|---:|',
    ...records.slice(0, 100).map((record) => `| ${record.path} | ${record.type} | ${formatBytes(record.bytes)} |`),
    '',
    '## Policy',
    '',
    ...CONFIG.policy.map((rule) => `- ${rule}`),
    ''
  ].join('\n');

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(join(REPORT_DIR, 'media-audit.md'), report, 'utf8');
  await writeFile(join(REPORT_DIR, 'media-audit.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalFiles: records.length,
    totalBytes,
    largeFiles: large.length,
    criticalFiles: critical.length,
    byType,
    largestFiles: records.slice(0, 100),
    budgets: CONFIG
  }, null, 2), 'utf8');

  console.log(`Media audit completed: ${records.length} files, ${formatBytes(totalBytes)}, ${critical.length} critical-size files.`);

  if (STRICT && critical.length > 0) {
    console.error('Strict media audit failed because files over 5 MB remain.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Media audit failed:', error);
  process.exit(1);
});
