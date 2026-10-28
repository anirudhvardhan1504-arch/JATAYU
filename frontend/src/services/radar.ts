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
  satellite?: {
    infrared?: RainViewerRadarFrame[];
  };
}

export interface RainViewerRadarInfo {
  host: string;
  latestPath: string;
  timestamp: number;
  tileUrl: string;
  sourceAttribution: string;
}

export interface RadarAnimationFrame {
  time: number;
  path: string;
  tileUrl: string;
  label: string;
  relativeTime: string;
}

export interface RainViewerTimeline {
  host: string;
  radarFrames: RadarAnimationFrame[];
  satelliteFrames: RadarAnimationFrame[];
  satelliteAvailable: boolean;
  generated: number;
  sourceAttribution: string;
}

/**
 * Fetch latest RainViewer radar metadata.
 * Free, public API with 256x256 standard EPSG:3857 raster tiles.
 */
export async function getLatestRadarInfo(): Promise<RainViewerRadarInfo | null> {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
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

/**
 * Fetch full radar animation timeline and satellite frame metadata.
 */
export async function getRainViewerTimeline(): Promise<RainViewerTimeline | null> {
  try {
    const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!response || !response.ok) {
      return null;
    }

    const data: RainViewerMetadata = await response.json();
    const host = data.host || 'https://tilecache.rainviewer.com';
    const past = data.radar?.past || [];
    const nowcast = data.radar?.nowcast || [];
    const allRadar = [...past, ...nowcast];

    const nowSec = Math.floor(Date.now() / 1000);

    const radarFrames: RadarAnimationFrame[] = allRadar.map((f) => {
      const diffMin = Math.round((f.time - nowSec) / 60);
      let relativeTime = `${Math.abs(diffMin)}m ago`;
      if (Math.abs(diffMin) < 5) relativeTime = 'Live';
      else if (diffMin > 0) relativeTime = `+${diffMin}m`;

      const dateObj = new Date(f.time * 1000);
      const label = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        time: f.time,
        path: f.path,
        tileUrl: `${host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
        label,
        relativeTime,
      };
    });

    const satInfrared = data.satellite?.infrared || [];
    const satelliteFrames: RadarAnimationFrame[] = satInfrared.map((f) => {
      const diffMin = Math.round((f.time - nowSec) / 60);
      const dateObj = new Date(f.time * 1000);
      return {
        time: f.time,
        path: f.path,
        tileUrl: `${host}${f.path}/256/{z}/{x}/{y}/0/0_0.png`,
        label: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relativeTime: `${Math.abs(diffMin)}m ago`,
      };
    });

    return {
      host,
      radarFrames,
      satelliteFrames,
      satelliteAvailable: satelliteFrames.length > 0,
      generated: data.generated,
      sourceAttribution: 'RainViewer International Meteorological Composite',
    };
  } catch (err) {
    console.warn('Failed to load RainViewer timeline:', err);
    return null;
  }
}
