import {
  escapeHtml,
  extractProductPresentation,
  formatEuro,
  renderProductPage,
  templatizeProductPage as templatizeBaseProductPage,
  templateHash,
} from './product-page-generation.mjs';

export {
  escapeHtml,
  extractProductPresentation,
  formatEuro,
  renderProductPage,
  templateHash,
};

export function templatizeProductPage(input) {
  const template = templatizeBaseProductPage(input);
  const pattern = /More from <span class="text-gradient-mint">[^<]+<\/span>/;
  if (!pattern.test(template)) {
    throw new Error('related collection heading: required markup was not found.');
  }
  return template.replace(
    pattern,
    'More from <span class="text-gradient-mint">{{COLLECTION}}</span>',
  );
}
