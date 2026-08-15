import fs from 'node:fs';
import crypto from 'node:crypto';

const rootHtml = fs.readdirSync('.').filter((name) => name.endsWith('.html'));
const footerTargets = [...rootHtml, 'templates/product-page.html'];

function updateFooterLinks(html) {
  return html
    .replace(/href="#"([^>]*>Shipping<\/a>)/g, 'href="shipping.html"$1')
    .replace(/href="#"([^>]*>Returns<\/a>)/g, 'href="returns.html"$1')
    .replace(/href="#"([^>]*>FAQ<\/a>)/g, 'href="faq.html"$1');
}

for (const path of footerTargets) {
  let html = fs.readFileSync(path, 'utf8');
  html = updateFooterLinks(html);
  fs.writeFileSync(path, html);
}

let shell = fs.readFileSync('about.html', 'utf8');
shell = updateFooterLinks(shell);
shell = shell
  .replaceAll('text-sm text-mint font-medium">About</a>', 'text-sm text-text-secondary hover:text-mint transition-colors font-medium">About</a>')
  .replaceAll('text-sm text-mint font-medium py-2">About</a>', 'text-sm text-text-secondary hover:text-mint transition-colors font-medium py-2">About</a>');

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function makePage({ file, title, description, heading, intro, sections }) {
  let html = shell;
  html = replaceRequired(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`, `${file} meta description`);
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/, `<title>${title} — LegendMural</title>`, `${file} title`);
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title} — LegendMural">`, `${file} og title`);
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`, `${file} og description`);
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="https://alkavisuals.github.io/legend-stories-website/${file}">`, `${file} og url`);
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="https://alkavisuals.github.io/legend-stories-website/${file}">`, `${file} canonical`);

  const sectionHtml = sections.map(({ title: sectionTitle, body }) => `
          <section class="rounded-2xl border border-surface-border/30 bg-surface/30 p-6 md:p-8">
            <h2 class="font-display text-xl md:text-2xl font-bold mb-3">${sectionTitle}</h2>
            <div class="text-text-secondary text-sm md:text-base leading-relaxed space-y-3">${body}</div>
          </section>`).join('\n');

  const main = `<main>
    <section class="py-16 md:py-24 border-b border-surface-border/20" aria-labelledby="page-heading">
      <div class="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8">
        <p class="text-mint text-xs font-semibold uppercase tracking-widest mb-3">Customer information</p>
        <h1 id="page-heading" class="section-heading mb-4">${heading}</h1>
        <p class="section-subheading max-w-2xl">${intro}</p>
      </div>
    </section>
    <section class="py-12 md:py-16">
      <div class="max-w-4xl mx-auto px-5 sm:px-6 lg:px-8 space-y-6">
${sectionHtml}
        <p class="text-xs text-text-muted">Last updated: 15 August 2026. This page describes the current LegendMural launch configuration and does not limit statutory consumer rights.</p>
      </div>
    </section>
  </main>`;
  html = replaceRequired(html, /<main>[\s\S]*?<\/main>/, main, `${file} main`);
  fs.writeFileSync(file, html);
}

makePage({
  file: 'shipping.html',
  title: 'Shipping',
  description: 'LegendMural shipping destinations, rates and delivery information for the Netherlands, EU and United States.',
  heading: 'Shipping',
  intro: 'Clear launch shipping rates, supported destinations and what happens after you place an order.',
  sections: [
    { title: 'Where we ship', body: '<p>LegendMural currently accepts delivery addresses in the Netherlands, supported EU destinations and the United States. Destinations outside these markets are blocked at checkout.</p>' },
    { title: 'Shipping rates', body: '<ul class="list-disc pl-5 space-y-2"><li><strong class="text-text-primary">Netherlands:</strong> €4.95</li><li><strong class="text-text-primary">EU:</strong> €9.95</li><li><strong class="text-text-primary">United States:</strong> €9.95 tracked shipping</li></ul><p>Shipping is free when the order subtotal after discounts is €69 or more.</p>' },
    { title: 'Delivery timing', body: '<p>We do not currently advertise a fixed delivery estimate. Orders are prepared and shipped from the Netherlands. Unless a different delivery time is agreed with you, consumer orders are delivered without undue delay and no later than 30 days after the order is concluded, as required by applicable consumer law.</p><p>If an order cannot be delivered within the applicable period, your statutory rights regarding late delivery remain unaffected.</p>' },
    { title: 'Transit risk and damaged parcels', body: '<p>When LegendMural arranges the carrier, we remain responsible for the goods until they are delivered to you. If a parcel arrives damaged or the contents are defective, contact us through the website contact form with your order reference and, where useful, photos of the packaging and product.</p>' },
    { title: 'United States import charges', body: '<p>The current checkout charges the product price and LegendMural shipping fee; it does not calculate destination-specific import duties or customs charges. If local authorities or a carrier impose import charges, those charges may be collected separately under the rules that apply to the destination.</p>' },
  ],
});

makePage({
  file: 'returns.html',
  title: 'Returns & Withdrawal',
  description: 'LegendMural returns, 14-day withdrawal rights, refunds, personalised orders and defective-product information.',
  heading: 'Returns & Withdrawal',
  intro: 'Your statutory rights for standard online purchases, plus the process for damaged, defective or personalised products.',
  sections: [
    { title: '14-day right of withdrawal', body: '<p>For standard catalogue products bought online by consumers, you generally have 14 days to withdraw from the purchase without giving a reason. The withdrawal period starts on the day after you receive the goods.</p><p>Tell us within that 14-day period that you want to withdraw. You then have another 14 days to send the goods back.</p>' },
    { title: 'How to notify us', body: '<p>Use the contact form on the LegendMural website and include your order reference, your name and a clear statement that you are withdrawing from the purchase. You may also use the model withdrawal form below, but using that exact format is not required.</p>' },
    { title: 'Return shipping and condition', body: '<p>For a change-of-mind withdrawal, you pay the direct cost of returning goods when we have informed you of that obligation before purchase. You may inspect the product as you reasonably would in a shop. If you handle it more than necessary to establish its nature, characteristics and functioning, you may be responsible for any resulting reduction in value.</p>' },
    { title: 'Refunds', body: '<p>After a valid withdrawal, we refund the payments that must be reimbursed by law, including the standard outbound delivery charge for a full-order withdrawal where applicable. We make the refund within 14 days after receiving your withdrawal notice, but we may wait until we receive the goods back or you provide evidence that you returned them, whichever happens first.</p>' },
    { title: 'Personalised and custom murals', body: '<p>The statutory withdrawal right may not apply to products made to your specifications or clearly personalised for you. This exception is not applied merely because an item belongs to the normal LegendMural catalogue. If a custom order qualifies for the legal personalised-goods exception, we will make that clear before the order is placed.</p>' },
    { title: 'Defective or damaged products', body: '<p>Your withdrawal rights are separate from your legal rights when a product is defective, damaged or does not match what was promised. Statutory conformity and guarantee rights remain fully applicable. Contact us through the website contact form so we can assess the appropriate repair, replacement, price reduction or refund remedy under applicable law.</p>' },
    { title: 'Model withdrawal form', body: '<div class="rounded-xl bg-void/40 border border-surface-border/20 p-4 space-y-2"><p>To: LegendMural (submit through the website contact form)</p><p>I/We hereby give notice that I/We withdraw from my/our contract of sale for the following goods:</p><p>Order reference: ____________________</p><p>Ordered on / received on: ____________________</p><p>Name of consumer(s): ____________________</p><p>Address of consumer(s): ____________________</p><p>Date: ____________________</p></div>' },
  ],
});

makePage({
  file: 'faq.html',
  title: 'FAQ',
  description: 'Frequently asked questions about LegendMural sizes, pricing, shipping, payment, returns, custom murals and wall stickers.',
  heading: 'Frequently Asked Questions',
  intro: 'The practical details behind ordering, receiving and using a LegendMural wall sticker.',
  sections: [
    { title: 'What sizes are available?', body: '<p><strong class="text-text-primary">Compact</strong> is 30 cm on the longest side and costs €35 including VAT. <strong class="text-text-primary">Statement</strong> is 45 cm on the longest side and costs €45 including VAT. The artwork keeps its original proportions, so the other dimension depends on the design.</p>' },
    { title: 'Which size is the default?', body: '<p>Statement (45 cm) is the default and recommended launch variant. You can choose Compact or Statement on the product page before adding the product to your cart.</p>' },
    { title: 'What material do you use?', body: '<p>LegendMural products are printed as matte vinyl wall stickers. The matte finish is intended to reduce glare and create a clean wall-art appearance.</p>' },
    { title: 'Where do you ship and what does it cost?', body: '<p>Netherlands shipping is €4.95. EU shipping is €9.95. United States shipping is €9.95 tracked. Shipping is free from €69 after discounts. See the Shipping page for the full current policy.</p>' },
    { title: 'How can I pay?', body: '<p>The launch checkout uses PayPal. The final amount is calculated server-side from the current product, discount and shipping rules before you are redirected to PayPal.</p>' },
    { title: 'Does LEGEND10 work?', body: '<p>Yes. The public launch code <strong class="text-text-primary">LEGEND10</strong> applies a 10% discount. The €69 free-shipping threshold is evaluated after the discount is applied.</p>' },
    { title: 'Can I return an order?', body: '<p>Standard catalogue purchases generally have a 14-day statutory withdrawal period for consumers. Different rules can apply to products made to your specifications or clearly personalised. See Returns & Withdrawal for the complete process and your rights.</p>' },
    { title: 'What if my order is damaged or defective?', body: '<p>Contact us through the website contact form with your order reference. Your statutory rights for defective or non-conforming goods are separate from the change-of-mind return process and remain unaffected.</p>' },
    { title: 'Can I request a custom mural?', body: '<p>Yes. Use the Custom mural or contact option on the website to discuss the request. If the final product will be made to your specifications or clearly personalised, any effect on the statutory withdrawal right must be explained before you place that custom order.</p>' },
  ],
});

const template = fs.readFileSync('templates/product-page.html', 'utf8');
const templateSha = crypto.createHash('sha256').update(template).digest('hex');
for (let batch = 1; batch <= 6; batch += 1) {
  const path = `data/products/2026-batch-${batch}-presentation.json`;
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  manifest.template = { ...(manifest.template || {}), sha256: templateSha };
  fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
