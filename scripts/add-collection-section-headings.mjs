import { readFile, writeFile } from 'node:fs/promises';

const TARGETS = [
  {
    file: 'combat-legends.html',
    anchor: '    <section class="py-12 md:py-16" aria-label="Combat Legends Products">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    replacement: '    <section class="py-12 md:py-16" aria-labelledby="combat-products-heading">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n        <h2 id="combat-products-heading" class="sr-only">Combat Legends mural designs</h2>',
  },
  {
    file: 'music-legends.html',
    anchor: '    <section class="py-12 md:py-16" aria-label="Music Legends Products">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    replacement: '    <section class="py-12 md:py-16" aria-labelledby="music-products-heading">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n        <h2 id="music-products-heading" class="sr-only">Music Legends mural designs</h2>',
  },
  {
    file: 'sport-legends.html',
    anchor: '    <section class="py-12 md:py-16" aria-label="Sport Legends Products">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    replacement: '    <section class="py-12 md:py-16" aria-labelledby="sport-products-heading">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n        <h2 id="sport-products-heading" class="sr-only">Sport Legends mural designs</h2>',
  },
  {
    file: 'wisdom-legends.html',
    anchor: '    <section class="py-12 md:py-16" aria-label="Wisdom Legends Products">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    replacement: '    <section class="py-12 md:py-16" aria-labelledby="wisdom-products-heading">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n        <h2 id="wisdom-products-heading" class="sr-only">Wisdom Legends mural designs</h2>',
  },
  {
    file: 'shop.html',
    anchor: '    <section class="py-12 md:py-16" aria-label="Products">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">',
    replacement: '    <section class="py-12 md:py-16" aria-labelledby="all-products-heading">\n      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">\n        <h2 id="all-products-heading" class="sr-only">All mural designs</h2>',
  },
];

async function main() {
  for (const target of TARGETS) {
    const html = await readFile(target.file, 'utf8');
    const occurrences = html.split(target.anchor).length - 1;
    if (occurrences !== 1) {
      throw new Error(`${target.file}: expected one product section anchor, found ${occurrences}`);
    }
    if (/id=["'](?:combat|music|sport|wisdom|all)-products-heading["']/.test(html)) {
      throw new Error(`${target.file}: product section heading already exists`);
    }
    await writeFile(target.file, html.replace(target.anchor, target.replacement), 'utf8');
  }

  console.log(`Added semantic product-section headings to ${TARGETS.length} collection and shop pages.`);
}

main().catch((error) => {
  console.error('Collection section heading migration failed:', error);
  process.exit(1);
});
