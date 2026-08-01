import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'reports');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function formatFix(value) {
  if (value === true) return 'Available';
  if (!value) return 'No automatic fix';
  if (typeof value === 'object') {
    const target = [value.name, value.version].filter(Boolean).join('@');
    return value.isSemVerMajor ? `${target || 'Upgrade'} (major)` : target || 'Available';
  }
  return String(value);
}

function viaSummary(via = []) {
  return via.map((entry) => {
    if (typeof entry === 'string') return entry;
    return entry.title || entry.name || entry.url || 'advisory';
  }).join('; ');
}

function counts(metadata = {}) {
  const vulnerabilities = metadata.vulnerabilities || {};
  return {
    info: vulnerabilities.info || 0,
    low: vulnerabilities.low || 0,
    moderate: vulnerabilities.moderate || 0,
    high: vulnerabilities.high || 0,
    critical: vulnerabilities.critical || 0,
    total: vulnerabilities.total || 0,
  };
}

const result = spawnSync(npmCommand, ['audit', '--json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch (error) {
  console.error('Dependency audit returned invalid JSON.');
  if (result.stdout) console.error(result.stdout.slice(0, 4000));
  if (result.stderr) console.error(result.stderr.slice(0, 4000));
  throw error;
}

const summary = counts(report.metadata);
const vulnerabilities = Object.values(report.vulnerabilities || {})
  .sort((a, b) => a.severity.localeCompare(b.severity) || a.name.localeCompare(b.name));

await mkdir(REPORT_DIR, { recursive: true });
await writeFile(join(REPORT_DIR, 'dependency-audit.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = [
  '# Dependency Audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Policy',
  '',
  '- Critical vulnerabilities allowed: 0',
  '- High vulnerabilities allowed: 0',
  '- Moderate, low and informational findings remain visible for planned maintenance.',
  '',
  '## Summary',
  '',
  `- Total: ${summary.total}`,
  `- Critical: ${summary.critical}`,
  `- High: ${summary.high}`,
  `- Moderate: ${summary.moderate}`,
  `- Low: ${summary.low}`,
  `- Info: ${summary.info}`,
  '',
  '## Vulnerabilities',
  '',
  '| Package | Severity | Direct | Affected range | Fix | Advisory |',
  '|---|---|---:|---|---|---|',
  ...(vulnerabilities.length
    ? vulnerabilities.map((item) => `| ${item.name} | ${item.severity} | ${item.isDirect ? 'yes' : 'no'} | ${item.range || '—'} | ${formatFix(item.fixAvailable)} | ${viaSummary(item.via) || '—'} |`)
    : ['| None | — | — | — | — | — |']),
  '',
].join('\n');

await writeFile(join(REPORT_DIR, 'dependency-audit.md'), markdown, 'utf8');

console.log(
  `Dependency audit completed: ${summary.total} total (${summary.critical} critical, ${summary.high} high, ${summary.moderate} moderate, ${summary.low} low).`,
);
for (const item of vulnerabilities) {
  console.log(`- ${item.name}: ${item.severity}; range ${item.range || 'unknown'}; fix ${formatFix(item.fixAvailable)}`);
}

if (result.error) {
  console.error('npm audit could not be executed:', result.error.message);
  process.exit(1);
}

const blockedFindings = summary.critical + summary.high;
if (blockedFindings > 0) {
  console.error(
    `Dependency audit failed policy: ${summary.critical} critical and ${summary.high} high vulnerability finding(s).`,
  );
  process.exit(1);
}
