import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/public/**', '**/dist/**', '**/node_modules/**'] },
    },
    build: {
      target: 'es2020',
      copyPublicDir: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('preload-helper')) {
              return 'preload-helper';
            }
            if (id.includes('node_modules')) {
              const normalized = id.replace(/\\/g, '/');
              if (
                normalized.includes('/node_modules/react/') ||
                normalized.includes('/node_modules/react-dom/') ||
                normalized.includes('/node_modules/scheduler/')
              ) {
                return 'vendor-react';
              }
              if (normalized.includes('/node_modules/three/')) {
                return 'vendor-three';
              }
              if (
                normalized.includes('/node_modules/jspdf/') ||
                normalized.includes('/node_modules/jspdf-autotable/')
              ) {
                return 'vendor-pdf';
              }
              if (normalized.includes('/node_modules/@supabase/')) {
                return 'vendor-supabase';
              }
            }
          },
        },
      },
    },
  };
});
