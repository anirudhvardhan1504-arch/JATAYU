import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

/**
 * Vite plugin that strips the static Cesium.js and widgets.css tags injected by vite-plugin-cesium
 * from index.html, ensuring Cesium is only downloaded on demand by authorized operators.
 */
function cesiumDeferredLoaderPlugin(): Plugin {
  return {
    name: 'cesium-deferred-loader-cleaner',
    enforce: 'post',
    transformIndexHtml(html: string) {
      return html
        .replace(/<link[^>]+href="[^"]*cesium[^"]*widgets\.css"[^>]*>\s*/gi, '')
        .replace(/<script[^>]+src="[^"]*cesium[^"]*Cesium\.js"[^>]*><\/script>\s*/gi, '');
    },
  };
}

const backendTarget = process.env.VITE_BACKEND_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:5001');

export default defineConfig({
  envDir: '../',
  plugins: [
    react(),
    cesium({
      cesiumBuildRootPath: '../node_modules/cesium/Build',
      cesiumBuildPath: '../node_modules/cesium/Build/Cesium/',
      devMinifyCesium: true,
    }),
    cesiumDeferredLoaderPlugin(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-maplibre': ['maplibre-gl'],
          'vendor-recharts': ['recharts'],
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
