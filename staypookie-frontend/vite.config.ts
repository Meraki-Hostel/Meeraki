import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command, mode }) => {
  // The real app has no offline/demo mode: a build without an API URL is a mistake, so fail it.
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required to build staypookie-frontend (e.g. https://api.example.com/api/v1). The demo prototype is the separate /prototype app.');
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom'] },
        },
      },
    },
  };
});
