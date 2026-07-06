/** @type {import('vite').UserConfig} */
import { defineConfig } from 'vite';
import { readdirSync } from 'fs';
import { resolve } from 'path';

// Get all HTML files in the current directory
const htmlFiles = readdirSync('.').filter(f => f.endsWith('.html'));

const entries = {};
htmlFiles.forEach(file => {
  const name = file.replace('.html', '');
  entries[name] = resolve(__dirname, file);
});

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
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