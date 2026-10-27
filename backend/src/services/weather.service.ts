import { config } from '../config.js';
import {
  CurrentWeatherObservation,
  WeatherForecastResponse,
  HourlyForecastDataPoint,
  SoilSaturationProfile,
  WeatherUnits,
} from '../types/weather.types.js';

export interface IWeatherService {
  getCurrentWeather(lat: number, lon: number, locationName?: string): Promise<CurrentWeatherObservation>;
  getForecast(lat: number, lon: number, locationName?: string): Promise<WeatherForecastResponse>;
}

// Standard WMO Weather Interpretation Codes
export const WMO_CODE_MAP: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

export const STANDARD_WEATHER_UNITS: WeatherUnits = {
  temperature: '°C',
  relativeHumidity: '%',
  precipitation: 'mm/h',
  rain: 'mm/h',
  showers: 'mm/h',
  windSpeed: 'km/h',
  windDirection: '°',
  windGusts: 'km/h',
  surfacePressure: 'hPa',
  soilMoisture: 'm³/m³',
};

export interface HistoricalWeatherResponse {
  location: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  startDate: string;
  endDate: string;
  daily: {
    time: string[];
    precipitationSum: number[];
    temperatureMax: number[];
    temperatureMin: number[];
  };
  eventAccumulationMm: number;
  peakDailyRainMm: number;
  dataSource: string;
}

export function evaluateSoilSaturation(m0To7?: number, m7To28?: number): SoilSaturationProfile {
  const primary = m0To7 ?? m7To28;
  if (primary === undefined || primary === null || isNaN(primary)) {
    return {
      saturationTier: 'LOW',
      description: 'Soil moisture telemetry unavailable for this coordinate.',
    };
  }

  // Volumetric water content benchmarks:
  // < 0.15: Dry / Low moisture
  // 0.15 - 0.28: Moderate field moisture
  // 0.28 - 0.38: High saturation (reduced infiltration rate)
  // >= 0.38: Near/at saturation (elevated surface runoff potential)
  if (primary >= 0.38) {
    return {
      moisture0To7cm: m0To7,
      moisture7To28cm: m7To28,
      saturationTier: 'SATURATED',
      description: 'Soil is saturated (>=0.38 m³/m³). High risk of immediate surface runoff.',
    };
  }
  if (primary >= 0.28) {
    return {
      moisture0To7cm: m0To7,
      moisture7To28cm: m7To28,
      saturationTier: 'HIGH',
      description: 'High soil moisture. Infiltration capacity is significantly reduced.',
    };
  }
  if (primary >= 0.15) {
    return {
      moisture0To7cm: m0To7,
      moisture7To28cm: m7To28,
      saturationTier: 'MODERATE',
      description: 'Moderate soil moisture. Normal infiltration absorption expected.',
    };
  }
  return {
    moisture0To7cm: m0To7,
    moisture7To28cm: m7To28,
    saturationTier: 'LOW',
    description: 'Dry upper soil profile. Maximum infiltration capacity available.',
  };
}

export function parseCurrentObservation(
  data: any,
  lat: number,
  lon: number,
  locationName: string,
  fetchedAt: string
): CurrentWeatherObservation {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid Open-Meteo response structure: empty or non-object root.');
  }

  const current = data.current;
  if (!current || typeof current !== 'object') {
    throw new Error('Open-Meteo response missing "current" observation payload.');
  }

  const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 0;
  const obsTimeStr = current.time || fetchedAt;
  const normalizedObsTime =
    obsTimeStr.endsWith('Z') || obsTimeStr.includes('+') ? obsTimeStr : `${obsTimeStr}Z`;

  // Stale detection: if observation time is > 90 minutes behind server fetch time
  let isStale = false;
  try {
    const obsEpoch = new Date(normalizedObsTime).getTime();
    const fetchEpoch = new Date(fetchedAt).getTime();
    if (!isNaN(obsEpoch) && !isNaN(fetchEpoch)) {
      isStale = fetchEpoch - obsEpoch > 90 * 60 * 1000;
    }
  } catch {
    isStale = false;
  }

  // Find nearest hourly soil moisture if available in response
  let soil0To7: number | undefined = undefined;
  let soil7To28: number | undefined = undefined;
  if (data.hourly && Array.isArray(data.hourly.time)) {
    const hourIndex = data.hourly.time.findIndex((t: string) => t === current.time);
    const targetIndex = hourIndex >= 0 ? hourIndex : 0;
    if (Array.isArray(data.hourly.soil_moisture_0_to_7cm)) {
      soil0To7 = data.hourly.soil_moisture_0_to_7cm[targetIndex] ?? undefined;
    }
    if (Array.isArray(data.hourly.soil_moisture_7_to_28cm)) {
      soil7To28 = data.hourly.soil_moisture_7_to_28cm[targetIndex] ?? undefined;
    }
  }

  return {
    location: {
      latitude: lat,
      longitude: lon,
      name: locationName,
    },
    timestamp: obsTimeStr,
    fetchedAt,
    temperatureC: current.temperature_2m ?? 0,
    apparentTemperatureC: current.apparent_temperature ?? current.temperature_2m ?? 0,
    relativeHumidityPercent: current.relative_humidity_2m ?? 0,
    precipitationMm: current.precipitation ?? 0,
    rainMm: current.rain ?? 0,
    showersMm: current.showers ?? 0,
    windSpeedKmh: current.wind_speed_10m ?? 0,
    windDirectionDegrees: current.wind_direction_10m ?? 0,
    windGustsKmh: current.wind_gusts_10m ?? current.wind_speed_10m ?? 0,
    surfacePressureHpa: current.surface_pressure ?? 1013.25,
    weatherCode,
    weatherDescription: WMO_CODE_MAP[weatherCode] || 'Unknown meteorological condition',
    soilMoisture0To7cm: soil0To7,
    soilMoisture7To28cm: soil7To28,
    isStale,
    sourceType: 'OBSERVED',
    sourceAttribution: 'Open-Meteo Live NWP Analysis (ECMWF IFS / DWD ICON)',
    units: STANDARD_WEATHER_UNITS,
  };
}

export function parseForecastResponse(
  data: any,
  lat: number,
  lon: number,
  locationName: string,
  fetchedAt: string,
  startTime: number
): WeatherForecastResponse {
  const currentObs = parseCurrentObservation(data, lat, lon, locationName, fetchedAt);

  const hourly = data.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error('Open-Meteo response missing "hourly" forecast timeseries array.');
  }

  const times: string[] = hourly.time;
  const hourlyPoints: HourlyForecastDataPoint[] = [];

  // Identify current hour index in the timeseries (account for past_days=1)
  const currentHourStr = data.current?.time;
  let currentIdx = times.findIndex((t) => t === currentHourStr);
  if (currentIdx === -1) {
    // If exact match not found, estimate index based on time difference or fallback to 24 (1 past day)
    currentIdx = Math.min(24, Math.floor(times.length / 4));
  }

  // Calculate past 24h accumulation
  let past24hRain = 0;
  const pastStart = Math.max(0, currentIdx - 24);
  for (let i = pastStart; i < currentIdx; i++) {
    const p = hourly.precipitation?.[i] ?? 0;
    if (typeof p === 'number' && !isNaN(p)) {
      past24hRain += p;
    }
  }

  // Calculate next 24h and next 72h forecast accumulations starting from currentIdx
  let next24hRain = 0;
  let next72hRain = 0;
  const forecastEnd = Math.min(times.length, currentIdx + 72);

  for (let i = currentIdx; i < forecastEnd; i++) {
    const p = hourly.precipitation?.[i] ?? 0;
    const val = typeof p === 'number' && !isNaN(p) ? p : 0;
    if (i < currentIdx + 24) {
      next24hRain += val;
    }
    next72hRain += val;

    hourlyPoints.push({
      time: times[i],
      temperatureC: hourly.temperature_2m?.[i] ?? 0,
      relativeHumidityPercent: hourly.relative_humidity_2m?.[i] ?? 0,
      precipitationMm: val,
      precipitationProbabilityPercent: hourly.precipitation_probability?.[i] ?? 0,
      rainMm: hourly.rain?.[i] ?? 0,
      showersMm: hourly.showers?.[i] ?? 0,
      windSpeedKmh: hourly.wind_speed_10m?.[i] ?? 0,
      windDirectionDegrees: hourly.wind_direction_10m?.[i] ?? 0,
      windGustsKmh: hourly.wind_gusts_10m?.[i] ?? hourly.wind_speed_10m?.[i] ?? 0,
      surfacePressureHpa: hourly.surface_pressure?.[i] ?? 1013.25,
      soilMoistureDepth0To7cm: hourly.soil_moisture_0_to_7cm?.[i] ?? undefined,
      soilMoistureDepth7To28cm: hourly.soil_moisture_7_to_28cm?.[i] ?? undefined,
    });
  }

  const latestSoil0To7 = hourly.soil_moisture_0_to_7cm?.[currentIdx];
  const latestSoil7To28 = hourly.soil_moisture_7_to_28cm?.[currentIdx];
  const latestSoil28To100 = hourly.soil_moisture_28_to_100cm?.[currentIdx];

  const soilProfile = evaluateSoilSaturation(latestSoil0To7, latestSoil7To28);
  soilProfile.moisture28To100cm = latestSoil28To100;

  return {
    location: {
      latitude: lat,
      longitude: lon,
      name: locationName,
    },
    elevation: typeof data.elevation === 'number' && !isNaN(data.elevation) ? data.elevation : null,
    generationTimeMs: Date.now() - startTime,
    fetchedAt,
    current: currentObs,
    hourly: hourlyPoints,
    accumulations: {
      past24hRainfallMm: Math.round(past24hRain * 10) / 10,
      next24hRainfallMm: Math.round(next24hRain * 10) / 10,
      next72hRainfallMm: Math.round(next72hRain * 10) / 10,
    },
    soilProfile,
    dataSource: {
      provider: 'Open-Meteo Forecast Engine',
      model: 'ECMWF IFS / GFS Seamless Ensemble',
      type: 'OFFICIAL_FORECAST',
      note: 'Hourly numerical weather prediction with volumetric soil moisture and accumulation integration.',
    },
  };
}

export class WeatherService implements IWeatherService {
  private baseUrl: string;
  private currentObservationCache = new Map<string, { observation: CurrentWeatherObservation; fetchedAt: number }>();
  private forecastCache = new Map<string, { forecast: WeatherForecastResponse; fetchedAt: number }>();
  private cacheTtlMs: number = 10 * 60 * 1000; // 10 minutes cache TTL

  constructor(customBaseUrl?: string, cacheTtlMs?: number) {
    this.baseUrl = customBaseUrl || config.weather.baseUrl;
    if (cacheTtlMs) this.cacheTtlMs = cacheTtlMs;
  }

  private getCacheKey(lat: number, lon: number): string {
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
  }

  private validateCoordinates(lat: number, lon: number): void {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      throw new Error(`Coordinates must be valid numbers. Received lat=${lat}, lon=${lon}`);
    }
    if (lat < -90 || lat > 90) {
      throw new Error(`Latitude out of valid range [-90, 90]: ${lat}`);
    }
    if (lon < -180 || lon > 180) {
      throw new Error(`Longitude out of valid range [-180, 180]: ${lon}`);
    }
  }

  public async getCurrentWeather(
    lat: number,
    lon: number,
    locationName: string = 'Operational Target'
  ): Promise<CurrentWeatherObservation> {
    this.validateCoordinates(lat, lon);
    const key = this.getCacheKey(lat, lon);
    const now = Date.now();

    const cached = this.currentObservationCache.get(key);
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.observation;
    }

    const fetchedAt = new Date().toISOString();
    const url = new URL(`${this.baseUrl}/forecast`);
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    url.searchParams.set('hourly', 'soil_moisture_0_to_7cm,soil_moisture_7_to_28cm');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'UTC');

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Jatayu-Disaster-Intelligence/0.1.0',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });
    } catch (netErr: any) {
      if (cached) {
        console.warn(`[JATAYU Weather] Upstream unreachable (${netErr.message}), returning stale cached observation for ${key}`);
        return {
          ...cached.observation,
          isStale: true,
          sourceAttribution: `${cached.observation.sourceAttribution} (STALE CACHED - Upstream Unreachable)`,
        };
      }
      throw new Error(`Network failure connecting to Open-Meteo upstream: ${netErr.message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (cached) {
        console.warn(`[JATAYU Weather] Upstream error HTTP ${response.status}, returning stale cached observation for ${key}`);
        return {
          ...cached.observation,
          isStale: true,
          sourceAttribution: `${cached.observation.sourceAttribution} (STALE CACHED - HTTP ${response.status})`,
        };
      }
      throw new Error(
        `Open-Meteo upstream error HTTP ${response.status}: ${errText || response.statusText}`
      );
    }

    const data = await response.json();
    const observation = parseCurrentObservation(data, lat, lon, locationName, fetchedAt);
    this.currentObservationCache.set(key, { observation, fetchedAt: now });
    return observation;
  }

  public async getForecast(
    lat: number,
    lon: number,
    locationName: string = 'Operational Target'
  ): Promise<WeatherForecastResponse> {
    this.validateCoordinates(lat, lon);
    const key = this.getCacheKey(lat, lon);
    const now = Date.now();

    const cached = this.forecastCache.get(key);
    if (cached && now - cached.fetchedAt < this.cacheTtlMs) {
      return cached.forecast;
    }

    const startTime = Date.now();
    const fetchedAt = new Date().toISOString();
    const url = new URL(`${this.baseUrl}/forecast`);
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    );
    url.searchParams.set(
      'hourly',
      'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,rain,showers,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm'
    );
    url.searchParams.set('past_days', '1');
    url.searchParams.set('forecast_days', '3');
    url.searchParams.set('timezone', 'UTC');

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Jatayu-Disaster-Intelligence/0.1.0',
        },
        signal: AbortSignal.timeout(12000), // 12s timeout
      });
    } catch (netErr: any) {
      if (cached) {
        console.warn(`[JATAYU Weather] Upstream unreachable (${netErr.message}), returning stale cached forecast for ${key}`);
        return {
          ...cached.forecast,
          current: {
            ...cached.forecast.current,
            isStale: true,
          },
        };
      }
      throw new Error(`Network failure connecting to Open-Meteo upstream: ${netErr.message}`);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      if (cached) {
        console.warn(`[JATAYU Weather] Upstream error HTTP ${response.status}, returning stale cached forecast for ${key}`);
        return {
          ...cached.forecast,
          current: {
            ...cached.forecast.current,
            isStale: true,
          },
        };
      }
      throw new Error(
        `Open-Meteo upstream error HTTP ${response.status}: ${errText || response.statusText}`
      );
    }

    const data = await response.json();
    const forecast = parseForecastResponse(data, lat, lon, locationName, fetchedAt, startTime);
    this.forecastCache.set(key, { forecast, fetchedAt: now });
    return forecast;
  }

  /**
   * Fetch historical meteorological series for disaster event reconstruction.
   */
  async getHistoricalWeather(
    lat: number,
    lon: number,
    startDate: string,
    endDate: string,
    name = 'Selected Coordinates'
  ): Promise<HistoricalWeatherResponse> {
    this.validateCoordinates(lat, lon);

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=Asia/Kolkata`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          'User-Agent': 'JATAYU-Research-Observatory/1.0',
        },
        signal: AbortSignal.timeout(20000),
      });
    } catch (netErr: any) {
      throw new Error(`Open-Meteo Historical Archive network failure: ${netErr.message}`);
    }

    if (!res.ok) {
      throw new Error(`Open-Meteo Historical Archive API returned HTTP ${res.status}`);
    }

    const data = (await res.json()) as any;
    const times = data.daily?.time || [];
    const precips = (data.daily?.precipitation_sum || []).map((p: any) =>
      typeof p === 'number' ? p : 0
    );
    const tempMax = (data.daily?.temperature_2m_max || []).map((t: any) =>
      typeof t === 'number' ? t : 0
    );
    const tempMin = (data.daily?.temperature_2m_min || []).map((t: any) =>
      typeof t === 'number' ? t : 0
    );

    const eventAccumulationMm = parseFloat(
      precips.reduce((acc: number, val: number) => acc + val, 0).toFixed(1)
    );
    const peakDailyRainMm = precips.length > 0 ? Math.max(...precips) : 0;

    return {
      location: { latitude: lat, longitude: lon, name },
      startDate,
      endDate,
      daily: {
        time: times,
        precipitationSum: precips,
        temperatureMax: tempMax,
        temperatureMin: tempMin,
      },
      eventAccumulationMm,
      peakDailyRainMm,
      dataSource: 'Open-Meteo Historical Weather Reanalysis (ERA5 / ECMWF)',
    };
  }
}
