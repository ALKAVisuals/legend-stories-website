import { readFile, writeFile } from 'node:fs/promises';

const link = '<li><a href="company.html" class="text-sm text-text-secondary hover:text-mint transition-colors">Company information</a></li>';
const storefrontFiles = [
  'index.html',
  'shop.html',
  'music-legends.html',
  'sport-legends.html',
  'combat-legends.html',
  'wisdom-legends.html',
  'about.html',
  'templates/product-page.html',
];

for (const path of storefrontFiles) {
  let html = await readFile(path, 'utf8');
  if (html.includes('href="company.html"')) continue;

  const aboutPattern = /(<li><a href="about\.html"[^>]*>About<\/a><\/li>)/;
  const privacyPattern = /(<li><a href="privacy\.html"[^>]*>Privacy<\/a><\/li>)/;
  if (aboutPattern.test(html)) html = html.replace(aboutPattern, `$1${link}`);
  else if (privacyPattern.test(html)) html = html.replace(privacyPattern, `${link}$1`);
  else throw new Error(`${path}: no safe storefront footer insertion point found`);
  await writeFile(path, html);
}

let privacy = await readFile('privacy.html', 'utf8');
const privacyOld = '<p>These company particulars identify the legal business responsible for LegendMural. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>';
const privacyNew = '<p>Full seller and statutory contact details, including VAT and telephone information, are available on the <a class="text-mint hover:underline" href="company.html">Company Information page</a>.</p>';
if (!privacy.includes(privacyOld) && !privacy.includes(privacyNew)) throw new Error('privacy.html: expected company-detail text not found');
privacy = privacy.replace(privacyOld, privacyNew);
await writeFile('privacy.html', privacy);

let terms = await readFile('terms.html', 'utf8');
const termsOld = '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>';
const termsNew = '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Full seller, VAT, telephone and registered-address details are available on the <a class="text-mint hover:underline" href="company.html">Company Information page</a>.</p>';
if (!terms.includes(termsOld) && !terms.includes(termsNew)) throw new Error('terms.html: expected company-detail text not found');
terms = terms.replace(termsOld, termsNew);
await writeFile('terms.html', terms);

let returns = await readFile('returns.html', 'utf8');
const returnOld = '<p>To: LegendMural (submit through the website contact form)</p>';
const returnNew = '<p>To: Alka Group, trading through LegendMural — KvK 95153756 — Schutkolk 4 d 1, 6582 DB Heumen, the Netherlands — info@alkavisuals.nl</p><p class="text-xs text-text-muted">This address may be used to identify the seller and send a withdrawal notice. Do not send a parcel there unless the return instructions for your order specifically designate it as the parcel-return address.</p>';
if (!returns.includes(returnOld) && !returns.includes(returnNew)) throw new Error('returns.html: expected model withdrawal recipient text not found');
returns = returns.replace(returnOld, returnNew);
await writeFile('returns.html', returns);

let company = await readFile('company.html', 'utf8');
company = company.replaceAll(' data-hide-on-error', '');
await writeFile('company.html', company);

console.log('Integrated Company Information into storefront footers and legal content without designating a parcel return address.');
