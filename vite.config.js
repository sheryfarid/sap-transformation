import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite serves the UI on :5173 and forwards /api to the Node server on :8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: 'localhost',
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
