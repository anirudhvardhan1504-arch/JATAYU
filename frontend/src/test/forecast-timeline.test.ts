import { describe, it, expect } from 'vitest';
import {
  formatForecastValidTime,
  getForecastTimeInfo,
  getNextForecastIndex,
  getPrevForecastIndex,
  clampForecastIndex,
  FORECAST_SPEED_PRESETS,
} from '../services/forecast-timeline';
import type { ForecastGridResponse } from '../services/forecast';

describe('Phase 3C: Unified 72-Hour Forecast Timeline Controller', () => {
  function createMockGridResponse(isFallback: boolean = false, isStale: boolean = false): ForecastGridResponse {
    return {
      metadata: {
        provider: isFallback ? 'Open-Meteo NOAA GFS' : 'Open-Meteo ECMWF Open Data',
        model: isFallback ? 'NOAA GFS (0.25°)' : 'ECMWF IFS (0.25°)',
        nativeResolution: '0.25° regular lat/lon',
        isFallback,
        runCycle: '00Z',
        initializationTime: '2026-11-13T00:00',
        generatedAt: '2026-11-13T00:05:00Z',
        validStartTime: '2026-11-13T00:00',
        validEndTime: '2026-11-16T00:00',
        totalTimesteps: 72,
        gridNodeCount: 42,
        deduplicatedNodeCount: 42,
        mode: 'sector',
        activeSector: 'mumbai',
        isInterpolatedMesh: true,
        disclosure: 'Interpolated mesoscale surface',
        attribution: 'ECMWF / Open-Meteo',
        isStale,
        cacheTtlMs: 3600000,
        billableCallsIncurred: 1,
        dailyBudgetRemaining: 7990,
      },
      nodes: [
        {
          requestedLat: 19.0,
          requestedLon: 72.8,
          modelLat: 19.0,
          modelLon: 72.75,
          elevationM: 10,
          accum24hMm: 20,
          accum72hMm: 50,
          maxWindGustKmh: 45,
          minPressureMslHpa: 1008,
          hourly: Array.from({ length: 72 }, (_, i) => {
            const h = i.toString().padStart(2, '0');
            return {
              time: `2026-11-13T${h}:00`,
              precipitationMm: 2.5,
              rainMm: 2.5,
              showersMm: 0,
              temperatureC: 28,
              apparentTemperatureC: 30,
              relativeHumidityPercent: 75,
              pressureMslHpa: 1012 - (i % 5),
              surfacePressureHpa: 1011 - (i % 5),
              windSpeedKmh: 25,
              windDirectionDegrees: 240,
              windGustsKmh: 35,
              uMs: 5.5,
              vMs: 3.2,
            };
          }),
        },
      ],
    };
  }

  describe('1. Timestamp Formatting & Provenance Metadata', () => {
    it('formats ISO timestamps into clean UTC labels', () => {
      expect(formatForecastValidTime('2026-11-13T14:00')).toContain('14:00 UTC');
      expect(formatForecastValidTime('2026-11-13T00:00')).toContain('00:00 UTC');
      expect(formatForecastValidTime('')).toBe('--:-- UTC');
    });

    it('extracts complete timeline metadata for a given forecast timestep', () => {
      const grid = createMockGridResponse(false, false);
      const info = getForecastTimeInfo(grid, 12);

      expect(info.index).toBe(12);
      expect(info.stepLabel).toBe('T+12h');
      expect(info.isoTime).toBe('2026-11-13T12:00');
      expect(info.model).toBe('ECMWF IFS (0.25°)');
      expect(info.runCycle).toBe('00Z');
      expect(info.isFallback).toBe(false);
      expect(info.isStale).toBe(false);
    });

    it('identifies failover and stale cache conditions in forecast metadata', () => {
      const fallbackGrid = createMockGridResponse(true, true);
      const info = getForecastTimeInfo(fallbackGrid, 0);

      expect(info.model).toBe('NOAA GFS (0.25°)');
      expect(info.isFallback).toBe(true);
      expect(info.isStale).toBe(true);
    });
  });

  describe('2. Timestep Stepping, Scrubbing & Boundary Safety', () => {
    it('steps forward sequentially from T+0 to T+71 and loops', () => {
      expect(getNextForecastIndex(0, 72, true)).toBe(1);
      expect(getNextForecastIndex(11, 72, true)).toBe(12);
      expect(getNextForecastIndex(70, 72, true)).toBe(71);
      expect(getNextForecastIndex(71, 72, true)).toBe(0); // Loop back
      expect(getNextForecastIndex(71, 72, false)).toBe(71); // No loop
    });

    it('steps backward sequentially and wraps around', () => {
      expect(getPrevForecastIndex(12, 72, true)).toBe(11);
      expect(getPrevForecastIndex(1, 72, true)).toBe(0);
      expect(getPrevForecastIndex(0, 72, true)).toBe(71); // Wrap around
      expect(getPrevForecastIndex(0, 72, false)).toBe(0); // Clamped
    });

    it('clamps scrubber input index safely to [0, totalSteps - 1]', () => {
      expect(clampForecastIndex(-5, 72)).toBe(0);
      expect(clampForecastIndex(100, 72)).toBe(71);
      expect(clampForecastIndex(36.7, 72)).toBe(36);
      expect(clampForecastIndex(NaN, 72)).toBe(0);
    });

    it('supports 0.5x, 1x, and 2x playback speed intervals', () => {
      expect(FORECAST_SPEED_PRESETS).toHaveLength(3);
      const speed05x = FORECAST_SPEED_PRESETS.find((s) => s.label === '0.5x');
      const speed1x = FORECAST_SPEED_PRESETS.find((s) => s.label === '1x');
      const speed2x = FORECAST_SPEED_PRESETS.find((s) => s.label === '2x');

      expect(speed05x?.ms).toBeGreaterThan(speed1x?.ms!);
      expect(speed1x?.ms).toBeGreaterThan(speed2x?.ms!);
    });
  });
});
