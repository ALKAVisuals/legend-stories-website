import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { productionOriginPlugin } from './scripts/vite-production-origin-plugin.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const htmlFiles = readdirSync(ROOT).filter((file) => file.endsWith('.html'));
const entries = Object.fromEntries(
  htmlFiles.map((file) => [file.replace(/\.html$/, ''), resolve(ROOT, file)]),
);

function checkoutControlsStylesPlugin() {
  return {
    name: 'checkout-controls-styles',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [{
          tag: 'link',
          attrs: { rel: 'stylesheet', href: '/css/checkout-controls.css' },
          injectTo: 'head',
        }];
      },
    },
  };
}

export default defineConfig({
  root: ROOT,
  publicDir: resolve(ROOT, 'generated/public'),
  plugins: [
    checkoutControlsStylesPlugin(),
    productionOriginPlugin({ root: ROOT, outDir: 'dist' }),
  ],
  build: {
    outDir: resolve(ROOT, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      input: entries,
    },
  },
  server: {
    port: 3001,
    open: false,
  },
});
