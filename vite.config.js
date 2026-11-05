import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Send local API requests to Express while Vite runs the frontend.
      '/api': 'http://localhost:5000'
    }
  }
});
