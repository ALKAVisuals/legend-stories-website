import { appendFile, readFile, writeFile } from 'node:fs/promises';

const cssPath = 'css/skipper.css';
const testPath = 'tests/portfolio-mobile-layout.test.mjs';
const marker = '/* Mobile portfolio gallery containment */';

const mobileCss = `

${marker}
@media (max-width: 767px) {
  .skp-hover-expand {
    justify-content: flex-start;
    gap: 0.875rem;
    width: 100%;
    max-width: 100%;
    padding: 0 0 0.75rem;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    scroll-padding-inline: 0.25rem;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .skp-hover-expand::-webkit-scrollbar {
    display: none;
  }

  .skp-hover-expand__item,
  .skp-hover-expand__item--default,
  .skp-hover-expand__item--active,
  .skp-hover-expand__item:hover,
  .skp-hover-expand__item:hover ~ .skp-hover-expand__item {
    width: min(82vw, 22rem);
    height: auto;
    flex: 0 0 min(82vw, 22rem);
    aspect-ratio: 4 / 5;
    border-radius: 20px;
    scroll-snap-align: start;
  }

  .skp-hover-expand__overlay {
    opacity: 1;
  }

  .skp-hover-expand__label {
    opacity: 1;
    color: rgba(255, 255, 255, 0.9);
  }
}
`;

const css = await readFile(cssPath, 'utf8');
if (!css.includes(marker)) {
  await appendFile(cssPath, mobileCss, 'utf8');
}

const testSource = `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../css/skipper.css', import.meta.url), 'utf8');
const mobileBlock = css.match(/\/\* Mobile portfolio gallery containment \*\/[\\s\\S]*$/)?.[0] || '';

test('mobile portfolio gallery stays inside the viewport and remains swipeable', () => {
  assert.match(mobileBlock, /@media \\(max-width: 767px\\)/);
  assert.match(mobileBlock, /overflow-x:\\s*auto/);
  assert.match(mobileBlock, /max-width:\\s*100%/);
  assert.match(mobileBlock, /scroll-snap-type:\\s*x mandatory/);
  assert.match(mobileBlock, /flex:\\s*0 0 min\\(82vw, 22rem\\)/);
  assert.match(mobileBlock, /aspect-ratio:\\s*4 \\/ 5/);
});

test('touch layouts do not retain the fixed desktop card widths', () => {
  assert.match(mobileBlock, /\\.skp-hover-expand__item--active/);
  assert.match(mobileBlock, /\\.skp-hover-expand__item--default/);
  assert.match(mobileBlock, /width:\\s*min\\(82vw, 22rem\\)/);
  assert.match(mobileBlock, /\\.skp-hover-expand__label[\\s\\S]*opacity:\\s*1/);
});
`;

await writeFile(testPath, testSource, 'utf8');
