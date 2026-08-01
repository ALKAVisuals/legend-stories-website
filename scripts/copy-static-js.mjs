import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'js');
const TARGET = join(ROOT, 'dist/js');

async function main() {
  await mkdir(TARGET, { recursive: true });
  await cp(SOURCE, TARGET, {
    recursive: true,
    filter: (source) => !source.endsWith('.mjs')
  });
  console.log('Copied classic JavaScript runtime files to dist/js/.');
}

main().catch((error) => {
  console.error('Failed to copy classic JavaScript runtime files:', error);
  process.exit(1);
});
