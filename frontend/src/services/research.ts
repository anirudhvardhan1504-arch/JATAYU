import { fetchJson } from './api';

export interface SimulationMetadata {
  status?: string;
  horizon_hours?: number;
  peak_depth_m?: number;
  flooded_cells_pct?: number;
  deep_channel_cells_pct?: number;
  mean_depth_m?: number;
  generated_at?: string;
  crs?: string;
  reach_length_km?: number;
  model_engine?: string;
  grid_resolution_m?: number;
  disclaimer?: string;
  scenario?: string;
  domain_bounds_utm44n?: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  total_inundated_area_km2?: number;
  depth_bands_km2?: {
    shallow_0_1_to_0_5m: number;
    moderate_0_5_to_1_5m: number;
    critical_gt_1_5m: number;
  };
  simulation_horizon_hours?: number;
  solver?: string;
}

export interface SimulationResponse {
  data_trust_tier: string;
  trust_badge?: string;
  disclaimer?: string;
  requestedBy?: {
    userId: string;
    role: string;
  };
  metadata: SimulationMetadata;
  geojson: GeoJSON.FeatureCollection;
  contours?: GeoJSON.FeatureCollection;
  model_version?: string;
  scenario?: string;
}

export function isGeoJSONFeatureCollection(data: unknown): data is GeoJSON.FeatureCollection {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const candidate = data as { type?: unknown; features?: unknown };
  return candidate.type === 'FeatureCollection' && Array.isArray(candidate.features);
}

export async function fetchAdyarSimulation(token: string): Promise<SimulationResponse> {
  return fetchJson<SimulationResponse>('/research/simulations/adyar-corridor-s2', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
