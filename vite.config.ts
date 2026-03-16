import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { envSavePlugin } from './vite-env-save-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), envSavePlugin()],
  server: {
    proxy: {
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
