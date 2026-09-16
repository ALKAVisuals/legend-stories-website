import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function normalizeOrigin(rawValue) {
  const raw = String(rawValue || '').trim();
  assert.ok(raw, 'LEGENDMURAL_PROOF_ORIGIN is required.');
  const firstToken = raw.split(/\s+/)[0];
  const candidate = /^https?:\/\//i.test(firstToken) ? firstToken : `https://${firstToken}`;
  const url = new URL(candidate);

  assert.equal(url.protocol, 'https:', 'Remote proof Worker must use HTTPS.');
  assert.match(url.hostname, /\.workers\.dev$/i, 'Remote proof Worker must use workers.dev.');
  assert.notEqual(url.hostname.toLowerCase(), 'legendmural.com');
  assert.match(url.hostname, /^legendmural-cloudflare-preview-pdf-r2-proof\./i);
  return url.origin;
}

const origin = normalizeOrigin(process.env.LEGENDMURAL_PROOF_ORIGIN);
const runId = String(process.env.LEGENDMURAL_PROOF_RUN_ID || '').trim();
const nodeProofPath = String(process.env.LEGENDMURAL_NODE_PDF_PROOF || '').trim();
assert.match(runId, /^\d{1,20}-\d{1,4}$/, 'LEGENDMURAL_PROOF_RUN_ID is invalid.');
assert.ok(nodeProofPath, 'LEGENDMURAL_NODE_PDF_PROOF is required.');

const nodeProof = JSON.parse(await readFile(nodeProofPath, 'utf8'));
const response = await fetch(`${origin}/probe`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
});
const text = await response.text();
let body = null;
try {
  body = text ? JSON.parse(text) : null;
} catch {}

console.log(`[remote-pdf-r2] status=${response.status} body=${text.replace(/\s+/g, ' ').slice(0, 1000)}`);
assert.equal(response.status, 200, `Remote proof returned HTTP ${response.status}.`);
assert.equal(body?.context, 'preview-pdf-r2-proof');
assert.equal(body?.runId, runId);
assert.equal(body?.rendererVersion, body?.expectedRendererVersion);
assert.equal(body?.rendererVersion, nodeProof.rendererVersion);
assert.equal(body?.filename, nodeProof.filename);
assert.equal(body?.pdfHeader, nodeProof.pdfHeader);
assert.equal(body?.pdfSha256, nodeProof.sha256);
assert.equal(body?.pdfByteLength, nodeProof.byteLength);
assert.equal(body?.deterministic, true);
assert.match(body?.pdfSha256 || '', /^[a-f0-9]{64}$/);
assert.ok(body?.pdfByteLength > 1000);

assert.equal(body?.firstDuplicate, false, 'The unique proof object must be created on the first write.');
assert.equal(body?.secondDuplicate, true, 'The second identical write must be rejected as an idempotent duplicate.');
assert.equal(body?.readSha256, body?.pdfSha256);
assert.equal(body?.readByteLength, body?.pdfByteLength);
assert.equal(body?.bytesEqual, true);
assert.equal(
  body?.storageKey,
  `proofs/cloudflare-preview-pdf-r2/${runId}/${body.pdfSha256}.pdf`,
);

console.log('[remote-pdf-r2] Cloudflare Worker PDFKit + preview R2 proof passed.');
