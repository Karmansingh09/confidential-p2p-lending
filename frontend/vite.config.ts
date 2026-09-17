import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'contracts': path.resolve(__dirname, './src/lib/contracts-client-facade.ts'),
      '@contracts': path.resolve(__dirname, './src/lib/contracts-client-facade.ts'),
    },
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
  },
});
