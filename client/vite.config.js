import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Tells Vite to skip pre-bundling maplibre-gl and its worker file
    exclude: ['maplibre-gl']
  }
});