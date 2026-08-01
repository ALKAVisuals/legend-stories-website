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
  const processedEvents = new Map();
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

    async processStripeEvent(eventInput, createUpdate) {
      return atomic(async () => {
        const event = clone(eventInput);
        const eventId = String(event?.eventId || '');
        const reference = String(event?.reference || '');
        if (!eventId || !reference || typeof createUpdate !== 'function') {
          throw storeError('INVALID_PAYMENT_EVENT', 'Stripe event processing input is invalid.');
        }

        const previousReference = processedEvents.get(eventId);
        if (previousReference) {
          if (previousReference !== reference) {
            throw storeError(
              'ORDER_STORE_EVENT_CONFLICT',
              'A Stripe event ID was reused for another order.',
            );
          }
          const existing = orders.get(reference);
          if (!existing) {
            throw storeError('ORDER_NOT_FOUND', 'The referenced order does not exist.');
          }
          return Object.freeze({
            duplicate: true,
            order: clone(existing),
          });
        }

        const current = orders.get(reference);
        if (!current) {
          throw storeError('ORDER_NOT_FOUND', 'The referenced order does not exist.');
        }

        const updated = await createUpdate(clone(current));
        if (!updated || updated.reference !== reference) {
          throw storeError(
            'ORDER_STORE_CONFLICT',
            'The order update returned an invalid reference.',
          );
        }
        if (!Number.isInteger(updated.version)
          || updated.version !== Number(current.version) + 1) {
          throw storeError(
            'ORDER_STORE_VERSION_CONFLICT',
            'The order update did not increment the optimistic version exactly once.',
          );
        }

        orders.set(reference, clone(updated));
        processedEvents.set(eventId, reference);
        return Object.freeze({
          duplicate: false,
          order: clone(updated),
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
