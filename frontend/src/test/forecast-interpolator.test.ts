import { describe, it, expect, beforeEach } from 'vitest';
import {
  interpolateForecastFrame,
  clearForecastFrameCache,
  getColorForProductValue,
} from '../services/forecast-interpolator';
import { ForecastGridResponse } from '../services/forecast';

function createMockGridResponse(nodeOverrides: any[] = []): ForecastGridResponse {
  const defaultNodes = [
    {
      requestedLat: 19.0,
      requestedLon: 72.8,
      modelLat: 19.0,
      modelLon: 72.75,
      elevationM: 10,
      accum24hMm: 25.0,
      accum72hMm: 60.0,
      maxWindGustKmh: 45.0,
      minPressureMslHpa: 1008.0,
      hourly: [
        {
          time: '2026-11-13T00:00',
          precipitationMm: 12.5,
          rainMm: 12.5,
          showersMm: 0,
          temperatureC: 32.0,
          apparentTemperatureC: 36.0,
          relativeHumidityPercent: 78,
          pressureMslHpa: 1006.0,
          surfacePressureHpa: 1005.0,
          windSpeedKmh: 24,
          windDirectionDegrees: 240,
          windGustsKmh: 38,
          uMs: -5.7,
          vMs: -3.3,
        },
      ],
    },
    {
      requestedLat: 19.25,
      requestedLon: 73.0,
      modelLat: 19.25,
      modelLon: 73.0,
      elevationM: 15,
      accum24hMm: 35.0,
      accum72hMm: 80.0,
      maxWindGustKmh: 55.0,
      minPressureMslHpa: 1004.0,
      hourly: [
        {
          time: '2026-11-13T00:00',
          precipitationMm: 28.0,
          rainMm: 28.0,
          showersMm: 0,
          temperatureC: 27.5,
          apparentTemperatureC: 30.0,
          relativeHumidityPercent: 88,
          pressureMslHpa: 1002.5,
          surfacePressureHpa: 1001.0,
          windSpeedKmh: 32,
          windDirectionDegrees: 220,
          windGustsKmh: 48,
          uMs: -5.7,
          vMs: -6.8,
        },
      ],
    },
    {
      requestedLat: 18.75,
      requestedLon: 72.9,
      modelLat: 18.75,
      modelLon: 73.0,
      elevationM: 8,
      accum24hMm: 10.0,
      accum72hMm: 25.0,
      maxWindGustKmh: 35.0,
      minPressureMslHpa: 1010.0,
      hourly: [
        {
          time: '2026-11-13T00:00',
          precipitationMm: 0.05, // Trace (below 0.1 mm)
          rainMm: 0.05,
          showersMm: 0,
          temperatureC: 34.0,
          apparentTemperatureC: 40.0,
          relativeHumidityPercent: 55,
          pressureMslHpa: 1011.0,
          surfacePressureHpa: 1010.0,
          windSpeedKmh: 15,
          windDirectionDegrees: 180,
          windGustsKmh: 22,
          uMs: 0,
          vMs: -4.1,
        },
      ],
    },
  ];

  return {
    metadata: {
      provider: 'Open-Meteo ECMWF Open Data',
      model: 'ECMWF IFS (0.25°)',
      nativeResolution: '0.25° (~28 km) regular lat/lon',
      isFallback: false,
      runCycle: '00Z',
      initializationTime: '2026-11-13T00:00',
      generatedAt: '2026-11-13T06:00:00Z',
      validStartTime: '2026-11-13T00:00',
      validEndTime: '2026-11-13T71:00',
      totalTimesteps: 72,
      gridNodeCount: 3,
      deduplicatedNodeCount: 3,
      mode: 'sector',
      activeSector: 'mumbai',
      isInterpolatedMesh: true,
      disclosure: 'Spatial surface reconstructed via mesoscale grid interpolation. Not a raw native-resolution GRIB2 raster.',
      attribution: 'Weather data by Open-Meteo under CC BY 4.0',
      isStale: false,
      cacheTtlMs: 7200000,
      billableCallsIncurred: 3,
      dailyBudgetRemaining: 7990,
    },
    nodes: nodeOverrides.length > 0 ? nodeOverrides : defaultNodes,
  };
}

describe('Spatial Forecast Interpolation Engine (forecast-interpolator.ts)', () => {
  beforeEach(() => {
    clearForecastFrameCache();
  });

  describe('1. Spatial IDW Interpolation & Frame Generation', () => {
    it('generates an interpolated canvas frame for precipitation', () => {
      const mock = createMockGridResponse();
      const frame = interpolateForecastFrame(mock, 'precipitation', 0, { width: 32, height: 32 });

      expect(frame).not.toBeNull();
      if (!frame) return;

      expect(frame.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(frame.width).toBe(32);
      expect(frame.height).toBe(32);
      expect(frame.coordinates).toHaveLength(4);

      // Verify MapLibre coordinate order: [TL, TR, BR, BL]
      const [tl, tr, br, bl] = frame.coordinates;
      expect(tl[0]).toBe(frame.bounds.minLon); // TL Lon
      expect(tl[1]).toBe(frame.bounds.maxLat); // TL Lat
      expect(tr[0]).toBe(frame.bounds.maxLon); // TR Lon
      expect(tr[1]).toBe(frame.bounds.maxLat); // TR Lat
      expect(br[0]).toBe(frame.bounds.maxLon); // BR Lon
      expect(br[1]).toBe(frame.bounds.minLat); // BR Lat
      expect(bl[0]).toBe(frame.bounds.minLon); // BL Lon
      expect(bl[1]).toBe(frame.bounds.minLat); // BL Lat
    });

    it('interpolates temperature scalar field within valid bounds', () => {
      const mock = createMockGridResponse();
      const frame = interpolateForecastFrame(mock, 'temperature', 0, { width: 32, height: 32 });

      expect(frame).not.toBeNull();
      if (!frame) return;

      expect(frame.minValue).toBeGreaterThanOrEqual(27.0);
      expect(frame.maxValue).toBeLessThanOrEqual(35.0);
    });

    it('interpolates relative humidity percentage within 0-100%', () => {
      const mock = createMockGridResponse();
      const frame = interpolateForecastFrame(mock, 'humidity', 0, { width: 32, height: 32 });

      expect(frame).not.toBeNull();
      if (!frame) return;

      expect(frame.minValue).toBeGreaterThanOrEqual(50);
      expect(frame.maxValue).toBeLessThanOrEqual(95);
    });

    it('interpolates MSLP barometric pressure field in hPa', () => {
      const mock = createMockGridResponse();
      const frame = interpolateForecastFrame(mock, 'pressure', 0, { width: 32, height: 32 });

      expect(frame).not.toBeNull();
      if (!frame) return;

      expect(frame.minValue).toBeGreaterThanOrEqual(1000);
      expect(frame.maxValue).toBeLessThanOrEqual(1015);
    });
  });

  describe('2. Coordinate Deduplication & Irregular Grid Spacing', () => {
    it('safely handles duplicate coordinates without mathematical NaN singularities', () => {
      // 2 nodes with identical model lat/lon
      const duplicateNodes = [
        {
          requestedLat: 19.01,
          requestedLon: 72.85,
          modelLat: 19.0,
          modelLon: 72.75,
          elevationM: 10,
          accum24hMm: 20.0,
          accum72hMm: 50.0,
          maxWindGustKmh: 40.0,
          minPressureMslHpa: 1008.0,
          hourly: [{ precipitationMm: 10.0, temperatureC: 30.0, relativeHumidityPercent: 70, pressureMslHpa: 1010.0 }],
        },
        {
          requestedLat: 19.03,
          requestedLon: 72.82,
          modelLat: 19.0, // Same model cell
          modelLon: 72.75, // Same model cell
          elevationM: 10,
          accum24hMm: 20.0,
          accum72hMm: 50.0,
          maxWindGustKmh: 40.0,
          minPressureMslHpa: 1008.0,
          hourly: [{ precipitationMm: 20.0, temperatureC: 32.0, relativeHumidityPercent: 80, pressureMslHpa: 1010.0 }],
        },
      ];

      const mock = createMockGridResponse(duplicateNodes);
      const frame = interpolateForecastFrame(mock, 'precipitation', 0, { width: 16, height: 16 });

      expect(frame).not.toBeNull();
      expect(isNaN(frame!.minValue)).toBe(false);
      expect(isNaN(frame!.maxValue)).toBe(false);
      // Average precipitation between duplicate coordinates should be ~15.0 mm
      expect(frame!.maxValue).toBeCloseTo(15.0, 0);
    });

    it('returns null when response contains empty or missing nodes', () => {
      const emptyMock: any = { metadata: {}, nodes: [] };
      expect(interpolateForecastFrame(emptyMock, 'precipitation', 0)).toBeNull();
      expect(interpolateForecastFrame(null as any, 'precipitation', 0)).toBeNull();
    });
  });

  describe('3. Frame Caching & Performance', () => {
    it('returns cached canvas frame without re-computing canvas', () => {
      const mock = createMockGridResponse();
      const frame1 = interpolateForecastFrame(mock, 'precipitation', 0, { width: 16, height: 16 });
      const frame2 = interpolateForecastFrame(mock, 'precipitation', 0, { width: 16, height: 16 });

      expect(frame1).toBe(frame2); // Same object reference from cache
    });

    it('clears cache and produces new frame when clearForecastFrameCache is invoked', () => {
      const mock = createMockGridResponse();
      const frame1 = interpolateForecastFrame(mock, 'precipitation', 0, { width: 16, height: 16 });
      clearForecastFrameCache();
      const frame2 = interpolateForecastFrame(mock, 'precipitation', 0, { width: 16, height: 16 });

      expect(frame1).not.toBe(frame2); // New frame created
      expect(frame1?.dataUrl).toBe(frame2?.dataUrl);
    });
  });

  describe('4. Color Mapping Scales & Trace Precipitation Thresholds', () => {
    it('returns fully transparent RGBA for precipitation < 0.1 mm/h (trace threshold)', () => {
      const [r, g, b, alpha] = getColorForProductValue('precipitation', 0.05, 1.0);
      expect(alpha).toBe(0);
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it('returns progressive color scales for active rainfall', () => {
      const light = getColorForProductValue('precipitation', 1.5, 1.0);
      const moderate = getColorForProductValue('precipitation', 5.0, 1.0);
      const heavy = getColorForProductValue('precipitation', 20.0, 1.0);
      const torrential = getColorForProductValue('precipitation', 60.0, 1.0);

      expect(light[3]).toBeGreaterThan(0);
      expect(moderate[3]).toBeGreaterThan(0);
      expect(heavy[3]).toBeGreaterThan(0);
      expect(torrential[3]).toBeGreaterThan(0);

      // Torrential rainfall should map to deep crimson/purple [128, 0, 38]
      expect(torrential[0]).toBe(128);
      expect(torrential[1]).toBe(0);
      expect(torrential[2]).toBe(38);
    });

    it('maps temperatures across cold to extreme heat scale', () => {
      const cold = getColorForProductValue('temperature', 0, 1.0);
      const hot = getColorForProductValue('temperature', 45, 1.0);

      expect(cold[3]).toBeGreaterThan(0);
      expect(hot[3]).toBeGreaterThan(0);
      // Hot (>42°C) should have dominant red channel
      expect(hot[0]).toBeGreaterThan(150);
    });

    it('maps MSLP pressures distinguishing cyclonic low from anticyclone', () => {
      const cyclone = getColorForProductValue('pressure', 980, 1.0);
      const anticyclone = getColorForProductValue('pressure', 1025, 1.0);

      expect(cyclone[3]).toBeGreaterThan(0);
      expect(anticyclone[3]).toBeGreaterThan(0);
      // Deep cyclonic low (<995 hPa) has magenta/purple tones
      expect(cyclone[0]).toBeGreaterThan(70);
    });
  });
});
