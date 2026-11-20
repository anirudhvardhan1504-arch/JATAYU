import { defineConfig, Plugin, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
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

export default defineConfig(({ mode }) => {
  // Read only the backend port; never expose backend credentials to the browser.
  const backendEnv = loadEnv(mode, fileURLToPath(new URL('../backend/', import.meta.url)), 'PORT');
  const rootEnv = loadEnv(mode, fileURLToPath(new URL('../', import.meta.url)), 'VITE_BACKEND_URL');
  const backendPort = process.env.PORT || backendEnv.PORT || '5000';
  const backendTarget = process.env.VITE_BACKEND_URL || rootEnv.VITE_BACKEND_URL || `http://localhost:${backendPort}`;
  return {
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
  };
});
