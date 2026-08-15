function clone(value) {
  return structuredClone(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function storeError(code, message) {
  const error = new Error(message);
  error.name = 'ReferenceOrderStoreError';
  error.code = code;
  return error;
}

export function createReferenceOrderStore() {
  const orders = new Map();
  let queue = Promise.resolve();

  async function atomic(action) {
    const previous = queue;
    let release;
    queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release();
    }
  }

  return Object.freeze({
    async persistPendingCheckout(orderInput) {
      return atomic(async () => {
        const order = clone(orderInput);
        const reference = String(order?.reference || '');
        if (!reference) {
          throw storeError('INVALID_ORDER', 'Pending order has no reference.');
        }

        const existing = orders.get(reference);
        if (existing) {
          if (!sameValue(existing, order)) {
            throw storeError(
              'ORDER_STORE_CONFLICT',
              'A different order already uses this reference.',
            );
          }
          return Object.freeze({
            created: false,
            order: clone(existing),
          });
        }

        orders.set(reference, clone(order));
        return Object.freeze({
          created: true,
          order: clone(order),
        });
      });
    },

    async getOrderByReference(referenceInput) {
      await queue;
      const reference = String(referenceInput || '');
      const order = orders.get(reference);
      return order ? clone(order) : null;
    },
  });
}
