import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.VITE_STRIPE_PUBLIC_KEY_PROD': JSON.stringify(process.env.VITE_STRIPE_PUBLIC_KEY_PROD),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true
  }
});