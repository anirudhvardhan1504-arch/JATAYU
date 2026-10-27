import dns from 'node:dns';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Enforce IPv4-first ordering for upstream OSRM and Nominatim routing queries
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignored in non-supported runtimes
}
import {
  TravelMode,
  LocationPoint,
  RouteHazard,
  EvaluatedRoute,
  RoutePlanResponse,
  EmergencyFacility,
  EmergencyFacilitiesResponse,
  GeocodingResult,
  FacilityCategory,
} from '../types/route.types.js';
import { AlertService } from './alert.service.js';
import { WeatherService } from './weather.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RoutingServiceError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code = 'ROUTING_ERROR', statusCode = 502) {
    super(message);
    this.name = 'RoutingServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface FloodVulnerabilityPoint {
  id: string;
  name: string;
  coordinate: [number, number]; // [lon, lat]
  radiusMeters: number;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  type: 'RIVER_BASIN_CROSSING' | 'VULNERABILITY_CHOKEPOINT';
  description: string;
  source: string;
}

export function haversineDistanceMeters(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const PRESET_MUNICIPAL_LOCATIONS: Record<string, { lat: number; lon: number; name: string }> = {
  // Chennai & Tamil Nadu
  'chennai central': { lat: 13.0827, lon: 80.2755, name: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central Railway Station, Chennai' },
  'saidapet': { lat: 13.0210, lon: 80.2230, name: 'Saidapet Metro / Arterial Junction, Chennai' },
  'kotturpuram': { lat: 13.0230, lon: 80.2410, name: 'Kotturpuram Bridge, Adyar Corridor, Chennai' },
  'velachery': { lat: 12.9790, lon: 80.2185, name: 'Velachery MRTS / Bypass, Chennai' },
  'chennai airport': { lat: 12.9856, lon: 80.1652, name: 'Chennai International Airport (MAA), Meenambakkam' },
  't. nagar': { lat: 13.0418, lon: 80.2341, name: 'Thyagaraya Nagar (T. Nagar), Chennai' },
  't nagar': { lat: 13.0418, lon: 80.2341, name: 'Thyagaraya Nagar (T. Nagar), Chennai' },
  'tambaram': { lat: 12.9249, lon: 80.1000, name: 'Tambaram Railway Station / GST Road, Chennai' },
  'guindy': { lat: 13.0067, lon: 80.2030, name: 'Guindy Industrial Estate / Metro, Chennai' },
  'anna nagar': { lat: 13.0850, lon: 80.2100, name: 'Anna Nagar Roundtana, Chennai' },
  'marina beach': { lat: 13.0500, lon: 80.2824, name: 'Marina Beach Promenade, Chennai' },
  'koyambedu': { lat: 13.0694, lon: 80.1948, name: 'Koyambedu CMBT, Chennai' },
  'coimbatore': { lat: 11.0168, lon: 76.9558, name: 'Gandhipuram Central, Coimbatore, Tamil Nadu' },
  'madurai': { lat: 9.9252, lon: 78.1198, name: 'Madurai Junction / Meenakshi Temple, Tamil Nadu' },

  // Delhi NCR
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, Central Delhi' },
  'new delhi': { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, Central Delhi' },
  'connaught place': { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, Central Delhi' },
  'new delhi railway station': { lat: 28.6427, lon: 77.2195, name: 'New Delhi Railway Station (NDLS), Delhi' },
  'aiims delhi': { lat: 28.5672, lon: 77.2100, name: 'AIIMS New Delhi, Ansari Nagar' },

  // Mumbai & Maharashtra
  'mumbai': { lat: 18.9400, lon: 72.8353, name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Mumbai' },
  'mumbai cst': { lat: 18.9400, lon: 72.8353, name: 'Chhatrapati Shivaji Maharaj Terminus, Mumbai' },
  'bandra': { lat: 19.0596, lon: 72.8295, name: 'Bandra West, Mumbai' },
  'dadar': { lat: 19.0178, lon: 72.8478, name: 'Dadar Central / Western Interchange, Mumbai' },
  'pune': { lat: 18.5204, lon: 73.8567, name: 'Shivajinagar / Pune Central, Maharashtra' },

  // Bengaluru & Karnataka
  'bengaluru': { lat: 12.9716, lon: 77.5946, name: 'Majestic / KSR Bengaluru City Station, Karnataka' },
  'bangalore': { lat: 12.9716, lon: 77.5946, name: 'Majestic / KSR Bengaluru City Station, Karnataka' },
  'whitefield': { lat: 12.9698, lon: 77.7499, name: 'Whitefield Tech Corridor, Bengaluru' },

  // Kolkata & West Bengal
  'kolkata': { lat: 22.5726, lon: 88.3639, name: 'Howrah Bridge / BBD Bagh, Kolkata' },
  'howrah': { lat: 22.5855, lon: 88.3433, name: 'Howrah Railway Station Terminal, West Bengal' },

  // Hyderabad & Telangana
  'hyderabad': { lat: 17.3850, lon: 78.4867, name: 'Charminar / Nampally Central, Hyderabad' },
  'secunderabad': { lat: 17.4399, lon: 78.4983, name: 'Secunderabad Junction Railway Station, Telangana' },

  // Kerala
  'kochi': { lat: 9.9312, lon: 76.2673, name: 'Marine Drive / Ernakulam Junction, Kochi, Kerala' },
  'ernakulam': { lat: 9.9816, lon: 76.2999, name: 'Ernakulam Town / North Station, Kerala' },
  'thiruvananthapuram': { lat: 8.5241, lon: 76.9366, name: 'Thiruvananthapuram Central Railway Station, Kerala' },

  // Eastern & North-Eastern Hubs
  'bhubaneswar': { lat: 20.2961, lon: 85.8245, name: 'Master Canteen Square, Bhubaneswar, Odisha' },
  'cuttack': { lat: 20.4625, lon: 85.8830, name: 'Badambadi Bus Terminal, Cuttack, Odisha' },
  'guwahati': { lat: 26.1822, lon: 91.7454, name: 'Paltan Bazaar / Guwahati Station, Assam' },
  'patna': { lat: 25.5941, lon: 85.1376, name: 'Gandhi Maidan / Patna Central, Bihar' },

  // Western & Northern Hubs
  'ahmedabad': { lat: 23.0225, lon: 72.5714, name: 'Kalupur Central Railway Station, Ahmedabad, Gujarat' },
  'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Sindhi Camp / Jaipur Junction, Rajasthan' },
  'lucknow': { lat: 26.8467, lon: 80.9462, name: 'Charbagh Railway Station, Lucknow, Uttar Pradesh' },
  'varanasi': { lat: 25.3176, lon: 82.9739, name: 'Varanasi Junction Cantt, Uttar Pradesh' },
  'visakhapatnam': { lat: 17.6868, lon: 83.2185, name: 'Visakhapatnam Port / Railway Station, Andhra Pradesh' },
  'chandigarh': { lat: 30.7333, lon: 76.7794, name: 'Sector 17 City Centre, Chandigarh' },
  'shimla': { lat: 31.1048, lon: 77.1734, name: 'The Mall Road / Ridge, Shimla, Himachal Pradesh' },
  'srinagar': { lat: 34.0837, lon: 74.7973, name: 'Lal Chowk, Srinagar, Jammu & Kashmir' }
};

export class RouteService {
  private facilities: EmergencyFacility[] = [];
  private vulnerabilityPoints: FloodVulnerabilityPoint[] = [];
  private alertService = new AlertService();
  private weatherService = new WeatherService();

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    const facilitiesPath = path.resolve(__dirname, '../data/geo/verified_facilities.json');
    if (fs.existsSync(facilitiesPath)) {
      try {
        this.facilities = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'));
      } catch (err) {
        console.warn('[RouteService] Failed to load verified_facilities.json:', err);
      }
    }

    const vulnPath = path.resolve(__dirname, '../data/geo/flood_vulnerability_points.json');
    if (fs.existsSync(vulnPath)) {
      try {
        this.vulnerabilityPoints = JSON.parse(fs.readFileSync(vulnPath, 'utf-8'));
      } catch (err) {
        console.warn('[RouteService] Failed to load flood_vulnerability_points.json:', err);
      }
    }
  }

  private geocodeCache = new Map<string, { timestamp: number; results: GeocodingResult[] }>();
  private reverseCache = new Map<string, { timestamp: number; displayName: string }>();
  private facilityCache = new Map<string, { timestamp: number; data: EmergencyFacilitiesResponse }>();

  /**
   * Reverse geocode a latitude/longitude coordinate pair into an informative place name.
   */
  async reverseGeocode(lat: number, lon: number): Promise<string> {
    const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.displayName;
    }

    // 1. Check if near any preset location (< 1.5 km)
    for (const val of Object.values(PRESET_MUNICIPAL_LOCATIONS)) {
      if (haversineDistanceMeters([lon, lat], [val.lon, val.lat]) < 1500) {
        this.reverseCache.set(cacheKey, { timestamp: Date.now(), displayName: val.name });
        return val.name;
      }
    }

    // 2. Query Nominatim reverse geocode
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JATAYU-SafeRoute/1.0 (contact@jatayu.gov.in)',
          'Accept-Language': 'en',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && data.display_name) {
          const name = data.display_name;
          this.reverseCache.set(cacheKey, { timestamp: Date.now(), displayName: name });
          return name;
        }
      }
    } catch {
      // Offline or network timeout fallback
    }

    const fallbackName = `Selected Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`;
    return fallbackName;
  }

  /**
   * Geocode a place name, address, or coordinate string.
   */
  async geocodeAddress(query: string): Promise<GeocodingResult[]> {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return [];
    }

    const trimmed = query.trim();
    const cacheKey = trimmed.toLowerCase();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 12 * 60 * 60 * 1000) {
      return cached.results;
    }

    // 1. Check if direct coordinate pair: "13.0827, 80.2707" or "13.0827 80.2707"
    const coordMatch = trimmed.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return [
          {
            latitude: lat,
            longitude: lon,
            displayName: `Coordinates (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
            type: 'coordinate',
          },
        ];
      }
    }

    // 2. Identify exact, prefix, or name-based preset matches (offline resilience & instant autocomplete)
    const lower = trimmed.toLowerCase();
    const exactOrPrefixPresets: GeocodingResult[] = [];
    for (const [key, val] of Object.entries(PRESET_MUNICIPAL_LOCATIONS)) {
      const valLower = val.name.toLowerCase();
      if (
        key === lower ||
        key.startsWith(lower) ||
        (lower.length >= 3 && valLower.includes(lower))
      ) {
        if (!exactOrPrefixPresets.some((p) => p.displayName === val.name)) {
          exactOrPrefixPresets.push({
            latitude: val.lat,
            longitude: val.lon,
            displayName: val.name,
            type: 'preset_verified',
          });
        }
      }
    }

    // 3. Attempt online geocoding via OpenStreetMap Nominatim with safety timeout
    let onlineResults: GeocodingResult[] = [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=7&countrycodes=in&addressdetails=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JATAYU-Disaster-Intelligence-Platform/2.0 (contact@jatayu.gov.in)',
          'Accept-Language': 'en',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any[];
        if (Array.isArray(data) && data.length > 0) {
          onlineResults = data.map((item) => ({
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
            type: item.type || item.class || 'place',
          }));
        }
      }
    } catch {
      // In offline/airgapped or rate-limited environments, continue to preset fallback
    }

    // 4. Combine online results with presets if online returned matches
    if (onlineResults.length > 0) {
      const combined: GeocodingResult[] = [...exactOrPrefixPresets];
      for (const online of onlineResults) {
        const isDup = combined.some(
          (c) =>
            Math.abs(c.latitude - online.latitude) < 0.005 &&
            Math.abs(c.longitude - online.longitude) < 0.005
        );
        if (!isDup) {
          combined.push(online);
        }
      }
      this.geocodeCache.set(cacheKey, { timestamp: Date.now(), results: combined });
      return combined;
    }

    // 5. If online returned nothing or failed, check broader substring preset matches
    const fallbackPresets: GeocodingResult[] = [...exactOrPrefixPresets];
    for (const [key, val] of Object.entries(PRESET_MUNICIPAL_LOCATIONS)) {
      if (lower.includes(key) || key.includes(lower)) {
        if (!fallbackPresets.some((p) => p.displayName === val.name)) {
          fallbackPresets.push({
            latitude: val.lat,
            longitude: val.lon,
            displayName: val.name,
            type: 'preset_verified',
          });
        }
      }
    }

    if (fallbackPresets.length > 0) {
      this.geocodeCache.set(cacheKey, { timestamp: Date.now(), results: fallbackPresets });
      return fallbackPresets;
    }

    return [];
  }

  /**
   * Retrieve verified emergency facilities, optionally filtered by category and sorted by distance.
   */
  getEmergencyFacilities(
    nearLat?: number,
    nearLon?: number,
    category?: string
  ): EmergencyFacility[] {
    let list = [...this.facilities];

    if (category && category !== 'ALL') {
      list = list.filter((f) => f.category.toUpperCase() === category.toUpperCase());
    }

    if (
      typeof nearLat === 'number' &&
      typeof nearLon === 'number' &&
      !isNaN(nearLat) &&
      !isNaN(nearLon)
    ) {
      list = list.map((f) => {
        const distMeters = haversineDistanceMeters(
          [nearLon, nearLat],
          [f.location.longitude, f.location.latitude]
        );
        return {
          ...f,
          sourceProvenance: 'CURATED_SOURCE' as const,
          distanceKm: parseFloat((distMeters / 1000).toFixed(2)),
        };
      });

      list.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    } else {
      list = list.map((f) => ({
        ...f,
        sourceProvenance: 'CURATED_SOURCE' as const,
      }));
    }

    return list;
  }

  /**
   * Dynamically discover nearby emergency facilities using OpenStreetMap Overpass API,
   * merged with officially curated civil defense repositories, bounded by search radius.
   * Real-time availability is strictly designated UNKNOWN with mandatory on-arrival verification.
   */
  async discoverNearbyFacilities(
    nearLat?: number,
    nearLon?: number,
    radiusMeters = 5000,
    category = 'ALL'
  ): Promise<EmergencyFacilitiesResponse> {
    // If coordinates are not provided, return the curated baseline facilities
    if (
      typeof nearLat !== 'number' ||
      typeof nearLon !== 'number' ||
      isNaN(nearLat) ||
      isNaN(nearLon)
    ) {
      const list = this.getEmergencyFacilities(nearLat, nearLon, category);
      return {
        facilities: list,
        count: list.length,
        sourceAttribution: 'Greater Chennai Corporation (GCC) & TNSDMA Official Emergency Registries',
        disclaimer:
          'Facility records are officially verified from public civil defense directories. Real-time vacancy and operational availability are designated UNKNOWN and require verification upon arrival or through official emergency dispatch.',
      };
    }

    // Clamp radius: between 1,000m and 50,000m
    const clampedRadius = Math.max(1000, Math.min(50000, radiusMeters));
    const cacheKey = `${nearLat.toFixed(3)},${nearLon.toFixed(3)},${clampedRadius},${category}`;
    const cached = this.facilityCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return cached.data;
    }

    // 1. Filter curated facilities within clampedRadius
    const curatedMatches: EmergencyFacility[] = [];
    for (const f of this.facilities) {
      const distMeters = haversineDistanceMeters(
        [nearLon, nearLat],
        [f.location.longitude, f.location.latitude]
      );
      if (distMeters <= clampedRadius) {
        if (category === 'ALL' || f.category.toUpperCase() === category.toUpperCase()) {
          curatedMatches.push({
            ...f,
            distanceKm: parseFloat((distMeters / 1000).toFixed(2)),
            sourceProvenance: 'CURATED_SOURCE',
            verificationStatus: 'OFFICIALLY_VERIFIED',
            currentAvailability: 'UNKNOWN',
          });
        }
      }
    }

    // 2. Query OpenStreetMap Overpass API for live nationwide emergency infrastructure
    const communityFacilities: EmergencyFacility[] = [];
    let overpassSucceeded = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const overpassQuery = `
        [out:json][timeout:5];
        (
          node["amenity"~"hospital|clinic|doctors|fire_station"](around:${clampedRadius},${nearLat},${nearLon});
          node["emergency"~"shelter|disaster_response|assembly_point"](around:${clampedRadius},${nearLat},${nearLon});
          node["social_facility"~"shelter|group_home"](around:${clampedRadius},${nearLat},${nearLon});
          way["amenity"~"hospital|clinic|fire_station"](around:${clampedRadius},${nearLat},${nearLon});
        );
        out center 35;
      `;

      const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'JATAYU-Disaster-Intelligence-Platform/2.0 (contact@jatayu.gov.in)',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data && Array.isArray(data.elements)) {
          overpassSucceeded = true;
          for (const el of data.elements) {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;

            const tags = el.tags || {};
            let cat: FacilityCategory = 'EMERGENCY_OPS';
            if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.amenity === 'doctors') {
              cat = 'HOSPITAL';
            } else if (
              tags.emergency === 'shelter' ||
              tags.social_facility === 'shelter' ||
              tags.emergency === 'assembly_point' ||
              tags.social_facility === 'group_home'
            ) {
              cat = 'SHELTER';
            } else if (tags.amenity === 'fire_station') {
              cat = 'FIRE_STATION';
            }

            if (category !== 'ALL' && cat.toUpperCase() !== category.toUpperCase()) {
              continue;
            }

            const rawName = tags.name || tags['name:en'] || tags['name:hi'] || tags['name:ta'];
            const fallbackName =
              cat === 'HOSPITAL'
                ? 'Community Hospital / Medical Center'
                : cat === 'SHELTER'
                ? 'Emergency Evacuation Shelter'
                : cat === 'FIRE_STATION'
                ? 'Fire & Rescue Station'
                : 'Emergency Response Unit';
            const name = rawName || fallbackName;

            const distMeters = haversineDistanceMeters([nearLon, nearLat], [lon, lat]);
            const addressParts = [
              tags['addr:street'],
              tags['addr:suburb'] || tags['addr:neighbourhood'],
              tags['addr:city'] || tags['addr:town'] || tags['addr:village'],
              tags['addr:district'],
              tags['addr:state'],
            ].filter(Boolean);

            const address =
              addressParts.length > 0
                ? addressParts.join(', ')
                : `Vicinity coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`;

            communityFacilities.push({
              id: `osm_${el.id}`,
              name,
              category: cat,
              location: { latitude: lat, longitude: lon },
              address,
              phone: tags.phone || tags['contact:phone'] || undefined,
              source: 'OpenStreetMap Overpass Community Registry',
              sourceProvenance: 'COMMUNITY_MAPPED',
              verificationStatus: 'GENERAL_DIRECTORY',
              currentAvailability: 'UNKNOWN',
              operationalStatus: 'OpenStreetMap Community Record — Operational status UNVERIFIED',
              distanceKm: parseFloat((distMeters / 1000).toFixed(2)),
            });
          }
        }
      }
    } catch {
      overpassSucceeded = false;
    }

    // 3. Deduplicate and merge: Curated entries take priority
    const merged: EmergencyFacility[] = [...curatedMatches];
    for (const com of communityFacilities) {
      const isDup = merged.some(
        (m) =>
          haversineDistanceMeters(
            [m.location.longitude, m.location.latitude],
            [com.location.longitude, com.location.latitude]
          ) < 250 || m.name.toLowerCase() === com.name.toLowerCase()
      );
      if (!isDup) {
        merged.push(com);
      }
    }

    // Fallback: If no facilities found in range (offline or remote area), provide nearest curated facilities
    if (merged.length === 0) {
      const fallbackCurated = this.getEmergencyFacilities(nearLat, nearLon, category).slice(0, 5);
      for (const f of fallbackCurated) {
        merged.push({
          ...f,
          sourceProvenance: 'CURATED_SOURCE',
          verificationStatus: 'OFFICIALLY_VERIFIED',
          currentAvailability: 'UNKNOWN',
        });
      }
    }

    merged.sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

    const response: EmergencyFacilitiesResponse = {
      facilities: merged,
      count: merged.length,
      sourceAttribution: overpassSucceeded
        ? 'OpenStreetMap Community Emergency Registry & Official Civil Defense Directories'
        : 'Greater Chennai Corporation (GCC) & TNSDMA Official Emergency Registries (Fallback)',
      disclaimer:
        'Facility records are aggregated from verified civil defense directories and OpenStreetMap community infrastructure. Operational availability and current vacancy are designated strictly UNKNOWN and require verification on arrival or through official disaster dispatch.',
    };

    this.facilityCache.set(cacheKey, { timestamp: Date.now(), data: response });
    return response;
  }

  /**
   * Fetch route from OSRM with IPv4 resolution to prevent Docker bridge IPv6 hangs.
   */
  private async fetchOSRMRoute(osrmUrl: string, timeoutMs = 8000): Promise<any> {
    if (process.env.NODE_ENV === 'test') {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(osrmUrl, {
          headers: { 'User-Agent': 'JATAYU-SafeRoute/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new RoutingServiceError(
            `Upstream routing provider returned HTTP ${res.status}.`,
            'ROUTING_PROVIDER_ERROR',
            502
          );
        }
        return await res.json();
      } finally {
        clearTimeout(timeout);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const parsed = new URL(osrmUrl);
        const isHttps = parsed.protocol === 'https:';
        const defaultPort = isHttps ? 443 : 80;

        dns.lookup(parsed.hostname, { family: 4 }, (lookupErr, address) => {
          if (lookupErr || !address) {
            fetch(osrmUrl, {
              headers: { 'User-Agent': 'JATAYU-SafeRoute/1.0' },
              signal: AbortSignal.timeout(timeoutMs),
            })
              .then(async (res) => {
                if (!res.ok) {
                  reject(
                    new RoutingServiceError(
                      `Upstream routing provider returned HTTP ${res.status}.`,
                      'ROUTING_PROVIDER_ERROR',
                      502
                    )
                  );
                  return;
                }
                resolve(await res.json());
              })
              .catch(reject);
            return;
          }

          const client = isHttps ? https : http;
          const req = client.request(
            {
              host: address,
              port: parsed.port ? parseInt(parsed.port, 10) : defaultPort,
              path: parsed.pathname + parsed.search,
              method: 'GET',
              headers: {
                Host: parsed.hostname,
                'User-Agent': 'JATAYU-SafeRoute/1.0',
                Accept: 'application/json',
              },
              timeout: timeoutMs,
            },
            (res) => {
              let body = '';
              res.on('data', (chunk) => (body += chunk));
              res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  try {
                    resolve(JSON.parse(body));
                  } catch (parseErr: any) {
                    reject(
                      new RoutingServiceError(
                        `Failed to parse routing response: ${parseErr.message}`,
                        'ROUTING_PROVIDER_ERROR',
                        502
                      )
                    );
                  }
                } else {
                  reject(
                    new RoutingServiceError(
                      `Upstream routing provider returned HTTP ${res.statusCode}.`,
                      'ROUTING_PROVIDER_ERROR',
                      502
                    )
                  );
                }
              });
            }
          );

          req.on('error', (err) => {
            reject(
              new RoutingServiceError(
                `Routing provider unreachable: ${err.message}`,
                'ROUTING_SERVICE_UNAVAILABLE',
                503
              )
            );
          });

          req.on('timeout', () => {
            req.destroy();
            reject(
              new RoutingServiceError(
                `Routing provider timed out after ${timeoutMs}ms.`,
                'ROUTING_SERVICE_UNAVAILABLE',
                503
              )
            );
          });

          req.end();
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  /**
   * Calculate routes using OSRM and evaluate hazard intersections along route geometries.
   */
  async planSafeRoute(params: {
    origin: LocationPoint;
    destination: LocationPoint;
    travelMode?: TravelMode;
  }): Promise<RoutePlanResponse> {
    const { origin, destination, travelMode = 'driving' } = params;

    if (
      typeof origin.latitude !== 'number' ||
      typeof origin.longitude !== 'number' ||
      typeof destination.latitude !== 'number' ||
      typeof destination.longitude !== 'number' ||
      isNaN(origin.latitude) ||
      isNaN(origin.longitude) ||
      isNaN(destination.latitude) ||
      isNaN(destination.longitude) ||
      origin.latitude < -90 ||
      origin.latitude > 90 ||
      destination.latitude < -90 ||
      destination.latitude > 90 ||
      origin.longitude < -180 ||
      origin.longitude > 180 ||
      destination.longitude < -180 ||
      destination.longitude > 180
    ) {
      throw new RoutingServiceError(
        'Invalid coordinates provided for origin or destination. Latitude must be in [-90, 90] and longitude in [-180, 180].',
        'INVALID_COORDINATES',
        400
      );
    }

    // Verify distance is greater than 10 meters
    const distMeters = haversineDistanceMeters(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude]
    );

    if (distMeters < 10) {
      throw new RoutingServiceError(
        'Origin and destination cannot be identical (minimum separation 10m).',
        'IDENTICAL_POINTS',
        400
      );
    }

    // Map travel mode to OSRM profile
    let osrmProfile = 'driving';
    if (travelMode === 'walking') osrmProfile = 'walking';
    if (travelMode === 'cycling') osrmProfile = 'cycling';

    const baseUrl = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
    const osrmUrl = `${baseUrl}/route/v1/${osrmProfile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&alternatives=true&steps=true`;

    let osrmData: any = null;
    try {
      osrmData = await this.fetchOSRMRoute(osrmUrl);
    } catch (err: any) {
      if (err instanceof RoutingServiceError) throw err;
      throw new RoutingServiceError(
        `Routing provider unreachable or timed out: ${err.message || 'Network error'}. Check external connectivity or configure OSRM_BASE_URL.`,
        'ROUTING_SERVICE_UNAVAILABLE',
        503
      );
    }

    const validRoutes = (osrmData?.routes || []).filter(
      (r: any) =>
        (r.distance || 0) > 0 &&
        Array.isArray(r.geometry?.coordinates) &&
        r.geometry.coordinates.length >= 2
    );

    if (!osrmData || osrmData.code !== 'Ok' || validRoutes.length === 0) {
      throw new RoutingServiceError(
        osrmData?.message || 'No navigable road route found between the specified points for this travel mode.',
        'NO_ROUTE_FOUND',
        404
      );
    }

    // Query active alerts & weather for context with resilient fallback
    let alertsFeed: any = null;
    try {
      alertsFeed = await this.alertService.getAlerts(origin.latitude, origin.longitude, origin.name);
    } catch {
      console.warn('[RouteService] Alert feed fetch failed, proceeding with degraded alert context');
    }

    let originWeather: any = null;
    try {
      originWeather = await this.weatherService.getCurrentWeather(origin.latitude, origin.longitude);
    } catch {
      console.warn('[RouteService] Weather fetch failed, proceeding with degraded weather context');
    }

    const evaluatedAtIso = new Date().toISOString();

    // Process each route alternative
    const evaluatedRoutes: EvaluatedRoute[] = [];

    for (let i = 0; i < validRoutes.length; i++) {
      const rawRoute = validRoutes[i];
      const isPrimary = i === 0;
      const coords = rawRoute.geometry?.coordinates as [number, number][]; // [lon, lat][]

      const hazards: RouteHazard[] = [];

      // 1. Check intersection with verified flood vulnerability choke points
      const checkedPoints = new Set<string>();
      if (Array.isArray(coords)) {
        // Sample points along route to avoid excessive checks
        const step = Math.max(1, Math.floor(coords.length / 50));
        for (let cIdx = 0; cIdx < coords.length; cIdx += step) {
          const coord = coords[cIdx];
          for (const vuln of this.vulnerabilityPoints) {
            if (checkedPoints.has(vuln.id)) continue;
            const dist = haversineDistanceMeters(coord, vuln.coordinate);
            if (dist <= vuln.radiusMeters) {
              checkedPoints.add(vuln.id);
              hazards.push({
                id: `hazard_${vuln.id}_${i}`,
                type: vuln.type,
                severity: vuln.severity,
                title: vuln.name,
                description: `${vuln.description} (Route passes within ${Math.round(dist)}m of critical point)`,
                coordinate: vuln.coordinate,
                affectedSegmentIndex: cIdx,
                dataSource: vuln.source,
                sourceProvenance: 'HISTORICAL_VULNERABILITY',
                lastUpdated: evaluatedAtIso,
              });
            }
          }
        }
      }

      // 2. Check official IMD alerts intersecting route
      if (alertsFeed && alertsFeed.officialAlerts.length > 0) {
        for (const alert of alertsFeed.officialAlerts) {
          hazards.push({
            id: `hazard_alert_${alert.id}_${i}`,
            type: 'METEOROLOGICAL_WARNING',
            severity: alert.severity === 'EMERGENCY' ? 'CRITICAL' : alert.severity === 'WARNING' ? 'HIGH' : 'MODERATE',
            title: `Official Bulletin: ${alert.event}`,
            description: `${alert.headline || alert.instruction} (Issued for administrative region: ${alert.areaDesc})`,
            coordinate: [origin.longitude, origin.latitude],
            dataSource: 'India Meteorological Department (IMD) / National Disaster Management Authority (NDMA)',
            sourceProvenance: 'OFFICIAL_ALERT',
            lastUpdated: alert.effective,
          });
        }
      }

      // 3. Check observed rainfall intensity
      if (originWeather && originWeather.precipitationMm >= 5.0) {
        const isSevere = originWeather.precipitationMm >= 15.0;
        hazards.push({
          id: `hazard_rain_${i}`,
          type: 'HEAVY_RAINFALL',
          severity: isSevere ? 'HIGH' : 'MODERATE',
          title: `Active Precipitation: ${originWeather.precipitationMm.toFixed(1)} mm/h`,
          description: `Telemetry records ${originWeather.precipitationMm.toFixed(1)} mm/h rainfall in sector. Surface water accumulation and reduced road grip expected.`,
          coordinate: [origin.longitude, origin.latitude],
          dataSource: 'Open-Meteo European NWP Telemetry Feed',
          sourceProvenance: 'NWP_OBSERVATION',
          lastUpdated: originWeather.timestamp,
        });
      }

      // 4. Compute transparent, documented risk score (0-100)
      let riskScore = 10; // Baseline peacetime travel uncertainty
      const highChokepoints = hazards.filter((h) => h.type === 'VULNERABILITY_CHOKEPOINT' || h.type === 'RIVER_BASIN_CROSSING');
      riskScore += highChokepoints.length * 25;

      const warningAlerts = hazards.filter((h) => h.type === 'METEOROLOGICAL_WARNING' && (h.severity === 'HIGH' || h.severity === 'CRITICAL'));
      if (warningAlerts.length > 0) riskScore += 30;

      const rainHazards = hazards.filter((h) => h.type === 'HEAVY_RAINFALL');
      if (rainHazards.some((r) => r.severity === 'HIGH')) riskScore += 25;
      else if (rainHazards.length > 0) riskScore += 15;

      riskScore = Math.min(100, Math.max(0, riskScore));

      let riskTier: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (riskScore >= 75) riskTier = 'CRITICAL';
      else if (riskScore >= 50) riskTier = 'HIGH';
      else if (riskScore >= 25) riskTier = 'ELEVATED';

      const distanceKm = parseFloat(((rawRoute.distance || 0) / 1000).toFixed(2));
      const durationMinutes = Math.round((rawRoute.duration || 0) / 60);

      // Comparison metrics against primary route (for alternatives)
      let additionalDistanceKm: number | undefined;
      let additionalDurationMinutes: number | undefined;
      let hazardsAvoidedAgainstPrimary: string[] | undefined;

      if (!isPrimary && evaluatedRoutes.length > 0) {
        const primary = evaluatedRoutes[0];
        additionalDistanceKm = parseFloat((distanceKm - primary.distanceKm).toFixed(2));
        additionalDurationMinutes = durationMinutes - primary.durationMinutes;

        // Check which hazards present in primary are NOT in this alternative
        const thisHazardTitles = new Set(hazards.map((h) => h.title));
        hazardsAvoidedAgainstPrimary = primary.hazards
          .filter((ph) => !thisHazardTitles.has(ph.title))
          .map((ph) => `Avoids: ${ph.title}`);
      }

      let suitabilityReason = isPrimary
        ? 'Shortest estimated travel path; evaluated against active regional alerts and terrain bottlenecks.'
        : hazardsAvoidedAgainstPrimary && hazardsAvoidedAgainstPrimary.length > 0
        ? `Alternative corridor bypassing ${hazardsAvoidedAgainstPrimary.length} critical terrain choke point(s) with +${additionalDistanceKm} km distance.`
        : 'Alternative routing corridor; evaluated under identical regional atmospheric conditions.';

      const uncertaintyNotes = [
        'Real-time municipal street-level flood depth sensors and automatic police barricade feeds are not currently integrated.',
        'Missing sensor telemetry cannot guarantee zero hazard; localized drainage failure may occur.',
      ];

      evaluatedRoutes.push({
        id: `route-${i}`,
        name: isPrimary ? `Primary Route (${distanceKm} km)` : `Alternative Route ${i} (${distanceKm} km)`,
        isPrimary,
        distanceMeters: rawRoute.distance || 0,
        distanceKm,
        durationSeconds: rawRoute.duration || 0,
        durationMinutes,
        geometry: rawRoute.geometry,
        hazards,
        riskScore,
        riskTier,
        summary: rawRoute.legs?.[0]?.summary || `Route via arterial corridors`,
        hazardsAvoidedAgainstPrimary,
        additionalDistanceKm,
        additionalDurationMinutes,
        suitabilityReason,
        uncertaintyNotes,
      });
    }

    // Determine recommended route: if an alternative has a lower risk score, suggest it
    let recommendedRouteId = evaluatedRoutes[0]?.id;
    let lowestRisk = evaluatedRoutes[0]?.riskScore || 100;

    for (const r of evaluatedRoutes) {
      if (r.riskScore < lowestRisk) {
        lowestRisk = r.riskScore;
        recommendedRouteId = r.id;
      }
    }

    const comparisonSummary =
      evaluatedRoutes.length > 1
        ? `Evaluated ${evaluatedRoutes.length} route options. Primary route has Risk Score ${evaluatedRoutes[0].riskScore}/100. ${
            recommendedRouteId !== evaluatedRoutes[0].id
              ? `Alternative route (${recommendedRouteId}) reduces exposure to known low-lying flood choke points.`
              : 'Primary route offers the lowest cumulative risk score among available paths.'
          }`
        : 'Single navigable route corridor available from routing provider.';

    return {
      origin,
      destination,
      travelMode,
      calculatedAt: evaluatedAtIso,
      routingProvider: 'Open Source Routing Machine (OSRM) with JATAYU Hazard Synthesis',
      routes: evaluatedRoutes,
      recommendedRouteId,
      comparisonSummary,
      dataFreshness: {
        weather: originWeather?.timestamp || 'Unavailable',
        alerts: alertsFeed?.fetchedAt || 'Unavailable',
        evaluatedAt: evaluatedAtIso,
      },
      knownLimitations: [
        'Real-time street-level flood depth sensors and dynamic police road-block feeds are not currently connected.',
        'Advisory screening only. Sub-meter road dips, sudden debris, or localized drain choking may occur.',
        'Experimental numerical flood simulations (SFINCS) are segregated and not used as certified road-closure signals.',
      ],
      disclaimer:
        'JATAYU SafeRoute provides advisory assessments based on available numerical weather predictions, official civil defense bulletins, and historical flood vulnerability data. It cannot guarantee road passability or personal safety. Always comply with on-ground civil defense instructions.',
    };
  }
}

export const routeService = new RouteService();
