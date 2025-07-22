import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.STRIPE_PUBLIC_KEY': JSON.stringify(process.env.STRIPE_PUBLIC_KEY),
    'process.env.STRIPE_SECRET_KEY': JSON.stringify(process.env.STRIPE_SECRET_KEY),
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/components/BookingSummary/__tests__/setup.ts'],
    globals: true
  }
});