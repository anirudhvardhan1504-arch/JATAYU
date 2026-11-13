import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  ForecastImpactService,
  haversineDistanceKm,
  validateHourlyContinuity,
  computeNodeFutureAccumulations,
  classifyImd24hRainfall,
  classifyImdHourlyRate,
} from '../services/forecast-impact.service.js';
import { HourlyGridDataPoint, ForecastGridResponse } from '../types/forecast-grid.types.js';

describe('Phase 3D-1: Backend Forecast Impact Engine & Scientific Verification', () => {
  // Helper to build a clean 72-hour timeseries (indices 0..71)
  function createSyntheticHourlySeries(
    baseTimeIso: string = '2026-11-13T00:00:00.000Z',
    precipGenerator: (t: number) => number = () => 1.0,
    gustGenerator: (t: number) => number = () => 20.0
  ): HourlyGridDataPoint[] {
    const list: HourlyGridDataPoint[] = [];
    const baseMs = new Date(baseTimeIso).getTime();

    for (let t = 0; t < 72; t++) {
      const time = new Date(baseMs + t * 3600000).toISOString();
      const precipitationMm = precipGenerator(t);
      const windGustsKmh = gustGenerator(t);

      list.push({
        time,
        precipitationMm,
        rainMm: precipitationMm * 0.8,
        showersMm: precipitationMm * 0.2,
        temperatureC: 28.0,
        apparentTemperatureC: 30.0,
        relativeHumidityPercent: 75,
        pressureMslHpa: 1010.0,
        surfacePressureHpa: 1008.0,
        windSpeedKmh: 15.0,
        windDirectionDegrees: 180,
        windGustsKmh,
        uMs: 0,
        vMs: 4.17,
      });
    }

    return list;
  }

  describe('1. Precipitation Interval Semantics & Accumulation Windows', () => {
    it('strictly excludes T+0 (preceding hour) and sums T+1 through T+6 for 6h accumulation', () => {
      // T+0 has 100mm (must be excluded!), T+1..T+6 have 5mm each = 30mm
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
        if (t === 0) return 100.0;
        if (t <= 6) return 5.0;
        return 0.0;
      });

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum6hMm).toBe(30.0); // 6 * 5 = 30, NOT 130!
    });

    it('sums T+1 through T+12 for 12h accumulation', () => {
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
        if (t === 0) return 999.0; // T+0 excluded
        if (t <= 12) return 2.5;
        return 0.0;
      });

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum12hMm).toBe(30.0); // 12 * 2.5 = 30.0
    });

    it('sums T+1 through T+24 for 24h accumulation', () => {
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
        if (t === 0) return 500.0; // T+0 excluded
        if (t <= 24) return 3.0;
        return 0.0;
      });

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum24hMm).toBe(72.0); // 24 * 3.0 = 72.0
    });

    it('sums T+1 through T+48 for 48h accumulation', () => {
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
        if (t === 0) return 250.0; // T+0 excluded
        if (t <= 48) return 1.5;
        return 0.0;
      });

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum48hMm).toBe(72.0); // 48 * 1.5 = 72.0
    });

    it('strictly returns futureAccum72hMm as null under standard 72-timestep (T+0..T+71) contract', () => {
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', () => 2.0);
      expect(series.length).toBe(72); // T+0..T+71

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum72hMm).toBeNull();
      expect(metrics.accum72hQualityReason).toContain('INSUFFICIENT_FORECAST_HORIZON');
      expect(metrics.accum72hQualityReason).toContain('71 future hours');
    });

    it('computes futureAccum72hMm only if 73 or more continuous timesteps (T+0..T+72) are provided', () => {
      const series73 = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => (t === 0 ? 0 : 1.0));
      // Append T+72
      const baseMs = new Date('2026-11-13T00:00:00.000Z').getTime();
      series73.push({
        time: new Date(baseMs + 72 * 3600000).toISOString(),
        precipitationMm: 1.0,
        rainMm: 0.8,
        showersMm: 0.2,
        temperatureC: 28,
        apparentTemperatureC: 30,
        relativeHumidityPercent: 75,
        pressureMslHpa: 1010,
        surfacePressureHpa: 1008,
        windSpeedKmh: 15,
        windDirectionDegrees: 180,
        windGustsKmh: 20,
        uMs: 0,
        vMs: 4.17,
      });

      expect(series73.length).toBe(73);
      const metrics = computeNodeFutureAccumulations(series73);
      expect(metrics.accum72hMm).toBe(72.0); // 72 terms of 1.0
      expect(metrics.accum72hQualityReason).toBeUndefined();
    });

    it('computes peak hourly rate and timestamp across future intervals', () => {
      const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
        if (t === 0) return 100.0; // T+0 peak must NOT be picked!
        if (t === 14) return 45.2; // Peak at T+14
        return 1.0;
      });

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.peakHourlyRateMmH).toBe(45.2);
      expect(metrics.peakHourlyTimeUtc).toBe(new Date(new Date('2026-11-13T00:00:00.000Z').getTime() + 14 * 3600000).toISOString());
    });
  });

  describe('2. Timestamp Continuity & Missing Data Validation', () => {
    it('validates a strictly continuous 1-hour uniform timeseries', () => {
      const series = createSyntheticHourlySeries();
      const res = validateHourlyContinuity(series);
      expect(res.isValid).toBe(true);
      expect(res.qualityNotice).toBeUndefined();
    });

    it('detects duplicate timestamps and flags continuity failure', () => {
      const series = createSyntheticHourlySeries();
      series[5].time = series[4].time; // Duplicate timestamp at index 5

      const res = validateHourlyContinuity(series);
      expect(res.isValid).toBe(false);
      expect(res.qualityNotice).toContain('Duplicate timestamp detected');

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.quality.continuityValid).toBe(false);
      expect(metrics.accum6hMm).toBeNull();
      expect(metrics.accum24hMm).toBeNull();
    });

    it('detects irregular temporal intervals (e.g. 2-hour gap)', () => {
      const series = createSyntheticHourlySeries();
      const baseMs = new Date(series[10].time).getTime();
      series[11].time = new Date(baseMs + 7200000).toISOString(); // 2h gap

      const res = validateHourlyContinuity(series);
      expect(res.isValid).toBe(false);
      expect(res.qualityNotice).toContain('Non-uniform time step of 7200s detected');
    });

    it('detects corrupted non-ISO timestamp string', () => {
      const series = createSyntheticHourlySeries();
      series[8].time = 'INVALID_TIMESTAMP_STRING';

      const res = validateHourlyContinuity(series);
      expect(res.isValid).toBe(false);
      expect(res.qualityNotice).toContain('Invalid ISO timestamp');
    });

    it('preserves genuine zero precipitation as 0.0 mm without falsifying missing data', () => {
      const zeroSeries = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', () => 0.0);
      const metrics = computeNodeFutureAccumulations(zeroSeries);

      expect(metrics.accum6hMm).toBe(0.0);
      expect(metrics.accum24hMm).toBe(0.0);
      expect(metrics.accum48hMm).toBe(0.0);
      expect(metrics.peakHourlyRateMmH).toBe(0.0);
    });

    it('marks accumulation window as null if any required hourly precipitation value is null or NaN', () => {
      const series = createSyntheticHourlySeries();
      // Inject null at T+5
      (series[5] as any).precipitationMm = null;

      const metrics = computeNodeFutureAccumulations(series);
      expect(metrics.accum6hMm).toBeNull(); // Window contains index 5
      expect(metrics.accum12hMm).toBeNull();
      expect(metrics.accum24hMm).toBeNull();
    });
  });

  describe('3. IMD Rainfall Classifications & Threshold Boundaries', () => {
    it('accurately classifies all 24h rainfall threshold boundaries from risk.service.ts', () => {
      // 0.0 -> NO_RAIN
      expect(classifyImd24hRainfall(0.0)).toBe('NO_RAIN');
      expect(classifyImd24hRainfall(null)).toBe('NO_RAIN');

      // 0.1 to 14.9 -> LIGHT_RAIN
      expect(classifyImd24hRainfall(0.1)).toBe('LIGHT_RAIN');
      expect(classifyImd24hRainfall(14.9)).toBe('LIGHT_RAIN');

      // 15.0 to 64.4 -> MODERATE_RAIN
      expect(classifyImd24hRainfall(15.0)).toBe('MODERATE_RAIN');
      expect(classifyImd24hRainfall(40.0)).toBe('MODERATE_RAIN');
      expect(classifyImd24hRainfall(64.4)).toBe('MODERATE_RAIN');

      // 64.5 to 115.4 -> HEAVY_RAIN
      expect(classifyImd24hRainfall(64.5)).toBe('HEAVY_RAIN');
      expect(classifyImd24hRainfall(100.0)).toBe('HEAVY_RAIN');
      expect(classifyImd24hRainfall(115.4)).toBe('HEAVY_RAIN');

      // 115.5 to 204.4 -> VERY_HEAVY_RAIN
      expect(classifyImd24hRainfall(115.5)).toBe('VERY_HEAVY_RAIN');
      expect(classifyImd24hRainfall(150.0)).toBe('VERY_HEAVY_RAIN');
      expect(classifyImd24hRainfall(204.4)).toBe('VERY_HEAVY_RAIN');

      // >= 204.5 -> EXTREMELY_HEAVY_RAIN
      expect(classifyImd24hRainfall(204.5)).toBe('EXTREMELY_HEAVY_RAIN');
      expect(classifyImd24hRainfall(350.0)).toBe('EXTREMELY_HEAVY_RAIN');
    });

    it('rigorously tests exact boundary decimal edges (14.99 vs 15.00, 64.49 vs 64.50, etc.)', () => {
      // 15.0 boundary
      expect(classifyImd24hRainfall(14.99)).toBe('LIGHT_RAIN');
      expect(classifyImd24hRainfall(15.00)).toBe('MODERATE_RAIN');

      // 64.5 boundary
      expect(classifyImd24hRainfall(64.49)).toBe('MODERATE_RAIN');
      expect(classifyImd24hRainfall(64.50)).toBe('HEAVY_RAIN');

      // 115.5 boundary
      expect(classifyImd24hRainfall(115.49)).toBe('HEAVY_RAIN');
      expect(classifyImd24hRainfall(115.50)).toBe('VERY_HEAVY_RAIN');

      // 204.5 boundary
      expect(classifyImd24hRainfall(204.49)).toBe('VERY_HEAVY_RAIN');
      expect(classifyImd24hRainfall(204.50)).toBe('EXTREMELY_HEAVY_RAIN');
    });

    it('accurately classifies peak hourly rain rates', () => {
      expect(classifyImdHourlyRate(0.0)).toBe('NEGLIGIBLE');
      expect(classifyImdHourlyRate(2.0)).toBe('NEGLIGIBLE');
      expect(classifyImdHourlyRate(5.0)).toBe('LIGHT');
      expect(classifyImdHourlyRate(10.0)).toBe('MODERATE');
      expect(classifyImdHourlyRate(25.0)).toBe('HEAVY');
      expect(classifyImdHourlyRate(42.0)).toBe('VERY_HEAVY');
      expect(classifyImdHourlyRate(75.0)).toBe('TORRENTIAL');
    });
  });

  describe('4. Spatial Geodesic Math & Proximity Fallbacks', () => {
    it('computes exact Haversine distances between known coordinates', () => {
      // Distance between Chennai (13.0827, 80.2707) and Saidapet Bridge (13.0204, 80.2227)
      const dist = haversineDistanceKm(13.0827, 80.2707, 13.0204, 80.2227);
      expect(dist).toBeGreaterThan(8.0);
      expect(dist).toBeLessThan(10.0);
    });

    it('identifies coordinates within 25 km boundary', () => {
      const near = haversineDistanceKm(13.08, 80.27, 13.00, 80.20);
      expect(near).toBeLessThan(25.0);

      const far = haversineDistanceKm(13.08, 80.27, 12.50, 79.50);
      expect(far).toBeGreaterThan(25.0);
    });
  });

  describe('5. Full Service Integration & Data Quality Tests', () => {
    let service: ForecastImpactService;
    let mockGridService: any;
    let mockAlertService: any;

    beforeEach(() => {
      // Mock Grid Service returning a synthetic Chennai sector grid
      mockGridService = {
        getForecastGrid: vi.fn().mockImplementation(async (mode: string, sectorKey: string) => {
          const hourlyChennai = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => (t === 0 ? 0 : 3.5), () => 45.0);
          const hourlyKanchi = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => (t === 0 ? 0 : 1.0), () => 25.0);

          return {
            metadata: {
              provider: 'Open-Meteo',
              model: 'ECMWF IFS Open Data (0.25°)',
              nativeResolution: '0.25° (~28 km) regular lat/lon',
              isFallback: false,
              runCycle: '00Z',
              initializationTime: '2026-11-13T00:00:00.000Z',
              validStartTime: '2026-11-13T00:00:00.000Z',
              validEndTime: '2026-11-15T23:00:00.000Z',
              isStale: false,
            },
            nodes: [
              {
                requestedLat: 13.08,
                requestedLon: 80.27,
                modelLat: 13.08,
                modelLon: 80.27,
                elevationM: 10,
                hourly: hourlyChennai,
              },
              {
                requestedLat: 12.83,
                requestedLon: 79.70,
                modelLat: 12.83,
                modelLon: 79.70,
                elevationM: 80,
                hourly: hourlyKanchi,
              },
            ],
          } as ForecastGridResponse;
        }),
      };

      // Mock Alert Service returning a live IMD Warning for Chennai
      mockAlertService = {
        fetchRawIMDAlerts: vi.fn().mockResolvedValue({
          alerts: [
            {
              id: 'alert_imd_che_01',
              headline: 'HEAVY TO VERY HEAVY RAIN IN CHENNAI DISTRICT',
              severity: 'WARNING',
              issuedAt: '2026-11-13T02:00:00.000Z',
            },
          ],
        }),
        getBoundaryService: vi.fn().mockReturnValue({
          isBulletinMatch: vi.fn().mockImplementation((headline: string, district: string) => {
            return headline.toUpperCase().includes(district.toUpperCase());
          }),
        }),
      };

      service = new ForecastImpactService(mockGridService, undefined, mockAlertService);
    });

    it('generates district impact response with verified prospective accumulations and IMD categorization', async () => {
      const response = await service.getForecastImpact('sector', 'chennai');

      expect(response).toBeDefined();
      expect(response.metadata.mode).toBe('sector');
      expect(response.metadata.activeSector).toBe('chennai');
      expect(response.districts.length).toBeGreaterThan(0);

      // Inspect Chennai district result
      const chennai = response.districts.find((d) => d.district === 'CHENNAI');
      expect(chennai).toBeDefined();

      // Check accumulation: 24h at 3.5mm/h = 84.0 mm -> HEAVY_RAIN
      expect(chennai!.metrics.futureAccum24hMm).toBe(84.0);
      expect(chennai!.classification.imdRainfallCategory).toBe('HEAVY_RAIN');

      // Check 72h null constraint
      expect(chennai!.metrics.futureAccum72hMm).toBeNull();
      expect(chennai!.metrics.accum72hQualityReason).toContain('INSUFFICIENT_FORECAST_HORIZON');

      // Check peak rate and max gust
      expect(chennai!.metrics.peakHourlyRateMmH).toBe(3.5);
      expect(chennai!.metrics.maxWindGustKmh).toBe(45.0);

      // Check separation of official IMD alert from model calculation
      expect(chennai!.classification.officialImdAlert).toBeDefined();
      expect(chennai!.classification.officialImdAlert!.severity).toBe('WARNING');
      expect(chennai!.classification.officialImdAlert!.color).toBe('ORANGE');

      // Check resolution metadata distinction
      expect(response.metadata.nativeResolution).toBe('0.25° (~28 km) regular lat/lon');
      expect(response.metadata.gridSamplingResolution).toContain('0.25° (~28 km) Mesoscale Sector Grid Cluster');

      // Check coverage quality for single-node district (Chennai)
      expect(chennai!.coverage.nodeCount).toBe(1);
      expect(chennai!.coverage.spatialDensity).toBe('SINGLE_NODE_LOCALIZED');
      expect(chennai!.coverage.coverageNotice).toContain('single interior NWP node');

      // Check local exposure: Chennai has 6 choke points and non-inundation disclosure
      expect(chennai!.localExposure.chennaiHistoricalChokepointsCount).toBe(6);
      expect(chennai!.localExposure.verifiedEmergencyFacilitiesCount).toBeGreaterThan(0);
      expect(chennai!.localExposure.exposureNotice).toContain('Geographic co-location in district does NOT imply physical inundation');
    });

    it('does NOT assign Chennai choke points to non-Chennai districts', async () => {
      const response = await service.getForecastImpact('sector', 'chennai');
      const nonChennai = response.districts.find((d) => d.district !== 'CHENNAI');

      if (nonChennai) {
        expect(nonChennai.localExposure.chennaiHistoricalChokepointsCount).toBeUndefined();
        expect(nonChennai.localExposure.exposureNotice).toContain('localized to Chennai Adyar basin');
      }
    });

    it('enforces SYNOPTIC_INDICATIVE disclosure in national mode', async () => {
      // Mock national grid response with 1 synoptic node in central India
      mockGridService.getForecastGrid = vi.fn().mockResolvedValue({
        metadata: {
          provider: 'Open-Meteo',
          model: 'ECMWF IFS Open Data (0.25°)',
          nativeResolution: '1.5° (~160 km) synoptic macro-grid',
          isFallback: false,
          runCycle: '00Z',
          initializationTime: '2026-11-13T00:00:00.000Z',
          validStartTime: '2026-11-13T00:00:00.000Z',
          validEndTime: '2026-11-15T23:00:00.000Z',
          isStale: false,
        },
        nodes: [
          {
            requestedLat: 21.0,
            requestedLon: 79.0,
            modelLat: 21.0,
            modelLon: 79.0,
            elevationM: 300,
            hourly: createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', () => 1.0),
          },
        ],
      });

      const response = await service.getForecastImpact('national');
      expect(response.metadata.scientificDisclaimer).toContain('SYNOPTIC_INDICATIVE_ONLY');

      // Districts far from (21, 79) should be marked INSUFFICIENT_DATA
      const farDistrict = response.districts.find((d) => d.coverage.status === 'INSUFFICIENT_DATA');
      expect(farDistrict).toBeDefined();
      expect(farDistrict!.metrics.futureAccum24hMm).toBeNull();
      expect(farDistrict!.coverage.method).toBe('NONE');
    });

    it('preserves stale cache and fallback metadata flags', async () => {
      mockGridService.getForecastGrid = vi.fn().mockResolvedValue({
        metadata: {
          provider: 'NOAA-GFS-Fallback',
          model: 'NOAA GFS (0.25°)',
          nativeResolution: '0.25° regular lat/lon',
          isFallback: true,
          fallbackReason: 'ECMWF upstream maintenance',
          runCycle: '06Z',
          initializationTime: '2026-11-13T06:00:00.000Z',
          validStartTime: '2026-11-13T06:00:00.000Z',
          validEndTime: '2026-11-16T05:00:00.000Z',
          isStale: true,
          staleReason: 'Upstream quota safety enforced',
        },
        nodes: [],
      });

      const response = await service.getForecastImpact('sector', 'mumbai');
      expect(response.metadata.isFallback).toBe(true);
      expect(response.metadata.fallbackReason).toBe('ECMWF upstream maintenance');
      expect(response.metadata.isStale).toBe(true);
      expect(response.metadata.staleReason).toBe('Upstream quota safety enforced');
    });
  });

  describe('6. HTTP Route Integration: GET /api/weather/forecast-impact', () => {
    const app = createApp();

    it('responds with 200 and typed ForecastImpactResponse for valid sector query', async () => {
      const res = await request(app).get('/api/weather/forecast-impact?mode=sector&sector=chennai');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metadata');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('districts');

      expect(res.body.metadata.mode).toBe('sector');
      expect(res.body.metadata.activeSector).toBe('chennai');
      expect(Array.isArray(res.body.districts)).toBe(true);

      if (res.body.districts.length > 0) {
        const d = res.body.districts[0];
        expect(d).toHaveProperty('district');
        expect(d).toHaveProperty('state');
        expect(d).toHaveProperty('coverage');
        expect(d).toHaveProperty('metrics');
        expect(d).toHaveProperty('dataQuality');
        expect(d).toHaveProperty('classification');
        expect(d).toHaveProperty('localExposure');

        // Check strict interval contract
        expect(d.metrics).toHaveProperty('futureAccum6hMm');
        expect(d.metrics).toHaveProperty('futureAccum12hMm');
        expect(d.metrics).toHaveProperty('futureAccum24hMm');
        expect(d.metrics).toHaveProperty('futureAccum48hMm');
        expect(d.metrics).toHaveProperty('futureAccum72hMm');
        expect(d.metrics.futureAccum72hMm).toBeNull();
      }
    });

    it('rejects invalid grid mode with HTTP 400 and structured error code', async () => {
      const res = await request(app).get('/api/weather/forecast-impact?mode=invalid_mode');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_GRID_MODE');
    });

    it('rejects invalid sector key with HTTP 400 and structured error code', async () => {
      const res = await request(app).get('/api/weather/forecast-impact?mode=sector&sector=tokyo');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SECTOR_KEY');
    });
  });
});
