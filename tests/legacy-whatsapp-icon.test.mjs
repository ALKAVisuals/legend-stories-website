import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTemplateStructure } from '../scripts/product-page-template.mjs';

test('known WhatsApp vector variants share one floating-button template contract', () => {
  const current = '<a aria-label="WhatsApp" class="fixed"><svg viewBox="0 0 24 24"><path d="current-whatsapp" /></svg></a>';
  const legacy = '<a aria-label="WhatsApp" class="fixed"><svg viewBox="0 0 24 24"><path d="legacy-whatsapp" /></svg></a>';

  const normalized = normalizeTemplateStructure(current);
  assert.equal(normalized, normalizeTemplateStructure(legacy));
  assert.match(normalized, /data-template-icon="whatsapp"/);
});
