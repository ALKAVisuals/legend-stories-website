import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const checkoutFields = [
  ['checkout-firstname', 'given-name'],
  ['checkout-lastname', 'family-name'],
  ['checkout-email', 'email'],
  ['checkout-street', 'street-address'],
  ['checkout-zip', 'postal-code'],
  ['checkout-city', 'address-level2'],
  ['checkout-country', 'country'],
];
const errors = [];
const htmlFiles = (await readdir(ROOT))
  .filter((file) => file.endsWith('.html'))
  .sort();
const checkoutPages = [];

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function openingTag(html, id) {
  const pattern = new RegExp(`<(?:input|select)\\b[^>]*\\bid=["']${escapePattern(id)}["'][^>]*>`, 'i');
  return html.match(pattern)?.[0] || '';
}

function attribute(tag, name) {
  const pattern = new RegExp(`\\b${escapePattern(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

for (const file of htmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  if (/\bon[a-z]+\s*=/i.test(html)) {
    errors.push(`${file}: inline event handler remains`);
  }
  if (!html.includes('id="checkout-firstname"')) continue;
  checkoutPages.push(file);

  for (const [id, expectedAutocomplete] of checkoutFields) {
    const tag = openingTag(html, id);
    if (!tag) {
      errors.push(`${file}: ${id} control is missing`);
      continue;
    }
    const labelPattern = new RegExp(`<label\\b[^>]*\\bfor=["']${escapePattern(id)}["'][^>]*>`, 'i');
    if (!labelPattern.test(html)) errors.push(`${file}: ${id} has no associated label`);
    const autocomplete = attribute(tag, 'autocomplete').toLowerCase();
    if (autocomplete !== expectedAutocomplete) {
      errors.push(`${file}: ${id} autocomplete is "${autocomplete || 'missing'}", expected "${expectedAutocomplete}"`);
    }
  }

  const footerLogoPattern = /<a\b[^>]*\bhref=["']index\.html["'][^>]*\bclass=["'][^"']*\blogo-wrap\b[^"']*["'][^>]*\baria-label=["']LegendMural Home["'][^>]*>\s*<img[^>]*lm-logo-transparant\.png/i;
  if (!footerLogoPattern.test(html)) errors.push(`${file}: footer logo link is unnamed`);
}

if (checkoutPages.length !== 118) {
  errors.push(`Expected 118 checkout surfaces, found ${checkoutPages.length}`);
}

const discountPages = [];
for (const file of checkoutPages) {
  const html = await readFile(join(ROOT, file), 'utf8');
  if (!html.includes('id="checkout-discount"')) continue;
  discountPages.push(file);
  if (!/<label\b[^>]*\bfor=["']checkout-discount["'][^>]*>/i.test(html)) {
    errors.push(`${file}: checkout discount field has no associated label`);
  }
}
if (discountPages.length !== 6) {
  errors.push(`Expected 6 checkout discount fields, found ${discountPages.length}`);
}

const index = await readFile(join(ROOT, 'index.html'), 'utf8');
if (!/<label\b[^>]*\bfor=["']cart-discount["'][^>]*>/i.test(index)) {
  errors.push('index.html: cart discount field has no associated label');
}
if (!/<input\b[^>]*\bid=["']email["'][^>]*\bautocomplete=["']email["'][^>]*>/i.test(index)) {
  errors.push('index.html: email field is missing autocomplete="email"');
}
if (!/<a\b[^>]*href=["']music-truth-seeker\.html["'][^>]*aria-label=["']View The Truth Seeker product["']/i.test(index)) {
  errors.push('index.html: featured product link has no accessible name');
}
if (/\btestimonial-dot\b/i.test(index)) {
  errors.push('index.html: removed testimonial controls unexpectedly returned');
}
if (!/<button\b[^>]*class=["'][^"']*add-to-cart-btn[^"']*["'][^>]*data-page=["']combat-grind-cycle\.html["'][^>]*data-name=["']The Grind Cycle["']/i.test(index)) {
  errors.push('index.html: cart upsell is not a native add-to-cart button');
}

if (errors.length) {
  console.error('Shared form semantics validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Shared form semantics validation passed for ${checkoutPages.length} checkout surfaces with zero inline handlers.`);
