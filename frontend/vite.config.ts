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
      // SPA routes that collide with API paths need bypass to serve
      // index.html for browser navigations (Accept: text/html)
      '/orders': {
        target: 'http://localhost:3001',
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/fleet': {
        target: 'http://localhost:3001',
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/analytics': {
        target: 'http://localhost:3001',
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/mix-designs': {
        target: 'http://localhost:3001',
        bypass(req) {
          if (req.headers.accept?.includes('text/html')) return '/index.html';
        },
      },
      '/customers': 'http://localhost:3001',
      '/plants': 'http://localhost:3001',
      '/schedule': 'http://localhost:3001',
    },
  },
});
