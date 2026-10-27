import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import {
  scoreRainfallIntensity,
  scoreRainfallAccumulation,
  scoreSoilSaturation,
  determineRiskTier,
  RiskService,
} from '../services/risk.service.js';
import { WeatherForecastResponse } from '../types/weather.types.js';

describe('Flood-Risk Scoring Functions & Category Boundaries', () => {
  it('scoreRainfallIntensity matches IMD and FFG benchmark tiers and handles malformed inputs safely', () => {
    // Malformed / Non-finite / Negative
    expect(scoreRainfallIntensity(NaN)).toBe(0);
    expect(scoreRainfallIntensity(Infinity)).toBe(0);
    expect(scoreRainfallIntensity(-5.0)).toBe(0);
    expect(scoreRainfallIntensity(0)).toBe(0);

    // Exact tier boundaries and progression
    expect(scoreRainfallIntensity(2.5)).toBe(15);
    expect(scoreRainfallIntensity(7.5)).toBe(35);
    expect(scoreRainfallIntensity(15.0)).toBe(55);
    expect(scoreRainfallIntensity(35.0)).toBe(80);
    expect(scoreRainfallIntensity(50.0)).toBe(95);

    // Progression values
    expect(scoreRainfallIntensity(1.5)).toBeGreaterThan(0);
    expect(scoreRainfallIntensity(1.5)).toBeLessThanOrEqual(15);
    expect(scoreRainfallIntensity(5.0)).toBe(25); // Light rain tier
    expect(scoreRainfallIntensity(10.0)).toBe(42); // Moderate rain tier
    expect(scoreRainfallIntensity(25.0)).toBe(68); // Heavy Rain
    expect(scoreRainfallIntensity(45.0)).toBe(90); // Very Heavy Rain
    expect(scoreRainfallIntensity(80.0)).toBe(98); // Extreme convective deluge
    expect(scoreRainfallIntensity(200.0)).toBe(100); // Capped at 100
  });

  it('scoreRainfallAccumulation matches 48h cumulative thresholds and handles invalid inputs', () => {
    expect(scoreRainfallAccumulation(NaN)).toBe(0);
    expect(scoreRainfallAccumulation(-10)).toBe(0);
    expect(scoreRainfallAccumulation(0)).toBe(0);

    // Boundaries
    expect(scoreRainfallAccumulation(15.0)).toBe(15);
    expect(scoreRainfallAccumulation(64.5)).toBe(45);
    expect(scoreRainfallAccumulation(115.5)).toBe(70);
    expect(scoreRainfallAccumulation(204.5)).toBe(90);

    expect(scoreRainfallAccumulation(10)).toBe(10);
    expect(scoreRainfallAccumulation(50)).toBe(36); // Moderate daily
    expect(scoreRainfallAccumulation(100)).toBe(62); // Heavy warning
    expect(scoreRainfallAccumulation(180)).toBe(84); // Very Heavy (70 + (64.5/89)*20 = 84.49 -> 84)
    expect(scoreRainfallAccumulation(250)).toBe(95); // Deluge
    expect(scoreRainfallAccumulation(400)).toBe(100); // Capped at 100
  });

  it('scoreSoilSaturation scores volumetric soil moisture without zero substitution', () => {
    expect(scoreSoilSaturation(NaN)).toBe(0);
    expect(scoreSoilSaturation(-0.05)).toBe(0);
    expect(scoreSoilSaturation(0)).toBe(0);

    // Boundary checks
    expect(scoreSoilSaturation(0.15)).toBe(20);
    expect(scoreSoilSaturation(0.28)).toBe(50);
    expect(scoreSoilSaturation(0.38)).toBe(80);

    expect(scoreSoilSaturation(0.08)).toBeLessThanOrEqual(20); // Dry
    expect(scoreSoilSaturation(0.20)).toBe(32); // Moderate field moisture
    expect(scoreSoilSaturation(0.35)).toBe(71); // High moisture
    expect(scoreSoilSaturation(0.42)).toBe(87); // Saturated ground
    expect(scoreSoilSaturation(0.60)).toBe(100); // Capped at 100
  });

  it('determineRiskTier correctly partitions boundary thresholds', () => {
    // LOW: [0, 24]
    expect(determineRiskTier(0)).toBe('LOW');
    expect(determineRiskTier(24)).toBe('LOW');

    // GUARDED: [25, 44]
    expect(determineRiskTier(25)).toBe('GUARDED');
    expect(determineRiskTier(44)).toBe('GUARDED');

    // ELEVATED: [45, 64]
    expect(determineRiskTier(45)).toBe('ELEVATED');
    expect(determineRiskTier(64)).toBe('ELEVATED');

    // HIGH: [65, 84]
    expect(determineRiskTier(65)).toBe('HIGH');
    expect(determineRiskTier(84)).toBe('HIGH');

    // CRITICAL: [85, 100]
    expect(determineRiskTier(85)).toBe('CRITICAL');
    expect(determineRiskTier(100)).toBe('CRITICAL');
  });
});

describe('RiskService Unit Tests (Edge Cases, Missing Inputs, Stale Data)', () => {
  const baseMockForecast: WeatherForecastResponse = {
    location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Test Sector' },
    elevation: 14,
    generationTimeMs: 10,
    fetchedAt: '2026-10-09T15:00:00.000Z',
    current: {
      location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Test Sector' },
      timestamp: '2026-10-09T15:00',
      fetchedAt: '2026-10-09T15:00:00.000Z',
      temperatureC: 29.0,
      apparentTemperatureC: 33.0,
      relativeHumidityPercent: 80,
      precipitationMm: 0,
      rainMm: 0,
      showersMm: 0,
      windSpeedKmh: 15,
      windDirectionDegrees: 200,
      windGustsKmh: 22,
      surfacePressureHpa: 1010,
      weatherCode: 0,
      weatherDescription: 'Clear sky',
      soilMoisture0To7cm: 0.12,
      isStale: false,
      sourceType: 'OBSERVED',
      sourceAttribution: 'Open-Meteo',
      units: {
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
      },
    },
    hourly: [
      {
        time: '2026-10-09T15:00',
        temperatureC: 29,
        relativeHumidityPercent: 80,
        precipitationMm: 0,
        precipitationProbabilityPercent: 10,
        rainMm: 0,
        showersMm: 0,
        windSpeedKmh: 15,
        windDirectionDegrees: 200,
        windGustsKmh: 22,
        surfacePressureHpa: 1010,
      },
    ],
    accumulations: {
      past24hRainfallMm: 0,
      next24hRainfallMm: 0,
      next72hRainfallMm: 0,
    },
    soilProfile: {
      moisture0To7cm: 0.12,
      saturationTier: 'LOW',
      description: 'Dry upper soil profile.',
    },
    dataSource: {
      provider: 'Open-Meteo',
      model: 'ECMWF IFS',
      type: 'OFFICIAL_FORECAST',
      note: 'Mock forecast',
    },
  };

  it('evaluates completely dry conditions as LOW risk tier', () => {
    const riskService = new RiskService();
    const result = riskService.calculateAssessment(baseMockForecast);

    expect(result.overallRiskLevel).toBe('LOW');
    expect(result.riskScore).toBeLessThan(25);
    expect(result.dataCompleteness).toBe('FULL');
    expect(result.dataConfidence).toBe('HIGH');
  });

  it('evaluates torrential cloudburst on saturated ground as CRITICAL risk tier', () => {
    const extremeForecast: WeatherForecastResponse = {
      ...baseMockForecast,
      current: {
        ...baseMockForecast.current,
        precipitationMm: 65.0, // 65 mm/h cloudburst
        soilMoisture0To7cm: 0.44, // completely saturated ground
      },
      accumulations: {
        past24hRainfallMm: 120.0,
        next24hRainfallMm: 150.0,
        next72hRainfallMm: 310.0,
      },
      soilProfile: {
        moisture0To7cm: 0.44,
        saturationTier: 'SATURATED',
        description: 'Saturated ground.',
      },
    };

    const riskService = new RiskService();
    const result = riskService.calculateAssessment(extremeForecast);

    expect(result.overallRiskLevel).toBe('CRITICAL');
    expect(result.riskScore).toBeGreaterThanOrEqual(85);
    expect(result.explanation.primaryDrivers.length).toBeGreaterThan(0);
    expect(result.explanation.primaryDrivers[0]).toContain('short-term rainfall intensity');
  });

  it('handles missing soil moisture explicitly without zero substitution', () => {
    const missingSoilForecast: WeatherForecastResponse = {
      ...baseMockForecast,
      current: {
        ...baseMockForecast.current,
        soilMoisture0To7cm: undefined,
      },
      soilProfile: {
        moisture0To7cm: undefined,
        saturationTier: 'LOW',
        description: 'Unavailable',
      },
    };

    const riskService = new RiskService();
    const result = riskService.calculateAssessment(missingSoilForecast);

    expect(result.factors.soilSaturation.status).toBe('UNAVAILABLE');
    expect(result.factors.soilSaturation.observedValue).toBeNull();
    expect(result.dataCompleteness).toBe('PARTIAL');
    expect(result.dataConfidence).toBe('MODERATE');
    expect(result.explanation.missingInputs).toContain('Root-zone volumetric soil moisture (0-7cm)');

    // Verify weights re-normalized so active weights sum to 1.0
    const totalActiveWeight =
      result.factors.rainfallIntensity.weight +
      result.factors.rainfallAccumulation.weight +
      result.factors.topographicVulnerability.weight;
    expect(totalActiveWeight).toBeCloseTo(1.0, 1);
  });

  it('handles missing elevation explicitly without zero substitution and re-normalizes weights', () => {
    const missingElevationForecast: WeatherForecastResponse = {
      ...baseMockForecast,
      elevation: null,
    };

    const riskService = new RiskService();
    const result = riskService.calculateAssessment(missingElevationForecast);

    expect(result.factors.topographicVulnerability.status).toBe('UNAVAILABLE');
    expect(result.factors.topographicVulnerability.observedValue).toBeNull();
    expect(result.dataCompleteness).toBe('PARTIAL');
    expect(result.dataConfidence).toBe('MODERATE');
    expect(result.explanation.missingInputs).toContain('Digital terrain elevation (m MSL)');

    // Active weights (intensity + accumulation + soil) should sum to ~1.0
    const totalActiveWeight =
      result.factors.rainfallIntensity.weight +
      result.factors.rainfallAccumulation.weight +
      result.factors.soilSaturation.weight;
    expect(totalActiveWeight).toBeCloseTo(1.0, 1);
  });

  it('marks dataCompleteness as MINIMAL and dataConfidence as LOW when multiple inputs are missing', () => {
    const multipleMissingForecast: WeatherForecastResponse = {
      ...baseMockForecast,
      elevation: null,
      current: {
        ...baseMockForecast.current,
        soilMoisture0To7cm: undefined,
      },
      soilProfile: {
        moisture0To7cm: undefined,
        saturationTier: 'LOW',
        description: 'Unavailable',
      },
    };

    const riskService = new RiskService();
    const result = riskService.calculateAssessment(multipleMissingForecast);

    expect(result.dataCompleteness).toBe('MINIMAL');
    expect(result.dataConfidence).toBe('LOW');
    expect(result.explanation.missingInputs.length).toBe(2);
  });

  it('detects and flags stale telemetry by reducing confidence', () => {
    const staleForecast: WeatherForecastResponse = {
      ...baseMockForecast,
      current: {
        ...baseMockForecast.current,
        isStale: true,
      },
    };

    const riskService = new RiskService();
    const result = riskService.calculateAssessment(staleForecast);

    expect(result.isStale).toBe(true);
    expect(result.dataConfidence).toBe('LOW');
  });
});

describe('Risk API Integration Route (/api/risk/assessment)', () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('GET /api/risk/assessment returns typed assessment with factors and disclaimer', async () => {
    const res = await request(app).get('/api/risk/assessment?lat=19.0760&lon=72.8777&name=Mumbai');
    expect(res.status).toBe(200);
    expect(res.body.overallRiskLevel).toBeDefined();
    expect(['LOW', 'GUARDED', 'ELEVATED', 'HIGH', 'CRITICAL']).toContain(res.body.overallRiskLevel);
    expect(typeof res.body.riskScore).toBe('number');
    expect(res.body.factors).toBeDefined();
    expect(res.body.factors.rainfallIntensity).toBeDefined();
    expect(res.body.factors.rainfallAccumulation).toBeDefined();
    expect(res.body.factors.soilSaturation).toBeDefined();
    expect(res.body.factors.topographicVulnerability).toBeDefined();
    expect(res.body.explanation).toBeDefined();
    expect(res.body.explanation.primaryDrivers).toBeInstanceOf(Array);
    expect(res.body.disclaimer.statement).toContain('Indicative assessment only — not a validated hydraulic flood model');
    expect(res.body.sourceType).toBe('INDICATIVE_MODEL');
  });

  it('GET /api/risk/assessment returns HTTP 400 on missing coordinates', async () => {
    const res = await request(app).get('/api/risk/assessment');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATES');
  });

  it('GET /api/risk/assessment returns HTTP 400 on out-of-range latitude', async () => {
    const res = await request(app).get('/api/risk/assessment?lat=95&lon=72.8');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATES');
  });
});
