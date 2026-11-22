import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → normal multi-file build. `npm run build:single` → one self-contained index.html.
export default defineConfig(({ mode }) => ({
  base: './', // relative paths: works at a domain root or in a sub-folder (e.g. GitHub Pages)
  plugins: [react(), tailwindcss(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  server: { host: true },
  build: { chunkSizeWarningLimit: 1000 }, // three.js is ~600 kB raw / ~150 kB gzipped
}));
