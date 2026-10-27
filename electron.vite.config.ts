import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import UnoCSS from '@unocss/vite';
import path from 'node:path';

const sharedAlias = { alias: { '@shared': path.resolve(__dirname, 'src/shared') } };

/**
 * Renderer Content-Security-Policy, injected into built HTML only — dev needs
 * Vite's inline React-refresh preamble and HMR websocket, which this blocks.
 * Remote hosts: Google Fonts (stylesheet + font files) and Hugging Face (Whisper
 * model downloads; HF redirects weights to *.huggingface.co / *.hf.co CDNs).
 * No script host is allowed: onnxruntime WASM ships in the bundle (voice-worker).
 */
export const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function rendererCsp(): Plugin {
  return {
    name: 'vibes-renderer-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: RENDERER_CSP }, injectTo: 'head-prepend' },
    ],
  };
}

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
    plugins: [react(), UnoCSS(), rendererCsp()],
    resolve: {
      alias: {
        ...sharedAlias.alias,
        // onnxruntime-web's exports map hides dist/; the voice worker imports its
        // WASM runtime files from here as bundled assets (?url) instead of the CDN.
        'ort-dist': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist'),
      },
    },
  },
});
