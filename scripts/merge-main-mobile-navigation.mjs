import { access, readFile, writeFile } from 'node:fs/promises';

const requiredMainFiles = [
  'js/mobile-navigation.mjs',
  'scripts/validate-mobile-navigation.mjs',
  'tests/mobile-navigation-contract.test.mjs',
  'tests/mobile-navigation.test.mjs',
];

for (const path of requiredMainFiles) {
  await access(path);
}

const appSource = await readFile('js/app.js', 'utf8');
if (!appSource.includes("import('./mobile-navigation.mjs')")) {
  throw new Error('Merged js/app.js is missing the mobile navigation module loader.');
}
if (!appSource.includes('createMobileNavigationController({')) {
  throw new Error('Merged js/app.js is missing the mobile navigation controller initialization.');
}

const packagePath = 'package.json';
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['validate:mobile-navigation'] = 'node scripts/validate-mobile-navigation.mjs';

const quality = packageJson.scripts.quality || '';
const dialogMarker = 'npm run validate:dialog-accessibility &&';
if (!quality.includes(dialogMarker)) {
  throw new Error('The quality chain is missing validate:dialog-accessibility.');
}
if (!quality.includes('npm run validate:product-browser-derivatives')) {
  throw new Error('The product browser derivative validator was lost during the main merge.');
}
if (!quality.includes('npm run validate:mobile-navigation')) {
  packageJson.scripts.quality = quality.replace(
    dialogMarker,
    `${dialogMarker} npm run validate:mobile-navigation &&`,
  );
}

const mobileCount = packageJson.scripts.quality.split('npm run validate:mobile-navigation').length - 1;
const derivativeCount = packageJson.scripts.quality.split('npm run validate:product-browser-derivatives').length - 1;
if (mobileCount !== 1 || derivativeCount !== 1) {
  throw new Error(`Expected one mobile and one derivative validator in quality; found ${mobileCount}/${derivativeCount}.`);
}

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
console.log('Main mobile-navigation contract merged with the product-browser derivative contract.');
