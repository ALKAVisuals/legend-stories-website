import assert from 'node:assert/strict';
import test from 'node:test';

import { handleContactRequest } from '../server/api/contact.mjs';

function request(body, options = {}) {
  return new Request('https://legendmural.com/api/contact', {
    method: options.method || 'POST',
    headers: {
      origin: options.origin || 'https://legendmural.com',
      'content-type': options.contentType || 'application/json',
    },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
}

test('contact API delivers normalized same-origin messages', async () => {
  const delivered = [];
  const response = await handleContactRequest(request({
    name: '  Test Person  ',
    email: ' Test@Example.com ',
    subject: ' Product question ',
    message: ' Hello LegendMural ',
    botField: '',
  }), {
    contactNotifier: {
      async sendContactMessage(message) {
        delivered.push(message);
        return { accepted: true, providerMessageId: 'msg_123' };
      },
    },
    allowedOrigins: 'https://legendmural.com',
    now: () => new Date('2026-09-14T10:00:00.000Z'),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.deepEqual(delivered, [{
    name: 'Test Person',
    email: 'test@example.com',
    subject: 'Product question',
    message: 'Hello LegendMural',
    submittedAtIso: '2026-09-14T10:00:00.000Z',
  }]);
});

test('contact API silently accepts honeypot submissions without delivery', async () => {
  let deliveries = 0;
  const response = await handleContactRequest(request({
    name: 'Bot',
    email: 'bot@example.com',
    subject: 'Spam',
    message: 'Spam',
    botField: 'filled-by-bot',
  }), {
    contactNotifier: {
      async sendContactMessage() {
        deliveries += 1;
      },
    },
  });
  assert.equal(response.status, 202);
  assert.equal(deliveries, 0);
});

test('contact API rejects cross-origin browser requests', async () => {
  const response = await handleContactRequest(request({
    name: 'Test',
    email: 'test@example.com',
    subject: 'Test',
    message: 'Hello',
  }, { origin: 'https://evil.example' }), {
    contactNotifier: { async sendContactMessage() {} },
    allowedOrigins: 'https://legendmural.com',
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'ORIGIN_NOT_ALLOWED');
});

test('contact API fails closed when messaging is not configured', async () => {
  const response = await handleContactRequest(request({
    name: 'Test',
    email: 'test@example.com',
    subject: 'Test',
    message: 'Hello',
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'CONTACT_SERVICE_NOT_CONFIGURED');
});

test('contact API validates required fields and methods', async () => {
  const invalid = await handleContactRequest(request({
    name: '',
    email: 'not-an-email',
    subject: '',
    message: '',
  }), {
    contactNotifier: { async sendContactMessage() {} },
  });
  assert.equal(invalid.status, 400);

  const getRequest = new Request('https://legendmural.com/api/contact', { method: 'GET' });
  const method = await handleContactRequest(getRequest, {
    contactNotifier: { async sendContactMessage() {} },
  });
  assert.equal(method.status, 405);
  assert.equal((await method.json()).error.code, 'METHOD_NOT_ALLOWED');
});
