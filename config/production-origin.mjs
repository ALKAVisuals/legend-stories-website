export const LEGENDMURAL_PRODUCTION_ORIGIN = 'https://legendmural.com';
export const LEGACY_STOREFRONT_ORIGIN = 'https://alkavisuals.github.io/legend-stories-website';

export function canonicalUrl(pathname = '/') {
  const normalized = pathname === '/' ? '/' : `/${String(pathname).replace(/^\/+/, '')}`;
  return `${LEGENDMURAL_PRODUCTION_ORIGIN}${normalized}`;
}
