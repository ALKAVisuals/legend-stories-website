import { readFile, writeFile } from 'node:fs/promises';

const replacements = [
  {
    path: 'privacy.html',
    pairs: [
      [
        '<p><strong class="text-text-primary">ALKA Group</strong>, trading through the LegendMural storefront, is the controller for the personal data described on this page.</p>',
        '<p><strong class="text-text-primary">Alka Group</strong>, trading through the LegendMural storefront, is the controller for the personal data described on this page. Alka Group is registered with the Dutch Chamber of Commerce under <strong class="text-text-primary">KvK 95153756</strong> at <strong class="text-text-primary">Schutkolk 4 d 1, 6582 DB Heumen, the Netherlands</strong>.</p>'
      ],
      [
        '<p>Full statutory company particulars will be published on the dedicated company-information surface before public launch.</p>',
        '<p>These company particulars identify the legal business responsible for LegendMural. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>'
      ]
    ]
  },
  {
    path: 'terms.html',
    pairs: [
      [
        '<p>These terms apply to consumer purchases made through the LegendMural storefront. The seller is <strong class="text-text-primary">ALKA Group</strong>, trading through LegendMural.</p>',
        '<p>These terms apply to consumer purchases made through the LegendMural storefront. The seller is <strong class="text-text-primary">Alka Group</strong>, trading through LegendMural. Alka Group is registered with the Dutch Chamber of Commerce under <strong class="text-text-primary">KvK 95153756</strong> at <strong class="text-text-primary">Schutkolk 4 d 1, 6582 DB Heumen, the Netherlands</strong>.</p>'
      ],
      [
        '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Full statutory company particulars will be published on the dedicated company-information surface before public launch.</p>',
        '<p>Customer-operations contact: <a class="text-mint hover:underline" href="mailto:info@alkavisuals.nl">info@alkavisuals.nl</a>. Additional statutory identifiers will be added only after they are independently confirmed for Alka Group.</p>'
      ]
    ]
  }
];

for (const entry of replacements) {
  let content = await readFile(entry.path, 'utf8');
  for (const [from, to] of entry.pairs) {
    if (!content.includes(from)) throw new Error(`${entry.path}: expected source text not found`);
    content = content.replace(from, to);
  }
  await writeFile(entry.path, content);
}

console.log('Applied confirmed Alka Group KvK and registered-address details to Privacy and Terms.');
