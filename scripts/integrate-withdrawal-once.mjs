import crypto from 'node:crypto';
import fs from 'node:fs';

const footerLink = '<li><a href="withdraw.html" class="text-sm text-text-secondary hover:text-mint transition-colors">Withdraw a purchase</a></li>';
const htmlFiles = fs.readdirSync('.').filter((name) => name.endsWith('.html'));

for (const path of [...htmlFiles, 'templates/product-page.html']) {
  let html = fs.readFileSync(path, 'utf8');
  if (!html.includes('href="withdraw.html"') && html.includes('>Returns</a></li>')) {
    html = html.replace('>Returns</a></li>', `>Returns</a></li>${footerLink}`);
  }
  fs.writeFileSync(path, html);
}

for (const path of ['shipping.html', 'returns.html', 'faq.html']) {
  let html = fs.readFileSync(path, 'utf8');
  html = html.replace(/\n\s*<button id="cart-btn"[\s\S]*?<\/button>/, '');
  html = html.replace(/\n\s*<div id="purchase-feedback"[\s\S]*?(?=\n\s*<script src="js\/componentry\.js"><\/script>)/, '\n');
  html = html.replace(/\n\s*<!-- FLOATING CTA -->[\s\S]*?<!-- WHATSAPP BUTTON -->[\s\S]*?<\/a>\n/, '\n');
  fs.writeFileSync(path, html);
}

let returns = fs.readFileSync('returns.html', 'utf8');
if (!returns.includes('id="online-withdrawal-cta"')) {
  returns = returns.replace(
    '<p class="section-subheading max-w-2xl">Your statutory rights for standard online purchases, plus the process for damaged, defective or personalised products.</p>',
    '<p class="section-subheading max-w-2xl">Your statutory rights for standard online purchases, plus the process for damaged, defective or personalised products.</p><div id="online-withdrawal-cta" class="mt-6"><a href="withdraw.html" class="btn-primary inline-flex">Withdraw from a purchase</a><p class="text-xs text-text-muted mt-3">You can use the online withdrawal function without creating an account.</p></div>',
  );
}
returns = returns.replace(
  'Use the contact form on the LegendMural website and include your order reference, your name and a clear statement that you are withdrawing from the purchase. You may also use the model withdrawal form below, but using that exact format is not required.',
  'You can use the clearly visible online withdrawal function on this website. You may also contact us through the website contact form or use the model withdrawal form below. You do not need to give a reason. The online function asks only for the Order ID and the email address used for the purchase so the order can be located.',
);
fs.writeFileSync('returns.html', returns);

let withdraw = fs.readFileSync('withdraw.html', 'utf8');
if (!withdraw.includes('rel="canonical"')) {
  withdraw = withdraw.replace(
    '<title>Withdraw a purchase — LegendMural</title>',
    '<title>Withdraw a purchase — LegendMural</title>\n  <link rel="canonical" href="https://alkavisuals.github.io/legend-stories-website/withdraw.html">',
  );
}
fs.writeFileSync('withdraw.html', withdraw);

let success = fs.readFileSync('order-success.html', 'utf8').replaceAll('Legend Stories', 'LegendMural');
if (!success.includes('id="order-id-block"')) {
  success = success.replace(
    '<p id="order-status-note" class="mt-4 text-sm text-text-muted">',
    '<div id="order-id-block" class="hidden mt-6 rounded-xl border border-surface-border/30 bg-void/40 p-4 text-left"><p class="text-xs uppercase tracking-wider text-text-muted mb-1">Order ID</p><p id="order-id-value" class="font-mono text-sm break-all text-text-primary"></p><p class="text-xs text-text-muted mt-2">Keep this Order ID with your payment records. It can be used with your order email for the online withdrawal function.</p></div><p id="order-status-note" class="mt-4 text-sm text-text-muted">',
  );
}
if (!success.includes('id="order-withdraw-link"')) {
  success = success.replace(
    '<a href="index.html#contact" class="inline-flex items-center justify-center rounded-xl border border-surface-border/50 px-6 py-3 font-semibold text-text-secondary hover:text-mint hover:border-mint/40 transition-colors">Contact support</a>',
    '<a id="order-withdraw-link" href="withdraw.html" class="hidden inline-flex items-center justify-center rounded-xl border border-surface-border/50 px-6 py-3 font-semibold text-text-secondary hover:text-mint hover:border-mint/40 transition-colors">Withdraw from purchase</a><a href="index.html#contact" class="inline-flex items-center justify-center rounded-xl border border-surface-border/50 px-6 py-3 font-semibold text-text-secondary hover:text-mint hover:border-mint/40 transition-colors">Contact support</a>',
  );
}
fs.writeFileSync('order-success.html', success);

fs.writeFileSync(
  'order-cancelled.html',
  fs.readFileSync('order-cancelled.html', 'utf8').replaceAll('Legend Stories', 'LegendMural'),
);

let returnJs = fs.readFileSync('js/order-return.js', 'utf8');
if (!returnJs.includes('orderIdBlock:')) {
  returnJs = returnJs.replace(
    "  note: document.getElementById('order-status-note'),",
    "  note: document.getElementById('order-status-note'),\n  orderIdBlock: document.getElementById('order-id-block'),\n  orderIdValue: document.getElementById('order-id-value'),\n  withdrawLink: document.getElementById('order-withdraw-link'),",
  );
}
if (!returnJs.includes('elements.orderIdValue.textContent = status.sessionId')) {
  returnJs = returnJs.replace(
    '  const copy = applyVerifiedOrderStatus(status, {',
    "  if (elements.orderIdValue) elements.orderIdValue.textContent = status.sessionId;\n  if (elements.orderIdBlock) elements.orderIdBlock.classList.remove('hidden');\n  if (elements.withdrawLink) {\n    elements.withdrawLink.href = `withdraw.html?order=${encodeURIComponent(status.sessionId)}`;\n    elements.withdrawLink.classList.remove('hidden');\n  }\n  const copy = applyVerifiedOrderStatus(status, {",
  );
}
fs.writeFileSync('js/order-return.js', returnJs);

const template = fs.readFileSync('templates/product-page.html', 'utf8');
const templateSha = crypto.createHash('sha256').update(template).digest('hex');
for (let batch = 1; batch <= 6; batch += 1) {
  const path = `data/products/2026-batch-${batch}-presentation.json`;
  const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
  manifest.template = { ...(manifest.template || {}), sha256: templateSha };
  fs.writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
