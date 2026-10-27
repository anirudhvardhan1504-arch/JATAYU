export interface RainViewerRadarFrame {
  time: number;
  path: string;
}

export interface RainViewerMetadata {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerRadarFrame[];
    nowcast: RainViewerRadarFrame[];
  };
}

export interface RainViewerRadarInfo {
  host: string;
  latestPath: string;
  timestamp: number;
  tileUrl: string;
  sourceAttribution: string;
}

/**
 * Fetch latest RainViewer radar metadata.
 * Free, public API with 256x256 standard EPSG:3857 raster tiles.
 */
export async function getLatestRadarInfo(): Promise<RainViewerRadarInfo | null> {
  try {
    let fetchOptions: RequestInit = {};
    let timer: any = null;
    if (typeof AbortController !== 'undefined') {
      try {
        const controller = new AbortController();
        timer = setTimeout(() => {
          try {
            controller.abort();
          } catch {}
        }, 6000);
        fetchOptions.signal = controller.signal;
      } catch {}
    }

    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json', fetchOptions);
    if (timer) clearTimeout(timer);

    if (!response.ok) {
      console.warn(`RainViewer API returned status ${response.status}`);
      return null;
    }

    const data: RainViewerMetadata = await response.json();
    const pastFrames = data.radar?.past || [];
    if (pastFrames.length === 0) {
      return null;
    }

    // Pick latest past frame
    const latest = pastFrames[pastFrames.length - 1];
    const host = data.host || 'https://tilecache.rainviewer.com';
    // Tile URL template for MapLibre raster source: {z}/{x}/{y}/2/1_1.png (color scheme 2: Universal Blue, smooth 1, snow 1)
    const tileUrl = `${host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;

    return {
      host,
      latestPath: latest.path,
      timestamp: latest.time,
      tileUrl,
      sourceAttribution: 'RainViewer Radar Composite',
    };
  } catch (err) {
    console.warn('Failed to fetch RainViewer radar metadata:', err);
    return null;
  }
}
