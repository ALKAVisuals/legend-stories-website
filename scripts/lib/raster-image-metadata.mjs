const RASTER_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const ALPHA_PIXEL_FORMAT_PREFIXES = [
  'abgr', 'argb', 'bgra', 'gbrap', 'pal8', 'rgba', 'ya', 'yuva',
];

export function isRasterImageExtension(extension = '') {
  const normalized = String(extension || '').trim().toLowerCase();
  return RASTER_EXTENSIONS.has(normalized.startsWith('.') ? normalized : `.${normalized}`);
}

export function classifyRasterRole(path = '') {
  const normalized = String(path || '').replaceAll('\\', '/').toLowerCase();
  if (normalized.includes('/stikkers/')) return 'product-source';
  if (normalized.includes('/voorbeelden/') || normalized.includes('/beforeafter/')) return 'marketing';
  if (normalized.includes('/logo/')) return 'brand';
  if (normalized.includes('/welcome/')) return 'hero';
  return 'other';
}

export function pixelFormatSupportsAlpha(pixelFormat = '') {
  const normalized = String(pixelFormat || '').trim().toLowerCase();
  return ALPHA_PIXEL_FORMAT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function calculateRasterMetrics({ bytes = 0, width = 0, height = 0 } = {}) {
  const safeBytes = Math.max(0, Number(bytes) || 0);
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeHeight = Math.max(0, Number(height) || 0);
  const pixels = safeWidth * safeHeight;
  const megapixels = pixels / 1_000_000;

  return Object.freeze({
    pixels,
    megapixels,
    bytesPerPixel: pixels > 0 ? safeBytes / pixels : 0,
    bytesPerMegapixel: megapixels > 0 ? safeBytes / megapixels : 0,
  });
}
