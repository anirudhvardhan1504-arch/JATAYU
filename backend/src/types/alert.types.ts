import { DataSourceType, GeoLocation } from './weather.types.js';

export type AlertSeverity = 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY';
export type AlertCategory = 'RAINFALL' | 'FLOOD' | 'CYCLONE' | 'WIND' | 'HEATWAVE';

export type GeographicMatchMethod =
  | 'EXACT_DISTRICT'
  | 'BORDER_ZONE_SECONDARY'
  | 'REGIONAL_STATE'
  | 'NOT_LOCATION_MATCHED'
  | 'OFFSHORE_OR_UNRESOLVED'
  | 'ALL_ACTIVE_FEED';

export interface GeographicResolution {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  resolvedDistrict: string | null;
  resolvedState: string | null;
  censusCode?: string;
  matchStatus: 'RESOLVED_DISTRICT' | 'OFFSHORE_OR_UNRESOLVED' | 'BOUNDARY_DATA_UNAVAILABLE';
  datasetSource: string;
  vintage: string;
  coverageNotice?: string;
  isAmbiguous?: boolean;
  secondaryDistricts?: string[];
}

export interface DisasterAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  headline: string;
  description: string;
  issuedAt: string; // ISO 8601 string
  effectiveUntil: string; // ISO 8601 string
  affectedArea: {
    name: string;
    location?: GeoLocation;
    radiusKm?: number;
    matchMethod?: GeographicMatchMethod;
  };
  recommendedActions: string[];
  sourceType: DataSourceType;
  sourceAgency: string; // e.g. "India Meteorological Department (IMD)"
  officialBulletinUrl?: string; // e.g. "https://mausam.imd.gov.in"
  isOfficialWarning: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'STANDBY';
  rawIdentifier?: string;
  districtMatched?: boolean;
}

export interface AlertFeedResponse {
  fetchedAt: string;
  source: string;
  feedStatus: 'LIVE_VERIFIED' | 'CACHED' | 'EMPTY' | 'UPSTREAM_FALLBACK';
  itemCount: number;
  geographicResolution: GeographicResolution;
  officialAlerts: DisasterAlert[]; // Matched to resolved district
  nationwideAlerts: DisasterAlert[]; // Active IMD nowcasts across other districts in India
  indicativeAlerts: DisasterAlert[]; // JATAYU heuristic model advisories
  demonstrationScenarios: DisasterAlert[]; // Synthetic drills
  disclaimer: string;
  limitations: string[];
}
