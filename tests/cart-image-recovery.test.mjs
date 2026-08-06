import assert from 'node:assert/strict';
import test from 'node:test';

import {
  initCartControlDelegation,
  persistRecoveredCartImage,
  recoverCartImage,
  renderCartItemMarkup,
} from '../js/cart-controls.mjs';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

class FakeContainer {
  constructor() {
    this.listeners = new Map();
    this.children = new Set();
  }

  addEventListener(type, listener, capture = false) {
    this.listeners.set(`${type}:${Boolean(capture)}`, listener);
  }

  removeEventListener(type, listener, capture = false) {
    const key = `${type}:${Boolean(capture)}`;
    if (this.listeners.get(key) === listener) this.listeners.delete(key);
  }

  contains(element) {
    return this.children.has(element);
  }

  append(element) {
    this.children.add(element);
  }

  emitImageError(target) {
    this.listeners.get('error:true')?.({ target });
  }
}

class FakeImage {
  constructor(page, src) {
    this.dataset = {
      cartProductPage: page,
      cartImageRecovery: 'idle',
    };
    this.src = src;
  }

  matches(selector) {
    return selector === 'img[data-cart-product-page]';
  }
}

function cartStorage(page, image) {
  return new MemoryStorage({
    legendCart: JSON.stringify([
      {
        id: `${page}:compact`,
        page,
        name: 'Test legend',
        variantId: 'compact',
        quantity: 1,
        image,
      },
    ]),
  });
}

test('cart markup carries the stable product page needed for image recovery', () => {
  const markup = renderCartItemMarkup({
    item: {
      page: 'music-truth-seeker.html',
      name: 'The Truth Seeker',
      image: 'media/legacy-truth-seeker.png',
      price: 35,
      quantity: 1,
    },
    index: 0,
    formatPrice: (value) => `€${value.toFixed(2)}`,
  });

  assert.match(markup, /data-cart-product-page="music-truth-seeker\.html"/);
  assert.match(markup, /data-cart-image-recovery="idle"/);
});

test('recovers a stale Netlify cart image from the runtime product registry', async () => {
  const page = 'music-truth-seeker.html';
  const storage = cartStorage(page, 'media/legacy-truth-seeker.png');
  const imageElement = new FakeImage(page, 'media/legacy-truth-seeker.png');

  const recovered = await recoverCartImage({
    imageElement,
    page,
    baseUri: 'https://legendmural.netlify.app/music-truth-seeker.html',
    storage,
    registryLoader: async () => [
      {
        page,
        browserImage: '/assets/truth-seeker-current.webp',
      },
    ],
  });

  assert.equal(recovered, '/assets/truth-seeker-current.webp');
  assert.equal(imageElement.src, '/assets/truth-seeker-current.webp');
  assert.equal(imageElement.dataset.cartImageRecovery, 'done');
  assert.equal(
    JSON.parse(storage.getItem('legendCart'))[0].image,
    '/assets/truth-seeker-current.webp',
  );
});

test('recovers repository-prefixed GitHub Pages image paths through delegated errors', async () => {
  const page = 'sport-lions-pride.html';
  const replacement = '/legend-stories-website/assets/lions-pride-current.webp';
  const storage = cartStorage(page, 'media/legacy-lions-pride.png');
  const container = new FakeContainer();
  const imageElement = new FakeImage(page, 'media/legacy-lions-pride.png');
  container.append(imageElement);

  const controller = initCartControlDelegation({
    container,
    onUpdateQuantity: () => {},
    onRemoveItem: () => {},
    baseUri: 'https://alkavisuals.github.io/legend-stories-website/sport-lions-pride.html',
    storage,
    registryLoader: async () => [{ page, browserImage: replacement }],
  });

  container.emitImageError(imageElement);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(imageElement.src, replacement);
  assert.equal(imageElement.dataset.cartImageRecovery, 'done');
  controller.destroy();
  assert.equal(container.listeners.has('error:true'), false);
});

test('does not persist unsafe registry image paths', async () => {
  const page = 'combat-beast-within.html';
  const storage = cartStorage(page, 'media/legacy-beast.png');
  const imageElement = new FakeImage(page, 'media/legacy-beast.png');

  const recovered = await recoverCartImage({
    imageElement,
    page,
    storage,
    registryLoader: async () => [{ page, browserImage: 'https://example.com/untrusted.png' }],
  });

  assert.equal(recovered, null);
  assert.equal(imageElement.src, 'media/legacy-beast.png');
  assert.equal(imageElement.dataset.cartImageRecovery, 'failed');
  assert.equal(
    JSON.parse(storage.getItem('legendCart'))[0].image,
    'media/legacy-beast.png',
  );
});

test('persists only matching safe cart lines', () => {
  const storage = cartStorage('music-free-spirit.html', 'media/old.png');
  assert.equal(
    persistRecoveredCartImage(
      'music-free-spirit.html',
      '/assets/free-spirit.webp',
      storage,
    ),
    true,
  );
  assert.equal(
    JSON.parse(storage.getItem('legendCart'))[0].image,
    '/assets/free-spirit.webp',
  );
  assert.equal(
    persistRecoveredCartImage('../unsafe.html', '/assets/unsafe.webp', storage),
    false,
  );
});
