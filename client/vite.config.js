import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://localhost:3443',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
})
