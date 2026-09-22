const BRAND_ORIGIN = 'https://legendmural.com';
const SOURCE_PREFIXES = Object.freeze(['media/stikkers/', 'media/browser-products/']);
const PUBLIC_PREFIX = '/email-products/';

function mediaType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.png')) return Object.freeze({ contentType: 'image/png', extension: 'png' });
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return Object.freeze({ contentType: 'image/jpeg', extension: 'jpg' });
  }
  if (lower.endsWith('.webp')) return Object.freeze({ contentType: 'image/webp', extension: 'webp' });
  return null;
}

export function resolveV3EmailProductAsset(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.includes('\\') || raw.includes('\u0000')) return null;

  let sourcePath = raw;
  while (sourcePath.startsWith('/')) sourcePath = sourcePath.slice(1);
  if (!SOURCE_PREFIXES.some((prefix) => sourcePath.startsWith(prefix))) return null;
  if (sourcePath.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')) {
    return null;
  }

  const type = mediaType(sourcePath);
  if (!type) return null;

  const mediaRelativePath = sourcePath.slice('media/'.length);
  const publicPath = `${PUBLIC_PREFIX}${mediaRelativePath}`;

  let url;
  try {
    url = new URL(publicPath, `${BRAND_ORIGIN}/`);
  } catch {
    return null;
  }
  if (url.origin !== BRAND_ORIGIN || !url.pathname.startsWith(PUBLIC_PREFIX)) return null;

  return Object.freeze({
    sourcePath,
    publicPath,
    url: url.href,
    contentType: type.contentType,
    extension: type.extension,
  });
}

export const V3_EMAIL_PRODUCT_PUBLIC_PREFIX = PUBLIC_PREFIX;
