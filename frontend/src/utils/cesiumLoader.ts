/**
 * Dynamic On-Demand Cesium Runtime Loader
 *
 * Ensures that the multi-megabyte Cesium 3D geospatial engine is only loaded
 * when an authenticated operator explicitly accesses the 3D Command Globe.
 * Citizens accessing Overview, 2D MapLibre, Alerts, Weather, Risk, and AI
 * never download or initialize Cesium.
 *
 * Guarantees:
 * - Injects <script src="/cesium/Cesium.js"> once into document.head
 * - Deduplicates script injection on repeated navigation
 * - Preserves window.CESIUM_BASE_URL = '/cesium/' for workers, shaders, and assets
 * - Provides graceful error handling and configurable timeout for network failures
 */

let loadPromise: Promise<any> | null = null;

export interface CesiumLoaderOptions {
  scriptUrl?: string;
  timeoutMs?: number;
}

export function isCesiumLoaded(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).Cesium !== 'undefined';
}

export function loadCesium(options: CesiumLoaderOptions = {}): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Cesium runtime cannot be loaded outside a browser environment.'));
  }

  // If Cesium is already initialized on window, resolve immediately
  if ((window as any).Cesium) {
    return Promise.resolve((window as any).Cesium);
  }

  // If a script load is currently in-flight, return the existing promise
  if (loadPromise) {
    return loadPromise;
  }

  const scriptUrl = options.scriptUrl || '/cesium/Cesium.js';
  const timeoutMs = options.timeoutMs ?? 25000;

  loadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      if ((window as any).Cesium) {
        resolve((window as any).Cesium);
        return;
      }
      const handleLoad = () => {
        if ((window as any).Cesium) {
          resolve((window as any).Cesium);
        } else {
          loadPromise = null;
          reject(new Error('Cesium script loaded but window.Cesium is not defined.'));
        }
      };
      const handleError = () => {
        loadPromise = null;
        reject(new Error(`Failed to load Cesium runtime from ${scriptUrl}`));
      };
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    // Ensure CESIUM_BASE_URL is set before script execution
    if (!(window as any).CESIUM_BASE_URL) {
      (window as any).CESIUM_BASE_URL = '/cesium/';
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;

    let timeoutId: any = null;
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        loadPromise = null;
        script.remove();
        reject(new Error(`Cesium runtime loading timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }

    script.onload = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if ((window as any).Cesium) {
        resolve((window as any).Cesium);
      } else {
        loadPromise = null;
        reject(new Error('Cesium script loaded but window.Cesium is not defined.'));
      }
    };

    script.onerror = () => {
      if (timeoutId) clearTimeout(timeoutId);
      loadPromise = null;
      script.remove();
      reject(new Error(`Network error loading Cesium 3D engine from ${scriptUrl}`));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Resets the loader state (used in automated test suites).
 */
export function resetCesiumLoaderForTesting(): void {
  loadPromise = null;
}
