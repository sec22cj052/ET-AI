import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/ingest': 'http://localhost:8000',
      '/query': 'http://localhost:8000',
      '/graph': 'http://localhost:8000',
      '/agents': 'http://localhost:8000',
      '/tacit-knowledge': 'http://localhost:8000',
    }
  }
})
