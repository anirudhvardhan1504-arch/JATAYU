/**
 * Forecast Maps Data Service for JATAYU Tactical Map 2.0
 *
 * Provides typed ingestion, accessors, units, and validation for
 * 72-hour Numerical Weather Prediction (NWP) forecast grids.
 *
 * Supported Models:
 * - Primary: ECMWF IFS Open Data (0.25° regular lat/lon)
 * - Fallback: NOAA GFS (0.25° regular/Gaussian lat/lon)
 *
 * Spatial Topology:
 * - Hierarchical Adaptive Mesh: 5 Operational Mesoscale Sector Clusters (0.25°)
 *   and National Synoptic Macro-Grid (1.5° spacing across India).
 *
 * Timeline Topology:
 * - Discrete hourly timesteps from T+0 (initialization time) to T+71 (72 total timesteps).
 * - No temporal interpolation or fabricated frames.
 */

import { fetchJson } from './api';

// ============================================================================
// Core Types & Contracts
// ============================================================================

export type OperationalSectorKey = 'mumbai' | 'chennai' | 'guwahati' | 'kolkata' | 'dehradun';
export type ForecastGridMode = 'sector' | 'national';
export type ForecastProductType = 'precipitation' | 'wind' | 'temperature' | 'humidity' | 'pressure';

export interface HourlyGridDataPoint {
  /** ISO UTC timestamp, e.g. '2026-11-13T00:00' */
  time: string;
  /** Total precipitation in preceding 1 hour (mm) */
  precipitationMm: number;
  /** Large-scale liquid rain in preceding 1 hour (mm) */
  rainMm: number;
  /** Convective convective showers in preceding 1 hour (mm) */
  showersMm: number;
  /** 2-meter air temperature (°C) */
  temperatureC: number;
  /** Apparent temperature / heat index (°C) */
  apparentTemperatureC: number;
  /** Relative humidity at 2m (%) */
  relativeHumidityPercent: number;
  /** Mean Sea Level Pressure (hPa) */
  pressureMslHpa: number;
  /** Atmospheric pressure at ground elevation (hPa) */
  surfacePressureHpa: number;
  /** 10-meter wind speed (km/h) */
  windSpeedKmh: number;
  /** 10-meter wind direction (0-360° meteorological, originating direction) */
  windDirectionDegrees: number;
  /** Maximum wind gusts in preceding hour (km/h) */
  windGustsKmh: number;
  /** U-component of wind velocity vector (eastward, m/s) */
  uMs: number;
  /** V-component of wind velocity vector (northward, m/s) */
  vMs: number;
}

export interface ForecastGridNode {
  /** Original coordinate requested by JATAYU mesh */
  requestedLat: number;
  requestedLon: number;
  /** Snapped model grid latitude returned by NWP provider */
  modelLat: number;
  /** Snapped model grid longitude returned by NWP provider */
  modelLon: number;
  /** Model topography elevation in meters */
  elevationM: number;
  /** Operational sector identifier if node belongs to a mesoscale cluster */
  sectorKey?: OperationalSectorKey;
  /** 72-hour discrete hourly forecast time-series (T+0 to T+71) */
  hourly: HourlyGridDataPoint[];
  /** Pre-calculated 24-hour total precipitation accumulation (mm) */
  accum24hMm: number;
  /** Pre-calculated 72-hour total precipitation accumulation (mm) */
  accum72hMm: number;
  /** Maximum wind gust over full 72-hour window (km/h) */
  maxWindGustKmh: number;
  /** Minimum mean sea level pressure over full 72-hour window (hPa) */
  minPressureMslHpa: number;
}

export interface ForecastGridMetadata {
  /** Upstream provider identification */
  provider: string;
  /** Numerical weather prediction model and nominal resolution */
  model: string;
  /** Native resolution disclosure (e.g. '0.25° (~28 km) regular lat/lon') */
  nativeResolution: string;
  /** Provider output grid (e.g. '0.25° regular latitude/longitude') */
  providerOutputGrid?: string;
  /** True when primary provider (ECMWF) failed and failover (NOAA GFS) was activated */
  isFallback: boolean;
  /** Explanation of why fallback was activated */
  fallbackReason?: string;
  /** Synoptic model assimilation run cycle: 00Z, 06Z, 12Z, 18Z, or UNKNOWN */
  runCycle: '00Z' | '06Z' | '12Z' | '18Z' | 'UNKNOWN';
  /** Model run initialization timestamp (ISO UTC) */
  initializationTime: string;
  /** Server processing completion timestamp (ISO UTC) */
  generatedAt: string;
  /** First valid forecast timestep timestamp (T+0, ISO UTC) */
  validStartTime: string;
  /** Final valid forecast timestep timestamp (T+71, ISO UTC) */
  validEndTime: string;
  /** Total discrete timesteps in series (72) */
  totalTimesteps: number;
  /** Total geographic nodes requested */
  gridNodeCount: number;
  /** Unique model coordinates after physical grid deduplication */
  deduplicatedNodeCount: number;
  /** Grid mode: 'sector' or 'national' */
  mode: ForecastGridMode;
  /** Active sector key when in sector mode */
  activeSector?: OperationalSectorKey;
  /** Scientific transparency disclosure */
  isInterpolatedMesh: boolean;
  disclosure: string;
  attribution: string;
  /** True if serving cached data during upstream outage or budget exhaustion */
  isStale: boolean;
  staleReason?: string;
  staleSince?: string;
  /** In-memory cache TTL in milliseconds */
  cacheTtlMs: number;
  /** Number of upstream location evaluations billed for this grid */
  billableCallsIncurred: number;
  /** Remaining daily budget calls under safe threshold */
  dailyBudgetRemaining: number;
}

export interface ForecastGridResponse {
  metadata: ForecastGridMetadata;
  nodes: ForecastGridNode[];
}

export interface TimestepOffset {
  /** 0-based array index (0 to 71) */
  index: number;
  /** Forecast lead hour offset from model initialization (T+0 to T+71) */
  offsetHours: number;
  /** Display label, e.g. 'T+00h', 'T+24h' */
  label: string;
  /** ISO UTC timestamp for this valid hour */
  time: string;
}

// ============================================================================
// Product Metadata & Scale Configurations
// ============================================================================

export interface ForecastProductConfig {
  type: ForecastProductType;
  name: string;
  shortLabel: string;
  unit: string;
  primaryVariable: string;
  description: string;
  minValue: number;
  maxValue: number;
  colorRamp: { value: number; color: string; label: string }[];
}

export const FORECAST_PRODUCTS: Record<ForecastProductType, ForecastProductConfig> = {
  precipitation: {
    type: 'precipitation',
    name: 'Precipitation Rate & Accumulation',
    shortLabel: 'Precipitation',
    unit: 'mm/h',
    primaryVariable: 'precipitationMm',
    description: 'Preceding 1-hour total precipitation accumulation from ECMWF/GFS NWP assimilation.',
    minValue: 0,
    maxValue: 100,
    colorRamp: [
      { value: 0.1, color: '#e0f3f8', label: '0.1 mm/h (Trace)' },
      { value: 2.5, color: '#67a9cf', label: '2.5 mm/h (Light)' },
      { value: 7.5, color: '#02818a', label: '7.5 mm/h (Moderate)' },
      { value: 15.0, color: '#fed976', label: '15 mm/h (Heavy)' },
      { value: 30.0, color: '#fd8d3c', label: '30 mm/h (Very Heavy)' },
      { value: 50.0, color: '#e31a1c', label: '50 mm/h (Extremely Heavy)' },
      { value: 100.0, color: '#800026', label: '100+ mm/h (Torrential)' },
    ],
  },
  wind: {
    type: 'wind',
    name: '10m Surface Wind & Gusts',
    shortLabel: 'Wind Field',
    unit: 'km/h',
    primaryVariable: 'windSpeedKmh',
    description: '10-meter above ground level wind speed, direction vectors, and 1-hour maximum gusts.',
    minValue: 0,
    maxValue: 180,
    colorRamp: [
      { value: 10, color: '#4575b4', label: '10 km/h (Light Breeze)' },
      { value: 30, color: '#91bfdb', label: '30 km/h (Moderate)' },
      { value: 50, color: '#fee090', label: '50 km/h (Strong)' },
      { value: 65, color: '#fc8d59', label: '65 km/h (Gale / Cyclonic)' },
      { value: 90, color: '#d73027', label: '90 km/h (Severe Storm)' },
      { value: 120, color: '#a50026', label: '120+ km/h (Hurricane Force)' },
    ],
  },
  temperature: {
    type: 'temperature',
    name: '2m Air Temperature',
    shortLabel: 'Temperature',
    unit: '°C',
    primaryVariable: 'temperatureC',
    description: '2-meter above ground level dry-bulb air temperature and apparent heat index.',
    minValue: -10,
    maxValue: 50,
    colorRamp: [
      { value: 0, color: '#313695', label: '0°C (Freezing)' },
      { value: 15, color: '#74add1', label: '15°C (Cool)' },
      { value: 25, color: '#e0f3f8', label: '25°C (Comfortable)' },
      { value: 35, color: '#fdae61', label: '35°C (Hot)' },
      { value: 42, color: '#f46d43', label: '42°C (Heatwave)' },
      { value: 48, color: '#a50026', label: '48°C (Severe Heatwave)' },
    ],
  },
  humidity: {
    type: 'humidity',
    name: '2m Relative Humidity',
    shortLabel: 'Humidity',
    unit: '%',
    primaryVariable: 'relativeHumidityPercent',
    description: '2-meter above ground level atmospheric moisture saturation percentage.',
    minValue: 0,
    maxValue: 100,
    colorRamp: [
      { value: 20, color: '#ffffd4', label: '20% (Arid)' },
      { value: 40, color: '#fed98e', label: '40% (Dry)' },
      { value: 60, color: '#fe9929', label: '60% (Moderate)' },
      { value: 80, color: '#41b6c4', label: '80% (Humid)' },
      { value: 95, color: '#225ea8', label: '95%+ (Saturated)' },
    ],
  },
  pressure: {
    type: 'pressure',
    name: 'Mean Sea Level Pressure',
    shortLabel: 'MSLP',
    unit: 'hPa',
    primaryVariable: 'pressureMslHpa',
    description: 'Atmospheric pressure reduced to mean sea level, critical for cyclonic depression detection.',
    minValue: 950,
    maxValue: 1040,
    colorRamp: [
      { value: 980, color: '#49006a', label: '< 980 hPa (Severe Cyclone / Deep Low)' },
      { value: 995, color: '#ae017e', label: '995 hPa (Cyclonic Depression)' },
      { value: 1005, color: '#f768a1', label: '1005 hPa (Low Pressure Area)' },
      { value: 1013, color: '#fa9fb5', label: '1013.25 hPa (Standard Atmospheric)' },
      { value: 1025, color: '#fde0dd', label: '1025+ hPa (High Pressure Anticyclone)' },
    ],
  },
};

// ============================================================================
// Service Constants & Client Caching
// ============================================================================

export const FORECAST_TOTAL_TIMESTEPS = 72;
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client-side memory cache

interface ClientCacheEntry {
  response: ForecastGridResponse;
  cachedAt: number;
}

const clientCache = new Map<string, ClientCacheEntry>();

// ============================================================================
// Core Service API
// ============================================================================

/**
 * Retrieves the 72-hour forecast grid from the JATAYU backend.
 *
 * @param mode 'sector' (mesoscale cluster) or 'national' (synoptic macro grid)
 * @param sector 'mumbai' | 'chennai' | 'guwahati' | 'kolkata' | 'dehradun'
 * @param forceRefresh Bypass client and backend caches
 */
export async function getForecastGrid(
  mode: ForecastGridMode = 'sector',
  sector: OperationalSectorKey = 'mumbai',
  forceRefresh: boolean = false
): Promise<ForecastGridResponse> {
  const cacheKey = `${mode}:${sector}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = clientCache.get(cacheKey);
    if (cached && now - cached.cachedAt < CLIENT_CACHE_TTL_MS) {
      return cached.response;
    }
  }

  const queryParams = new URLSearchParams({
    mode,
    sector,
    refresh: forceRefresh ? 'true' : 'false',
  });

  const response = await fetchJson<ForecastGridResponse>(`/weather/forecast-grid?${queryParams.toString()}`);

  validateForecastResponse(response);

  clientCache.set(cacheKey, {
    response,
    cachedAt: now,
  });

  return response;
}

/**
 * Clears the client-side forecast memory cache.
 */
export function clearForecastClientCache(): void {
  clientCache.clear();
}

/**
 * Strict structural validation of the incoming backend response.
 */
export function validateForecastResponse(response: any): asserts response is ForecastGridResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Forecast API returned an invalid non-object payload.');
  }

  const { metadata, nodes } = response;
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Forecast API response is missing required metadata object.');
  }

  if (typeof metadata.provider !== 'string' || !metadata.provider) {
    throw new Error('Forecast metadata is missing valid provider identification.');
  }

  if (typeof metadata.model !== 'string' || !metadata.model) {
    throw new Error('Forecast metadata is missing valid model identification.');
  }

  if (!metadata.initializationTime || isNaN(Date.parse(metadata.initializationTime))) {
    throw new Error('Forecast metadata is missing valid initializationTime ISO timestamp.');
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error('Forecast API response contains empty or invalid nodes array.');
  }

  const firstNode = nodes[0];
  if (!Array.isArray(firstNode.hourly) || firstNode.hourly.length === 0) {
    throw new Error('Forecast grid node contains empty hourly time-series.');
  }

  // Verify timeline bounds: expected 72 timesteps (T+0 to T+71)
  if (firstNode.hourly.length !== FORECAST_TOTAL_TIMESTEPS) {
    console.warn(
      `[ForecastService] Node hourly series length is ${firstNode.hourly.length}, expected ${FORECAST_TOTAL_TIMESTEPS}.`
    );
  }
}

// ============================================================================
// Timeline & Timestep Accessors (T+0 to T+71 Contract)
// ============================================================================

/**
 * Generates an array of 72 discrete timestep offsets (T+0 through T+71)
 * aligned strictly with the model initialization and valid timestamps.
 */
export function getTimestepOffsets(response: ForecastGridResponse): TimestepOffset[] {
  const nodes = response?.nodes;
  if (!nodes || nodes.length === 0) return [];

  const hourly = nodes[0]?.hourly;
  if (!hourly || hourly.length === 0) return [];

  return hourly.map((point, index) => {
    const padHour = index.toString().padStart(2, '0');
    return {
      index,
      offsetHours: index, // T+0 is index 0, T+71 is index 71
      label: `T+${padHour}h`,
      time: point.time,
    };
  });
}

/**
 * Finds the timestep index corresponding to a specific ISO timestamp string.
 * Returns -1 if no matching timestep exists.
 */
export function findTimestepIndexByTimestamp(response: ForecastGridResponse, targetTime: string): number {
  const offsets = getTimestepOffsets(response);
  return offsets.findIndex((o) => o.time === targetTime);
}

/**
 * Safe bounds check and normalization for timestep index (0 to 71).
 */
export function clampTimestepIndex(index: number, maxTimesteps: number = FORECAST_TOTAL_TIMESTEPS): number {
  if (isNaN(index) || index < 0) return 0;
  if (index >= maxTimesteps) return maxTimesteps - 1;
  return Math.floor(index);
}

// ============================================================================
// Granular Product Extractors & Physics Conversions
// ============================================================================

export interface NodePrecipitationValue {
  /** Preceding 1-hour accumulation in mm */
  precipitationMm: number;
  rainMm: number;
  showersMm: number;
  isPrecedingHourAccumulation: true;
  unit: 'mm';
}

export interface NodeWindValue {
  /** Wind speed at 10m AGL in km/h */
  speedKmh: number;
  /** Wind speed converted to m/s */
  speedMs: number;
  /** Meteorological direction where wind originates from (0-360°) */
  directionDeg: number;
  /** 16-point compass cardinal direction (e.g. 'SW', 'NNE') */
  cardinal: string;
  /** Preceding 1-hour peak gust in km/h */
  gustsKmh: number;
  /** Eastward velocity vector component (m/s) */
  uMs: number;
  /** Northward velocity vector component (m/s) */
  vMs: number;
}

export interface NodeTemperatureValue {
  temperatureC: number;
  apparentTemperatureC: number;
  unit: '°C';
}

export interface NodeHumidityValue {
  relativeHumidityPercent: number;
  unit: '%';
}

export interface NodePressureValue {
  pressureMslHpa: number;
  surfacePressureHpa: number;
  unit: 'hPa';
}

/**
 * Extracts precipitation data for a node at a given timestep.
 */
export function getNodePrecipitation(node: ForecastGridNode, timestep: number): NodePrecipitationValue {
  const t = clampTimestepIndex(timestep, node?.hourly?.length || FORECAST_TOTAL_TIMESTEPS);
  const pt = node?.hourly?.[t];
  return {
    precipitationMm: pt?.precipitationMm ?? 0,
    rainMm: pt?.rainMm ?? 0,
    showersMm: pt?.showersMm ?? 0,
    isPrecedingHourAccumulation: true,
    unit: 'mm',
  };
}

/**
 * Extracts wind vector and speed data for a node at a given timestep.
 */
export function getNodeWind(node: ForecastGridNode, timestep: number): NodeWindValue {
  const t = clampTimestepIndex(timestep, node?.hourly?.length || FORECAST_TOTAL_TIMESTEPS);
  const pt = node?.hourly?.[t];
  const speedKmh = pt?.windSpeedKmh ?? 0;
  const directionDeg = pt?.windDirectionDegrees ?? 0;
  const speedMs = Math.round((speedKmh / 3.6) * 100) / 100;

  return {
    speedKmh,
    speedMs,
    directionDeg,
    cardinal: degreesToCardinal(directionDeg),
    gustsKmh: pt?.windGustsKmh ?? speedKmh,
    uMs: pt?.uMs ?? 0,
    vMs: pt?.vMs ?? 0,
  };
}

/**
 * Extracts temperature data for a node at a given timestep.
 */
export function getNodeTemperature(node: ForecastGridNode, timestep: number): NodeTemperatureValue {
  const t = clampTimestepIndex(timestep, node?.hourly?.length || FORECAST_TOTAL_TIMESTEPS);
  const pt = node?.hourly?.[t];
  return {
    temperatureC: pt?.temperatureC ?? 0,
    apparentTemperatureC: pt?.apparentTemperatureC ?? pt?.temperatureC ?? 0,
    unit: '°C',
  };
}

/**
 * Extracts relative humidity data for a node at a given timestep.
 */
export function getNodeHumidity(node: ForecastGridNode, timestep: number): NodeHumidityValue {
  const t = clampTimestepIndex(timestep, node?.hourly?.length || FORECAST_TOTAL_TIMESTEPS);
  const pt = node?.hourly?.[t];
  return {
    relativeHumidityPercent: pt?.relativeHumidityPercent ?? 0,
    unit: '%',
  };
}

/**
 * Extracts barometric pressure data for a node at a given timestep.
 */
export function getNodePressure(node: ForecastGridNode, timestep: number): NodePressureValue {
  const t = clampTimestepIndex(timestep, node?.hourly?.length || FORECAST_TOTAL_TIMESTEPS);
  const pt = node?.hourly?.[t];
  return {
    pressureMslHpa: pt?.pressureMslHpa ?? 1013.25,
    surfacePressureHpa: pt?.surfacePressureHpa ?? pt?.pressureMslHpa ?? 1013.25,
    unit: 'hPa',
  };
}

// ============================================================================
// Aggregations & Sector Summaries
// ============================================================================

export interface SectorExtremaSummary {
  maxPrecipitationMm: number;
  maxAccum24hMm: number;
  maxAccum72hMm: number;
  maxWindGustKmh: number;
  maxWindSpeedKmh: number;
  minPressureMslHpa: number;
  minTemperatureC: number;
  maxTemperatureC: number;
  maxHumidityPercent: number;
}

/**
 * Computes extrema across all nodes in the grid for operational alert badges.
 */
export function computeGridExtrema(response: ForecastGridResponse): SectorExtremaSummary {
  const nodes = response?.nodes || [];
  let maxPrecip = 0;
  let maxAccum24 = 0;
  let maxAccum72 = 0;
  let maxGust = 0;
  let maxSpeed = 0;
  let minPressure = Infinity;
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let maxHumidity = 0;

  for (const node of nodes) {
    if (node.accum24hMm > maxAccum24) maxAccum24 = node.accum24hMm;
    if (node.accum72hMm > maxAccum72) maxAccum72 = node.accum72hMm;
    if (node.maxWindGustKmh > maxGust) maxGust = node.maxWindGustKmh;
    if (node.minPressureMslHpa < minPressure) minPressure = node.minPressureMslHpa;

    for (const pt of node.hourly || []) {
      if (pt.precipitationMm > maxPrecip) maxPrecip = pt.precipitationMm;
      if (pt.windSpeedKmh > maxSpeed) maxSpeed = pt.windSpeedKmh;
      if (pt.temperatureC < minTemp) minTemp = pt.temperatureC;
      if (pt.temperatureC > maxTemp) maxTemp = pt.temperatureC;
      if (pt.relativeHumidityPercent > maxHumidity) maxHumidity = pt.relativeHumidityPercent;
    }
  }

  return {
    maxPrecipitationMm: Math.round(maxPrecip * 10) / 10,
    maxAccum24hMm: Math.round(maxAccum24 * 10) / 10,
    maxAccum72hMm: Math.round(maxAccum72 * 10) / 10,
    maxWindGustKmh: Math.round(maxGust * 10) / 10,
    maxWindSpeedKmh: Math.round(maxSpeed * 10) / 10,
    minPressureMslHpa: minPressure === Infinity ? 1013.25 : Math.round(minPressure * 10) / 10,
    minTemperatureC: minTemp === Infinity ? 0 : Math.round(minTemp * 10) / 10,
    maxTemperatureC: maxTemp === -Infinity ? 0 : Math.round(maxTemp * 10) / 10,
    maxHumidityPercent: Math.round(maxHumidity),
  };
}

// ============================================================================
// Scientific Disclosure & UI Helpers
// ============================================================================

/**
 * Returns formatted scientific disclosure text for UI attribution banners.
 */
export function getForecastDisclosureText(metadata: ForecastGridMetadata): string {
  if (!metadata) return '';
  const fallbackNotice = metadata.isFallback
    ? ` [FAILOVER ACTIVE: ${metadata.fallbackReason || 'Operating on secondary NOAA GFS feed'}]`
    : '';
  const staleNotice = metadata.isStale
    ? ` [STALE CACHE: ${metadata.staleReason || 'Upstream provider delayed or quota safety enforced'}]`
    : '';

  return `${metadata.disclosure} Model: ${metadata.model}, Grid: ${metadata.providerOutputGrid || metadata.nativeResolution}, Assimilation: ${metadata.runCycle} (${metadata.initializationTime}).${fallbackNotice}${staleNotice}`;
}

/**
 * Converts meteorological direction (0-360°) to 16-point cardinal compass text.
 */
export function degreesToCardinal(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Converts Celsius to Fahrenheit.
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round(((celsius * 9) / 5 + 32) * 10) / 10;
}

/**
 * Converts km/h to knots.
 */
export function kmhToKnots(kmh: number): number {
  return Math.round((kmh * 0.539957) * 10) / 10;
}

/**
 * Converts hPa to inHg (inches of mercury).
 */
export function hpaToInHg(hpa: number): number {
  return Math.round((hpa * 0.0295299830714) * 100) / 100;
}
