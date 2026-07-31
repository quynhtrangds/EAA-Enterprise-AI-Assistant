import { defineConfig } from 'vitest/config'
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
      '/api/admin': {
        target: process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8081',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: process.env.AI_ORCHESTRATOR_URL || 'http://ai-orchestrator:8082',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', 'e2e/**'],
  }
})
