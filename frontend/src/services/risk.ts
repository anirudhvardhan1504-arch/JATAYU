import { fetchJson } from './api';
import { IndicativeFloodRiskAssessment } from '../types';

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
