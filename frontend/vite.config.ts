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

export default defineConfig({
  plugins: [
    react(),
    cesium({
      cesiumBuildPath: '../node_modules/cesium/Build/Cesium/',
    }),
    cesiumDeferredLoaderPlugin(),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
