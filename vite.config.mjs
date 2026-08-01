import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const htmlFiles = readdirSync(ROOT).filter((file) => file.endsWith('.html'));
const entries = Object.fromEntries(
  htmlFiles.map((file) => [file.replace(/\.html$/, ''), resolve(ROOT, file)]),
);

export default defineConfig({
  root: ROOT,
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
