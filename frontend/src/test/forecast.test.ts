import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiModule from '../services/api';
import {
  getForecastGrid,
  clearForecastClientCache,
  validateForecastResponse,
  getTimestepOffsets,
  findTimestepIndexByTimestamp,
  clampTimestepIndex,
  getNodePrecipitation,
  getNodeWind,
  getNodeTemperature,
  getNodeHumidity,
  getNodePressure,
  computeGridExtrema,
  getForecastDisclosureText,
  degreesToCardinal,
  celsiusToFahrenheit,
  kmhToKnots,
  hpaToInHg,
  FORECAST_PRODUCTS,
  FORECAST_TOTAL_TIMESTEPS,
  ForecastGridResponse,
} from '../services/forecast';

// Helper to generate a realistic 72-hour mock NWP forecast grid response
function createMockForecastGridResponse(overrides: Partial<ForecastGridResponse> = {}): ForecastGridResponse {
  const hourly = Array.from({ length: 72 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return {
      time: `2026-11-13T${hour}:00`,
      precipitationMm: i === 12 ? 24.5 : i === 13 ? 12.0 : 0.5,
      rainMm: 0.5,
      showersMm: 0.0,
      temperatureC: 28.0 + (i % 6),
      apparentTemperatureC: 31.0 + (i % 6),
      relativeHumidityPercent: 65 + (i % 20),
      pressureMslHpa: 1012.0 - (i % 10),
      surfacePressureHpa: 1010.0 - (i % 10),
      windSpeedKmh: 20 + i,
      windDirectionDegrees: 225, // SW
      windGustsKmh: 35 + i,
      uMs: -3.93,
      vMs: -3.93,
    };
  });

  return {
    metadata: {
      provider: 'Open-Meteo ECMWF Open Data',
      model: 'ECMWF IFS (0.25°)',
      nativeResolution: '0.25° (~28 km) regular lat/lon',
      isFallback: false,
      runCycle: '00Z',
      initializationTime: '2026-11-13T00:00',
      generatedAt: '2026-11-13T06:21:55.122Z',
      validStartTime: '2026-11-13T00:00',
      validEndTime: '2026-11-15T23:00',
      totalTimesteps: 72,
      gridNodeCount: 49,
      deduplicatedNodeCount: 42,
      mode: 'sector',
      activeSector: 'mumbai',
      isInterpolatedMesh: true,
      disclosure:
        'Spatial surface reconstructed via mesoscale grid interpolation from ECMWF IFS (0.25°) / GFS (0.25°). Not a raw native-resolution GRIB2 raster.',
      attribution: 'Weather data by Open-Meteo.com under CC BY 4.0 (ECMWF Open Data / NOAA GFS)',
      isStale: false,
      cacheTtlMs: 7200000,
      billableCallsIncurred: 49,
      dailyBudgetRemaining: 7951,
      ...overrides.metadata,
    },
    nodes: [
      {
        requestedLat: 19.076,
        requestedLon: 72.8777,
        modelLat: 19.0,
        modelLon: 73.0,
        elevationM: 14,
        sectorKey: 'mumbai',
        accum24hMm: 45.2,
        accum72hMm: 110.8,
        maxWindGustKmh: 82.5,
        minPressureMslHpa: 998.4,
        hourly,
      },
      {
        requestedLat: 19.25,
        requestedLon: 72.75,
        modelLat: 19.25,
        modelLon: 73.0,
        elevationM: 8,
        sectorKey: 'mumbai',
        accum24hMm: 38.0,
        accum72hMm: 95.0,
        maxWindGustKmh: 75.0,
        minPressureMslHpa: 1001.2,
        hourly,
      },
    ],
    ...overrides,
  };
}

describe('Forecast Data Service (frontend/src/services/forecast.ts)', () => {
  beforeEach(() => {
    clearForecastClientCache();
    vi.restoreAllMocks();
  });

  describe('1. Response Validation & Contract Enforcement', () => {
    it('validates a compliant NWP response successfully', () => {
      const mock = createMockForecastGridResponse();
      expect(() => validateForecastResponse(mock)).not.toThrow();
    });

    it('throws when payload is non-object or null', () => {
      expect(() => validateForecastResponse(null)).toThrow('invalid non-object payload');
      expect(() => validateForecastResponse('string')).toThrow('invalid non-object payload');
    });

    it('throws when metadata is missing or incomplete', () => {
      const mock = createMockForecastGridResponse();
      delete (mock as any).metadata;
      expect(() => validateForecastResponse(mock)).toThrow('missing required metadata');

      const missingProvider = createMockForecastGridResponse();
      missingProvider.metadata.provider = '';
      expect(() => validateForecastResponse(missingProvider)).toThrow('missing valid provider');

      const missingModel = createMockForecastGridResponse();
      missingModel.metadata.model = '';
      expect(() => validateForecastResponse(missingModel)).toThrow('missing valid model');

      const invalidInitTime = createMockForecastGridResponse();
      invalidInitTime.metadata.initializationTime = 'invalid-date';
      expect(() => validateForecastResponse(invalidInitTime)).toThrow('missing valid initializationTime');
    });

    it('throws when nodes array is missing or empty', () => {
      const mock = createMockForecastGridResponse({ nodes: [] });
      expect(() => validateForecastResponse(mock)).toThrow('empty or invalid nodes array');
    });

    it('throws when a node has empty hourly series', () => {
      const mock = createMockForecastGridResponse();
      mock.nodes[0].hourly = [];
      expect(() => validateForecastResponse(mock)).toThrow('empty hourly time-series');
    });
  });

  describe('2. Forecast Grid Fetching & Client Caching', () => {
    it('fetches sector forecast grid via fetchJson with correct query parameters', async () => {
      const mockResponse = createMockForecastGridResponse();
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockResponse);

      const result = await getForecastGrid('sector', 'mumbai', false);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
      expect(fetchJsonSpy).toHaveBeenCalledWith('/weather/forecast-grid?mode=sector&sector=mumbai&refresh=false');
      expect(result.metadata.activeSector).toBe('mumbai');
      expect(result.nodes.length).toBe(2);
    });

    it('serves subsequent calls from client cache without repeated network requests', async () => {
      const mockResponse = createMockForecastGridResponse();
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockResponse);

      const first = await getForecastGrid('sector', 'chennai', false);
      const second = await getForecastGrid('sector', 'chennai', false);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('bypasses client cache when forceRefresh is true', async () => {
      const mockResponse = createMockForecastGridResponse();
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockResponse);

      await getForecastGrid('sector', 'kolkata', false);
      await getForecastGrid('sector', 'kolkata', true);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
      expect(fetchJsonSpy).toHaveBeenLastCalledWith(
        '/weather/forecast-grid?mode=sector&sector=kolkata&refresh=true'
      );
    });

    it('propagates upstream fetch failures cleanly', async () => {
      vi.spyOn(apiModule, 'fetchJson').mockRejectedValue(new Error('HTTP Error 502: Upstream Gateway Timeout'));

      await expect(getForecastGrid('sector', 'guwahati', false)).rejects.toThrow(
        'HTTP Error 502: Upstream Gateway Timeout'
      );
    });
  });

  describe('3. Timeline Offsets & T+0 to T+71 Contract Verification', () => {
    it('generates exactly 72 discrete hourly offsets starting from T+00h to T+71h', () => {
      const mock = createMockForecastGridResponse();
      const offsets = getTimestepOffsets(mock);

      expect(offsets).toHaveLength(FORECAST_TOTAL_TIMESTEPS);
      expect(offsets).toHaveLength(72);

      // Verify T+0 (initialization timestep)
      expect(offsets[0]).toEqual({
        index: 0,
        offsetHours: 0,
        label: 'T+00h',
        time: '2026-11-13T00:00',
      });

      // Verify T+24 (day 1 end)
      expect(offsets[24]).toEqual({
        index: 24,
        offsetHours: 24,
        label: 'T+24h',
        time: '2026-11-13T24:00',
      });

      // Verify T+71 (final forecast hour)
      expect(offsets[71]).toEqual({
        index: 71,
        offsetHours: 71,
        label: 'T+71h',
        time: '2026-11-13T71:00',
      });
    });

    it('returns empty array when response has no nodes', () => {
      expect(getTimestepOffsets({ metadata: {} as any, nodes: [] })).toEqual([]);
    });

    it('finds exact timestep index by ISO timestamp string', () => {
      const mock = createMockForecastGridResponse();
      expect(findTimestepIndexByTimestamp(mock, '2026-11-13T00:00')).toBe(0);
      expect(findTimestepIndexByTimestamp(mock, '2026-11-13T12:00')).toBe(12);
      expect(findTimestepIndexByTimestamp(mock, '2026-11-13T99:00')).toBe(-1);
    });

    it('clamps timestep indices securely between 0 and 71', () => {
      expect(clampTimestepIndex(-5)).toBe(0);
      expect(clampTimestepIndex(0)).toBe(0);
      expect(clampTimestepIndex(35.8)).toBe(35);
      expect(clampTimestepIndex(71)).toBe(71);
      expect(clampTimestepIndex(72)).toBe(71);
      expect(clampTimestepIndex(999)).toBe(71);
      expect(clampTimestepIndex(NaN)).toBe(0);
    });
  });

  describe('4. Product Value Extractors & Units', () => {
    it('extracts preceding-hour precipitation accumulation and intensity', () => {
      const mock = createMockForecastGridResponse();
      const node = mock.nodes[0];

      const precip12 = getNodePrecipitation(node, 12);
      expect(precip12.precipitationMm).toBe(24.5);
      expect(precip12.rainMm).toBe(0.5);
      expect(precip12.isPrecedingHourAccumulation).toBe(true);
      expect(precip12.unit).toBe('mm');

      const precip0 = getNodePrecipitation(node, 0);
      expect(precip0.precipitationMm).toBe(0.5);
    });

    it('extracts wind speed, cardinal direction, gusts, and velocity vectors', () => {
      const mock = createMockForecastGridResponse();
      const node = mock.nodes[0];

      const wind0 = getNodeWind(node, 0);
      expect(wind0.speedKmh).toBe(20);
      expect(wind0.speedMs).toBe(5.56); // 20 / 3.6 rounded
      expect(wind0.directionDeg).toBe(225);
      expect(wind0.cardinal).toBe('SW');
      expect(wind0.gustsKmh).toBe(35);
      expect(wind0.uMs).toBe(-3.93);
      expect(wind0.vMs).toBe(-3.93);
    });

    it('extracts 2m temperature and apparent temperature with °C unit', () => {
      const mock = createMockForecastGridResponse();
      const node = mock.nodes[0];

      const temp = getNodeTemperature(node, 0);
      expect(temp.temperatureC).toBe(28.0);
      expect(temp.apparentTemperatureC).toBe(31.0);
      expect(temp.unit).toBe('°C');
    });

    it('extracts relative humidity percentage', () => {
      const mock = createMockForecastGridResponse();
      const node = mock.nodes[0];

      const humidity = getNodeHumidity(node, 0);
      expect(humidity.relativeHumidityPercent).toBe(65);
      expect(humidity.unit).toBe('%');
    });

    it('extracts Mean Sea Level Pressure and surface pressure with hPa unit', () => {
      const mock = createMockForecastGridResponse();
      const node = mock.nodes[0];

      const pressure = getNodePressure(node, 0);
      expect(pressure.pressureMslHpa).toBe(1012.0);
      expect(pressure.surfacePressureHpa).toBe(1010.0);
      expect(pressure.unit).toBe('hPa');
    });
  });

  describe('5. Extrema Aggregations across Grid', () => {
    it('computes max rainfall, min pressure, peak gusts, and temperature ranges', () => {
      const mock = createMockForecastGridResponse();
      const summary = computeGridExtrema(mock);

      expect(summary.maxPrecipitationMm).toBe(24.5);
      expect(summary.maxAccum24hMm).toBe(45.2);
      expect(summary.maxAccum72hMm).toBe(110.8);
      expect(summary.maxWindGustKmh).toBe(82.5);
      expect(summary.minPressureMslHpa).toBe(998.4);
      expect(summary.minTemperatureC).toBe(28.0);
      expect(summary.maxTemperatureC).toBe(33.0);
    });
  });

  describe('6. Scientific Disclosure & Fallback Annotations', () => {
    it('formats standard operational disclosure text', () => {
      const mock = createMockForecastGridResponse();
      const text = getForecastDisclosureText(mock.metadata);

      expect(text).toContain('Spatial surface reconstructed via mesoscale grid interpolation');
      expect(text).toContain('ECMWF IFS (0.25°)');
      expect(text).toContain('00Z');
      expect(text).not.toContain('FAILOVER ACTIVE');
      expect(text).not.toContain('STALE CACHE');
    });

    it('includes FAILOVER ACTIVE annotation when NOAA GFS fallback is triggered', () => {
      const mock = createMockForecastGridResponse();
      mock.metadata.isFallback = true;
      mock.metadata.fallbackReason = 'ECMWF maintenance window';
      const text = getForecastDisclosureText(mock.metadata);

      expect(text).toContain('[FAILOVER ACTIVE: ECMWF maintenance window]');
    });

    it('includes STALE CACHE annotation when serving cached data during outage', () => {
      const mock = createMockForecastGridResponse();
      mock.metadata.isStale = true;
      mock.metadata.staleReason = 'DAILY_BUDGET_EXHAUSTED';
      const text = getForecastDisclosureText(mock.metadata);

      expect(text).toContain('[STALE CACHE: DAILY_BUDGET_EXHAUSTED]');
    });
  });

  describe('7. Physical Units & Compass Conversions', () => {
    it('converts degrees to 16-point cardinal compass accurately', () => {
      expect(degreesToCardinal(0)).toBe('N');
      expect(degreesToCardinal(360)).toBe('N');
      expect(degreesToCardinal(45)).toBe('NE');
      expect(degreesToCardinal(90)).toBe('E');
      expect(degreesToCardinal(135)).toBe('SE');
      expect(degreesToCardinal(180)).toBe('S');
      expect(degreesToCardinal(225)).toBe('SW');
      expect(degreesToCardinal(270)).toBe('W');
      expect(degreesToCardinal(315)).toBe('NW');
      expect(degreesToCardinal(340)).toBe('NNW');
      expect(degreesToCardinal(-45)).toBe('NW');
    });

    it('converts Celsius to Fahrenheit correctly', () => {
      expect(celsiusToFahrenheit(0)).toBe(32);
      expect(celsiusToFahrenheit(100)).toBe(212);
      expect(celsiusToFahrenheit(25)).toBe(77);
      expect(celsiusToFahrenheit(-10)).toBe(14);
    });

    it('converts km/h to knots correctly', () => {
      expect(kmhToKnots(0)).toBe(0);
      expect(kmhToKnots(100)).toBe(54); // 100 * 0.539957 = 53.9957 -> 54.0
      expect(kmhToKnots(50)).toBe(27);
    });

    it('converts hPa to inHg correctly', () => {
      expect(hpaToInHg(1013.25)).toBe(29.92);
      expect(hpaToInHg(980)).toBe(28.94);
    });
  });

  describe('8. Forecast Product Configurations', () => {
    it('verifies all 5 core forecast products have valid definitions', () => {
      const productKeys = ['precipitation', 'wind', 'temperature', 'humidity', 'pressure'] as const;
      expect(Object.keys(FORECAST_PRODUCTS)).toEqual(productKeys);

      for (const key of productKeys) {
        const prod = FORECAST_PRODUCTS[key];
        expect(prod.type).toBe(key);
        expect(prod.name).toBeTruthy();
        expect(prod.unit).toBeTruthy();
        expect(prod.colorRamp.length).toBeGreaterThan(0);
        expect(prod.minValue).toBeLessThan(prod.maxValue);
      }
    });
  });
});
