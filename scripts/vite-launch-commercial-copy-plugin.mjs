import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const HOME_PATHS = new Set(['/', '/index.html']);
const SHOP_PATHS = new Set(['/shop.html']);

const STALE_FIXED_DELIVERY_RANGE = /\b\d+\s*(?:to|-|–|—)\s*\d+\s*(?:working\s+)?days?\b/i;

function rewriteHomepage(source) {
  return String(source)
    .replaceAll('€49,95', 'From €35')
    .replace(
      'Drag the slider. See what a €49 sticker does to a blank wall.',
      'Drag the slider. See what a LegendMural sticker does to a blank wall.',
    )
    .replace(
      '<h3 class="font-display font-bold text-sm mb-1">Fast shipping</h3><p class="text-text-secondary text-xs leading-relaxed">2 to 4 working days. Ships across Europe.</p>',
      '<h3 class="font-display font-bold text-sm mb-1">Ships from NL</h3><p class="text-text-secondary text-xs leading-relaxed">Available to the Netherlands, supported EU destinations and the United States.</p>',
    )
    .replace(
      'Your mural gets printed on matte vinyl and lands at your door in 2 to 4 days.',
      'Your mural is printed on matte vinyl and prepared for shipment from the Netherlands.',
    );
}

function rewriteShop(source) {
  return String(source)
    .replace(
      'Free shipping over €50. Standard delivery in 2 to 4 working days across Europe.',
      'Free shipping from €69 after discount. Netherlands €4,95 · EU €9,95 · United States €9,95 tracked.',
    )
    .replace(
      '30 day return window. Not happy? Send it back for a full refund.',
      'Standard catalogue purchases generally have a 14-day statutory withdrawal period. See Returns for the full process.',
    );
}

export function rewriteLaunchCommercialCopy(source, { path = '' } = {}) {
  if (HOME_PATHS.has(path)) return rewriteHomepage(source);
  if (SHOP_PATHS.has(path)) return rewriteShop(source);
  return String(source);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(filePath));
    else files.push(filePath);
  }
  return files;
}

export function validateLaunchCommercialOutput(root, outDir = 'dist') {
  const outputRoot = resolve(root, outDir);
  const htmlFiles = walk(outputRoot).filter((file) => extname(file) === '.html');
  const errors = [];

  for (const file of htmlFiles) {
    const source = readFileSync(file, 'utf8');
    const page = relative(outputRoot, file).replaceAll('\\', '/');

    if (STALE_FIXED_DELIVERY_RANGE.test(source)) {
      errors.push(`${page} still contains a fixed delivery-range promise.`);
    }
    if (/Free shipping over €50/i.test(source)) {
      errors.push(`${page} still contains the obsolete €50 free-shipping threshold.`);
    }
    if (/30 day return window/i.test(source)) {
      errors.push(`${page} still contains the obsolete 30-day return-window claim.`);
    }
  }

  const homepage = readFileSync(join(outputRoot, 'index.html'), 'utf8');
  if (homepage.includes('€49,95') || homepage.includes('€49 sticker')) {
    errors.push('index.html still contains the obsolete €49/€49,95 marketing price.');
  }
  if (!homepage.includes('From €35')) {
    errors.push('index.html does not expose the current Compact starting price.');
  }

  const shop = readFileSync(join(outputRoot, 'shop.html'), 'utf8');
  if (!shop.includes('Free shipping from €69 after discount.')) {
    errors.push('shop.html does not expose the current €69-after-discount shipping threshold.');
  }
  if (!shop.includes('14-day statutory withdrawal period')) {
    errors.push('shop.html does not expose the current statutory withdrawal summary.');
  }

  if (errors.length) {
    throw new Error(`Launch commercial-copy validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export function launchCommercialCopyPlugin({ root, outDir = 'dist' }) {
  const resolvedRoot = resolve(root);

  return {
    name: 'legendmural-launch-commercial-copy',
    enforce: 'post',

    transformIndexHtml(html, context) {
      return rewriteLaunchCommercialCopy(html, { path: context?.path || '' });
    },

    closeBundle() {
      validateLaunchCommercialOutput(resolvedRoot, outDir);
    },
  };
}

export { STALE_FIXED_DELIVERY_RANGE };
