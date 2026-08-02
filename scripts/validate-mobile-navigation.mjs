import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = process.cwd();
const errors = [];

function count(source, needle) {
  return source.split(needle).length - 1;
}

const [appSource, moduleSource, packageSource] = await Promise.all([
  readFile(join(ROOT, 'js/app.js'), 'utf8'),
  readFile(join(ROOT, 'js/mobile-navigation.mjs'), 'utf8'),
  readFile(join(ROOT, 'package.json'), 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

if (count(appSource, "import('./mobile-navigation.mjs')") !== 1) {
  errors.push('js/app.js must load the mobile navigation module exactly once.');
}
if (!appSource.includes('createMobileNavigationController({')) {
  errors.push('js/app.js must initialize the shared mobile navigation controller.');
}
if (appSource.includes('mobileMenuOpen:')) {
  errors.push('js/app.js must not keep a second mobile-menu open state.');
}
if (/function\s+(?:toggleMobileMenu|closeMobileMenu)\s*\(/.test(appSource)) {
  errors.push('Legacy mobile-menu toggle functions must be removed from js/app.js.');
}
if (/mobileMenu\.style\.display/.test(appSource)) {
  errors.push('js/app.js must not directly toggle mobile-menu display styles.');
}

const requiredModuleSignals = [
  "setAttribute(button, 'aria-controls', menuId)",
  "setAttribute(button, 'aria-expanded'",
  "setAttribute(menu, 'aria-hidden'",
  "event?.key !== 'Escape'",
  'restoreFocus: true',
  "documentRef.addEventListener('click'",
  "windowRef.addEventListener('resize'",
  "event?.target?.closest?.('a[href]')",
  'Number(windowRef.innerWidth) >= Number(breakpoint)',
];
for (const signal of requiredModuleSignals) {
  if (!moduleSource.includes(signal)) {
    errors.push(`js/mobile-navigation.mjs is missing required behavior: ${signal}`);
  }
}

if (packageJson.scripts?.['validate:mobile-navigation'] !== 'node scripts/validate-mobile-navigation.mjs') {
  errors.push('package.json must expose validate:mobile-navigation.');
}
if (!packageJson.scripts?.quality?.includes('npm run validate:mobile-navigation')) {
  errors.push('The permanent quality chain must run validate:mobile-navigation.');
}

const htmlFiles = (await readdir(ROOT))
  .filter((file) => extname(file).toLowerCase() === '.html')
  .sort();
let navigationPages = 0;
for (const file of htmlFiles) {
  const html = await readFile(join(ROOT, file), 'utf8');
  const buttonCount = count(html, 'id="mobile-menu-btn"');
  const menuCount = count(html, 'id="mobile-menu"');
  if (buttonCount === 0 && menuCount === 0) continue;
  navigationPages += 1;
  if (buttonCount !== 1 || menuCount !== 1) {
    errors.push(`${file}: expected exactly one mobile menu button and one mobile menu; found ${buttonCount}/${menuCount}.`);
  }
  if (!/<button\b[^>]*id="mobile-menu-btn"[^>]*aria-expanded="false"/i.test(html)) {
    errors.push(`${file}: mobile menu button must start with aria-expanded="false".`);
  }
  if (!/<div\b[^>]*id="mobile-menu"[^>]*style="display:none;"/i.test(html)) {
    errors.push(`${file}: mobile menu must retain a no-flash closed fallback before JavaScript initializes.`);
  }
  if (!html.includes('<script src="js/app.js"></script>')) {
    errors.push(`${file}: mobile navigation markup requires js/app.js.`);
  }
}

if (navigationPages === 0) {
  errors.push('No mobile navigation surfaces were found.');
}

if (errors.length) {
  console.error('Mobile navigation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Mobile navigation validation passed across ${navigationPages} page(s).`);
