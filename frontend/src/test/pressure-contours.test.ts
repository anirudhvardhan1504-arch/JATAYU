import { describe, it, expect } from 'vitest';
import {
  generatePressureIsobars,
} from '../services/pressure-contours';
import { ForecastGridResponse } from '../services/forecast';

function createMockPressureGrid(nodeOverrides: any[] = []): ForecastGridResponse {
  // Create a 7x7 mesoscale grid simulating a low-pressure depression surrounded by higher pressure
  const nodes: any[] = [];
  const minLat = 18.25;
  const maxLat = 19.75;
  const minLon = 72.25;
  const maxLon = 73.75;
  const step = 0.25;

  const centerLat = 19.0;
  const centerLon = 73.0;

  for (let lat = minLat; lat <= maxLat + 0.001; lat += step) {
    for (let lon = minLon; lon <= maxLon + 0.001; lon += step) {
      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;

      // Distance from depression center (19.0°N, 73.0°E)
      const dist = Math.hypot(roundedLon - centerLon, roundedLat - centerLat);
      // MSLP: 996 hPa at center, rising to 1014 hPa at periphery
      const mslp = 996.0 + dist * 18.0;

      nodes.push({
        requestedLat: roundedLat,
        requestedLon: roundedLon,
        modelLat: roundedLat,
        modelLon: roundedLon,
        elevationM: 10,
        accum24hMm: 15,
        accum72hMm: 40,
        maxWindGustKmh: 45,
        minPressureMslHpa: Math.round(mslp * 10) / 10,
        hourly: Array.from({ length: 72 }, (_, h) => ({
          time: `2026-11-13T${h.toString().padStart(2, '0')}:00`,
          precipitationMm: 2.0,
          rainMm: 2.0,
          showersMm: 0,
          temperatureC: 28.0,
          apparentTemperatureC: 31.0,
          relativeHumidityPercent: 80,
          pressureMslHpa: Math.round((mslp + (h % 3) * 0.5) * 10) / 10,
          surfacePressureHpa: 1000.0,
          windSpeedKmh: 25,
          windDirectionDegrees: 220,
          windGustsKmh: 40,
          uMs: -4.5,
          vMs: -5.3,
        })),
      });
    }
  }

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
      validEndTime: '2026-11-15T23:00',
      totalTimesteps: 72,
      gridNodeCount: nodes.length,
      deduplicatedNodeCount: nodes.length,
      mode: 'sector',
      activeSector: 'mumbai',
      isInterpolatedMesh: true,
      disclosure: 'Spatial surface reconstructed via mesoscale grid interpolation. Not a raw native-resolution GRIB2 raster.',
      attribution: 'Weather data by Open-Meteo under CC BY 4.0',
      isStale: false,
      cacheTtlMs: 7200000,
      billableCallsIncurred: nodes.length,
      dailyBudgetRemaining: 7900,
    },
    nodes: nodeOverrides.length > 0 ? nodeOverrides : nodes,
  };
}

describe('Pressure Isobar Contour Engine (pressure-contours.ts)', () => {
  describe('1. Marching Squares Generation & GeoJSON Validity', () => {
    it('generates valid GeoJSON FeatureCollection with LineString isobars', () => {
      const mock = createMockPressureGrid();
      const result = generatePressureIsobars(mock, 0, { intervalHpa: 4 });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.contours.type).toBe('FeatureCollection');
      expect(result.contours.features.length).toBeGreaterThan(0);

      // Verify structure of first isobar feature
      const firstFeature = result.contours.features[0];
      expect(firstFeature.type).toBe('Feature');
      expect(firstFeature.geometry.type).toBe('LineString');
      expect(Array.isArray(firstFeature.geometry.coordinates)).toBe(true);
      expect(firstFeature.geometry.coordinates.length).toBeGreaterThanOrEqual(2);

      // Verify coordinate format [lon, lat]
      const [lon, lat] = firstFeature.geometry.coordinates[0];
      expect(typeof lon).toBe('number');
      expect(typeof lat).toBe('number');
      expect(lon).toBeGreaterThanOrEqual(72.0);
      expect(lon).toBeLessThanOrEqual(74.0);
      expect(lat).toBeGreaterThanOrEqual(18.0);
      expect(lat).toBeLessThanOrEqual(20.0);

      // Verify properties
      expect(firstFeature.properties.pressureHpa).toBeDefined();
      expect(firstFeature.properties.label).toMatch(/^\d+ hPa$/);
      expect(typeof firstFeature.properties.isIndex).toBe('boolean');
    });

    it('respects configurable 2 hPa vs 4 hPa contour intervals', () => {
      const mock = createMockPressureGrid();
      const res4 = generatePressureIsobars(mock, 0, { intervalHpa: 4 });
      const res2 = generatePressureIsobars(mock, 0, { intervalHpa: 2 });

      expect(res4).not.toBeNull();
      expect(res2).not.toBeNull();

      expect(res4!.intervalHpa).toBe(4);
      expect(res2!.intervalHpa).toBe(2);

      // 2 hPa interval generates more contour features than 4 hPa interval
      expect(res2!.contours.features.length).toBeGreaterThan(res4!.contours.features.length);

      // Verify 4 hPa intervals are multiples of 4
      for (const f of res4!.contours.features) {
        expect(f.properties.pressureHpa % 4).toBe(0);
      }

      // Verify 2 hPa intervals are multiples of 2
      for (const f of res2!.contours.features) {
        expect(f.properties.pressureHpa % 2).toBe(0);
      }
    });

    it('identifies index isobars with isIndex=true', () => {
      const mock = createMockPressureGrid();
      const result = generatePressureIsobars(mock, 0, { intervalHpa: 4 });

      expect(result).not.toBeNull();
      const indexFeatures = result!.contours.features.filter((f) => f.properties.isIndex);
      expect(indexFeatures.length).toBeGreaterThan(0);

      for (const f of indexFeatures) {
        const p = f.properties.pressureHpa;
        expect(p % 8 === 0 || p === 1012 || p === 1000).toBe(true);
      }
    });

    it('updates isobars when timestep changes', () => {
      const mock = createMockPressureGrid();
      const step0 = generatePressureIsobars(mock, 0, { intervalHpa: 4 });
      const step1 = generatePressureIsobars(mock, 1, { intervalHpa: 4 });

      expect(step0).not.toBeNull();
      expect(step1).not.toBeNull();
      expect(step0!.timestepIndex).toBe(0);
      expect(step1!.timestepIndex).toBe(1);
    });
  });

  describe('2. Saddle Disambiguation & Missing Data Protection', () => {
    it('handles saddle cells deterministically without crashing', () => {
      // 4 corners forming an alternating saddle (BL high, BR low, TR high, TL low)
      const saddleNodes = [
        { requestedLat: 19.0, requestedLon: 73.0, modelLat: 19.0, modelLon: 73.0, hourly: [{ pressureMslHpa: 1016 }] },
        { requestedLat: 19.0, requestedLon: 73.25, modelLat: 19.0, modelLon: 73.25, hourly: [{ pressureMslHpa: 1004 }] },
        { requestedLat: 19.25, requestedLon: 73.25, modelLat: 19.25, modelLon: 73.25, hourly: [{ pressureMslHpa: 1016 }] },
        { requestedLat: 19.25, requestedLon: 73.0, modelLat: 19.25, modelLon: 73.0, hourly: [{ pressureMslHpa: 1004 }] },
      ];

      const mock = createMockPressureGrid(saddleNodes);
      const result = generatePressureIsobars(mock, 0, { intervalHpa: 4 });

      expect(result).not.toBeNull();
      // Should generate lines through the saddle without throwing
      expect(result!.contours.features.length).toBeGreaterThanOrEqual(1);
    });

    it('does not extrapolate isobars across missing-data or unsupported regions', () => {
      // Create isolated point far from cluster
      const isolatedNodes = [
        { requestedLat: 19.0, requestedLon: 73.0, modelLat: 19.0, modelLon: 73.0, hourly: [{ pressureMslHpa: 1010 }] },
        { requestedLat: 19.0, requestedLon: 73.25, modelLat: 19.0, modelLon: 73.25, hourly: [{ pressureMslHpa: 1012 }] },
        { requestedLat: 19.25, requestedLon: 73.25, modelLat: 19.25, modelLon: 73.25, hourly: [{ pressureMslHpa: 1014 }] },
        // Isolated node 5 degrees away
        { requestedLat: 25.0, requestedLon: 80.0, modelLat: 25.0, modelLon: 80.0, hourly: [{ pressureMslHpa: 1020 }] },
      ];

      const mock = createMockPressureGrid(isolatedNodes);
      const result = generatePressureIsobars(mock, 0, { intervalHpa: 4, maxDistanceDegrees: 0.5 });

      expect(result).not.toBeNull();
      // No isobar line should span across the 5° gap between 73.25°E and 80.0°E
      for (const f of result!.contours.features) {
        for (const coord of f.geometry.coordinates) {
          const lon = (coord as [number, number])[0];
          expect(lon < 75.0 || lon > 79.0).toBe(true); // Gap preserved
        }
      }
    });

    it('returns null for empty or invalid forecast response', () => {
      expect(generatePressureIsobars(null as any)).toBeNull();
      expect(generatePressureIsobars({ metadata: {} as any, nodes: [] })).toBeNull();
    });
  });

  describe('3. High and Low Pressure Extrema Detection', () => {
    it('detects a local Low (L) pressure center with prominence and valid metadata', () => {
      const mock = createMockPressureGrid();
      const result = generatePressureIsobars(mock, 0, { intervalHpa: 4, prominenceThresholdHpa: 0.8 });

      expect(result).not.toBeNull();
      if (!result) return;

      const extrema = result.extrema;
      expect(extrema.type).toBe('FeatureCollection');
      expect(extrema.features.length).toBeGreaterThan(0);

      // Find the detected Low
      const lowFeature = extrema.features.find((f) => f.properties.type === 'L');
      expect(lowFeature).toBeDefined();

      if (lowFeature) {
        expect(lowFeature.geometry.type).toBe('Point');
        const [lon, lat] = lowFeature.geometry.coordinates;
        // Should be near depression center (19.0°N, 73.0°E)
        expect(lon).toBeCloseTo(73.0, 1);
        expect(lat).toBeCloseTo(19.0, 1);
        expect(lowFeature.properties.pressureHpa).toBeLessThan(1000);
        expect(lowFeature.properties.label).toMatch(/^L \d+$/);
        expect(lowFeature.properties.isForecastExtrema).toBe(true);
        expect(lowFeature.properties.notice).toContain('Local NWP forecast-grid extrema');
      }
    });

    it('suppresses duplicate extrema within suppression radius', () => {
      const mock = createMockPressureGrid();
      const result = generatePressureIsobars(mock, 0, {
        intervalHpa: 4,
        suppressionRadiusDegrees: 0.5,
      });

      expect(result).not.toBeNull();
      const lows = result!.extrema.features.filter((f) => f.properties.type === 'L');

      // Verify no two Lows are closer than 0.5°
      for (let i = 0; i < lows.length; i++) {
        for (let j = i + 1; j < lows.length; j++) {
          const [lon1, lat1] = lows[i].geometry.coordinates;
          const [lon2, lat2] = lows[j].geometry.coordinates;
          const dist = Math.hypot(lon1 - lon2, lat1 - lat2);
          expect(dist).toBeGreaterThanOrEqual(0.5);
        }
      }
    });

    it('does not place extrema on boundary edges', () => {
      const mock = createMockPressureGrid();
      const result = generatePressureIsobars(mock, 0);

      expect(result).not.toBeNull();
      for (const ext of result!.extrema.features) {
        const [lon, lat] = ext.geometry.coordinates;
        // Outer boundaries: lat [18.25, 19.75], lon [72.25, 73.75]
        expect(lat).toBeGreaterThan(18.3);
        expect(lat).toBeLessThan(19.7);
        expect(lon).toBeGreaterThan(72.3);
        expect(lon).toBeLessThan(73.7);
      }
    });
  });
});
