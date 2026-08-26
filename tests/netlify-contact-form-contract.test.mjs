import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [definition, client, viteConfig, homepage] = await Promise.all([
  readFile(new URL('../netlify-forms.html', import.meta.url), 'utf8'),
  readFile(new URL('../js/contact-form.js', import.meta.url), 'utf8'),
  readFile(new URL('../vite.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

test('Netlify contact form has a static build-time definition with spam protection', () => {
  assert.match(definition, /<form name="contact" method="POST" data-netlify="true" data-netlify-honeypot="bot-field" hidden>/);
  assert.match(definition, /name="form-name" value="contact"/);
  assert.match(definition, /name="bot-field"/);
  for (const field of ['name', 'email', 'subject', 'message']) {
    assert.match(definition, new RegExp(`name="${field}"`));
  }
  assert.match(definition, /noindex,nofollow/);
});

test('homepage contact form keeps the expected customer fields and LegendMural email', () => {
  for (const field of ['name', 'email', 'subject', 'message']) {
    assert.match(homepage, new RegExp(`name="${field}"`));
  }
  assert.match(homepage, /id="contact"/);
  assert.match(homepage, /info@legendmural\.com/);
  assert.doesNotMatch(homepage, /hello@legendstories\.nl/);
});

test('contact client submits only the public form payload to Netlify', () => {
  assert.match(client, /data\.set\('form-name', 'contact'\)/);
  assert.match(client, /fetch\('\/', \{/);
  assert.match(client, /application\/x-www-form-urlencoded;charset=UTF-8/);
  assert.match(client, /contact-form-status/);
  assert.match(client, /aria-live/);
  assert.doesNotMatch(client, /hello@legendstories\.nl/);
  assert.doesNotMatch(client, /RESEND_API_KEY|PAYPAL_CLIENT_SECRET|NEON_DATABASE_URL/);
});

test('Vite includes the contact client in the production build', () => {
  assert.match(viteConfig, /contactFormScriptPlugin/);
  assert.match(viteConfig, /\/js\/contact-form\.js/);
});
