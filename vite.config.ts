import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути: Яндекс Игры раздают архив не из корня домена
  base: './',
  server: { port: 5173, host: true },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
});
