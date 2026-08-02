import { readFile, writeFile } from 'node:fs/promises';

const path = 'css/shared.css';
const marker = '/* ACCESSIBILITY CONTRACT — dialogs and screen-reader-only content */';
const block = `

${marker}
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

#purchase-feedback {
  left: 50%;
  transform: translateX(-50%);
  z-index: 80;
  width: calc(100% - 2rem);
  max-width: 24rem;
}

#purchase-feedback[role="status"] {
  border-color: rgba(42, 138, 74, 0.45);
  color: var(--color-mint);
}

#purchase-feedback[role="alert"] {
  border-color: rgba(248, 113, 113, 0.55);
  color: #fca5a5;
}
`;

async function main() {
  const css = await readFile(path, 'utf8');
  if (css.includes(marker)) {
    throw new Error('Accessibility styles already exist; refusing to append a duplicate block.');
  }
  await writeFile(path, `${css.trimEnd()}${block}\n`, 'utf8');
  console.log('Appended the shared accessibility style contract.');
}

main().catch((error) => {
  console.error('Accessibility style migration failed:', error);
  process.exit(1);
});
