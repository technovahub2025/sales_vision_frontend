import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/test-salesvision/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react_vendor';
          }
          if (id.includes('node_modules/react-router-dom')) {
            return 'router_vendor';
          }
          if (id.includes('node_modules/axios') || id.includes('node_modules/socket.io-client')) {
            return 'network_vendor';
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query_vendor';
          }
          if (
            id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/@hookform/resolvers') ||
            id.includes('node_modules/zod')
          ) {
            return 'form_vendor';
          }
          return undefined;
        },
      },
    },
  },
})
