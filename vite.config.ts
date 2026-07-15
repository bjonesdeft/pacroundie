import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Project Pages URL: https://bjonesdeft.github.io/pacroundie/
export default defineConfig({
  base: '/pacroundie/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        scores: resolve(__dirname, 'scores.html'),
      },
    },
  },
})
