import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // listen on 0.0.0.0 so ngrok / LAN can reach it
    allowedHosts: true,  // accept the ngrok domain as a Host header
    proxy: {
      // UI calls /api/... and the /ws socket on its own origin; forward both to
      // the backend. Capture requests go straight to the backend origin
      // (see VITE_INGEST_BASE), not through this proxy.
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, changeOrigin: true, ws: true },
    },
  },
});
