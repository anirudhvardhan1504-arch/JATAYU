/**
 * JATAYU — Hydrodynamic Modeling Groundwork & Integration Contracts
 * 
 * Formal architecture definitions for future hydrologic and hydraulic inundation modeling services.
 * All outputs produced under this contract MUST be marked EXPERIMENTAL until validated against
 * empirical historical ground-truth observations.
 */

export type ModelEngine = 
  | 'HEC_RAS_2D' 
  | 'LISFLOOD_FP' 
  | 'SFINCS' 
  | 'TUFLOW' 
  | 'TELEMAC_2D';

export type JobStatus = 
  | 'QUEUED' 
  | 'PROVISIONING_INPUTS' 
  | 'RUNNING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'TIMED_OUT' 
  | 'CANCELLED';

export type OutputClassification = 
  | 'EXPERIMENTAL_UNVALIDATED' 
  | 'VALIDATED_PILOT' 
  | 'OPERATIONAL_ADVISORY';

export type InundationOutputVariable = 
  | 'WATER_DEPTH' 
  | 'WATER_SURFACE_ELEVATION' 
  | 'VELOCITY_VECTOR' 
  | 'INUNDATION_EXTENT' 
  | 'ARRIVAL_TIME';

export interface RainfallTimeseriesPoint {
  timestamp: string;
  intensityMmH: number;
}

export interface InflowHydrographPoint {
  riverId: string;
  nodeIndex: number;
  dischargeM3s: number;
  timestamp: string;
}

export interface TidalBoundaryPoint {
  stationId: string;
  waterLevelMslMeters: number;
  timestamp: string;
}

export interface ManningRoughnessConfig {
  defaultChannel: number;
  defaultFloodplain: number;
  landUseOverrideTableId?: string;
}

export interface TerrainConfiguration {
  demId: string;
  demResolutionMeters: number;
  crs: string; // Projected CRS e.g., EPSG:32643
  roughness: ManningRoughnessConfig;
  elevationDatum: 'EGM96' | 'EGM2008' | 'LOCAL_MSL';
}

export interface SimulationBoundaryConditions {
  rainfallTimeseries: RainfallTimeseriesPoint[];
  inflowHydrographs?: InflowHydrographPoint[];
  tidalDownstreamBoundary?: TidalBoundaryPoint[];
}

export interface SimulationTimeWindow {
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  timestepSeconds: number; // e.g. 5 to 30
  outputIntervalMinutes: number; // e.g. 15 or 60
}

/**
 * Standardized simulation request schema for the external modeling worker.
 */
export interface HydrodynamicSimulationRequest {
  simulationId: string;
  sectorId: string;
  modelEngine: ModelEngine;
  modelVersion: string;
  terrain: TerrainConfiguration;
  boundaries: SimulationBoundaryConditions;
  timeWindow: SimulationTimeWindow;
  requestedOutputs: InundationOutputVariable[];
  requesterId: string;
}

/**
 * Job lifecycle and telemetry tracking.
 */
export interface HydrodynamicJobState {
  jobId: string;
  simulationId: string;
  sectorId: string;
  status: JobStatus;
  progressPercent: number; // 0 - 100
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  heartbeatTimestamp: string;
  workerNodeId?: string;
}

export interface DepthTierSummary {
  depthRange: '<0.3m' | '0.3-0.6m' | '0.6-1.2m' | '>1.2m';
  areaKm2: number;
  hazardLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface HydrodynamicUncertaintyMetrics {
  depthErrorMarginMeters: number; // +/- 95% CI margin
  confidencePercentile: number; // e.g., 50 or 90
  calibrationDataset?: string;
  brierScore?: number;
  criticalSuccessIndex?: number; // CSI (Threat Score)
}

export interface HydrodynamicProvenanceMetadata {
  engineName: ModelEngine;
  engineVersion: string;
  demSource: string;
  meteorologicalDriver: string;
  gridCellCount: number;
  computationDurationSeconds: number;
  storageUri: string;
  checksumSha256: string;
}

/**
 * Standardized model output schema for frontend rendering (MapLibre vector/raster & Cesium 3D).
 */
export interface HydrodynamicSimulationOutput {
  outputId: string;
  jobId: string;
  simulationId: string;
  sectorId: string;
  simulationTimestamp: string;
  spatialReferenceSystem: string; // e.g., 'EPSG:4326' (for GeoJSON) and native projected 'EPSG:32643'
  classification: OutputClassification;
  disclaimer: string;
  metrics: {
    maxInundationExtentKm2: number;
    peakDepthMeters: number;
    peakVelocityMs?: number;
    depthTiers: DepthTierSummary[];
  };
  inundationPolygonsGeoJSON?: {
    type: 'FeatureCollection';
    features: any[];
  };
  rasterCoverageTileUrl?: string; // Cog/XYZ tiles for Cesium and MapLibre raster layering
  uncertainty: HydrodynamicUncertaintyMetrics;
  provenance: HydrodynamicProvenanceMetadata;
}

export const EXPERIMENTAL_MODEL_DISCLAIMER = 
  'EXPERIMENTAL HYDRODYNAMIC ESTIMATION: This inundation model output is an uncalibrated experimental ' +
  'numerical prototype. It is NOT validated against verified ground-truth gauge benchmarks and MUST NOT ' +
  'be used as the sole basis for live tactical dispatch, emergency evacuation, or life-safety decisions. ' +
  'Refer to official IMD/CWC bulletins and verified field observations.';
