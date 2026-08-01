import {
  escapeHtml,
  extractProductPresentation,
  formatEuro,
  renderProductPage,
  templatizeProductPage as templatizeBaseProductPage,
  templateHash,
} from './product-page-generation.mjs';

const CATEGORY_LINKS = [
  ['music', 'Music Legends'],
  ['sport', 'Sport Legends'],
  ['combat', 'Combat Legends'],
  ['wisdom', 'Wisdom Legends'],
];
const FOOTER_LINK_CLASS = 'text-sm text-text-secondary hover:text-mint transition-colors';

export {
  escapeHtml,
  extractProductPresentation,
  formatEuro,
  renderProductPage,
  templateHash,
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeLegacyProductPageMarkup(input) {
  let html = String(input);

  html = html.replace(
    /(<img\s+src="media\/LOGO\/lm-logo-transparant\.png"\s+alt=")[^"]*(")/,
    '$1$2',
  );

  html = html.replace(
    /(<a\s+href="index\.html"[^>]*\blogo-wrap\b[^>]*>\s*<img[^>]*>\s*<\/a>)\s*<\/a>/,
    '$1',
  );

  for (const [category, label] of CATEGORY_LINKS) {
    const escapedLabel = escapeRegExp(label);
    const desktop = new RegExp(
      `<a href="[^"]*" class="((?:(?!\\bpy-2\\b)[^"])*)">${escapedLabel}<\\/a>`,
    );
    const mobile = new RegExp(
      `<a href="[^"]*" class="([^"]*\\bpy-2\\b[^"]*)">${escapedLabel}<\\/a>`,
    );
    const footer = new RegExp(
      `<li>\\s*<a href="[^"]*" class="[^"]*">${escapedLabel}<\\/a>\\s*<\\/li>`,
    );

    html = html.replace(
      desktop,
      `<a href="${category}-legends.html" class="$1">${label}</a>`,
    );
    html = html.replace(
      mobile,
      `<a href="${category}-legends.html" class="$1">${label}</a>`,
    );
    html = html.replace(
      footer,
      `<li><a href="${category}-legends.html" class="${FOOTER_LINK_CLASS}">${label}</a></li>`,
    );
  }

  return html;
}

export function templatizeProductPage(input) {
  const normalizedInput = normalizeLegacyProductPageMarkup(input);
  const template = templatizeBaseProductPage(normalizedInput);
  const pattern = /More from <span class="text-gradient-mint">[^<]+<\/span>/;
  if (!pattern.test(template)) {
    throw new Error('related collection heading: required markup was not found.');
  }
  return template.replace(
    pattern,
    'More from <span class="text-gradient-mint">{{COLLECTION}}</span>',
  );
}

function normalizeKnownIconVectors(input) {
  let html = String(input);

  html = html.replace(
    /(<button\s+id="cart-btn"[^>]*>)\s*<svg[\s\S]*?<\/svg>/,
    '$1<svg data-template-icon="cart"></svg>',
  );

  for (const label of ['Instagram', 'Facebook', 'TikTok']) {
    const pattern = new RegExp(
      `(<a[^>]*aria-label="${label}"[^>]*>)\\s*<svg[\\s\\S]*?<\\/svg>`,
    );
    html = html.replace(
      pattern,
      `$1<svg data-template-icon="${label.toLowerCase()}"></svg>`,
    );
  }

  return html;
}

export function normalizeTemplateStructure(template) {
  return normalizeKnownIconVectors(template)
    .replace(/>\s+</g, '><')
    .trim();
}
