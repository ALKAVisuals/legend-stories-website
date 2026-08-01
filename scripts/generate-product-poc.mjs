import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DATA_FILE = join(ROOT, 'data/products/2026-batch-3-poc.json');
const TEMPLATE_FILE = join(ROOT, 'templates/product-poc.html');
const OUTPUT_DIR = join(ROOT, 'generated/product-poc');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render(template, product) {
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    image: product.image,
    description: product.description,
    brand: { '@type': 'Brand', name: 'Legend Stories' },
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: product.currency,
      availability: 'https://schema.org/InStock',
      url: product.page
    }
  });

  const values = {
    ...product,
    priceFormatted: product.price.toFixed(2).replace('.', ','),
    structuredData
  };

  return template.replace(/{{([a-zA-Z]+)}}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return key === 'structuredData' ? values[key] : escapeHtml(values[key]);
  });
}

async function main() {
  const { products } = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  const template = await readFile(TEMPLATE_FILE, 'utf8');
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const product of products) {
    const output = render(template, product);
    await writeFile(join(OUTPUT_DIR, product.page), output, 'utf8');
  }

  console.log(`Generated ${products.length} product proof-of-concept pages in generated/product-poc/.`);
}

main().catch((error) => {
  console.error('Product proof-of-concept generation failed:', error);
  process.exit(1);
});
