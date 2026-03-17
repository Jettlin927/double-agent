import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { envSavePlugin } from './vite-env-save-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), envSavePlugin()],
  server: {
    proxy: {
      // Backend API proxy (new)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Don't rewrite - backend expects /api prefix
      },
      // Keep existing proxies for backward compatibility
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openai/, ''),
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
    },
  },
})
