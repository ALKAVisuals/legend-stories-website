export function parseVideoSourceAttribute(sourceTag = '', { label = 'video source' } = {}) {
  const source = String(sourceTag || '');
  if (/\sdata-(?:data-)+src\s*=/i.test(source)) {
    throw new Error(`${label}: deferred source attribute contains repeated data- prefixes.`);
  }

  const matches = [...source.matchAll(/(?:^|\s)(data-src|src)\s*=\s*(["'])([^"']+)\2/gi)];
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw new Error(`${label}: expected exactly one src or data-src attribute, found ${matches.length}.`);
  }

  const attribute = matches[0][1].toLowerCase();
  return Object.freeze({
    attribute,
    value: matches[0][3],
    deferred: attribute === 'data-src',
  });
}

export function parseSingleVideoSource(videoBody = '', { label = 'video' } = {}) {
  const sourceTags = [...String(videoBody || '').matchAll(/<source\b[^>]*>/gi)].map((match) => match[0]);
  const parsed = sourceTags
    .map((sourceTag, index) => parseVideoSourceAttribute(sourceTag, {
      label: `${label} source ${index + 1}`,
    }))
    .filter(Boolean);

  if (parsed.length === 0) return null;
  if (parsed.length !== 1) {
    throw new Error(`${label}: expected exactly one active video source, found ${parsed.length}.`);
  }
  return parsed[0];
}
