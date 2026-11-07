import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/category-api': {
        target: 'http://localhost:8080/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/category-api/, ''),
        headers: {
          Origin: 'http://localhost:5173',
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: ['./src/test/setup.ts'],
  },
})
