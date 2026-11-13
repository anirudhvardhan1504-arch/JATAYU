/**
 * Meteorological Forecast Grid Types for JATAYU Tactical Map 2.0 (Phase 3B)
 *
 * Strict adherence to atmospheric physics, exact meteorological definitions,
 * and verified mathematical vector coordinate mappings.
 */

export type ForecastGridMode = 'national' | 'sector';
export type OperationalSectorKey = 'mumbai' | 'chennai' | 'guwahati' | 'kolkata' | 'dehradun';

export interface GridCoordinate {
  latitude: number;
  longitude: number;
  name?: string;
  isSectorCentroid?: boolean;
  sectorKey?: OperationalSectorKey;
}

export interface HourlyGridDataPoint {
  time: string; // ISO 8601 UTC timestamp e.g. "2026-11-13T06:00"
  
  // Precipitation (preceding 1-hour accumulated liquid equivalent depth in mm, NOT instantaneous rate)
  precipitationMm: number;
  rainMm: number;
  showersMm: number;
  
  // Thermal
  temperatureC: number;
  apparentTemperatureC: number;
  
  // Moisture
  relativeHumidityPercent: number;
  
  // Barometric Pressure
  pressureMslHpa: number; // Mean sea-level pressure normalized via barometric reduction
  surfacePressureHpa: number; // Local terrain surface pressure
  
  // Wind Kinematics & Aerodynamic Vectors
  windSpeedKmh: number; // 10m horizontal wind speed
  windDirectionDegrees: number; // Meteorological direction from which wind blows (0°=N, 90°=E, 180°=S, 270°=W)
  windGustsKmh: number; // Peak 3-second gust
  
  // Calculated Atmospheric Velocity Vectors in m/s (pointing in direction of particle motion)
  // u = - (windSpeedKmh / 3.6) * sin(windDirectionDegrees * pi / 180)  [Eastward = +, Westward = -]
  // v = - (windSpeedKmh / 3.6) * cos(windDirectionDegrees * pi / 180)  [Northward = +, Southward = -]
  uMs: number;
  vMs: number;
}

export interface ForecastGridNode {
  // Query coordinates vs actual snapped model grid-cell coordinates
  requestedLat: number;
  requestedLon: number;
  modelLat: number;
  modelLon: number;
  elevationM: number;
  sectorKey?: OperationalSectorKey;
  
  // 72-hour hourly forecast timeseries
  hourly: HourlyGridDataPoint[];
  
  // Cumulative summaries
  accum24hMm: number; // 24-hour total accumulation (mm)
  accum72hMm: number; // 72-hour total accumulation (mm)
  maxWindGustKmh: number; // Peak gust across the 72h window
  minPressureMslHpa: number; // Minimum MSLP (identifies cyclonic core / low pressure center)
}

export interface ForecastGridMetadata {
  provider: string; // e.g. "Open-Meteo ECMWF Open Data" or "Open-Meteo NOAA GFS"
  model: string; // e.g. "ECMWF IFS (0.25°)" or "NOAA GFS (0.25°)"
  nativeResolution: string; // e.g. "0.25° (~28 km) regular lat/lon"
  isFallback: boolean;
  fallbackReason?: string;
  runCycle: '00Z' | '06Z' | '12Z' | '18Z' | 'UNKNOWN';
  initializationTime: string;
  generatedAt: string;
  validStartTime: string;
  validEndTime: string;
  totalTimesteps: number;
  gridNodeCount: number;
  deduplicatedNodeCount: number;
  mode: ForecastGridMode;
  activeSector?: OperationalSectorKey;
  
  // Mandatory Scientific Disclosures
  isInterpolatedMesh: boolean;
  disclosure: string;
  attribution: string;
  
  // Accounting and Caching Telemetry
  isStale: boolean;
  staleReason?: string;
  cacheTtlMs: number;
  staleSince?: string;
  billableCallsIncurred: number;
  dailyBudgetRemaining: number;
}

export interface ForecastGridResponse {
  metadata: ForecastGridMetadata;
  nodes: ForecastGridNode[];
}
