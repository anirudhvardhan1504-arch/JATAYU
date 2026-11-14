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
  decisionSupport?: DistrictDecisionSupport;
}

// -------------------------------------------------------------
// Phase 3E: Meteorological Decision Support Types & Interfaces
// -------------------------------------------------------------

export type OverallDataStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export interface DistrictMeteorologicalAvailability {
  overallStatus: OverallDataStatus;
  isPrecipitationAvailable: boolean;
  isWindAvailable: boolean;
  isPressureAvailable: boolean;
  missingVariables: string[];
}

export type RainfallPriorityTier =
  | 'TIER_1_CRITICAL'
  | 'TIER_2_ELEVATED'
  | 'TIER_3_WATCH'
  | 'TIER_4_ADVISORY'
  | 'TIER_5_ROUTINE'
  | 'UNAVAILABLE';

export interface DistrictRainfallAssessment {
  status: 'AVAILABLE' | 'DATA_INSUFFICIENT';
  priorityTier: RainfallPriorityTier;
  imd24hCategory: ImdRainfallCategory | 'UNAVAILABLE';
  accum24hMm: number | null;
  peakHourlyRateMmH: number | null;
  peakHourlyCategory: ImdHourlyRateCategory | 'UNAVAILABLE';
  peakHourlyTimeUtc: string | null;
  thresholdDefinition: string;
  priorityDefinition: string;
  hourlyIntensityBenchmark?: string;
  insufficientReason?: string;
}

export type WindSeverityCategory =
  | 'EXTREME_GALE_STORM'
  | 'GALE_FORCE'
  | 'NEAR_GALE'
  | 'MODERATE_BREEZE'
  | 'ROUTINE'
  | 'UNAVAILABLE';

export interface DistrictWindAssessment {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  severityCategory: WindSeverityCategory;
  maxWindGustKmh: number | null;
  peakGustTimeUtc: string | null;
  provenance: 'PROPOSED_HEURISTIC_WIND_SCALE';
  insufficientReason?: string;
}

export type First24hTrajectory =
  | 'STABLE_LOW'
  | 'DELAYED_ONSET'
  | 'INTENSIFYING'
  | 'IMMEDIATE_PEAK'
  | 'SUBSIDING'
  | 'PERSISTENT_UNIFORM'
  | 'MIXED_OR_VARIABLE'
  | 'UNAVAILABLE';

export interface TemporalMilestones {
  w1Mm: number | null;
  w2Mm: number | null;
  w3Mm: number | null;
  w4Mm: number | null;
  first24hTrajectory: First24hTrajectory;
  onsetHourUtc: string | null;
  peakHourUtc: string | null;
  cessationHourUtc: string | null;
  elevatedHoursTotal: number;
  longestElevatedRunHours: number;
}

export interface ExtendedForecastBlock {
  blockIndex: number;
  startHour: number;
  endHour: number;
  durationHours: number;
  isIncomplete: boolean;
  accumMm: number | null;
  meanRateMmH: number | null;
}

export type ContributingDriverKey =
  | 'CONVECTIVE_BURST'
  | 'PROLONGED_INTENSITY'
  | 'GALE_GUST_COINCIDENCE'
  | 'RAPID_BAROMETRIC_DROP'
  | 'IMMINENT_ONSET';

export type DriverStatus = 'TRIGGERED' | 'NOT_TRIGGERED' | 'UNAVAILABLE';

export interface ContributingDriverState {
  key: ContributingDriverKey;
  status: DriverStatus;
  missingDataReason?: string;
  evidence?: {
    observedValue?: number;
    threshold?: number;
    units?: string;
    timestampUtc?: string;
  };
  provenance: 'PROPOSED_HEURISTIC';
}

export interface DistrictDecisionSupport {
  availability: DistrictMeteorologicalAvailability;
  rainfall: DistrictRainfallAssessment;
  wind: DistrictWindAssessment;
  temporalMilestones: TemporalMilestones;
  extendedBlocks: ExtendedForecastBlock[];
  contributingDrivers: ContributingDriverState[];
  officialImdAlert?: {
    severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';
    color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    headline: string;
    issuedAt: string;
    authorityDisclosure: string;
  };
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

const CLIENT_IMPACT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes client-side memory cache

interface ClientImpactCacheEntry {
  response: ForecastImpactResponse;
  cachedAt: number;
}

const clientImpactCache = new Map<string, ClientImpactCacheEntry>();
const inFlightImpactRequests = new Map<string, Promise<ForecastImpactResponse>>();

/**
 * Clears the client-side forecast impact memory cache (useful for tests).
 */
export function clearForecastImpactClientCache(): void {
  clientImpactCache.clear();
  inFlightImpactRequests.clear();
}

/**
 * Fetches forecast impact intelligence for a given sector or national synoptic mesh.
 * Reuses active in-flight promises (coalescing) and in-memory cache to prevent request storms.
 */
export async function getForecastImpact(
  mode: ForecastGridMode = 'sector',
  sector: OperationalSectorKey = 'chennai',
  refresh: boolean = false
): Promise<ForecastImpactResponse> {
  const cacheKey = `${mode}:${mode === 'sector' ? sector : 'all'}`;
  const now = Date.now();

  if (!refresh) {
    const cached = clientImpactCache.get(cacheKey);
    if (cached && now - cached.cachedAt < CLIENT_IMPACT_CACHE_TTL_MS) {
      return cached.response;
    }

    const inFlight = inFlightImpactRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const query = new URLSearchParams({
    mode,
    sector,
    refresh: refresh ? 'true' : 'false',
  });

  const requestPromise = (async () => {
    try {
      const response = await fetchJson<ForecastImpactResponse>(`/weather/forecast-impact?${query.toString()}`);
      clientImpactCache.set(cacheKey, {
        response,
        cachedAt: Date.now(),
      });
      return response;
    } finally {
      inFlightImpactRequests.delete(cacheKey);
    }
  })();

  inFlightImpactRequests.set(cacheKey, requestPromise);
  return requestPromise;
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

/**
 * Visual styling & information for Phase 3E Meteorological Rainfall Priority Tiers.
 */
export const RAINFALL_PRIORITY_STYLES: Record<
  RainfallPriorityTier,
  { label: string; shortLabel: string; badge: string; border: string; bg: string; text: string; description: string }
> = {
  TIER_1_CRITICAL: {
    label: 'Tier 1 — Critical Hazard',
    shortLabel: 'Tier 1 Critical',
    badge: 'bg-rose-950 text-rose-300 border-rose-500 font-bold',
    border: 'border-rose-500/80',
    bg: 'bg-rose-950/40',
    text: 'text-rose-400',
    description: 'Critical rainfall threat (24h rain >= 204.5 mm or peak rate >= 50.0 mm/h)',
  },
  TIER_2_ELEVATED: {
    label: 'Tier 2 — Elevated Hazard',
    shortLabel: 'Tier 2 Elevated',
    badge: 'bg-orange-950 text-orange-300 border-orange-500 font-bold',
    border: 'border-orange-500/80',
    bg: 'bg-orange-950/40',
    text: 'text-orange-400',
    description: 'Elevated rainfall threat (24h rain >= 115.5 mm or peak rate >= 35.0 mm/h)',
  },
  TIER_3_WATCH: {
    label: 'Tier 3 — Watch',
    shortLabel: 'Tier 3 Watch',
    badge: 'bg-amber-950 text-amber-300 border-amber-500 font-bold',
    border: 'border-amber-500/80',
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    description: 'Heavy rainfall watch (24h rain >= 64.5 mm or peak rate >= 15.0 mm/h)',
  },
  TIER_4_ADVISORY: {
    label: 'Tier 4 — Advisory',
    shortLabel: 'Tier 4 Advisory',
    badge: 'bg-sky-950 text-sky-300 border-sky-600 font-semibold',
    border: 'border-sky-600/70',
    bg: 'bg-sky-950/40',
    text: 'text-sky-400',
    description: 'Rainfall advisory (24h rain >= 15.0 mm or peak rate >= 7.5 mm/h)',
  },
  TIER_5_ROUTINE: {
    label: 'Tier 5 — Routine',
    shortLabel: 'Tier 5 Routine',
    badge: 'bg-slate-900 text-slate-400 border-slate-700',
    border: 'border-slate-800',
    bg: 'bg-slate-900/40',
    text: 'text-slate-400',
    description: 'Routine conditions; no rainfall priority criteria met',
  },
  UNAVAILABLE: {
    label: 'Data Unavailable',
    shortLabel: 'Unavailable',
    badge: 'bg-slate-950 text-slate-500 border-slate-800',
    border: 'border-slate-800/60',
    bg: 'bg-slate-950/40',
    text: 'text-slate-500',
    description: 'Precipitation timeseries incomplete or discontinuous across T+1..T+24',
  },
};

/**
 * Visual styling & threshold benchmarks for Wind Severity Categories.
 */
export const WIND_SEVERITY_STYLES: Record<
  WindSeverityCategory,
  { label: string; badge: string; threshold: string; description: string }
> = {
  EXTREME_GALE_STORM: {
    label: 'Extreme Gale / Storm',
    badge: 'bg-rose-950 text-rose-200 border-rose-500 font-bold',
    threshold: '>= 85 km/h',
    description: 'Peak 10m wind gust >= 85 km/h (Extreme storm potential)',
  },
  GALE_FORCE: {
    label: 'Gale Force',
    badge: 'bg-orange-950 text-orange-200 border-orange-500 font-bold',
    threshold: '65 - 84 km/h',
    description: 'Peak 10m wind gust 65 - 84 km/h (Gale force winds)',
  },
  NEAR_GALE: {
    label: 'Near Gale',
    badge: 'bg-amber-950 text-amber-200 border-amber-600 font-semibold',
    threshold: '50 - 64 km/h',
    description: 'Peak 10m wind gust 50 - 64 km/h (Strong breeze / Near gale)',
  },
  MODERATE_BREEZE: {
    label: 'Moderate Breeze',
    badge: 'bg-blue-950 text-blue-200 border-blue-600',
    threshold: '40 - 49 km/h',
    description: 'Peak 10m wind gust 40 - 49 km/h (Moderate breeze)',
  },
  ROUTINE: {
    label: 'Routine Wind',
    badge: 'bg-slate-900 text-slate-400 border-slate-700',
    threshold: '< 40 km/h',
    description: 'Peak 10m wind gust < 40 km/h (Routine conditions)',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    badge: 'bg-slate-950 text-slate-500 border-slate-800',
    threshold: 'Missing',
    description: 'Wind gust timeseries incomplete across T+1..T+24',
  },
};

/**
 * Visual styling & descriptions for First 24-Hour Rainfall Trajectories.
 */
export const TRAJECTORY_STYLES: Record<
  First24hTrajectory,
  { label: string; badge: string; description: string }
> = {
  STABLE_LOW: {
    label: 'Stable Low',
    badge: 'bg-slate-900 text-slate-400 border-slate-700',
    description: 'All four 6-hour blocks remain below 15 mm',
  },
  DELAYED_ONSET: {
    label: 'Delayed Onset',
    badge: 'bg-indigo-950 text-indigo-300 border-indigo-600 font-semibold',
    description: 'Dry opening (W1+W2 < 5 mm) followed by heavy late surge (W3+W4 >= 25 mm)',
  },
  INTENSIFYING: {
    label: 'Intensifying',
    badge: 'bg-amber-950 text-amber-300 border-amber-500 font-bold',
    description: 'Monotonic increase with step-increase >= 15 mm and >= 1.5x amplification',
  },
  IMMEDIATE_PEAK: {
    label: 'Immediate Peak',
    badge: 'bg-rose-950 text-rose-300 border-rose-500 font-bold',
    description: 'Front-loaded burst in W1 (>= 20 mm) with steep subsequent subsidence',
  },
  SUBSIDING: {
    label: 'Subsiding',
    badge: 'bg-teal-950 text-teal-300 border-teal-600',
    description: 'Steady monotonic decrease from elevated opening block',
  },
  PERSISTENT_UNIFORM: {
    label: 'Persistent Uniform',
    badge: 'bg-blue-950 text-blue-300 border-blue-600 font-semibold',
    description: 'Sustained rain across all blocks within 20% of mean spread',
  },
  MIXED_OR_VARIABLE: {
    label: 'Mixed / Variable',
    badge: 'bg-purple-950 text-purple-300 border-purple-600',
    description: 'Multi-pulse or complex distribution not matching single canonical profile',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    badge: 'bg-slate-950 text-slate-500 border-slate-800',
    description: 'Incomplete or discontinuous 24-hour rainfall block timeseries',
  },
};

/**
 * Metadata and criteria descriptions for Contributing Drivers.
 */
export const CONTRIBUTING_DRIVERS_META: Record<
  ContributingDriverKey,
  { title: string; criterion: string; unit: string }
> = {
  CONVECTIVE_BURST: {
    title: 'Convective Burst',
    criterion: 'Peak one-hour rainfall rate >= 15.0 mm/h (preceding-hour accumulation)',
    unit: 'ratio',
  },
  PROLONGED_INTENSITY: {
    title: 'Prolonged Rainfall',
    criterion: '>= 3 consecutive hours with one-hour rainfall rate >= 5.0 mm/h',
    unit: 'hours',
  },
  GALE_GUST_COINCIDENCE: {
    title: 'Gale-Gust Coincidence',
    criterion: 'Peak gust >= 62.0 km/h coincident with one-hour rain rate >= 5.0 mm/h within +/- 1 hour',
    unit: 'km/h',
  },
  RAPID_BAROMETRIC_DROP: {
    title: 'Rapid MSLP Drop',
    criterion: 'Mean sea-level pressure drop >= 3.0 hPa in 3h or >= 5.0 hPa in 6h (MSLP tendency)',
    unit: 'hPa',
  },
  IMMINENT_ONSET: {
    title: 'Imminent Onset',
    criterion: 'One-hour rain rate >= 2.5 mm/h within initial 3 forecast hours (T+1..T+3)',
    unit: 'hours',
  },
};

/**
 * Visual styling for overall meteorological data availability.
 */
export const DATA_STATUS_STYLES: Record<
  OverallDataStatus,
  { label: string; badge: string; text: string }
> = {
  COMPLETE: {
    label: 'COMPLETE',
    badge: 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold',
    text: 'text-emerald-400',
  },
  PARTIAL: {
    label: 'PARTIAL',
    badge: 'bg-amber-950 text-amber-300 border-amber-600 font-bold',
    text: 'text-amber-400',
  },
  UNAVAILABLE: {
    label: 'UNAVAILABLE',
    badge: 'bg-rose-950 text-rose-300 border-rose-600 font-bold',
    text: 'text-rose-400',
  },
};
