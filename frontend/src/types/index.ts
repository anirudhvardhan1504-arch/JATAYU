export type DataSourceType = 'OBSERVED' | 'OFFICIAL_FORECAST' | 'INDICATIVE_MODEL' | 'DEMO_DATA';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  name?: string;
  region?: string;
  country?: string;
}

export interface WeatherUnits {
  temperature: string;
  relativeHumidity: string;
  precipitation: string;
  rain: string;
  showers: string;
  windSpeed: string;
  windDirection: string;
  windGusts: string;
  surfacePressure: string;
  soilMoisture: string;
}

export interface CurrentWeatherObservation {
  location: GeoLocation;
  timestamp: string; // ISO 8601 observation time from provider
  fetchedAt: string; // ISO 8601 client/server fetch time
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidityPercent: number;
  precipitationMm: number;
  rainMm: number;
  showersMm: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  windGustsKmh: number;
  surfacePressureHpa: number;
  weatherCode: number;
  weatherDescription: string;
  soilMoisture0To7cm?: number;
  soilMoisture7To28cm?: number;
  isStale: boolean;
  sourceType: DataSourceType;
  sourceAttribution: string;
  units: WeatherUnits;
}

export interface HourlyForecastDataPoint {
  time: string;
  temperatureC: number;
  relativeHumidityPercent: number;
  precipitationMm: number;
  precipitationProbabilityPercent: number;
  rainMm: number;
  showersMm: number;
  windSpeedKmh: number;
  windDirectionDegrees: number;
  windGustsKmh: number;
  surfacePressureHpa: number;
  soilMoistureDepth0To7cm?: number;
  soilMoistureDepth7To28cm?: number;
}

export interface SoilSaturationProfile {
  moisture0To7cm?: number;
  moisture7To28cm?: number;
  moisture28To100cm?: number;
  saturationTier: 'LOW' | 'MODERATE' | 'HIGH' | 'SATURATED';
  description: string;
}

export interface WeatherForecastResponse {
  location: GeoLocation;
  elevation?: number | null;
  generationTimeMs: number;
  fetchedAt: string;
  current: CurrentWeatherObservation;
  hourly: HourlyForecastDataPoint[];
  accumulations: {
    past24hRainfallMm: number;
    next24hRainfallMm: number;
    next72hRainfallMm: number;
  };
  soilProfile: SoilSaturationProfile;
  dataSource: {
    provider: string;
    model: string;
    type: DataSourceType;
    note: string;
  };
}

export type RiskLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
export type DataCompleteness = 'FULL' | 'PARTIAL' | 'MINIMAL';
export type FactorStatus = 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE';

export interface FactorContribution {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  observedValue: string | number | null;
  unit: string;
  benchmark: string;
  basis: 'AUTHORITATIVE_METEOROLOGY' | 'ENGINEERING_ASSUMPTION';
  status: FactorStatus;
  notes: string;
}

export interface RiskExplanation {
  summary: string;
  primaryDrivers: string[];
  meteorologicalContext: string;
  missingInputs: string[];
  modelAssumptions: string[];
  limitations: string[];
}

export interface IndicativeFloodRiskAssessment {
  location: GeoLocation;
  assessedAt: string;
  dataTimestamp: string;
  isStale: boolean;
  overallRiskLevel: RiskLevel;
  riskScore: number;
  dataCompleteness: DataCompleteness;
  dataConfidence: 'HIGH' | 'MODERATE' | 'LOW';
  factors: {
    rainfallIntensity: FactorContribution;
    rainfallAccumulation: FactorContribution;
    soilSaturation: FactorContribution;
    topographicVulnerability: FactorContribution;
  };
  metrics: {
    peakIntensity1hMm: number;
    past24hRainfallMm: number | null;
    next24hRainfallMm: number;
    next72hRainfallMm: number;
    soilMoistureVolumetricPercent: number | null;
    elevationMeters: number | null;
  };
  explanation: RiskExplanation;
  disclaimer: {
    isHydraulicallyValidated: false;
    modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC';
    statement: string;
    validationStatus: 'UNVALIDATED_PROTOTYPE';
  };
  sourceType: DataSourceType;
  sourceAttribution: string;
}

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
  issuedAt: string;
  effectiveUntil: string;
  affectedArea: {
    name: string;
    location?: GeoLocation;
    radiusKm?: number;
    matchMethod?: GeographicMatchMethod;
  };
  recommendedActions: string[];
  sourceType: DataSourceType;
  sourceAgency: string;
  officialBulletinUrl?: string;
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
  officialAlerts: DisasterAlert[];
  nationwideAlerts: DisasterAlert[];
  indicativeAlerts: DisasterAlert[];
  demonstrationScenarios: DisasterAlert[];
  disclaimer: string;
  limitations: string[];
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIChatResponse {
  message: AIChatMessage;
  model: string;
  configured: boolean;
  timestamp: string;
  error?: string;
}

export interface AIStatusResponse {
  configured: boolean;
  provider: 'OpenRouter';
  model: string;
  message: string;
}

export type ThreatPhase = 'EARLY_WATCH' | 'CRITICAL_ALERT' | 'EVACUATION' | 'INSUFFICIENT_DATA';

export interface ThreatEvaluationResult {
  phase: ThreatPhase;
  phaseLabel: string;
  primaryTrigger: string;
  triggerSeverity: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'LOW' | 'UNKNOWN';
  sourceHealth: {
    weather: 'FRESH' | 'STALE' | 'UNAVAILABLE';
    riskAssessment: 'AVAILABLE' | 'UNAVAILABLE';
    alertFeed: 'VERIFIED' | 'UNAVAILABLE';
  };
  hasSufficientData: boolean;
  missingDataReasons: string[];
  isWeatherStale: boolean;
}

export type NavigationTab =
  | 'home'
  | 'overview'
  | 'weather'
  | 'map'
  | 'saferoute'
  | 'facilities'
  | 'research'
  | 'risk'
  | 'alerts'
  | 'ai'
  | 'preparedness'
  | 'command3d';

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
  riskScore: number;
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

