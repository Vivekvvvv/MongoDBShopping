import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    build: {
      // build into repo-root /dist so Express can serve it
      outDir: path.resolve(__dirname, '..', 'dist'),
      emptyOutDir: true
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': 'http://localhost:3001',
        '/uploads': 'http://localhost:3001',
        '/images': 'http://localhost:3001',
        '/style.css': 'http://localhost:3001'
      }
    }
  };
});
