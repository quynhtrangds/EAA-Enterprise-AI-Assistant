import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: process.env.CHAT_UI_PORT ? parseInt(process.env.CHAT_UI_PORT) : 3000,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.AI_ORCHESTRATOR_URL || 'http://127.0.0.1:8082',
        changeOrigin: true,
        secure: false
      }
    }
  }
})