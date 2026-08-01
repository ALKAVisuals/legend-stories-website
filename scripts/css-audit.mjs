import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CSS_DIR = join(ROOT, 'css');
const REPORT_DIR = join(ROOT, 'reports');

function selectors(css) {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const result = [];
  const pattern = /(^|})\s*([^@}{][^{]+)\{/g;
  let match;
  while ((match = pattern.exec(cleaned))) {
    for (const selector of match[2].trim().split(',')) {
      const normalized = selector.replace(/\s+/g, ' ').trim();
      if (normalized) result.push(normalized);
    }
  }
  return result;
}

const files = (await readdir(CSS_DIR)).filter((file) => file.endsWith('.css')).sort();
const occurrences = new Map();
const summary = [];
for (const file of files) {
  const path = join(CSS_DIR, file);
  const css = await readFile(path, 'utf8');
  const found = selectors(css);
  summary.push({ file: relative(ROOT, path), count: found.length, bytes: Buffer.byteLength(css) });
  for (const selector of found) {
    const locations = occurrences.get(selector) || [];
    locations.push(relative(ROOT, path));
    occurrences.set(selector, locations);
  }
}
const duplicates = [...occurrences.entries()].filter(([, locations]) => locations.length > 1).sort((a,b) => b[1].length-a[1].length || a[0].localeCompare(b[0]));
const report = ['# CSS Audit','',`Stylesheets scanned: ${files.length}`,`Repeated selectors: ${duplicates.length}`,'','## Stylesheets','','| File | Selectors | Size (KB) |','|---|---:|---:|',...summary.map((item)=>`| ${item.file} | ${item.count} | ${(item.bytes/1024).toFixed(2)} |`),'','## Repeated selectors','',...duplicates.slice(0,200).flatMap(([selector,locations])=>[`### \`${selector.replaceAll('`','\\`')}\``,'',...locations.map((location)=>`- ${location}`),''])].join('\n');
await mkdir(REPORT_DIR,{recursive:true});
await writeFile(join(REPORT_DIR,'css-audit.md'),`${report}\n`,'utf8');
console.log(`CSS audit completed: ${duplicates.length} repeated selectors.`);
