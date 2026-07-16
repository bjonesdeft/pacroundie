import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Dev/preview use `/` so Cursor Simple Browser & local hosts work.
// Production build keeps the GitHub Pages project path.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/pacroundie/' : '/',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scores: resolve(__dirname, 'scores.html'),
      },
    },
  },
}))
