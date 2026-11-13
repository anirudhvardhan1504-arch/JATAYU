/**
 * Forecast Impact Data Service for JATAYU Tactical Map 2.0 (Phase 3D-2A)
 *
 * Ingests district-level rainfall hazard metrics, quality audits,
 * and supported infrastructure co-location counts from GET /api/weather/forecast-impact.
 */

import { fetchJson } from './api';
import { ForecastGridMode, OperationalSectorKey } from './forecast';

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
  futureAccum6hMm: number | null;
  futureAccum12hMm: number | null;
  futureAccum24hMm: number | null;
  futureAccum48hMm: number | null;
  futureAccum72hMm: number | null;
  accum72hQualityReason?: string;
  peakHourlyRateMmH: number | null;
  peakHourlyTimeUtc: string | null;
  peakHourlyRateCategory: ImdHourlyRateCategory;
  maxWindGustKmh: number | null;
}

export interface DistrictDataQuality {
  isComplete: boolean;
  totalExpectedHours: number;
  totalAvailableHours: number;
  continuityValid: boolean;
  qualityNotice?: string;
}

export interface DistrictClassification {
  imdRainfallCategory: ImdRainfallCategory;
  thresholdDefinition: string;
  officialImdAlert?: {
    severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';
    color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    headline: string;
    issuedAt: string;
  };
}

export interface DistrictLocalExposure {
  verifiedEmergencyFacilitiesCount: number;
  facilityTypes: {
    hospitals: number;
    shelters: number;
    fireStations: number;
    other: number;
  };
  chennaiHistoricalChokepointsCount?: number;
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

/**
 * Fetches forecast impact intelligence for a given sector or national synoptic mesh.
 */
export async function getForecastImpact(
  mode: ForecastGridMode = 'sector',
  sector: OperationalSectorKey = 'chennai',
  refresh: boolean = false
): Promise<ForecastImpactResponse> {
  const query = new URLSearchParams({
    mode,
    sector,
    refresh: refresh ? 'true' : 'false',
  });
  return fetchJson<ForecastImpactResponse>(`/weather/forecast-impact?${query.toString()}`);
}

/**
 * Visual styling & color ramp for IMD 24h rainfall categories.
 */
export const IMD_RAINFALL_STYLES: Record<
  ImdRainfallCategory,
  { label: string; bg: string; text: string; border: string; badge: string; description: string }
> = {
  NO_RAIN: {
    label: 'No Rain / Nil',
    bg: 'bg-slate-900/40',
    text: 'text-slate-400',
    border: 'border-slate-700/60',
    badge: 'bg-slate-800 text-slate-300 border border-slate-700',
    description: 'Accumulation 0.0 mm (Nil / Dry)',
  },
  LIGHT_RAIN: {
    label: 'Light Rain',
    bg: 'bg-sky-950/30',
    text: 'text-sky-400',
    border: 'border-sky-800/60',
    badge: 'bg-sky-950 text-sky-300 border border-sky-700',
    description: '0.1 - 15.0 mm (IMD Light Rain benchmark)',
  },
  MODERATE_RAIN: {
    label: 'Moderate Rain',
    bg: 'bg-blue-950/40',
    text: 'text-blue-300',
    border: 'border-blue-700/60',
    badge: 'bg-blue-950 text-blue-200 border border-blue-600',
    description: '15.0 - 64.4 mm (IMD Moderate benchmark)',
  },
  HEAVY_RAIN: {
    label: 'Heavy Rain',
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    border: 'border-amber-600/60',
    badge: 'bg-amber-950 text-amber-300 border border-amber-600',
    description: '64.5 - 115.4 mm (IMD Heavy Rain benchmark)',
  },
  VERY_HEAVY_RAIN: {
    label: 'Very Heavy Rain',
    bg: 'bg-orange-950/50',
    text: 'text-orange-400',
    border: 'border-orange-600/70',
    badge: 'bg-orange-950 text-orange-200 border border-orange-500 font-bold',
    description: '115.5 - 204.4 mm (IMD Very Heavy benchmark)',
  },
  EXTREMELY_HEAVY_RAIN: {
    label: 'Extremely Heavy Rain',
    bg: 'bg-red-950/60',
    text: 'text-red-400',
    border: 'border-red-600/80',
    badge: 'bg-red-950 text-red-200 border border-red-500 font-bold animate-pulse',
    description: '>= 204.5 mm (IMD Extremely Heavy benchmark)',
  },
};

/**
 * Visual styling & text for Spatial Density quality levels.
 */
export const SPATIAL_DENSITY_CONFIG: Record<
  DistrictSpatialDensity,
  { label: string; shortLabel: string; badge: string; notice: string }
> = {
  MULTI_NODE_REPRESENTATIVE: {
    label: 'Multi-Node Spatial Average',
    shortLabel: 'Multi-Node Area Mean',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60',
    notice: 'Rainfall is averaged across multiple interior NWP model nodes.',
  },
  SINGLE_NODE_LOCALIZED: {
    label: 'Single-Node Localized Sample',
    shortLabel: 'Single-Node Point Sample',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
    notice: 'Derived from 1 interior node. Intra-district microclimatic variability is unrepresented.',
  },
  CENTROID_PROXIMITY_ONLY: {
    label: 'Centroid Proximity Fallback',
    shortLabel: 'Centroid Fallback',
    badge: 'bg-purple-950/80 text-purple-300 border-purple-600/60',
    notice: 'Zero interior nodes; estimated from nearest NWP node within bounded radius.',
  },
  UNREPRESENTED: {
    label: 'Unrepresented / Insufficient Data',
    shortLabel: 'Insufficient Coverage',
    badge: 'bg-rose-950/80 text-rose-300 border-rose-600/60',
    notice: 'No NWP grid nodes within defensible distance. Metrics unavailable.',
  },
};
