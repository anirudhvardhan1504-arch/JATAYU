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
  fetchedAt: string; // ISO 8601 server fetch time
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
  soilMoisture0To7cm?: number; // volumetric m3/m3
  soilMoisture7To28cm?: number; // volumetric m3/m3
  isStale: boolean;
  sourceType: DataSourceType;
  sourceAttribution: string;
  units: WeatherUnits;
}

export interface HourlyForecastDataPoint {
  time: string; // ISO 8601
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

export interface WeatherServiceError {
  error: string;
  code: 'UPSTREAM_ERROR' | 'INVALID_COORDINATES' | 'NETWORK_FAILURE';
  attemptedAt: string;
  location?: GeoLocation;
  statusCode?: number;
}
