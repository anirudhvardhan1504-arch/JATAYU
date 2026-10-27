import { fetchJson } from './api';
import { AlertFeedResponse } from '../types';

export async function getDisasterAlerts(
  lat: number = 19.076,
  lon: number = 72.8777,
  name: string = 'Mumbai Operational Center'
): Promise<AlertFeedResponse> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    name,
  });
  return fetchJson<AlertFeedResponse>(`/alerts?${query.toString()}`);
}
