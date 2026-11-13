/**
 * Forecast Impact Types for JATAYU Tactical Map 2.0 (Phase 3D-1)
 *
 * Defines typed models, metrics, quality assessments, and response contracts
 * for district-level meteorological rainfall hazard and local exposure analysis.
 */

import { ForecastGridMode, OperationalSectorKey } from './forecast-grid.types.js';

export type ImdRainfallCategory =
  | 'NO_RAIN'
  | 'LIGHT_RAIN'
  | 'MODERATE_RAIN'
  | 'HEAVY_RAIN'
  | 'VERY_HEAVY_RAIN'
  | 'EXTREMELY_HEAVY_RAIN';

export type ImdHourlyRateCategory =
  | 'NEGLIGIBLE'
  | 'LIGHT'
  | 'MODERATE'
  | 'HEAVY'
  | 'VERY_HEAVY'
  | 'TORRENTIAL';

export type DistrictCoverageStatus =
  | 'SUFFICIENT_MESOSCALE'
  | 'SYNOPTIC_INDICATIVE'
  | 'INSUFFICIENT_DATA';

export type DistrictSamplingMethod =
  | 'POLYGON_INTERIOR'
  | 'PROXIMITY_CENTROID_BOUNDED'
  | 'NONE';

export type DistrictSpatialDensity =
  | 'MULTI_NODE_REPRESENTATIVE'
  | 'SINGLE_NODE_LOCALIZED'
  | 'CENTROID_PROXIMITY_ONLY'
  | 'UNREPRESENTED';

export interface DistrictImpactMetrics {
  /** Future 6-hour forecast accumulation from validStartTime: T+1 to T+6 (mm) */
  futureAccum6hMm: number | null;
  /** Future 12-hour forecast accumulation from validStartTime: T+1 to T+12 (mm) */
  futureAccum12hMm: number | null;
  /** Future 24-hour forecast accumulation from validStartTime: T+1 to T+24 (mm) */
  futureAccum24hMm: number | null;
  /** Future 48-hour forecast accumulation from validStartTime: T+1 to T+48 (mm) */
  futureAccum48hMm: number | null;
  /** Future 72-hour forecast accumulation: null under T+0..T+71 contract */
  futureAccum72hMm: number | null;
  /** Explicit reason why 72h future accumulation is null */
  accum72hQualityReason?: string;
  /** Maximum 1-hour rainfall rate within available future window (mm/h) */
  peakHourlyRateMmH: number | null;
  /** ISO UTC timestamp of peak rainfall intensity */
  peakHourlyTimeUtc: string | null;
  /** Qualitative IMD rain rate classification */
  peakHourlyRateCategory: ImdHourlyRateCategory;
  /** Maximum 10-meter wind gust within available future window (km/h) */
  maxWindGustKmh: number | null;
}

export interface DistrictDataQuality {
  /** True if all expected hourly intervals are present and valid */
  isComplete: boolean;
  /** Total expected future hourly intervals */
  totalExpectedHours: number;
  /** Total valid future hourly intervals found */
  totalAvailableHours: number;
  /** True if timestamps increment continuously by strictly 3600 seconds */
  continuityValid: boolean;
  /** Human-readable quality diagnosis if data is incomplete or has continuity breaks */
  qualityNotice?: string;
}

export interface DistrictClassification {
  /** Model-derived rainfall category strictly matched to authoritative IMD 24h criteria */
  imdRainfallCategory: ImdRainfallCategory;
  /** Definition of IMD threshold applied */
  thresholdDefinition: string;
  /** Official administrative IMD warning bulletin if active for this district */
  officialImdAlert?: {
    severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';
    color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    headline: string;
    issuedAt: string;
  };
}

export interface DistrictLocalExposure {
  /** Number of verified emergency facilities (hospitals, shelters, fire stations) located in district */
  verifiedEmergencyFacilitiesCount: number;
  /** Breakdown of facility types */
  facilityTypes: {
    hospitals: number;
    shelters: number;
    fireStations: number;
    other: number;
  };
  /** Historical Adyar River / urban drainage choke points (strictly for Chennai) */
  chennaiHistoricalChokepointsCount?: number;
  /** Exposure attribution and scientific boundaries */
  exposureNotice: string;
}

export interface DistrictForecastImpact {
  district: string;
  state: string;
  censusCode?: string;
  coverage: {
    status: DistrictCoverageStatus;
    spatialDensity: DistrictSpatialDensity;
    nodeCount: number;
    method: DistrictSamplingMethod;
    meanDistanceKm?: number;
    coverageNotice?: string;
  };
  metrics: DistrictImpactMetrics;
  dataQuality: DistrictDataQuality;
  classification: DistrictClassification;
  localExposure: DistrictLocalExposure;
}

export interface ForecastImpactMetadata {
  provider: string;
  model: string;
  nativeResolution: string;
  gridSamplingResolution: string;
  initializationTime: string;
  runCycle: '00Z' | '06Z' | '12Z' | '18Z' | 'UNKNOWN';
  validStartTime: string;
  validEndTime: string;
  generatedAt: string;
  mode: ForecastGridMode;
  activeSector?: OperationalSectorKey;
  isFallback: boolean;
  isStale: boolean;
  fallbackReason?: string;
  staleReason?: string;
  scientificDisclaimer: string;
  dataQualityDisclaimer: string;
  accumulationConvention: string;
}

export interface ForecastImpactSummary {
  districtsEvaluated: number;
  districtsWithSufficientCoverage: number;
  districtsInHeavyOrAbove: number;
  districtsInVeryHeavyOrAbove: number;
  districtsInExtremelyHeavy: number;
  topImpactedDistricts: DistrictForecastImpact[];
}

export interface ForecastImpactResponse {
  metadata: ForecastImpactMetadata;
  summary: ForecastImpactSummary;
  districts: DistrictForecastImpact[];
}
