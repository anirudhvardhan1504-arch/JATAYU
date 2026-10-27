import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import {
  parseCurrentObservation,
  parseForecastResponse,
  evaluateSoilSaturation,
  WeatherService,
} from '../services/weather.service.js';

const mockValidPayload = {
  latitude: 19.076,
  longitude: 72.8777,
  elevation: 14,
  current: {
    time: '2026-10-09T15:00',
    temperature_2m: 29.5,
    apparent_temperature: 33.2,
    relative_humidity_2m: 78,
    precipitation: 4.5,
    rain: 4.5,
    showers: 0.0,
    weather_code: 61,
    surface_pressure: 1008.2,
    wind_speed_10m: 18.5,
    wind_direction_10m: 240,
    wind_gusts_10m: 32.0,
  },
  hourly: {
    time: ['2026-10-09T14:00', '2026-10-09T15:00', '2026-10-09T16:00'],
    temperature_2m: [30.0, 29.5, 28.5],
    relative_humidity_2m: [75, 78, 82],
    precipitation: [2.0, 4.5, 6.0],
    precipitation_probability: [60, 75, 85],
    rain: [2.0, 4.5, 6.0],
    showers: [0, 0, 0],
    weather_code: [61, 61, 63],
    surface_pressure: [1008.5, 1008.2, 1007.8],
    wind_speed_10m: [16.0, 18.5, 20.0],
    wind_direction_10m: [235, 240, 245],
    wind_gusts_10m: [28.0, 32.0, 35.0],
    soil_moisture_0_to_7cm: [0.32, 0.35, 0.38],
    soil_moisture_7_to_28cm: [0.28, 0.29, 0.30],
  },
};

describe('Weather API Integration & Route Validation', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify(mockValidPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });
  it('GET /api/weather/current should return typed observation with audited fields and units', async () => {
    const res = await request(app).get('/api/weather/current?lat=19.0760&lon=72.8777&name=Mumbai');
    expect(res.status).toBe(200);
    expect(res.body.location).toBeDefined();
    expect(res.body.location.latitude).toBe(19.076);
    expect(typeof res.body.temperatureC).toBe('number');
    expect(typeof res.body.apparentTemperatureC).toBe('number');
    expect(typeof res.body.relativeHumidityPercent).toBe('number');
    expect(typeof res.body.precipitationMm).toBe('number');
    expect(typeof res.body.windSpeedKmh).toBe('number');
    expect(typeof res.body.windGustsKmh).toBe('number');
    expect(typeof res.body.surfacePressureHpa).toBe('number');
    expect(typeof res.body.isStale).toBe('boolean');
    expect(res.body.units).toBeDefined();
    expect(res.body.units.temperature).toBe('°C');
    expect(res.body.units.surfacePressure).toBe('hPa');
    expect(res.body.sourceType).toBe('OBSERVED');
    expect(res.body.sourceAttribution).toContain('Open-Meteo');
  });

  it('GET /api/weather/forecast should return forecast with past/next accumulations and soil profile', async () => {
    const res = await request(app).get('/api/weather/forecast?lat=19.0760&lon=72.8777&name=Mumbai');
    expect(res.status).toBe(200);
    expect(res.body.hourly).toBeInstanceOf(Array);
    expect(res.body.hourly.length).toBeGreaterThan(0);
    expect(res.body.accumulations).toBeDefined();
    expect(typeof res.body.accumulations.past24hRainfallMm).toBe('number');
    expect(typeof res.body.accumulations.next24hRainfallMm).toBe('number');
    expect(typeof res.body.accumulations.next72hRainfallMm).toBe('number');
    expect(res.body.soilProfile).toBeDefined();
    expect(['LOW', 'MODERATE', 'HIGH', 'SATURATED']).toContain(res.body.soilProfile.saturationTier);
    expect(res.body.dataSource.type).toBe('OFFICIAL_FORECAST');
  });

  it('GET /api/weather/current should reject missing coordinates with HTTP 400', async () => {
    const res = await request(app).get('/api/weather/current');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATES');
    expect(res.body.error).toContain('Latitude and longitude');
  });

  it('GET /api/weather/current should reject out-of-range coordinates with HTTP 400', async () => {
    const res = await request(app).get('/api/weather/current?lat=95.5&lon=72.8');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATES');
    expect(res.body.error).toContain('out of valid range');
  });
});

describe('Open-Meteo Response Parser & Soil Saturation Unit Tests', () => {

  it('parseCurrentObservation correctly extracts all audited meteorological fields', () => {
    const fetchedAt = '2026-10-09T15:05:00.000Z';
    const obs = parseCurrentObservation(mockValidPayload, 19.076, 72.8777, 'Mumbai Station', fetchedAt);

    expect(obs.location.name).toBe('Mumbai Station');
    expect(obs.temperatureC).toBe(29.5);
    expect(obs.apparentTemperatureC).toBe(33.2);
    expect(obs.precipitationMm).toBe(4.5);
    expect(obs.windSpeedKmh).toBe(18.5);
    expect(obs.windGustsKmh).toBe(32.0);
    expect(obs.surfacePressureHpa).toBe(1008.2);
    expect(obs.soilMoisture0To7cm).toBe(0.35); // matched current hour 15:00
    expect(obs.weatherDescription).toBe('Slight rain');
    expect(obs.isStale).toBe(false);
    expect(obs.sourceType).toBe('OBSERVED');
  });

  it('parseCurrentObservation marks data as stale when timestamp is > 90 minutes old', () => {
    const stalePayload = {
      ...mockValidPayload,
      current: {
        ...mockValidPayload.current,
        time: '2026-10-09T12:00:00.000Z', // 3.5 hours old
      },
    };
    const fetchedAt = '2026-10-09T15:30:00.000Z';
    const obs = parseCurrentObservation(stalePayload, 19.076, 72.8777, 'Mumbai Station', fetchedAt);

    expect(obs.isStale).toBe(true);
  });

  it('parseCurrentObservation gracefully handles missing optional fields without NaN or crashing', () => {
    const minimalPayload = {
      current: {
        time: '2026-10-09T15:00',
        temperature_2m: 22.0,
        // apparent_temperature, precipitation, wind_gusts, surface_pressure omitted
      },
    };
    const obs = parseCurrentObservation(minimalPayload, 19.076, 72.8777, 'Sparse Station', new Date().toISOString());

    expect(obs.temperatureC).toBe(22.0);
    expect(obs.apparentTemperatureC).toBe(22.0); // falls back to temperature_2m
    expect(obs.precipitationMm).toBe(0);
    expect(obs.windGustsKmh).toBe(0);
    expect(obs.surfacePressureHpa).toBe(1013.25);
    expect(obs.soilMoisture0To7cm).toBeUndefined();
  });

  it('parseCurrentObservation throws descriptive error for empty or invalid payload', () => {
    expect(() => parseCurrentObservation(null, 19.076, 72.8777, 'Test', '')).toThrow(
      'Invalid Open-Meteo response structure'
    );
    expect(() => parseCurrentObservation({}, 19.076, 72.8777, 'Test', '')).toThrow(
      'missing "current" observation payload'
    );
  });

  it('evaluateSoilSaturation returns correct saturation tiers', () => {
    expect(evaluateSoilSaturation(0.42).saturationTier).toBe('SATURATED');
    expect(evaluateSoilSaturation(0.32).saturationTier).toBe('HIGH');
    expect(evaluateSoilSaturation(0.22).saturationTier).toBe('MODERATE');
    expect(evaluateSoilSaturation(0.10).saturationTier).toBe('LOW');
    expect(evaluateSoilSaturation(undefined).saturationTier).toBe('LOW');
  });

  it('WeatherService throws on upstream network failure and NEVER returns fabricated data', async () => {
    // Instantiate with unreachable port to simulate network failure
    const badService = new WeatherService('http://127.0.0.1:59999');

    await expect(badService.getCurrentWeather(19.076, 72.8777)).rejects.toThrow(
      /Network failure connecting to Open-Meteo upstream/
    );
  });

  describe('GET /api/weather/historical (Open-Meteo Climate Archive)', () => {
    it('rejects missing or invalid coordinates with HTTP 400', async () => {
      const res = await request(app).get('/api/weather/historical?lat=120&lon=80');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_REQUEST');
    });

    it('rejects invalid date format with HTTP 400', async () => {
      const res = await request(app).get('/api/weather/historical?lat=13.08&lon=80.27&startDate=invalid');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_DATE_FORMAT');
    });

    it('returns typed historical series with event accumulation and daily breakdown', async () => {
      const mockArchiveData = {
        latitude: 13.08,
        longitude: 80.27,
        daily: {
          time: ['2015-11-30', '2015-12-01', '2015-12-02'],
          precipitation_sum: [85.5, 490.2, 110.0],
          temperature_2m_max: [28.5, 27.0, 28.0],
          temperature_2m_min: [24.0, 23.5, 24.2],
        },
      };

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async () => {
        return new Response(JSON.stringify(mockArchiveData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });

      const res = await request(app).get(
        '/api/weather/historical?lat=13.0827&lon=80.2707&startDate=2015-11-30&endDate=2015-12-02&name=Chennai%20Basin'
      );

      expect(res.status).toBe(200);
      expect(res.body.location.latitude).toBeCloseTo(13.08, 2);
      expect(res.body.startDate).toBe('2015-11-30');
      expect(res.body.endDate).toBe('2015-12-02');
      expect(res.body.daily.time.length).toBe(3);
      expect(res.body.eventAccumulationMm).toBeCloseTo(685.7, 1);
      expect(res.body.peakDailyRainMm).toBeCloseTo(490.2, 1);
      expect(res.body.dataSource).toContain('Open-Meteo Historical Weather');

      spy.mockRestore();
    });
  });
});
