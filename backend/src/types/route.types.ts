export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface LocationPoint {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface RouteHazard {
  id: string;
  type: 'METEOROLOGICAL_WARNING' | 'HEAVY_RAINFALL' | 'VULNERABILITY_CHOKEPOINT' | 'RIVER_BASIN_CROSSING';
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  title: string;
  description: string;
  coordinate: [number, number]; // [lon, lat]
  affectedSegmentIndex?: number;
  dataSource: string;
  sourceProvenance: 'OFFICIAL_ALERT' | 'NWP_OBSERVATION' | 'HISTORICAL_VULNERABILITY';
  lastUpdated: string;
}

export interface EvaluatedRoute {
  id: string;
  name: string;
  isPrimary: boolean;
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lon, lat]
  };
  hazards: RouteHazard[];
  riskScore: number; // 0 - 100
  riskTier: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
  summary: string;
  hazardsAvoidedAgainstPrimary?: string[];
  additionalDistanceKm?: number;
  additionalDurationMinutes?: number;
  suitabilityReason: string;
  uncertaintyNotes: string[];
}

export interface RoutePlanResponse {
  origin: LocationPoint;
  destination: LocationPoint;
  travelMode: TravelMode;
  calculatedAt: string;
  routingProvider: string;
  routes: EvaluatedRoute[];
  recommendedRouteId?: string;
  comparisonSummary: string;
  dataFreshness: {
    weather: string;
    alerts: string;
    evaluatedAt: string;
  };
  knownLimitations: string[];
  disclaimer: string;
}

export type FacilityCategory = 'SHELTER' | 'HOSPITAL' | 'EMERGENCY_OPS' | 'RELIEF_CAMP' | 'FIRE_STATION';
export type VerificationStatus = 'OFFICIALLY_VERIFIED' | 'GENERAL_DIRECTORY' | 'COMMUNITY_MAPPED' | 'COMMUNITY_VERIFIED';
export type CurrentAvailability = 'UNKNOWN' | 'OPEN' | 'AT_CAPACITY';
export type SourceProvenance = 'OFFICIAL_SOURCE' | 'COMMUNITY_MAPPED' | 'CURATED_SOURCE' | 'UNVERIFIED';

export interface EmergencyFacility {
  id: string;
  name: string;
  category: FacilityCategory;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  state?: string;
  district?: string;
  phone?: string;
  source: string;
  sourceProvenance?: SourceProvenance;
  sourceUpdateDate?: string;
  verificationStatus: VerificationStatus;
  currentAvailability: CurrentAvailability;
  operationalStatus?: string;
  distanceKm?: number;
}

export interface EmergencyFacilitiesResponse {
  facilities: EmergencyFacility[];
  count: number;
  sourceAttribution: string;
  disclaimer: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  type?: string;
}
