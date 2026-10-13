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
  },
  renderer: {
    plugins: [react(), UnoCSS()],
    resolve: sharedAlias,
  },
});
