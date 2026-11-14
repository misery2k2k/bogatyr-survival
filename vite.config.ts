import { defineConfig, type Plugin } from 'vite';

/** CrazyGames просит подключать SDK в <head>, до кода игры. */
const crazyGamesSdk = (): Plugin => ({
  name: 'crazygames-sdk',
  transformIndexHtml: () => [{ tag: 'script', attrs: { src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' }, injectTo: 'head' }],
});

// Сборка для Яндекса: npm run build (dist/). Для CrazyGames: npm run build:cg (--mode crazygames → dist-cg/,
// площадка берётся из .env.crazygames).
export default defineConfig(({ mode }) => {
  const cg = mode === 'crazygames';
  return {
    // Относительные пути: обе площадки раздают архив не из корня домена
    base: './',
    plugins: cg ? [crazyGamesSdk()] : [],
    server: { port: 5173, host: true },
    build: {
      outDir: cg ? 'dist-cg' : 'dist',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 2000,
    },
  };
});
