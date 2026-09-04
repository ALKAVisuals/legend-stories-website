const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_BATCH_SIZE = 25;

export class V3InvoiceReconciliationWorkerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3InvoiceReconciliationWorkerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new V3InvoiceReconciliationWorkerError(code, message, details);
}

function timestamp(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError('V3 reconciliation worker clock returned an invalid timestamp.');
  }
  return normalized;
}

function batchSize(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > DEFAULT_BATCH_SIZE) {
    throw new TypeError('V3 reconciliation worker batch size must be between 1 and 25.');
  }
  return normalized;
}

function safeReference(value) {
  const reference = String(value || '').trim().toLowerCase();
  return REFERENCE_PATTERN.test(reference) ? reference : 'unknown';
}

function errorCode(error) {
  return String(error?.code || error?.name || 'UNKNOWN').slice(0, 120);
}

function safeLog(logger, message, metadata) {
  try {
    logger?.error?.(message, metadata);
  } catch {
    // Reconciliation progress must never depend on logging availability.
  }
}

function normalizeOrder(candidate) {
  const order = candidate?.order;
  const reference = String(order?.reference || '').trim().toLowerCase();
  const invoiceId = Number(order?.invoiceId);
  if (!REFERENCE_PATTERN.test(reference)
    || order?.status !== 'paid'
    || order?.mode !== 'live'
    || Number(order?.documentProfileVersion) !== 1
    || !Number.isSafeInteger(invoiceId)
    || invoiceId <= 0) {
    fail(
      'V3_RECONCILIATION_CANDIDATE_INVALID',
      'Reconciliation source returned an invalid Profile-1 paid order candidate.',
    );
  }
  return Object.freeze({
    reference,
    status: 'paid',
    mode: 'live',
    documentProfileVersion: 1,
    invoiceId,
  });
}

function assertSource(source) {
  if (typeof source?.listCandidates !== 'function') {
    throw new TypeError('V3 reconciliation source is missing listCandidates().');
  }
}

function assertDelivery(deliver) {
  if (typeof deliver !== 'function') {
    throw new TypeError('V3 reconciliation delivery boundary must be a function.');
  }
}

function createSummary(startedAt, selected) {
  return {
    startedAt,
    selected,
    sent: 0,
    failed: 0,
    duplicate: 0,
    skipped: 0,
  };
}

function classifyResult(summary, result) {
  if (result?.duplicate === true) {
    summary.duplicate += 1;
    return;
  }
  if (result?.skipped === true) {
    summary.skipped += 1;
    return;
  }
  if (result?.status === 'sent') {
    summary.sent += 1;
    return;
  }
  summary.failed += 1;
}

export function createV3InvoiceReconciliationWorker({
  source,
  deliverV3CustomerInvoice,
  now = () => Math.floor(Date.now() / 1000),
  limit = DEFAULT_BATCH_SIZE,
  logger = console,
} = {}) {
  assertSource(source);
  assertDelivery(deliverV3CustomerInvoice);
  if (typeof now !== 'function') {
    throw new TypeError('V3 reconciliation worker clock must be a function.');
  }
  const boundedLimit = batchSize(limit);

  return async function reconcileV3Invoices() {
    const startedAt = timestamp(now());
    const candidates = await source.listCandidates({
      dueAt: startedAt,
      limit: boundedLimit,
    });
    if (!Array.isArray(candidates)) {
      fail('V3_RECONCILIATION_SOURCE_INVALID', 'Reconciliation source returned a non-array result.');
    }
    if (candidates.length > boundedLimit) {
      fail('V3_RECONCILIATION_SOURCE_INVALID', 'Reconciliation source exceeded the bounded batch size.');
    }

    const summary = createSummary(startedAt, candidates.length);
    for (const candidate of candidates) {
      let order;
      try {
        order = normalizeOrder(candidate);
        const result = await deliverV3CustomerInvoice(order);
        classifyResult(summary, result);
      } catch (error) {
        summary.failed += 1;
        safeLog(logger, 'V3 invoice reconciliation candidate failed.', Object.freeze({
          reference: safeReference(order?.reference || candidate?.order?.reference),
          code: errorCode(error),
        }));
      }
    }

    return Object.freeze(summary);
  };
}

export { DEFAULT_BATCH_SIZE };
