import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const SOURCE = join(ROOT, 'js');
const TARGET = join(ROOT, 'dist/js');

async function main() {
  await mkdir(TARGET, { recursive: true });
  await cp(SOURCE, TARGET, { recursive: true });
  console.log('Copied classic JavaScript and browser modules to dist/js/.');
}

main().catch((error) => {
  console.error('Failed to copy browser runtime files:', error);
  process.exit(1);
});
