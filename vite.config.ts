import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for built assets to work in Chrome extension
  server: {
    proxy: {
      '/dashscope': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dashscope/, ''),
        proxyTimeout: 120000,
        timeout: 120000,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
