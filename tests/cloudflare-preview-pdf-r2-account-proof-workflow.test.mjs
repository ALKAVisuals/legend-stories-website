import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/cloudflare-preview-pdf-r2-account-proof.yml', import.meta.url),
  'utf8',
);
const config = await readFile(
  new URL('./fixtures/wrangler.remote-pdf-r2-proof.jsonc', import.meta.url),
  'utf8',
);
const worker = await readFile(
  new URL('./fixtures/cloudflare-remote-pdf-r2-proof-worker.mjs', import.meta.url),
  'utf8',
);
const verifier = await readFile(
  new URL('../scripts/verify-cloudflare-remote-pdf-r2-proof.mjs', import.meta.url),
  'utf8',
);

test('remote PDF/R2 account proof is manual and requires an exact preview-only phrase', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\npull_request:/);
  assert.doesNotMatch(workflow, /\npush:/);
  assert.match(workflow, /PREVIEW_PDF_R2_ONLY/);
});

test('remote PDF/R2 proof deploys only its temporary workers.dev Worker', () => {
  assert.match(workflow, /wrangler\.remote-pdf-r2-proof\.jsonc/);
  assert.match(workflow, /LEGENDMURAL_PROOF_RUN_ID/);
  assert.doesNotMatch(workflow, /--env\s+production/);
  assert.doesNotMatch(workflow, /legendmural-cloudflare-production/);
  assert.doesNotMatch(workflow, /legendmural-v3-invoice-pdfs-prod(?:\s|['"`]|$)/);
  assert.doesNotMatch(workflow, /\bwrangler\.jsonc\b/);
  assert.match(workflow, /wrangler@4\.129\.0 delete/);
  assert.match(workflow, /--force/);
});

test('remote PDF/R2 proof consumes no commerce, email or dashboard runtime secrets', () => {
  for (const forbidden of [
    'NEON_DATABASE_URL',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'RESEND_API_KEY',
    'LEGENDMURAL_DASHBOARD_INVOICE_TOKEN',
  ]) {
    assert.doesNotMatch(workflow, new RegExp(forbidden));
  }
  assert.match(workflow, /CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/);
});

test('temporary proof config binds only the existing private preview R2 bucket', () => {
  const parsed = JSON.parse(config);
  assert.equal(parsed.name, 'legendmural-cloudflare-preview-pdf-r2-proof');
  assert.equal(parsed.workers_dev, true);
  assert.equal(parsed.r2_buckets?.length, 1);
  assert.deepEqual(parsed.r2_buckets[0], {
    binding: 'V3_INVOICE_PDFS',
    bucket_name: 'legendmural-v3-invoice-pdfs-preview',
    preview_bucket_name: 'legendmural-v3-invoice-pdfs-preview',
  });
  assert.equal(parsed.routes, undefined);
  assert.equal(parsed.route, undefined);
  assert.equal(parsed.env, undefined);
  assert.match(parsed.alias?.pdfkit || '', /pdfkit-worker-runtime\.mjs$/);
});

test('proof Worker exercises PDFKit plus R2 create-only and read-back integrity without Production adapter flags', () => {
  assert.match(worker, /renderV3InvoicePdf/);
  assert.match(worker, /V3_INVOICE_PDFS/);
  assert.match(worker, /etagDoesNotMatch:\s*['"]\*['"]/);
  assert.match(worker, /bucket\.get\(storageKey\)/);
  assert.match(worker, /readSha256/);
  assert.match(worker, /readByteLength/);
  assert.match(worker, /bytesEqual/);
  assert.doesNotMatch(worker, /createCloudflareR2V3InvoicePdfStore/);
  assert.doesNotMatch(worker, /LEGENDMURAL_DEPLOY_CONTEXT/);
  assert.doesNotMatch(worker, /V3_INVOICE_STORAGE_ENABLED/);
});

test('remote verifier requires canonical Node equality and real create-only duplicate semantics', () => {
  assert.match(verifier, /workers\\\.dev/);
  assert.match(verifier, /nodeProof\.sha256/);
  assert.match(verifier, /nodeProof\.byteLength/);
  assert.match(verifier, /firstDuplicate, false/);
  assert.match(verifier, /secondDuplicate, true/);
  assert.match(verifier, /readSha256/);
  assert.match(verifier, /readByteLength/);
  assert.match(verifier, /bytesEqual, true/);
});
