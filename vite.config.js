import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:2000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:2000', changeOrigin: true },
    },
  },
  preview: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:2000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:2000', changeOrigin: true },
    },
  },
})
