/**
 * NASA GIBS Satellite Raster Service for JATAYU Tactical Map 2.0
 *
 * Integrates NASA Global Imagery Browse Services (GIBS) Web Map Tile Service (WMTS)
 * standard EPSG:3857 (Web Mercator) raster tiles.
 *
 * Provides two primary operational modes:
 * 1. LIVE SATELLITE (Geostationary 10-minute cadence via Himawari-9 AHI):
 *    - Infrared (Band 13, 10.4 µm Clean IR) - all weather, day & night
 *    - Visible (Band 3, 0.64 µm Red) - high-resolution optical, daytime only
 *    - Air Mass RGB Composite - upper tropospheric dynamics & jet streams
 * 2. HD SATELLITE (Daily 250m polar-orbiting True Color composites):
 *    - VIIRS NOAA-20 Corrected Reflectance True Color
 *    - MODIS Terra Corrected Reflectance True Color
 */

export type SatelliteMode = 'live' | 'hd';
export type LiveSatelliteChannel = 'ir' | 'visible' | 'airmass';
export type HDSatelliteProduct = 'viirs' | 'modis';
export type SatelliteProductKey = LiveSatelliteChannel | HDSatelliteProduct;

export interface SatelliteProductConfig {
  key: SatelliteProductKey;
  mode: SatelliteMode;
  name: string;
  shortLabel: string;
  layerId: string;
  tileMatrixSet: string;
  format: 'png' | 'jpg';
  minZoom: number;
  maxZoom: number;
  nativeResolution: string;
  cadence: string;
  latencyNote: string;
  attribution: string;
  description: string;
  isDaylightOnly?: boolean;
}

export const SATELLITE_PRODUCTS: Record<SatelliteProductKey, SatelliteProductConfig> = {
  ir: {
    key: 'ir',
    mode: 'live',
    name: 'Himawari-9 Clean Infrared (Band 13)',
    shortLabel: 'Infrared (10.4 µm)',
    layerId: 'Himawari_AHI_Band13_Clean_Infrared',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    minZoom: 0,
    maxZoom: 6,
    nativeResolution: '2 km at nadir (140.7°E)',
    cadence: '10 minutes',
    latencyNote: '~40 min GIBS processing latency',
    attribution: 'NASA GIBS / JMA Himawari-9 AHI',
    description: 'Clean infrared brightness temperature (10.4 µm). Detects convective cloud tops day and night.',
  },
  visible: {
    key: 'visible',
    mode: 'live',
    name: 'Himawari-9 Red Visible (Band 3)',
    shortLabel: 'Visible (0.64 µm)',
    layerId: 'Himawari_AHI_Band3_Red_Visible_1km',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    minZoom: 0,
    maxZoom: 7,
    nativeResolution: '1 km at nadir (140.7°E)',
    cadence: '10 minutes',
    latencyNote: '~40 min GIBS processing latency',
    attribution: 'NASA GIBS / JMA Himawari-9 AHI',
    description: 'High-resolution optical visible band. Only illuminated during daylight hours (01:00-11:00 UTC for India).',
    isDaylightOnly: true,
  },
  airmass: {
    key: 'airmass',
    mode: 'live',
    name: 'Himawari-9 Air Mass RGB',
    shortLabel: 'Air Mass RGB',
    layerId: 'Himawari_AHI_Air_Mass',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    minZoom: 0,
    maxZoom: 6,
    nativeResolution: '2 km at nadir (140.7°E)',
    cadence: '10 minutes',
    latencyNote: '~40 min GIBS processing latency',
    attribution: 'NASA GIBS / JMA Himawari-9 AHI',
    description: 'Multi-spectral RGB composite diagnosing dry stratospheric air intrusions, jet streaks, and tropopause height.',
  },
  viirs: {
    key: 'viirs',
    mode: 'hd',
    name: 'VIIRS NOAA-20 True Color',
    shortLabel: 'VIIRS True Color (250m)',
    layerId: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    minZoom: 0,
    maxZoom: 9,
    nativeResolution: '250 m at equator',
    cadence: 'Daily composite',
    latencyNote: 'Daily polar-orbiting swath composite',
    attribution: 'NASA GIBS / NOAA-20 VIIRS',
    description: 'High-definition 250m corrected reflectance True Color optical imagery from polar-orbiting NOAA-20.',
  },
  modis: {
    key: 'modis',
    mode: 'hd',
    name: 'MODIS Terra True Color',
    shortLabel: 'MODIS Terra (250m)',
    layerId: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpg',
    minZoom: 0,
    maxZoom: 9,
    nativeResolution: '250 m at equator',
    cadence: 'Daily composite',
    latencyNote: 'Daily polar-orbiting swath composite',
    attribution: 'NASA GIBS / EOSDIS MODIS Terra',
    description: 'High-definition 250m optical imagery from EOS Terra morning pass (~10:30 AM local solar time).',
  },
};

/**
 * Geographic viewing geometry context for Indian operational sectors.
 * Himawari-9 is positioned at geostationary orbital longitude 140.7°E.
 * Full-disk coverage spans 70°E to 150°W.
 */
export const SECTOR_VIEWING_CHARACTERISTICS: Record<string, { viewingAngle: string; qualityNote: string }> = {
  Mumbai: {
    viewingAngle: '~72° satellite zenith angle (Western limb boundary)',
    qualityNote: 'Foreshortening near disk edge; high-altitude cirrus well-captured.',
  },
  Chennai: {
    viewingAngle: '~63° satellite zenith angle',
    qualityNote: 'Favorable viewing angle across Bay of Bengal.',
  },
  Guwahati: {
    viewingAngle: '~50° satellite zenith angle (Near central disk)',
    qualityNote: 'Optimal geostationary resolution across Northeast India and Brahmaputra basin.',
  },
  Kolkata: {
    viewingAngle: '~52° satellite zenith angle',
    qualityNote: 'Optimal viewing angle across Bengal Delta.',
  },
  Dehradun: {
    viewingAngle: '~67° satellite zenith angle',
    qualityNote: 'Moderate slant angle across Western Himalayan foothills.',
  },
};

/**
 * Returns latest completed composite date (YYYY-MM-DD) for daily polar-orbiting products (MODIS/VIIRS).
 * Downlink and GIBS processing pipelines complete previous day's global mosaic.
 */
export function getLatestCompletedCompositeDate(): string {
  const now = new Date();
  // If current UTC hour is < 14, today's daily polar mosaic is incomplete; use yesterday
  if (now.getUTCHours() < 14) {
    now.setUTCDate(now.getUTCDate() - 1);
  }
  return now.toISOString().slice(0, 10);
}

/**
 * Builds standard NASA GIBS EPSG:3857 WMTS REST tile URL template for MapLibre raster sources.
 *
 * NASA GIBS accepts:
 * - 'default' as {Time} for live geostationary feeds (Himawari-9 AHI).
 * - Explicit UTC date e.g. '2026-11-12' for daily polar composites (MODIS/VIIRS).
 */
export function getSatelliteTileUrl(
  productKey: SatelliteProductKey,
  timeOrDate: string = 'default'
): string {
  const config = SATELLITE_PRODUCTS[productKey];
  if (!config) {
    throw new Error(`Unknown satellite product key: ${productKey}`);
  }

  // Daily polar composites require completed date to avoid empty / 1665B tiles
  let effectiveTime = timeOrDate;
  if (config.mode === 'hd' && timeOrDate === 'default') {
    effectiveTime = getLatestCompletedCompositeDate();
  }

  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${config.layerId}/default/${effectiveTime}/${config.tileMatrixSet}/{z}/{y}/{x}.${config.format}`;
}

/**
 * Returns estimated observation timestamp metadata for live Himawari-9 geostationary frames.
 * Accounting for the empirical ~40-minute GIBS pipeline ingestion latency.
 */
export function getEstimatedLiveObservationTime(): {
  observationIso: string;
  observationTimeLabel: string;
  latencyMinutes: number;
} {
  const now = new Date();
  // Estimated latest frame timestamp: 40 minutes in past, rounded down to 10-minute boundary
  const latencyMs = 40 * 60 * 1000;
  const targetTime = new Date(now.getTime() - latencyMs);
  const minutes = Math.floor(targetTime.getUTCMinutes() / 10) * 10;
  targetTime.setUTCMinutes(minutes, 0, 0);

  return {
    observationIso: targetTime.toISOString(),
    observationTimeLabel: `${targetTime.toISOString().slice(11, 16)} UTC (approx.)`,
    latencyMinutes: 40,
  };
}
