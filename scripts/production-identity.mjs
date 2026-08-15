import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PRODUCTION_IDENTITY_FILE = join(
  'data',
  'products',
  'storefront-production-identity-v1.tsv',
);

const PRODUCT_ID_PATTERN = /^LM-\d{4}-\d{5}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function normalizeRepoPath(value = '') {
  return String(value)
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function loadProductionIdentityBridge(root = process.cwd()) {
  const text = await readFile(join(root, PRODUCTION_IDENTITY_FILE), 'utf8');
  const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  if (lines.shift() !== 'product_id\tstorefront_source_path\tsource_sha256') {
    throw new Error('Production identity bridge has an unexpected header.');
  }

  const records = lines.filter(Boolean).map((line, index) => {
    const [productId, storefrontSourcePath, sourceSha256, ...extra] = line.split('\t');
    if (extra.length || !PRODUCT_ID_PATTERN.test(productId || '')
      || !storefrontSourcePath || !SHA256_PATTERN.test(sourceSha256 || '')) {
      throw new Error(`Production identity bridge row ${index + 2} is invalid.`);
    }
    return Object.freeze({
      productId,
      storefrontSourcePath: normalizeRepoPath(storefrontSourcePath),
      sourceSha256,
    });
  });

  if (records.length !== 111) {
    throw new Error(`Production identity bridge must contain 111 products; found ${records.length}.`);
  }

  const byPath = new Map();
  const productIds = new Set();
  for (const record of records) {
    if (productIds.has(record.productId)) {
      throw new Error(`Duplicate production product ID: ${record.productId}`);
    }
    if (byPath.has(record.storefrontSourcePath)) {
      throw new Error(`Duplicate production storefront source path: ${record.storefrontSourcePath}`);
    }
    productIds.add(record.productId);
    byPath.set(record.storefrontSourcePath, record);
  }

  return Object.freeze({
    records: Object.freeze(records),
    byPath,
    productIds,
  });
}

export async function resolveProductionIdentity(product, bridge, root = process.cwd()) {
  const storefrontSourcePath = normalizeRepoPath(product?.image);
  const identity = bridge?.byPath?.get(storefrontSourcePath);
  if (!identity) {
    throw new Error(
      `${product?.page || storefrontSourcePath || '(unknown product)'}: image is not present in the production identity bridge.`,
    );
  }

  let bytes;
  try {
    bytes = await readFile(join(root, storefrontSourcePath));
  } catch (error) {
    throw new Error(
      `${product?.page || storefrontSourcePath}: storefront artwork cannot be read: ${storefrontSourcePath}`,
      { cause: error },
    );
  }
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== identity.sourceSha256) {
    throw new Error(
      `${product?.page || storefrontSourcePath}: storefront artwork SHA-256 differs from the production identity bridge.`,
    );
  }

  return Object.freeze({
    ...identity,
    storefrontSourcePath,
    verifiedSha256: actualSha256,
  });
}
