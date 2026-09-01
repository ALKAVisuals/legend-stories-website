import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { launchCommercialCopyPlugin } from './scripts/vite-launch-commercial-copy-plugin.mjs';
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

function footerThemeStylesPlugin() {
  return {
    name: 'footer-theme-styles',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [{
          tag: 'link',
          attrs: { rel: 'stylesheet', href: '/css/footer-theme.css' },
          injectTo: 'head',
        }];
      },
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'css/footer-theme.css',
        source: readFileSync(resolve(ROOT, 'css/footer-theme.css'), 'utf8'),
      });
    },
  };
}

function premiumNavigationStylesPlugin() {
  return {
    name: 'premium-navigation-styles',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'css/premium-navigation.css',
        source: readFileSync(resolve(ROOT, 'css/premium-navigation.css'), 'utf8'),
      });
    },
  };
}

function contactFormScriptPlugin() {
  return {
    name: 'contact-form-script',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [{
          tag: 'script',
          attrs: { src: '/js/contact-form.js', defer: true },
          injectTo: 'body',
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
    contactFormScriptPlugin(),
    footerThemeStylesPlugin(),
    premiumNavigationStylesPlugin(),
    launchCommercialCopyPlugin({ root: ROOT, outDir: 'dist' }),
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
