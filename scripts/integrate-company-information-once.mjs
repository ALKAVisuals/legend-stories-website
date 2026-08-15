import { readFile, writeFile } from 'node:fs/promises';

const link = '<li><a href="company.html" class="text-sm text-text-secondary hover:text-mint transition-colors">Company information</a></li>';
const files = [
  'index.html','shop.html','music-legends.html','sport-legends.html','combat-legends.html','wisdom-legends.html','about.html',
  'shipping.html','returns.html','faq.html','privacy.html','terms.html','templates/product-page.html'
];

for (const path of files) {
  let html = await readFile(path, 'utf8');
  if (html.includes('href="company.html"')) continue;

  const aboutPattern = /(<li><a href="about\.html"[^>]*>About<\/a><\/li>)/;
  const privacyPattern = /(<li><a href="privacy\.html"[^>]*>Privacy<\/a><\/li>)/;
  if (aboutPattern.test(html)) html = html.replace(aboutPattern, `$1${link}`);
  else if (privacyPattern.test(html)) html = html.replace(privacyPattern, `${link}$1`);
  else throw new Error(`${path}: no safe footer insertion point found`);
  await writeFile(path, html);
}

let privacy = await readFile('privacy.html', 'utf8');
privacy = privacy.replace(
  '<p>These company particulars identify the legal business responsible for LegendMural. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>',
  '<p>Full seller and statutory contact details, including VAT and telephone information, are available on the <a class="text-mint hover:underline" href="company.html">Company Information page</a>.</p>'
);
await writeFile('privacy.html', privacy);

let terms = await readFile('terms.html', 'utf8');
terms = terms.replace(
  '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>',
  '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Full seller, VAT, telephone and registered-address details are available on the <a class="text-mint hover:underline" href="company.html">Company Information page</a>.</p>'
);
await writeFile('terms.html', terms);

let returns = await readFile('returns.html', 'utf8');
returns = returns.replace(
  '<p>To: LegendMural (submit through the website contact form)</p>',
  '<p>To: Alka Group, trading through LegendMural — KvK 95153756 — Schutkolk 4 d 1, 6582 DB Heumen, the Netherlands — info@alkavisuals.nl</p><p class="text-xs text-text-muted">This address may be used to identify the seller and send a withdrawal notice. Do not send a parcel there unless the return instructions for your order specifically designate it as the parcel-return address.</p>'
);
await writeFile('returns.html', returns);

let company = await readFile('company.html', 'utf8');
company = company.replaceAll(' data-hide-on-error', '');
await writeFile('company.html', company);

console.log('Integrated Company Information links and confirmed seller details without designating a parcel return address.');
