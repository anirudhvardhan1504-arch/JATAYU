/**
 * JATAYU — Frontend Hydrodynamic Model Visualization Contracts
 * 
 * Client-side interface contracts for rendering hydrodynamic inundation extents,
 * depth tiers, velocity vectors, and experimental disclaimers in MapLibre 2D and Cesium 3D.
 */

export type ModelEngine = 
  | 'HEC_RAS_2D' 
  | 'LISFLOOD_FP' 
  | 'SFINCS' 
  | 'TUFLOW' 
  | 'TELEMAC_2D';

export type OutputClassification = 
  | 'EXPERIMENTAL_UNVALIDATED' 
  | 'VALIDATED_PILOT' 
  | 'OPERATIONAL_ADVISORY';

export interface DepthTierStyle {
  depthRange: '<0.3m' | '0.3-0.6m' | '0.6-1.2m' | '>1.2m';
  areaKm2: number;
  fillColorHex: string;
  fillOpacity: number;
  label: string;
}

export interface ClientHydrodynamicLayerConfig {
  outputId: string;
  sectorId: string;
  classification: OutputClassification;
  isExperimental: boolean;
  disclaimer: string;
  maxInundationExtentKm2: number;
  peakDepthMeters: number;
  criticalSuccessIndex?: number;
  geoJsonUrl?: string;
  rasterTileUrl?: string; // Cloud-Optimized GeoTIFF (COG) or XYZ tile endpoint
  depthTiers: DepthTierStyle[];
}

export const DEFAULT_DEPTH_TIER_STYLES: DepthTierStyle[] = [
  { depthRange: '<0.3m', areaKm2: 0, fillColorHex: '#93c5fd', fillOpacity: 0.4, label: 'Shallow Ponding (<0.3m)' },
  { depthRange: '0.3-0.6m', areaKm2: 0, fillColorHex: '#3b82f6', fillOpacity: 0.6, label: 'Moderate Inundation (0.3-0.6m)' },
  { depthRange: '0.6-1.2m', areaKm2: 0, fillColorHex: '#1d4ed8', fillOpacity: 0.75, label: 'Deep Water Hazard (0.6-1.2m)' },
  { depthRange: '>1.2m', areaKm2: 0, fillColorHex: '#1e1b4b', fillOpacity: 0.9, label: 'Severe / Submerged (>1.2m)' },
];
