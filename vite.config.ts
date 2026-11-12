import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 25,
            },
            {
              name: 'vendor-jspdf',
              test: /node_modules[\\/](jspdf|jspdf-autotable|fflate|fast-png|iobuffer|pako)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-canvg',
              test: /node_modules[\\/](canvg|core-js|svg-pathdata|rgbcolor|stackblur-canvas|raf|@babel\/runtime|regenerator-runtime)[\\/]/,
              priority: 18,
            },
            {
              name: 'vendor-icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});
