export function buildMarketingBackgroundDeclarations(source, derivative) {
  const sourcePath = String(source || '').trim();
  const derivativePath = String(derivative || '').trim();
  if (!sourcePath || !derivativePath) {
    throw new Error('Both source and derivative paths are required.');
  }
  return `background-image:url('${sourcePath}');background-image:image-set(url('${derivativePath}') type('image/webp'), url('${sourcePath}') type('image/png'));`;
}

export function applyMarketingBackgroundDerivative(html, { source, derivative } = {}) {
  const document = String(html || '');
  const fallback = `background-image:url('${source}');`;
  const replacement = buildMarketingBackgroundDeclarations(source, derivative);
  if (document.includes(replacement)) return document;

  const matches = document.split(fallback).length - 1;
  if (matches !== 1) {
    throw new Error(`${source}: expected exactly one homepage background reference, found ${matches}.`);
  }
  return document.replace(fallback, replacement);
}

export function parseSsimScore(output = '') {
  const match = String(output || '').match(/\bAll:([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) throw new Error('FFmpeg SSIM output did not contain an All score.');
  const score = Number(match[1]);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Invalid SSIM score: ${match[1]}.`);
  }
  return score;
}

export function calculateSizeRatio(sourceBytes, derivativeBytes) {
  const source = Number(sourceBytes);
  const derivative = Number(derivativeBytes);
  if (!Number.isFinite(source) || source <= 0) {
    throw new Error('Source size must be a positive number.');
  }
  if (!Number.isFinite(derivative) || derivative < 0) {
    throw new Error('Derivative size must be a non-negative number.');
  }
  return derivative / source;
}
