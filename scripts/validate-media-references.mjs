import { readFile } from 'node:fs/promises';

const report = JSON.parse(
  await readFile(new URL('../reports/media-references.json', import.meta.url), 'utf8'),
);
const summary = report?.summary || {};
const errors = [];

for (const field of [
  'mediaFiles',
  'activelyReferencedMedia',
  'unreferencedMedia',
  'fullyOrphanedMedia',
  'largeUnreferencedMedia',
  'exactDuplicateGroups',
  'potentialDuplicateRecoveryBytes',
  'htmlVideoElements',
]) {
  if (!Number.isInteger(summary[field]) || summary[field] < 0) {
    errors.push(`Media reference report has an invalid ${field} value.`);
  }
}

if (summary.unreferencedMedia !== summary.fullyOrphanedMedia) {
  errors.push('Every media file without a storefront reference must be classified explicitly.');
}
if (summary.fullyOrphanedMedia > 0) {
  errors.push(`${summary.fullyOrphanedMedia} fully orphaned media files remain.`);
}
if (summary.largeUnreferencedMedia > 0) {
  errors.push(`${summary.largeUnreferencedMedia} unreferenced media files larger than 1 MB remain.`);
}
if (summary.activelyReferencedMedia + summary.unreferencedMedia !== summary.mediaFiles) {
  errors.push('Media reference totals do not reconcile.');
}

if (errors.length) {
  console.error('Media reference validation failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `Media reference validation passed: all ${summary.mediaFiles} supported media files are actively referenced and no orphaned media remains.`,
);
