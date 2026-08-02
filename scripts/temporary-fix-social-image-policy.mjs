import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after, label) {
  const source = await readFile(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match in ${path}, found ${count}.`);
  }
  await writeFile(path, source.replace(before, after), 'utf8');
}

await replaceExact(
  'scripts/product-page-generation.mjs',
  '    ABSOLUTE_IMAGE: escapeHtml(absoluteImageUrl(product, browserImage)),',
  '    ABSOLUTE_IMAGE: escapeHtml(absoluteImageUrl(product)),',
  'Keep social metadata on the original product PNG',
);

await replaceExact(
  'scripts/validate-product-browser-derivatives.mjs',
  `    const sourceCount = countOccurrences(productHtml, sourcePath);\n    if (sourceCount !== 1) {\n      errors.push(\`${'${image.productPage}'}: expected exactly one original source reference in Product JSON-LD, found ${'${sourceCount}'}.\`);\n    }`,
  `    const structuredDataPattern = new RegExp(\`<script type="application\\\\/ld\\\\+json">[\\\\s\\\\S]*?"image":\\\\s*"[^"]*${'${escapeRegExp(sourcePath)}'}"[\\\\s\\\\S]*?<\\\\/script>\`, 'i');\n    if (!structuredDataPattern.test(productHtml)) {\n      errors.push(\`${'${image.productPage}'}: Product JSON-LD does not retain the original PNG source ${'${sourcePath}'}.\`);\n    }`,
  'Scope original source validation to Product JSON-LD',
);

await replaceExact(
  'scripts/validate-product-browser-derivatives.mjs',
  `    const socialPattern = new RegExp(\`<meta\\\\s+(?:property="og:image"|name="twitter:image")\\\\s+content="[^"]*${'${escapeRegExp(derivativePath)}'}"\`, 'gi');\n    const socialCount = [...productHtml.matchAll(socialPattern)].length;\n    if (socialCount !== 2) {\n      errors.push(\`${'${image.productPage}'}: expected two social image references to ${'${derivativePath}'}, found ${'${socialCount}'}.\`);\n    }`,
  `    const socialSourcePattern = new RegExp(\`<meta\\\\s+(?:property="og:image"|name="twitter:image")\\\\s+content="[^"]*${'${escapeRegExp(sourcePath)}'}"\`, 'gi');\n    const socialSourceCount = [...productHtml.matchAll(socialSourcePattern)].length;\n    if (socialSourceCount !== 2) {\n      errors.push(\`${'${image.productPage}'}: expected two social image references to original PNG ${'${sourcePath}'}, found ${'${socialSourceCount}'}.\`);\n    }\n    const socialDerivativePattern = new RegExp(\`<meta\\\\s+(?:property="og:image"|name="twitter:image")\\\\s+content="[^"]*${'${escapeRegExp(derivativePath)}'}"\`, 'gi');\n    const socialDerivativeCount = [...productHtml.matchAll(socialDerivativePattern)].length;\n    if (socialDerivativeCount !== 0) {\n      errors.push(\`${'${image.productPage}'}: social metadata must not use WebP derivative ${'${derivativePath}'}.\`);\n    }`,
  'Require crawler-safe original PNG social metadata',
);

await replaceExact(
  'scripts/validate-product-browser-derivatives.mjs',
  '- Browser-facing product heroes, cards, cart thumbnails, social previews and related products use reviewed WebP derivatives when available.',
  '- Browser-facing product heroes, cards, cart thumbnails and related products use reviewed WebP derivatives when available; Product JSON-LD and social previews retain the original PNG source for crawler compatibility.',
  'Document crawler-safe social image policy',
);

console.log('Applied guarded social image policy migration.');
