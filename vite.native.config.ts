import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** Relative-asset build for the iOS / macOS WKWebView shell. */
export default defineConfig({
  base: './',
  build: {
    outDir: resolve(__dirname, 'native/OrbiPac/Web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scores: resolve(__dirname, 'scores.html'),
      },
    },
  },
})
