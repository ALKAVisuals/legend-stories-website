const MAX_REQUEST_BYTES = 16 * 1024;

export class ContactRequestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContactRequestError';
    this.code = code;
  }
}

function parseAllowedOrigins(value = '') {
  return new Set(
    String(value)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function responseHeaders(origin = '') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function jsonResponse(status, body, origin = '') {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(origin),
  });
}

function errorResponse(status, code, message, origin = '') {
  return jsonResponse(status, { error: { code, message } }, origin);
}

function resolveCorsOrigin(request, configuredOrigins) {
  const origin = request.headers.get('origin') || '';
  if (!origin) return '';
  const allowed = parseAllowedOrigins(configuredOrigins);
  allowed.add(new URL(request.url).origin);
  return allowed.has(origin) ? origin : null;
}

async function parseJsonRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ContactRequestError('UNSUPPORTED_CONTENT_TYPE', 'Content-Type must be application/json.');
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new ContactRequestError('REQUEST_TOO_LARGE', 'Contact request is too large.');
  }
  const source = await request.text();
  if (new TextEncoder().encode(source).length > MAX_REQUEST_BYTES) {
    throw new ContactRequestError('REQUEST_TOO_LARGE', 'Contact request is too large.');
  }
  try {
    return JSON.parse(source);
  } catch {
    throw new ContactRequestError('INVALID_JSON', 'Contact request body is invalid JSON.');
  }
}

function requiredText(value, field, maxLength) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw new ContactRequestError(`INVALID_CONTACT_${field.toUpperCase()}`, `Enter a valid ${field}.`);
  }
  return normalized;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ContactRequestError('INVALID_CONTACT_EMAIL', 'Enter a valid email address.');
  }
  return email;
}

function honeypotValue(payload) {
  return String(payload?.botField ?? payload?.['bot-field'] ?? '').trim();
}

function mapError(error, origin) {
  if (error instanceof ContactRequestError) {
    return errorResponse(400, error.code, error.message, origin);
  }
  console.error('Unexpected contact request error.', {
    name: String(error?.name || 'Error').slice(0, 120),
    code: String(error?.code || 'UNKNOWN').slice(0, 120),
  });
  return errorResponse(502, 'CONTACT_DELIVERY_FAILED', 'Your message could not be sent. Please try again.', origin);
}

export async function handleContactRequest(request, {
  contactNotifier = null,
  allowedOrigins = process.env.CHECKOUT_ALLOWED_ORIGINS || '',
  now = () => new Date(),
} = {}) {
  const corsOrigin = resolveCorsOrigin(request, allowedOrigins);
  if (corsOrigin === null) {
    return errorResponse(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(corsOrigin) });
  }
  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed.', corsOrigin);
  }

  try {
    const payload = await parseJsonRequest(request);
    if (honeypotValue(payload)) {
      return jsonResponse(202, { accepted: true }, corsOrigin);
    }
    if (!contactNotifier || typeof contactNotifier.sendContactMessage !== 'function') {
      return errorResponse(503, 'CONTACT_SERVICE_NOT_CONFIGURED', 'Contact messaging is not configured.', corsOrigin);
    }

    const name = requiredText(payload?.name, 'name', 160);
    const email = normalizeEmail(payload?.email);
    const subject = requiredText(payload?.subject, 'subject', 200);
    const message = requiredText(payload?.message, 'message', 5000);
    const submittedAt = now();
    const submittedAtIso = submittedAt instanceof Date
      ? submittedAt.toISOString()
      : new Date(submittedAt).toISOString();

    await contactNotifier.sendContactMessage({
      name,
      email,
      subject,
      message,
      submittedAtIso,
    });

    return jsonResponse(201, { accepted: true }, corsOrigin);
  } catch (error) {
    return mapError(error, corsOrigin);
  }
}
