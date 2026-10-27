import {
  TravelMode,
  LocationPoint,
  RoutePlanResponse,
  EmergencyFacilitiesResponse,
  GeocodingResult,
} from '../types';
import { getReplayHeaders } from './replayHelper';

export class SafeRouteApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'ROUTE_API_ERROR', statusCode = 500) {
    super(message);
    this.name = 'SafeRouteApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Calculate route alternatives with transparent hazard evaluations.
 */
export async function planSafeRoute(
  origin: LocationPoint,
  destination: LocationPoint,
  travelMode: TravelMode = 'driving'
): Promise<RoutePlanResponse> {
  const replayHeaders = getReplayHeaders();
  const response = await fetch('/api/route/plan', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...replayHeaders,
    },
    body: JSON.stringify({
      origin,
      destination,
      travelMode,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SafeRouteApiError(
      data.error || `Route planning failed with status ${response.status}`,
      data.code || 'ROUTE_PLANNING_FAILED',
      response.status
    );
  }

  return data as RoutePlanResponse;
}

/**
 * Search places, addresses, or landmarks via server-side geocoding.
 */
export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  if (!query || !query.trim()) return [];

  const replayHeaders = getReplayHeaders();
  const response = await fetch(`/api/route/geocode?q=${encodeURIComponent(query.trim())}`, {
    headers: { ...replayHeaders },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SafeRouteApiError(
      data.error || 'Geocoding search failed',
      data.code || 'GEOCODE_FAILED',
      response.status
    );
  }

  return data.results || [];
}

/**
 * Fetch verified emergency facilities and shelters.
 */
export async function getEmergencyFacilities(
  lat?: number,
  lon?: number,
  category?: string,
  radius?: number
): Promise<EmergencyFacilitiesResponse> {
  const params = new URLSearchParams();
  if (typeof lat === 'number' && !isNaN(lat)) params.set('lat', lat.toString());
  if (typeof lon === 'number' && !isNaN(lon)) params.set('lon', lon.toString());
  if (category && category !== 'ALL') params.set('category', category);
  if (typeof radius === 'number' && !isNaN(radius)) params.set('radius', radius.toString());

  const url = `/api/route/facilities${params.toString() ? `?${params.toString()}` : ''}`;
  const replayHeaders = getReplayHeaders();
  const response = await fetch(url, {
    headers: { ...replayHeaders },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new SafeRouteApiError(
      data.error || 'Failed to load emergency facilities',
      data.code || 'FACILITIES_FAILED',
      response.status
    );
  }

  return data as EmergencyFacilitiesResponse;
}

/**
 * Reverse geocode coordinates to an address/place name.
 */
export async function reverseGeocodeLocation(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(`/api/route/reverse-geocode?lat=${lat}&lon=${lon}`);
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.displayName) {
      return data.displayName;
    }
  } catch {
    // Ignore network error in offline mode
  }
  return `Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`;
}

/**
 * Generate a standard Google Maps Directions URL for external navigation handoff.
 */
export function getGoogleMapsDirectionsUrl(
  origin: LocationPoint,
  destination: LocationPoint,
  travelMode: TravelMode = 'driving',
  waypoints?: [number, number][]
): string {
  const googleMode = travelMode === 'cycling' ? 'bicycling' : travelMode;
  const originStr = `${origin.latitude.toFixed(6)},${origin.longitude.toFixed(6)}`;
  const destStr = `${destination.latitude.toFixed(6)},${destination.longitude.toFixed(6)}`;

  let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}&travelmode=${googleMode}`;

  if (waypoints && waypoints.length > 0) {
    const wpStr = waypoints.map((wp) => `${wp[1].toFixed(6)},${wp[0].toFixed(6)}`).join('|');
    url += `&waypoints=${encodeURIComponent(wpStr)}`;
  }

  return url;
}
