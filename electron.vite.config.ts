import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import UnoCSS from '@unocss/vite';
import path from 'node:path';

const sharedAlias = { alias: { '@shared': path.resolve(__dirname, 'src/shared') } };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: sharedAlias,
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: sharedAlias,
    // A sandboxed preload runs in a CommonJS context; package.json "type":"module"
    // would otherwise emit ESM (index.mjs) whose `import` throws at load time.
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } } },
  },
  renderer: {
    plugins: [react(), UnoCSS()],
    resolve: sharedAlias,
  },
});
