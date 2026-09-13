import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/wirefactory/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdf-lib') || id.includes('@pdf-lib') || id.includes('pako')) {
            return 'pdf-vendor'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/zustand')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  preview: { host: '127.0.0.1', port: 4175, strictPort: true },
})
