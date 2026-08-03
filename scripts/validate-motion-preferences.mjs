import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const errors = [];

function count(source, needle) {
  return source.split(needle).length - 1;
}

const [appSource, moduleSource, packageSource] = await Promise.all([
  readFile(join(ROOT, 'js/app.js'), 'utf8'),
  readFile(join(ROOT, 'js/motion-preferences.mjs'), 'utf8'),
  readFile(join(ROOT, 'package.json'), 'utf8'),
]);
const packageJson = JSON.parse(packageSource);

if (count(appSource, "import('./motion-preferences.mjs')") !== 1) {
  errors.push('js/app.js must load the motion-preferences module exactly once.');
}
if (count(appSource, 'createAutomaticMotionGate({') !== 2) {
  errors.push('js/app.js must create exactly two automatic-motion gates.');
}
if (/function initTestimonials\(\)[\s\S]*?setInterval\(/.test(appSource)) {
  errors.push('Testimonials must not use an unconditional setInterval loop.');
}
if (!/function initTestimonials\(\)[\s\S]*?testimonialMotionGate\.subscribe/.test(appSource)) {
  errors.push('Testimonials must subscribe to the automatic-motion gate.');
}
if (!/function initParticleCanvas\(\)[\s\S]*?cancelAnimationFrame/.test(appSource)) {
  errors.push('Particle canvas must cancel animation frames when automatic motion is blocked.');
}
if (!/function initParticleCanvas\(\)[\s\S]*?particleMotionGate\.subscribe/.test(appSource)) {
  errors.push('Particle canvas must subscribe to the automatic-motion gate.');
}
if (/relatedMotionGate|scheduleAutoScroll|pauseAutoScroll|resumeAutoScroll/.test(appSource)) {
  errors.push('Related products must remain user-controlled and must not restore automatic carousel motion.');
}
if (!/async function initRelatedProducts\(\)[\s\S]*?related-discovery-track/.test(appSource)) {
  errors.push('Related products must render the user-controlled discovery track.');
}

for (const signal of [
  "'(prefers-reduced-motion: reduce)'",
  "documentRef.addEventListener('visibilitychange'",
  'observer.observe(element)',
  'const allowed = !reducedMotion && documentVisible && intersecting',
  'observer?.disconnect?.()',
]) {
  if (!moduleSource.includes(signal)) {
    errors.push(`js/motion-preferences.mjs is missing required behavior: ${signal}`);
  }
}

if (packageJson.scripts?.['validate:motion-preferences'] !== 'node scripts/validate-motion-preferences.mjs') {
  errors.push('package.json must expose validate:motion-preferences.');
}
if (count(packageJson.scripts?.quality || '', 'npm run validate:motion-preferences') !== 1) {
  errors.push('The permanent quality chain must run validate:motion-preferences exactly once.');
}

if (errors.length) {
  console.error('Motion preference validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Motion preference validation passed for testimonials, particle canvas and user-controlled related products.');
