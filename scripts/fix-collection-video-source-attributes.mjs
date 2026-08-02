import { readFile, writeFile } from 'node:fs/promises';

const pages = [
  'combat-legends.html',
  'music-legends.html',
  'sport-legends.html',
  'wisdom-legends.html',
];

for (const page of pages) {
  const url = new URL(`../${page}`, import.meta.url);
  const source = await readFile(url, 'utf8');
  const malformed = [...source.matchAll(/\sdata-(?:data-)+src=/gi)];

  if (malformed.length === 0) {
    const valid = [...source.matchAll(/\sdata-src=["'][^"']+["']/gi)];
    if (valid.length !== 1) {
      throw new Error(`${page}: expected one valid data-src attribute, found ${valid.length}.`);
    }
    console.log(`${page}: source attribute already valid.`);
    continue;
  }

  if (malformed.length !== 1) {
    throw new Error(`${page}: expected one malformed deferred source attribute, found ${malformed.length}.`);
  }

  const repaired = source.replace(/\sdata-(?:data-)+src=/i, ' data-src=');
  const valid = [...repaired.matchAll(/\sdata-src=["'][^"']+["']/gi)];
  const remainingMalformed = [...repaired.matchAll(/\sdata-(?:data-)+src=/gi)];
  if (valid.length !== 1 || remainingMalformed.length !== 0) {
    throw new Error(`${page}: deferred source repair did not produce exactly one valid data-src attribute.`);
  }

  await writeFile(url, repaired, 'utf8');
  console.log(`${page}: repaired deferred video source attribute.`);
}
