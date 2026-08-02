import { readFile, writeFile } from 'node:fs/promises';

function replaceRequired(source, pattern, replacement, label) {
  const matches = typeof pattern === 'string'
    ? source.split(pattern).length - 1
    : [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))].length;
  if (matches !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${matches}.`);
  }
  return source.replace(pattern, replacement);
}

const appPath = 'js/app.js';
let app = await readFile(appPath, 'utf8');

app = replaceRequired(
  app,
  '    mobileMenuOpen: false,\n',
  '',
  'remove duplicated mobile menu state',
);

app = replaceRequired(
  app,
  'let checkoutDialogController = null;\n',
  `let checkoutDialogController = null;\nlet mobileNavigationModulePromise = null;\nlet mobileNavigationController = null;\n\nfunction loadMobileNavigationModule() {\n  if (!mobileNavigationModulePromise) {\n    mobileNavigationModulePromise = import('./mobile-navigation.mjs');\n  }\n  return mobileNavigationModulePromise;\n}\n`,
  'insert mobile navigation loader',
);

app = replaceRequired(
  app,
  /  \/\/ ==========================================\n  \/\/ MOBILE MENU\n  \/\/ ==========================================\n[\s\S]*?  \/\/ ==========================================\n  \/\/ BEFORE \/ AFTER SLIDER/,
  `  // ==========================================\n  // BEFORE / AFTER SLIDER`,
  'remove legacy mobile menu implementation',
);

app = replaceRequired(
  app,
  /    if \(dom\.mobileMenuBtn\) dom\.mobileMenuBtn\.addEventListener\('click', toggleMobileMenu\);\n    if \(dom\.mobileMenu\) \{[\s\S]*?    document\.addEventListener\('keydown', \(e\) => \{\n      if \(e\.key === 'Escape' && state\.mobileMenuOpen\) closeMobileMenu\(\);\n    \}\);\n/,
  '',
  'remove legacy mobile menu listeners',
);

app = replaceRequired(
  app,
  '    await loadDialogAccessibilityModule();\n',
  `    await loadDialogAccessibilityModule();\n    const mobileNavigationModule = await loadMobileNavigationModule();\n`,
  'load mobile navigation module',
);

app = replaceRequired(
  app,
  '    const fns = [\n',
  `    if (dom.mobileMenuBtn && dom.mobileMenu) {\n      mobileNavigationController = mobileNavigationModule.createMobileNavigationController({\n        button: dom.mobileMenuBtn,\n        menu: dom.mobileMenu,\n        documentRef: document,\n        windowRef: window,\n      });\n    }\n    const fns = [\n`,
  'initialize mobile navigation controller',
);

await writeFile(appPath, app, 'utf8');

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:mobile-navigation'] = 'node scripts/validate-mobile-navigation.mjs';
const qualityMarker = 'npm run validate:dialog-accessibility &&';
if (!packageJson.scripts.quality.includes(qualityMarker)) {
  throw new Error('package quality chain is missing the dialog accessibility marker.');
}
if (!packageJson.scripts.quality.includes('npm run validate:mobile-navigation')) {
  packageJson.scripts.quality = packageJson.scripts.quality.replace(
    qualityMarker,
    `${qualityMarker} npm run validate:mobile-navigation &&`,
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Mobile navigation migration completed.');
