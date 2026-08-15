import fs from 'node:fs';

const address = 'Schutkolk 4 d 1, 6582 DB Heumen, the Netherlands';

function replaceOnce(path, from, to) {
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(from)) throw new Error(`${path}: expected source text not found`);
  const after = before.replace(from, to);
  if (after === before) throw new Error(`${path}: replacement produced no change`);
  fs.writeFileSync(path, after);
}

replaceOnce(
  'returns.html',
  '<p>For a change-of-mind withdrawal, you pay the direct cost of returning goods when we have informed you of that obligation before purchase. You may inspect the product as you reasonably would in a shop. If you handle it more than necessary to establish its nature, characteristics and functioning, you may be responsible for any resulting reduction in value.</p>',
  `<p>For a change-of-mind withdrawal, you pay the direct cost of returning goods when we have informed you of that obligation before purchase. You may inspect the product as you reasonably would in a shop. If you handle it more than necessary to establish its nature, characteristics and functioning, you may be responsible for any resulting reduction in value.</p><p><strong class="text-text-primary">Parcel-return address:</strong> Alka Group / LegendMural, ${address}. Include the LegendMural Order ID with the return so the parcel can be matched to the correct purchase.</p>`
);

replaceOnce(
  'returns.html',
  '<p class="text-xs text-text-muted">This address may be used to identify the seller and send a withdrawal notice. Do not send a parcel there unless the return instructions for your order specifically designate it as the parcel-return address.</p>',
  `<p class="text-xs text-text-muted">This is also the LegendMural parcel-return address. Include the Order ID with any returned parcel. Registering a withdrawal remains separate from the physical return and does not automatically trigger a PayPal refund.</p>`
);

replaceOnce(
  'company.html',
  '<dt class="text-text-muted">Registered address</dt><dd class="text-text-secondary">Schutkolk 4 d 1<br>6582 DB Heumen<br>The Netherlands</dd>',
  '<dt class="text-text-muted">Registered address</dt><dd class="text-text-secondary">Schutkolk 4 d 1<br>6582 DB Heumen<br>The Netherlands</dd>\n            <dt class="text-text-muted">Parcel-return address</dt><dd class="text-text-secondary">Schutkolk 4 d 1<br>6582 DB Heumen<br>The Netherlands</dd>'
);

replaceOnce(
  'company.html',
  'The registered address above identifies the legal business. For a physical product return, follow the instructions on the <a class="text-mint hover:underline" href="returns.html">Returns page</a> or the instructions provided for your specific return. Do not assume that a statutory registered address is automatically the parcel-return destination.',
  'The registered Heumen address is also the LegendMural parcel-return address. Before sending a return, follow the process on the <a class="text-mint hover:underline" href="returns.html">Returns page</a> and include the Order ID so the parcel can be matched to the correct purchase.'
);

console.log(`Return address integrated: ${address}`);
