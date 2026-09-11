import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const EXPECTED_SOURCE_SHA = '95a57e8f05a0af547efa0dfc4d044b8a96de7fe3';
const REQUIRED_FILES = [
  'index.html',
  'shop.html',
  'robots.txt',
  'sitemap.xml',
  'js/commerce/runtime-config.mjs',
];

const sourceDir = resolve(process.argv[2] || 'production-source');
const outputPath = resolve(process.argv[3] || 'out/netlify-production-source-build-proof.json');
const distDir = join(sourceDir, 'dist');

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function summarizeTree(rootDir) {
  let fileCount = 0;
  let totalBytes = 0;
  const queue = [rootDir];

  while (queue.length) {
    const current = queue.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        const info = await stat(fullPath);
        fileCount += 1;
        totalBytes += info.size;
      }
    }
  }

  return { fileCount, totalBytes };
}

const actualSourceSha = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actualSourceSha !== EXPECTED_SOURCE_SHA) {
  throw new Error(`Expected source ${EXPECTED_SOURCE_SHA}, got ${actualSourceSha}`);
}

const netlifyToml = await readFile(join(sourceDir, 'netlify.toml'), 'utf8');
if (!/publish\s*=\s*"dist"/.test(netlifyToml)) {
  throw new Error('Pinned source no longer declares Netlify publish = "dist".');
}
if (!/NODE_VERSION\s*=\s*"22"/.test(netlifyToml)) {
  throw new Error('Pinned source no longer declares Netlify NODE_VERSION = "22".');
}

const requiredFiles = {};
for (const relativePath of REQUIRED_FILES) {
  const bytes = await readFile(join(distDir, relativePath));
  if (bytes.length === 0) {
    throw new Error(`Required build artifact is empty: ${relativePath}`);
  }
  requiredFiles[relativePath] = {
    bytes: bytes.length,
    sha256: sha256(bytes),
  };
}

const runtimeConfig = await readFile(join(distDir, 'js/commerce/runtime-config.mjs'), 'utf8');
for (const expectedPath of ['/api/paypal/checkout', '/api/order-status', '/api/paypal/capture']) {
  if (!runtimeConfig.includes(expectedPath)) {
    throw new Error(`Runtime config is missing expected same-origin endpoint ${expectedPath}`);
  }
}
if (/https?:\/\//.test(runtimeConfig.replace('https://legendmural-runtime.invalid', ''))) {
  throw new Error('Generated public runtime config unexpectedly contains an absolute HTTP(S) origin.');
}

const tree = await summarizeTree(distDir);
const proof = {
  proofType: 'netlify-production-source-build',
  sourceSha: actualSourceSha,
  nodeMajor: Number(process.versions.node.split('.')[0]),
  publishDirectory: 'dist',
  requiredFiles,
  tree,
  mutationPerformed: false,
  providerCredentialsUsed: false,
};

if (proof.nodeMajor !== 22) {
  throw new Error(`Expected Node 22, got Node ${process.versions.node}`);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(proof, null, 2));
