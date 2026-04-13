import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/orders': 'http://localhost:3001',
      '/fleet': 'http://localhost:3001',
      '/analytics': 'http://localhost:3001',
      '/customers': 'http://localhost:3001',
      '/plants': 'http://localhost:3001',
      '/mix-designs': 'http://localhost:3001',
    },
  },
});
