import {
  createNeonDocumentNumberAllocator,
} from './neon-document-number-allocator.mjs';
import {
  createV3InvoiceSnapshot,
  V3InvoiceSnapshotError,
} from '../invoices/v3-invoice-snapshot.mjs';

const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const MAX_TEXT_LENGTH = 128;

export class NeonPaidOrderFinalizerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NeonPaidOrderFinalizerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NeonPaidOrderFinalizerError(code, message, details);
}

function nonnegativeInteger(value, field) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    fail('INVALID_PAID_FINALIZATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function requireText(value, field, { maxLength = MAX_TEXT_LENGTH } = {}) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maxLength) {
    fail('INVALID_PAID_FINALIZATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function optionalText(value, field, { maxLength = 256 } = {}) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    fail('INVALID_PAID_FINALIZATION', `${field} is invalid.`, { field });
  }
  return normalized;
}

function normalizeVerifiedPayment(input = {}) {
  const reference = String(input.reference ?? '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_PAID_FINALIZATION', 'Paid order reference is invalid.', { field: 'reference' });
  }

  const currency = String(input.currency ?? '').trim().toUpperCase();
  if (currency !== 'EUR') {
    fail('INVALID_PAID_FINALIZATION', 'Paid order currency is invalid.', { field: 'currency' });
  }

  const mode = String(input.mode ?? '').trim();
  if (!['test', 'live'].includes(mode)) {
    fail('INVALID_PAID_FINALIZATION', 'Paid order mode is invalid.', { field: 'mode' });
  }

  return Object.freeze({
    reference,
    provider: requireText(input.provider, 'provider', { maxLength: 32 }).toLowerCase(),
    providerOrderId: requireText(input.providerOrderId, 'providerOrderId', { maxLength: 256 }),
    providerCaptureId: optionalText(input.providerCaptureId, 'providerCaptureId'),
    providerEventId: optionalText(input.providerEventId, 'providerEventId'),
    providerEventType: optionalText(input.providerEventType, 'providerEventType'),
    source: requireText(input.source, 'source', { maxLength: 128 }),
    amountTotal: nonnegativeInteger(input.amountTotal, 'amountTotal'),
    currency,
    mode,
    paidAt: nonnegativeInteger(input.paidAt, 'paidAt'),
  });
}

function rowToOrder(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    reference: String(row.reference || ''),
    status: String(row.status || ''),
    amountTotal: Number(row.amount_total),
    currency: String(row.currency || '').toUpperCase(),
    mode: String(row.mode || ''),
    paymentSessionId: String(row.payment_session_id || ''),
    paymentProvider: String(row.payment_provider || ''),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    paidAt: row.paid_at === null ? null : Number(row.paid_at),
    version: Number(row.version),
    customer: structuredClone(row.customer),
    items: structuredClone(row.items),
    discount: structuredClone(row.discount),
    shipping: structuredClone(row.shipping),
    totals: structuredClone(row.totals),
    documentProfileVersion: Number(row.document_profile_version || 0),
    orderNumber: row.order_number === null ? null : String(row.order_number),
    orderNumberAssignedAt: row.order_number_assigned_at === null
      ? null
      : Number(row.order_number_assigned_at),
    invoiceId: row.invoice_id === null ? null : Number(row.invoice_id),
  };
}

function rowToInvoice(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: Number(row.id),
    orderReference: String(row.order_reference || ''),
    orderNumber: String(row.order_number || ''),
    invoiceNumber: String(row.invoice_number || ''),
    status: String(row.status || ''),
    issuedAt: Number(row.issued_at),
    currency: String(row.currency || '').toUpperCase(),
    amountTotal: Number(row.amount_total),
    schemaVersion: Number(row.schema_version),
    snapshot: structuredClone(row.snapshot),
    createdAt: Number(row.created_at),
  };
}

function assertOrderMatchesVerifiedPayment(order, payment) {
  if (order.paymentSessionId !== payment.providerOrderId
    || order.paymentProvider !== payment.provider
    || order.amountTotal !== payment.amountTotal
    || order.currency !== payment.currency
    || order.mode !== payment.mode) {
    fail(
      'PAID_ORDER_IDENTITY_MISMATCH',
      'Verified payment evidence does not match the durable order.',
      { reference: order.reference },
    );
  }
}

function assertSupportedProfile(order) {
  if (![0, 1].includes(order.documentProfileVersion)) {
    fail(
      'DOCUMENT_PROFILE_UNSUPPORTED',
      'The order document profile is not supported.',
      { documentProfileVersion: order.documentProfileVersion },
    );
  }
}

function assertExistingInvoiceInvariant(order, invoice) {
  if (!order.orderNumber
    || !Number.isSafeInteger(order.orderNumberAssignedAt)
    || order.orderNumberAssignedAt < 0
    || !Number.isSafeInteger(order.invoiceId)
    || order.invoiceId < 1
    || !Number.isSafeInteger(order.paidAt)
    || order.paidAt < 0
    || !invoice
    || invoice.id !== order.invoiceId
    || invoice.orderReference !== order.reference
    || invoice.orderNumber !== order.orderNumber
    || invoice.status !== 'issued'
    || invoice.currency !== order.currency
    || invoice.amountTotal !== order.amountTotal
    || invoice.schemaVersion !== 1
    || invoice.snapshot?.schemaVersion !== 1
    || invoice.snapshot?.document?.orderNumber !== order.orderNumber
    || invoice.snapshot?.document?.invoiceNumber !== invoice.invoiceNumber
    || invoice.snapshot?.order?.reference !== order.reference
    || invoice.snapshot?.order?.paidAt !== order.paidAt) {
    fail(
      'PAID_DOCUMENT_INVARIANT_BROKEN',
      'A paid V3 order has incomplete or conflicting durable document identity.',
      { reference: order.reference },
    );
  }
}

function normalizeNumberingPolicy(policy) {
  if (!policy
    || typeof policy.resolveSeriesKey !== 'function'
    || typeof policy.format !== 'function') {
    fail(
      'DOCUMENT_NUMBER_POLICY_NOT_CONFIGURED',
      'A server-side V3 document numbering policy is required.',
    );
  }
  return policy;
}

function resolveDocumentNumber({ policy, documentType, value, order, paidAt }) {
  const seriesKey = String(policy.resolveSeriesKey({
    documentType,
    paidAt,
    order: structuredClone(order),
  }) ?? '').trim();
  if (!seriesKey) {
    fail('DOCUMENT_NUMBER_POLICY_NOT_CONFIGURED', 'Document numbering series key is empty.', {
      documentType,
    });
  }

  return { seriesKey, format: (allocatedValue) => {
    const formatted = String(policy.format({
      documentType,
      value: allocatedValue,
      seriesKey,
      paidAt,
      order: structuredClone(order),
    }) ?? '').trim();
    if (!formatted || formatted.length > MAX_TEXT_LENGTH) {
      fail('DOCUMENT_NUMBER_POLICY_INVALID', 'Document numbering policy returned an invalid number.', {
        documentType,
      });
    }
    return formatted;
  }, value };
}

function normalizeDocumentContextProvider(provider) {
  if (typeof provider !== 'function') {
    fail(
      'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE',
      'A server-side invoice document context provider is required.',
    );
  }
  return provider;
}

const SELECT_ORDER_FOR_UPDATE = `
  SELECT *
  FROM legend_commerce.orders
  WHERE reference = $1
  FOR UPDATE
`;

const SELECT_INVOICE_BY_ID = `
  SELECT *
  FROM legend_commerce.invoices
  WHERE id = $1
`;

const UPDATE_LEGACY_PAID = `
  UPDATE legend_commerce.orders
  SET status = 'paid',
      updated_at = $3,
      paid_at = COALESCE(paid_at, $3),
      version = version + 1
  WHERE reference = $1 AND version = $2
  RETURNING *
`;

const INSERT_INVOICE = `
  INSERT INTO legend_commerce.invoices (
    order_reference,
    order_number,
    invoice_number,
    status,
    issued_at,
    currency,
    amount_total,
    schema_version,
    snapshot,
    created_at
  )
  VALUES ($1, $2, $3, 'issued', $4, $5, $6, 1, $7::jsonb, $4)
  RETURNING *
`;

const UPDATE_V3_PAID = `
  UPDATE legend_commerce.orders
  SET status = 'paid',
      updated_at = $3,
      paid_at = $4,
      order_number = $5,
      order_number_assigned_at = $4,
      invoice_id = $6,
      version = version + 1
  WHERE reference = $1 AND version = $2
  RETURNING *
`;

export function createNeonPaidOrderFinalizer({
  connectionString = process.env.DATABASE_URL,
  clientFactory,
  numberingPolicy,
  documentContextProvider,
  transactionRunner,
} = {}) {
  const policy = numberingPolicy ? normalizeNumberingPolicy(numberingPolicy) : null;
  const contextProvider = documentContextProvider
    ? normalizeDocumentContextProvider(documentContextProvider)
    : null;
  const runner = transactionRunner || createNeonDocumentNumberAllocator({
    connectionString,
    ...(clientFactory ? { clientFactory } : {}),
  });

  if (typeof runner?.transact !== 'function') {
    fail('INVALID_PAID_FINALIZER_TRANSACTION_RUNNER', 'A transaction runner is required.');
  }

  return Object.freeze({
    async finalizePaidOrder(paymentInput) {
      const payment = normalizeVerifiedPayment(paymentInput);

      return runner.transact(async ({ client, allocate }) => {
        const currentResult = await client.query(SELECT_ORDER_FOR_UPDATE, [payment.reference]);
        const current = rowToOrder(currentResult.rows?.[0]);
        if (!current) {
          fail('ORDER_NOT_FOUND', 'Referenced order does not exist.', {
            reference: payment.reference,
          });
        }

        assertSupportedProfile(current);
        assertOrderMatchesVerifiedPayment(current, payment);

        if (current.status === 'paid') {
          if (current.documentProfileVersion === 0) {
            return Object.freeze({
              duplicate: true,
              legacy: true,
              order: structuredClone(current),
              invoice: null,
            });
          }

          const invoiceResult = await client.query(SELECT_INVOICE_BY_ID, [current.invoiceId]);
          const invoice = rowToInvoice(invoiceResult.rows?.[0]);
          assertExistingInvoiceInvariant(current, invoice);
          return Object.freeze({
            duplicate: true,
            legacy: false,
            order: structuredClone(current),
            invoice: structuredClone(invoice),
          });
        }

        const updatedAt = Math.max(current.updatedAt, payment.paidAt);

        if (current.documentProfileVersion === 0) {
          const updateResult = await client.query(UPDATE_LEGACY_PAID, [
            current.reference,
            current.version,
            updatedAt,
          ]);
          const updated = rowToOrder(updateResult.rows?.[0]);
          if (!updated) {
            const retryable = new Error('Legacy paid order version changed during finalization.');
            retryable.code = '40001';
            throw retryable;
          }
          return Object.freeze({
            duplicate: false,
            legacy: true,
            order: structuredClone(updated),
            invoice: null,
          });
        }

        if (!policy) {
          fail(
            'DOCUMENT_NUMBER_POLICY_NOT_CONFIGURED',
            'V3 paid finalization requires a document numbering policy.',
          );
        }
        if (!contextProvider) {
          fail(
            'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE',
            'V3 paid finalization requires immutable invoice document context.',
          );
        }

        const orderNumberPolicy = resolveDocumentNumber({
          policy,
          documentType: 'order',
          order: current,
          paidAt: payment.paidAt,
        });
        const invoiceNumberPolicy = resolveDocumentNumber({
          policy,
          documentType: 'invoice',
          order: current,
          paidAt: payment.paidAt,
        });

        // Fixed lock order: official order-number series first, invoice-number series second.
        const orderAllocation = await allocate({
          documentType: 'order',
          seriesKey: orderNumberPolicy.seriesKey,
          updatedAt,
        });
        const invoiceAllocation = await allocate({
          documentType: 'invoice',
          seriesKey: invoiceNumberPolicy.seriesKey,
          updatedAt,
        });
        const orderNumber = orderNumberPolicy.format(orderAllocation.value);
        const invoiceNumber = invoiceNumberPolicy.format(invoiceAllocation.value);

        let documentContext;
        try {
          documentContext = await contextProvider(Object.freeze({
            order: structuredClone(current),
            payment: structuredClone(payment),
          }));
        } catch (error) {
          if (error instanceof NeonPaidOrderFinalizerError || error instanceof V3InvoiceSnapshotError) {
            throw error;
          }
          fail(
            'INVOICE_SNAPSHOT_CONFIG_INCOMPLETE',
            'Invoice document context could not be resolved.',
          );
        }

        const projectedPaidOrder = {
          ...structuredClone(current),
          status: 'paid',
          updatedAt,
          paidAt: payment.paidAt,
        };

        const snapshot = createV3InvoiceSnapshot({
          order: projectedPaidOrder,
          orderNumber,
          invoiceNumber,
          issuedAt: payment.paidAt,
          seller: documentContext?.seller,
          billingAddress: documentContext?.billingAddress,
          tax: documentContext?.tax,
          payment: {
            provider: payment.provider,
            providerOrderId: payment.providerOrderId,
            providerCaptureId: payment.providerCaptureId,
            providerEventId: payment.providerEventId,
            providerEventType: payment.providerEventType,
            source: payment.source,
            verifiedPaidAt: payment.paidAt,
          },
        });

        const invoiceResult = await client.query(INSERT_INVOICE, [
          current.reference,
          orderNumber,
          invoiceNumber,
          payment.paidAt,
          current.currency,
          current.amountTotal,
          JSON.stringify(snapshot),
        ]);
        const invoice = rowToInvoice(invoiceResult.rows?.[0]);
        if (!invoice || !Number.isSafeInteger(invoice.id) || invoice.id < 1) {
          fail('INVOICE_INSERT_FAILED', 'The immutable invoice record was not created.');
        }

        const updateResult = await client.query(UPDATE_V3_PAID, [
          current.reference,
          current.version,
          updatedAt,
          payment.paidAt,
          orderNumber,
          invoice.id,
        ]);
        const updated = rowToOrder(updateResult.rows?.[0]);
        if (!updated) {
          const retryable = new Error('V3 paid order version changed during finalization.');
          retryable.code = '40001';
          throw retryable;
        }

        assertExistingInvoiceInvariant(updated, invoice);
        return Object.freeze({
          duplicate: false,
          legacy: false,
          order: structuredClone(updated),
          invoice: structuredClone(invoice),
        });
      });
    },
  });
}
