const REFERENCE_PATTERN = /^[a-f0-9]{64}$/;
const PRODUCT_ID_PATTERN = /^LM-\d{4}-\d{5}$/;
const ALLOWED_PRODUCTION_SIZES = new Set([30, 45]);

export class ProductionHandoffError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductionHandoffError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProductionHandoffError(code, message, details);
}

function normalizePaidOrder(order = {}) {
  const reference = String(order.reference || '').trim().toLowerCase();
  if (!REFERENCE_PATTERN.test(reference)) {
    fail('INVALID_ORDER_REFERENCE', 'The paid order reference is invalid.');
  }
  if (order.status !== 'paid') {
    fail('ORDER_NOT_PAID', 'Only a verified paid order may be handed to production.', {
      status: order.status || null,
    });
  }
  if (!Array.isArray(order.items) || order.items.length === 0) {
    fail('INVALID_ORDER_ITEMS', 'The paid order contains no production items.');
  }
  return { reference, items: order.items };
}

export function createProductionHandoff(orderInput = {}) {
  const order = normalizePaidOrder(orderInput);
  const items = order.items.map((item, index) => {
    const productId = String(item?.productId || '').trim();
    const sizeCm = Number(item?.sizeCm);
    const quantity = Number(item?.quantity);

    if (!PRODUCT_ID_PATTERN.test(productId)) {
      fail('INVALID_PRODUCTION_PRODUCT_ID', 'An order line has no canonical production product ID.', {
        line: index + 1,
      });
    }
    if (!Number.isInteger(sizeCm) || !ALLOWED_PRODUCTION_SIZES.has(sizeCm)) {
      fail('INVALID_PRODUCTION_SIZE', 'An order line does not match an active 30/45 cm production size.', {
        line: index + 1,
        sizeCm: item?.sizeCm ?? null,
      });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      fail('INVALID_PRODUCTION_QUANTITY', 'An order line has an invalid production quantity.', {
        line: index + 1,
        quantity: item?.quantity ?? null,
      });
    }

    return Object.freeze({
      line_ref: String(index + 1),
      product_id: productId,
      size_cm: sizeCm,
      quantity,
    });
  });

  return Object.freeze({
    schema_version: 1,
    order_ref: order.reference,
    source_system: 'legendmural-web',
    items: Object.freeze(items),
  });
}
