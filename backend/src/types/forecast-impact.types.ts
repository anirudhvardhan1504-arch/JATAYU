/**
 * Forecast Impact Types for JATAYU Tactical Map 2.0 (Phase 3D / Phase 3E)
 *
 * Defines typed models, metrics, quality assessments, and response contracts
 * for district-level meteorological rainfall hazard, aerodynamic wind kinematics,
 * explainable decision support, and local exposure analysis.
 */

import { ForecastGridMode, OperationalSectorKey } from './forecast-grid.types.js';

// ==========================================
// 1. STATUTORY & BENCHMARK CLASSIFICATIONS
// ==========================================

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

export type RainfallPriorityTier =
  | 'TIER_1_CRITICAL'
  | 'TIER_2_ELEVATED'
  | 'TIER_3_WATCH'
  | 'TIER_4_ADVISORY'
  | 'TIER_5_ROUTINE'
  | 'UNAVAILABLE';

export type WindSeverityCategory =
  | 'EXTREME_GALE_STORM'
  | 'GALE_FORCE'
  | 'NEAR_GALE'
  | 'MODERATE_BREEZE'
  | 'ROUTINE'
  | 'UNAVAILABLE';

export type First24hTrajectory =
  | 'STABLE_LOW'
  | 'DELAYED_ONSET'
  | 'INTENSIFYING'
  | 'IMMEDIATE_PEAK'
  | 'SUBSIDING'
  | 'PERSISTENT_UNIFORM'
  | 'MIXED_OR_VARIABLE'
  | 'UNAVAILABLE';

export type DriverStatus = 'TRIGGERED' | 'NOT_TRIGGERED' | 'UNAVAILABLE';

export type ContributingDriverKey =
  | 'CONVECTIVE_BURST'
  | 'PROLONGED_INTENSITY'
  | 'GALE_GUST_COINCIDENCE'
  | 'RAPID_BAROMETRIC_DROP'
  | 'IMMINENT_ONSET';

export type OverallDataStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

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

// ==========================================
// 2. DETAILED ASSESSMENT INTERFACES
// ==========================================

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

export interface DistrictMeteorologicalAvailability {
  overallStatus: OverallDataStatus;
  isPrecipitationAvailable: boolean;
  isWindAvailable: boolean;
  isPressureAvailable: boolean;
  missingVariables: string[];
}

export interface DistrictRainfallAssessment {
  status: 'AVAILABLE' | 'DATA_INSUFFICIENT';
  priorityTier: RainfallPriorityTier;
  imd24hCategory: ImdRainfallCategory | 'UNAVAILABLE';
  accum24hMm: number | null;
  peakHourlyRateMmH: number | null;
  peakHourlyCategory: ImdHourlyRateCategory | 'UNAVAILABLE';
  peakHourlyTimeUtc: string | null;
  thresholdDefinition: string; // "Official IMD 24-Hour Rainfall Standard"
  priorityDefinition: string;  // "JATAYU Internal Decision-Support Heuristic"
  insufficientReason?: string;
}

export interface DistrictWindAssessment {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  severityCategory: WindSeverityCategory;
  maxWindGustKmh: number | null;
  peakGustTimeUtc: string | null;
  provenance: 'PROPOSED_HEURISTIC_WIND_SCALE';
  insufficientReason?: string;
}

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
  blockIndex: number; // 1 to 12
  startHour: number;
  endHour: number;
  durationHours: number; // 6h for blocks 1..11, 5h for block 12
  isIncomplete: boolean;
  accumMm: number | null;
  meanRateMmH: number | null;
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
    authorityDisclosure: string; // "OFFICIAL IMD BULLETIN (SEPARATE AUTHORITY)"
  };
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
  decisionSupport: DistrictDecisionSupport;
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
