import { fetchJson } from './api';
import { IndicativeFloodRiskAssessment } from '../types';

export interface FloodVulnerabilityPoint {
  id: string;
  name: string;
  coordinate: [number, number]; // [lon, lat]
  radiusMeters: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  type: 'RIVER_BASIN_CROSSING' | 'VULNERABILITY_CHOKEPOINT';
  description: string;
  source: string;
}

export async function getFloodRiskAssessment(
  lat: number = 19.076,
  lon: number = 72.8777,
  name: string = 'Mumbai Operational Center'
): Promise<IndicativeFloodRiskAssessment> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    name,
  });
  return fetchJson<IndicativeFloodRiskAssessment>(`/risk/assessment?${query.toString()}`);
}

export async function getFloodVulnerabilityPoints(): Promise<{
  points: FloodVulnerabilityPoint[];
  count: number;
  sourceAttribution: string;
  lastUpdated: string;
}> {
  return fetchJson<{
    points: FloodVulnerabilityPoint[];
    count: number;
    sourceAttribution: string;
    lastUpdated: string;
  }>('/risk/vulnerabilities');
}
