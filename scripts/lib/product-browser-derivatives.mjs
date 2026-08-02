import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const manifest = require('../../data/media/product-browser-derivatives.json');

const LEGACY_BASE_PATH = '/legend-stories-website/';

export function normalizeProductImagePath(value = '') {
  const raw = String(value).trim();
  if (!raw) return '';

  let pathname = raw;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    // Relative path; keep it as-is.
  }

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Preserve malformed legacy paths for validation rather than throwing.
  }

  pathname = pathname.replace(/^\.\//, '').replace(/^\//, '');
  if (pathname.startsWith(LEGACY_BASE_PATH.slice(1))) {
    pathname = pathname.slice(LEGACY_BASE_PATH.length - 1);
  }

  const mediaIndex = pathname.indexOf('media/');
  return mediaIndex >= 0 ? pathname.slice(mediaIndex) : pathname;
}

export function calculateDerivativeDimensions(width, height, maxDimension) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  const maximum = Number(maxDimension);
  if (![sourceWidth, sourceHeight, maximum].every(Number.isFinite)) {
    throw new Error('Derivative dimensions require finite numeric values.');
  }
  if (sourceWidth <= 0 || sourceHeight <= 0 || maximum <= 0) {
    throw new Error('Derivative dimensions require positive values.');
  }

  if (sourceWidth >= sourceHeight) {
    const scaledHeight = Math.round((sourceHeight * maximum) / sourceWidth);
    return {
      width: maximum,
      height: scaledHeight % 2 === 0 ? scaledHeight : scaledHeight + 1,
    };
  }

  const scaledWidth = Math.round((sourceWidth * maximum) / sourceHeight);
  return {
    width: scaledWidth % 2 === 0 ? scaledWidth : scaledWidth + 1,
    height: maximum,
  };
}

export function calculateSizeRatio(sourceBytes, derivativeBytes) {
  const source = Number(sourceBytes);
  const derivative = Number(derivativeBytes);
  if (!Number.isFinite(source) || source <= 0 || !Number.isFinite(derivative) || derivative < 0) {
    throw new Error('Size ratio requires valid source and derivative byte counts.');
  }
  return derivative / source;
}

export function parseSsimScore(output = '') {
  const match = String(output).match(/All:([0-9]+(?:\.[0-9]+)?)/);
  if (!match) throw new Error('Unable to parse SSIM score.');
  return Number(match[1]);
}

export const PRODUCT_BROWSER_DERIVATIVE_MANIFEST = Object.freeze(manifest);
export const PRODUCT_BROWSER_DERIVATIVES = Object.freeze(
  (manifest.images || []).map((image) => Object.freeze({ ...image })),
);

const BY_SOURCE = new Map(
  PRODUCT_BROWSER_DERIVATIVES.map((image) => [normalizeProductImagePath(image.source), image]),
);
const BY_DERIVATIVE = new Map(
  PRODUCT_BROWSER_DERIVATIVES.map((image) => [normalizeProductImagePath(image.derivative), image]),
);

export function productDerivativeRecordFor(value = '') {
  const normalized = normalizeProductImagePath(value);
  return BY_SOURCE.get(normalized) || BY_DERIVATIVE.get(normalized) || null;
}

export function browserProductImageFor(value = '') {
  const normalized = normalizeProductImagePath(value);
  return BY_SOURCE.get(normalized)?.derivative || normalized;
}

export function sourceProductImageFor(value = '') {
  const normalized = normalizeProductImagePath(value);
  return BY_DERIVATIVE.get(normalized)?.source || normalized;
}

export function hasProductBrowserDerivative(value = '') {
  return Boolean(productDerivativeRecordFor(value));
}
