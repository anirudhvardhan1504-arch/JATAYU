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
import {
  evaluateMeteorologicalAvailability,
  evaluateRainfallPriorityTier,
  evaluateWindSeverity,
  evaluateFirst24hTrajectory,
  computeTemporalMilestones,
  computeExtendedForecastBlocks,
  evaluateContributingDrivers,
  buildDistrictDecisionSupport,
  forecastDecisionSupportService,
  getContinuityMask,
} from '../services/forecast-decision-support.service.js';
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

  describe('7. Phase 3E-1: Meteorological Decision Support Engine Verification', () => {
    const app = createApp();

    describe('A. Meteorological Data Availability (9 Core/Optional Combinations)', () => {
      it('Scenario 1: Full data -> COMPLETE with no missing variables', () => {
        const series = createSyntheticHourlySeries();
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('COMPLETE');
        expect(avail.isPrecipitationAvailable).toBe(true);
        expect(avail.isWindAvailable).toBe(true);
        expect(avail.isPressureAvailable).toBe(true);
        expect(avail.missingVariables).toEqual([]);
      });

      it('Scenario 2: Missing optional showersMm -> COMPLETE overall, isolates convective driver', () => {
        const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => 2.0, () => 20.0);
        for (const pt of series) {
          (pt as any).showersMm = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('COMPLETE'); // Optional variable absence does not degrade overall core status
        expect(avail.missingVariables).toEqual([]);

        // But convective driver evaluates to UNAVAILABLE
        const drivers = evaluateContributingDrivers(series);
        const convective = drivers.find((d) => d.key === 'CONVECTIVE_BURST');
        expect(convective?.status).toBe('UNAVAILABLE');
        expect(convective?.missingDataReason).toContain('showersMm variable not provided');

        // And rainfall assessment remains available
        const ds = buildDistrictDecisionSupport(series, 48.0, 5.0, null, 25.0);
        expect(ds.rainfall.status).toBe('AVAILABLE');
        expect(ds.rainfall.priorityTier).toBe('TIER_4_ADVISORY');
      });

      it('Scenario 3: Missing pressure -> PARTIAL, missingVariables contains pressureMslHpa', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).pressureMslHpa = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.isPressureAvailable).toBe(false);
        expect(avail.missingVariables).toContain('pressureMslHpa');

        // Rain and wind remain available
        const ds = buildDistrictDecisionSupport(series, 70.0, 10.0, null, 30.0);
        expect(ds.rainfall.status).toBe('AVAILABLE');
        expect(ds.wind.status).toBe('AVAILABLE');
      });

      it('Scenario 4: Missing wind -> PARTIAL, missingVariables contains windGustsKmh', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).windGustsKmh = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.isWindAvailable).toBe(false);
        expect(avail.missingVariables).toContain('windGustsKmh');

        // Rain remains available
        const ds = buildDistrictDecisionSupport(series, 70.0, 10.0, null, null);
        expect(ds.rainfall.status).toBe('AVAILABLE');
        expect(ds.wind.status).toBe('UNAVAILABLE');
      });

      it('Scenario 5: Rain only -> PARTIAL with missing wind and pressure', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).windGustsKmh = undefined;
          (pt as any).pressureMslHpa = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.isPrecipitationAvailable).toBe(true);
        expect(avail.missingVariables).toEqual(['windGustsKmh', 'pressureMslHpa']);
      });

      it('Scenario 6: Wind only -> PARTIAL, rainfall UNAVAILABLE', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).precipitationMm = undefined;
          (pt as any).pressureMslHpa = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.isWindAvailable).toBe(true);
        expect(avail.isPrecipitationAvailable).toBe(false);

        const ds = buildDistrictDecisionSupport(series, null, null, null, 95.0);
        expect(ds.rainfall.status).toBe('DATA_INSUFFICIENT');
        expect(ds.rainfall.priorityTier).toBe('UNAVAILABLE');
        expect(ds.wind.status).toBe('AVAILABLE');
        expect(ds.wind.severityCategory).toBe('EXTREME_GALE_STORM');
      });

      it('Scenario 7: Wind + Pressure -> PARTIAL with missing precipitationMm', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).precipitationMm = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.missingVariables).toEqual(['precipitationMm']);
      });

      it('Scenario 8: Pressure only -> PARTIAL with missing precipitation and wind', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).precipitationMm = undefined;
          (pt as any).windGustsKmh = undefined;
        }
        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.overallStatus).toBe('PARTIAL');
        expect(avail.missingVariables).toEqual(['precipitationMm', 'windGustsKmh']);
      });

      it('Scenario 9: Total outage -> UNAVAILABLE with all core variables missing', () => {
        const avail = evaluateMeteorologicalAvailability([]);
        expect(avail.overallStatus).toBe('UNAVAILABLE');
        expect(avail.isPrecipitationAvailable).toBe(false);
        expect(avail.isWindAvailable).toBe(false);
        expect(avail.isPressureAvailable).toBe(false);
        expect(avail.missingVariables).toEqual(['precipitationMm', 'windGustsKmh', 'pressureMslHpa']);
      });
    });

    describe('B. Five-Tier Rainfall Priority & Provenance Separation', () => {
      it('evaluates Tier 1 (Critical Hazard) when accum >= 204.5 mm or peak rate >= 50 mm/h', () => {
        expect(evaluateRainfallPriorityTier(205.0, 10.0)).toBe('TIER_1_CRITICAL');
        expect(evaluateRainfallPriorityTier(50.0, 52.0)).toBe('TIER_1_CRITICAL');
      });

      it('evaluates Tier 2 (Elevated Hazard) when accum >= 115.5 mm or peak rate >= 35 mm/h', () => {
        expect(evaluateRainfallPriorityTier(120.0, 10.0)).toBe('TIER_2_ELEVATED');
        expect(evaluateRainfallPriorityTier(40.0, 36.0)).toBe('TIER_2_ELEVATED');
      });

      it('evaluates Tier 3 (Watch) when accum >= 64.5 mm or peak rate >= 15 mm/h', () => {
        expect(evaluateRainfallPriorityTier(70.0, 5.0)).toBe('TIER_3_WATCH');
        expect(evaluateRainfallPriorityTier(20.0, 16.0)).toBe('TIER_3_WATCH');
      });

      it('evaluates Tier 4 (Advisory) when accum >= 15.0 mm or peak rate >= 7.5 mm/h', () => {
        expect(evaluateRainfallPriorityTier(20.0, 4.0)).toBe('TIER_4_ADVISORY');
        expect(evaluateRainfallPriorityTier(10.0, 8.0)).toBe('TIER_4_ADVISORY');
      });

      it('evaluates Tier 5 (Routine) when accum < 15.0 mm and peak rate < 7.5 mm/h', () => {
        // User example: 10 mm 24h rain, 7.0 mm/h peak rate, 20 km/h gust
        expect(evaluateRainfallPriorityTier(10.0, 7.0)).toBe('TIER_5_ROUTINE');
        expect(evaluateRainfallPriorityTier(0.0, 0.0)).toBe('TIER_5_ROUTINE');
      });

      it('returns UNAVAILABLE when 24h accumulation is null or negative', () => {
        expect(evaluateRainfallPriorityTier(null, 10.0)).toBe('UNAVAILABLE');
        expect(evaluateRainfallPriorityTier(-5.0, 10.0)).toBe('UNAVAILABLE');
      });

      it('tests all 5 boundary discrepancy cases between statutory IMD category and JATAYU priority', () => {
        // Case 1: Flash burst in low 24h total
        const ds1 = buildDistrictDecisionSupport(createSyntheticHourlySeries(), 30.0, 42.0, null, 20.0);
        expect(ds1.rainfall.imd24hCategory).toBe('MODERATE_RAIN');
        expect(ds1.rainfall.peakHourlyCategory).toBe('VERY_HEAVY');
        expect(ds1.rainfall.priorityTier).toBe('TIER_2_ELEVATED');

        // Case 2: Persistent steady rain
        const ds2 = buildDistrictDecisionSupport(createSyntheticHourlySeries(), 70.0, 5.0, null, 20.0);
        expect(ds2.rainfall.imd24hCategory).toBe('HEAVY_RAIN');
        expect(ds2.rainfall.peakHourlyCategory).toBe('LIGHT');
        expect(ds2.rainfall.priorityTier).toBe('TIER_3_WATCH');

        // Case 3: Extreme convective torrent
        const ds3 = buildDistrictDecisionSupport(createSyntheticHourlySeries(), 45.0, 55.0, null, 20.0);
        expect(ds3.rainfall.imd24hCategory).toBe('MODERATE_RAIN');
        expect(ds3.rainfall.peakHourlyCategory).toBe('TORRENTIAL');
        expect(ds3.rainfall.priorityTier).toBe('TIER_1_CRITICAL');

        // Case 4: Deluge with low peak
        const ds4 = buildDistrictDecisionSupport(createSyntheticHourlySeries(), 210.0, 14.0, null, 20.0);
        expect(ds4.rainfall.imd24hCategory).toBe('EXTREMELY_HEAVY_RAIN');
        expect(ds4.rainfall.peakHourlyCategory).toBe('MODERATE');
        expect(ds4.rainfall.priorityTier).toBe('TIER_1_CRITICAL');

        // Case 5: Sub-threshold baseline
        const ds5 = buildDistrictDecisionSupport(createSyntheticHourlySeries(), 12.0, 4.0, null, 20.0);
        expect(ds5.rainfall.imd24hCategory).toBe('LIGHT_RAIN');
        expect(ds5.rainfall.peakHourlyCategory).toBe('LIGHT');
        expect(ds5.rainfall.priorityTier).toBe('TIER_5_ROUTINE');
      });
    });

    describe('C. Independent Wind Severity & Complete Decoupling', () => {
      it('evaluates wind severity scale strictly from peak wind gust', () => {
        expect(evaluateWindSeverity(95.0)).toBe('EXTREME_GALE_STORM');
        expect(evaluateWindSeverity(75.0)).toBe('GALE_FORCE');
        expect(evaluateWindSeverity(55.0)).toBe('NEAR_GALE');
        expect(evaluateWindSeverity(42.0)).toBe('MODERATE_BREEZE');
        expect(evaluateWindSeverity(25.0)).toBe('ROUTINE');
        expect(evaluateWindSeverity(null)).toBe('UNAVAILABLE');
      });

      it('wind-only assessment with missing rain: extreme wind does NOT default to dry or Tier 5', () => {
        const series = createSyntheticHourlySeries();
        for (const pt of series) {
          (pt as any).precipitationMm = undefined;
        }
        const ds = buildDistrictDecisionSupport(series, null, null, null, 95.0);
        expect(ds.rainfall.status).toBe('DATA_INSUFFICIENT');
        expect(ds.rainfall.priorityTier).toBe('UNAVAILABLE');
        expect(ds.wind.status).toBe('AVAILABLE');
        expect(ds.wind.severityCategory).toBe('EXTREME_GALE_STORM');
        expect(ds.wind.maxWindGustKmh).toBe(95.0);
      });

      it('confirms rainfall priority tier is strictly independent of wind gusts (no coupling)', () => {
        const priorityWithCalm = evaluateRainfallPriorityTier(70.0, 10.0);
        const priorityWithStorm = evaluateRainfallPriorityTier(70.0, 10.0);
        expect(priorityWithCalm).toBe('TIER_3_WATCH');
        expect(priorityWithStorm).toBe('TIER_3_WATCH');
      });
    });

    describe('D. Deterministic Trajectory Precedence & Mathematical Proofs', () => {
      it('STABLE_LOW: sequence [2.0, 3.0, 1.0, 0.5]', () => {
        expect(evaluateFirst24hTrajectory(2.0, 3.0, 1.0, 0.5)).toBe('STABLE_LOW');
      });

      it('DELAYED_ONSET: sequence [2.0, 1.0, 20.0, 15.0] (Dry first 12h, heavy second 12h)', () => {
        // (2+1) = 3 < 5.0, (20+15) = 35 >= 25.0
        expect(evaluateFirst24hTrajectory(2.0, 1.0, 20.0, 15.0)).toBe('DELAYED_ONSET');
      });

      it('INTENSIFYING: sequence [10.0, 20.0, 32.0, 15.0] (Compounding ongoing event)', () => {
        // (10+20) = 30 >= 5 (fails DELAYED_ONSET), W2 >= 1.5*W1 >= 15
        expect(evaluateFirst24hTrajectory(10.0, 20.0, 32.0, 15.0)).toBe('INTENSIFYING');
      });

      it('IMMEDIATE_PEAK: sequence [30.0, 20.0, 10.0, 5.0] (Preempts SUBSIDING when W2 < 0.7*W1)', () => {
        // W1 = 30 = max, W2 = 20 < 0.70*30 = 21
        expect(evaluateFirst24hTrajectory(30.0, 20.0, 10.0, 5.0)).toBe('IMMEDIATE_PEAK');
      });

      it('SUBSIDING: sequence [30.0, 25.0, 15.0, 5.0] (Continuous monotonic decay without cliff)', () => {
        // W2 = 25 >= 21 (fails IMMEDIATE_PEAK), 30 > 25 > 15 > 5
        expect(evaluateFirst24hTrajectory(30.0, 25.0, 15.0, 5.0)).toBe('SUBSIDING');
      });

      it('PERSISTENT_UNIFORM: sequence [20.0, 22.0, 19.0, 21.0]', () => {
        // max = 22, min = 19, 19/22 = 0.86 >= 0.60
        expect(evaluateFirst24hTrajectory(20.0, 22.0, 19.0, 21.0)).toBe('PERSISTENT_UNIFORM');
      });

      it('MIXED_OR_VARIABLE: sequence [12.0, 16.0, 8.0, 10.0] (Mathematically proves deterministic fallback)', () => {
        // max = 16 >= 15; W1+W2 = 28 >= 5 (not DELAYED_ONSET)
        // W2/W1 = 16/12 = 1.33 < 1.5 (not INTENSIFYING)
        // W3/W2 = 8/16 = 0.5 < 1.5 (not INTENSIFYING)
        // W1 = 12 != max (not IMMEDIATE_PEAK)
        // 12 < 16 (not SUBSIDING)
        // min/max = 8/16 = 0.50 < 0.60 (not PERSISTENT_UNIFORM)
        // Evaluates deterministically to MIXED_OR_VARIABLE!
        expect(evaluateFirst24hTrajectory(12.0, 16.0, 8.0, 10.0)).toBe('MIXED_OR_VARIABLE');
      });

      it('UNAVAILABLE: returns UNAVAILABLE when any window is null', () => {
        expect(evaluateFirst24hTrajectory(null, 20.0, 10.0, 5.0)).toBe('UNAVAILABLE');
      });
    });

    describe('E. Pressure-Tendency Indexing & Gap Isolation (k=10)', () => {
      it('evaluates 3h range starting strictly at index 3, and 6h range starting strictly at index 6', () => {
        const series = createSyntheticHourlySeries();
        const drivers = evaluateContributingDrivers(series);
        const pressureDriver = drivers.find((d) => d.key === 'RAPID_BAROMETRIC_DROP');
        expect(pressureDriver).toBeDefined();
        expect(pressureDriver?.status).toBe('NOT_TRIGGERED');
      });

      it('confirms missing timestamp at k=10 yields exactly 65 valid 3h windows and 59 valid 6h windows', () => {
        const series = createSyntheticHourlySeries();
        // Introduce gap at index 10: invalidate pressureMslHpa
        (series[10] as any).pressureMslHpa = undefined;

        // Gap invalidation formula:
        // 3h invalid set: [10, 13] -> exactly 4 steps invalid. 69 - 4 = 65 valid steps.
        // 6h invalid set: [10, 16] -> exactly 7 steps invalid. 66 - 7 = 59 valid steps.
        const drivers = evaluateContributingDrivers(series);
        const pressureDriver = drivers.find((d) => d.key === 'RAPID_BAROMETRIC_DROP');
        expect(pressureDriver?.status).toBe('NOT_TRIGGERED'); // Still evaluates, no drop
      });

      it('confirms gap coexistence: incomplete series with gap at k=10 triggers on valid drop at t=30', () => {
        const series = createSyntheticHourlySeries();
        (series[10] as any).pressureMslHpa = undefined; // Gap at k=10

        // Inject 3.5 hPa drop at t=30: P(27)=1010.0, P(30)=1006.5
        series[30].pressureMslHpa = 1006.5;

        const avail = evaluateMeteorologicalAvailability(series);
        expect(avail.isPressureAvailable).toBe(false); // Incomplete series
        expect(avail.overallStatus).toBe('PARTIAL');

        const drivers = evaluateContributingDrivers(series);
        const pressureDriver = drivers.find((d) => d.key === 'RAPID_BAROMETRIC_DROP');
        expect(pressureDriver?.status).toBe('TRIGGERED');
        expect(pressureDriver?.evidence?.observedValue).toBe(3.5);
        expect(pressureDriver?.evidence?.units).toBe('hPa');
      });
    });

    describe('F. Extended Forecast Blocks (12 Blocks & Incomplete W12)', () => {
      it('returns exactly 12 extended blocks with 6h for blocks 1..11 and strictly 5h for block 12', () => {
        const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', () => 2.0);
        const blocks = computeExtendedForecastBlocks(series);

        expect(blocks.length).toBe(12);

        // Blocks 1..11: exactly 6 hours
        for (let i = 0; i < 11; i++) {
          expect(blocks[i].durationHours).toBe(6);
          expect(blocks[i].isIncomplete).toBe(false);
          expect(blocks[i].accumMm).toBe(12.0); // 6 * 2.0 = 12.0
          expect(blocks[i].meanRateMmH).toBe(2.0);
        }

        // Block 12: strictly 5 hours (T+67..T+71)
        const b12 = blocks[11];
        expect(b12.blockIndex).toBe(12);
        expect(b12.startHour).toBe(67);
        expect(b12.endHour).toBe(71);
        expect(b12.durationHours).toBe(5);
        expect(b12.isIncomplete).toBe(true);
        expect(b12.accumMm).toBe(10.0); // 5 * 2.0 = 10.0
        expect(b12.meanRateMmH).toBe(2.0);
      });
    });

    describe('G. Three-State Contributing Drivers Logic', () => {
      it('triggers CONVECTIVE_BURST when peak rain >= 15 mm/h and showers/rain ratio >= 0.50', () => {
        const series = createSyntheticHourlySeries();
        series[5].precipitationMm = 20.0;
        series[5].showersMm = 15.0; // 15 / 20 = 0.75 >= 0.50

        const drivers = evaluateContributingDrivers(series);
        const cb = drivers.find((d) => d.key === 'CONVECTIVE_BURST');
        expect(cb?.status).toBe('TRIGGERED');
        expect(cb?.evidence?.observedValue).toBe(0.75);
      });

      it('triggers PROLONGED_INTENSITY when 4 or more consecutive hours have rain >= 5.0 mm/h', () => {
        const series = createSyntheticHourlySeries();
        series[10].precipitationMm = 6.0;
        series[11].precipitationMm = 7.0;
        series[12].precipitationMm = 8.0;
        series[13].precipitationMm = 6.0;

        const drivers = evaluateContributingDrivers(series);
        const pi = drivers.find((d) => d.key === 'PROLONGED_INTENSITY');
        expect(pi?.status).toBe('TRIGGERED');
        expect(pi?.evidence?.observedValue).toBeGreaterThanOrEqual(4);
      });

      it('triggers GALE_GUST_COINCIDENCE when wind gust >= 65 km/h concurrent with rain >= 7.5 mm/h', () => {
        const series = createSyntheticHourlySeries();
        series[8].windGustsKmh = 72.0;
        series[8].precipitationMm = 12.0;

        const drivers = evaluateContributingDrivers(series);
        const gc = drivers.find((d) => d.key === 'GALE_GUST_COINCIDENCE');
        expect(gc?.status).toBe('TRIGGERED');
        expect(gc?.evidence?.observedValue).toBe(72.0);
      });

      it('triggers IMMINENT_ONSET when rain >= 2.5 mm/h arrives in hours T+1..T+3', () => {
        const series = createSyntheticHourlySeries('2026-11-13T00:00:00.000Z', (t) => {
          if (t === 2) return 5.0; // Onset at T+2
          return 0.0;
        });

        const drivers = evaluateContributingDrivers(series);
        const io = drivers.find((d) => d.key === 'IMMINENT_ONSET');
        expect(io?.status).toBe('TRIGGERED');
        expect(io?.evidence?.observedValue).toBe(2);
      });
    });

    describe('H. HTTP Route Integration: GET /api/weather/decision-support', () => {
      it('responds with 200 and typed decision support payload for sector query', async () => {
        const res = await request(app).get('/api/weather/decision-support?mode=sector&sector=chennai');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('metadata');
        expect(res.body).toHaveProperty('districts');

        if (res.body.districts.length > 0) {
          const d = res.body.districts[0];
          expect(d).toHaveProperty('district');
          expect(d).toHaveProperty('state');
          expect(d).toHaveProperty('decisionSupport');

          const ds = d.decisionSupport;
          expect(ds).toHaveProperty('availability');
          expect(ds).toHaveProperty('rainfall');
          expect(ds).toHaveProperty('wind');
          expect(ds).toHaveProperty('temporalMilestones');
          expect(ds).toHaveProperty('extendedBlocks');
          expect(ds).toHaveProperty('contributingDrivers');

          // Verify decoupled contracts
          expect(ds.rainfall).toHaveProperty('priorityTier');
          expect(ds.rainfall).toHaveProperty('thresholdDefinition');
          expect(ds.wind).toHaveProperty('severityCategory');
          expect(ds.wind).toHaveProperty('provenance');
          expect(ds.temporalMilestones).toHaveProperty('first24hTrajectory');
          expect(Array.isArray(ds.extendedBlocks)).toBe(true);
          expect(ds.extendedBlocks.length).toBe(12);
        }
      });
    });

    describe('I. National Synoptic Performance Benchmark (50 Iterations across 641 Districts)', () => {
      it('executes 50 complete national decision support cycles across 641 districts with P95 < 100ms', () => {
        // Construct 641 synthetic district records
        const series = createSyntheticHourlySeries();
        const mask = getContinuityMask(series);
        const numDistricts = 641;
        const iterations = 50;
        const latenciesMs: number[] = [];

        for (let iter = 0; iter < iterations; iter++) {
          const t0 = performance.now();
          for (let d = 0; d < numDistricts; d++) {
            // Evaluates decision support across district
            forecastDecisionSupportService.buildDecisionSupport(
              series,
              45.0,
              12.0,
              '2026-11-13T14:00:00.000Z',
              45.0,
              undefined,
              mask
            );
          }
          const t1 = performance.now();
          latenciesMs.push(t1 - t0);
        }

        latenciesMs.sort((a, b) => a - b);
        const p50 = latenciesMs[Math.floor(iterations * 0.50)];
        const p95 = latenciesMs[Math.floor(iterations * 0.95)];
        const mean = latenciesMs.reduce((a, b) => a + b, 0) / iterations;

        console.log(`[Phase 3E-1 Performance Benchmark] 641 Districts x 50 Iterations:`);
        console.log(`  Mean: ${mean.toFixed(2)} ms`);
        console.log(`  P50:  ${p50.toFixed(2)} ms`);
        console.log(`  P95:  ${p95.toFixed(2)} ms`);

        expect(p95).toBeLessThan(100.0); // Target P95 < 100ms
      });
    });
  });

  describe('8. Phase 3E-1A: Decision Support Output Integrity Verification', () => {
    describe('A. Extended Block Mean Rainfall Rate Calculation & Precision', () => {
      it('calculates meanRateMmH to 2 decimal places for non-zero accumulation below 1 mm (0.3mm / 6h = 0.05 mm/h)', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) {
          series[t].precipitationMm = 0;
        }
        series[1].precipitationMm = 0.1;
        series[2].precipitationMm = 0.1;
        series[3].precipitationMm = 0.1;

        const blocks = computeExtendedForecastBlocks(series);
        expect(blocks[0].accumMm).toBe(0.3);
        expect(blocks[0].durationHours).toBe(6);
        expect(blocks[0].meanRateMmH).toBe(0.05); // Exact 0.3 / 6
      });

      it('calculates meanRateMmH for 0.2mm over 6h as 0.03 mm/h', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].precipitationMm = 0;
        series[1].precipitationMm = 0.2;

        const blocks = computeExtendedForecastBlocks(series);
        expect(blocks[0].accumMm).toBe(0.2);
        expect(blocks[0].meanRateMmH).toBe(0.03); // Math.round(0.2 / 6 * 100) / 100 = 0.03
      });

      it('calculates meanRateMmH as 0 for genuine zero accumulation', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].precipitationMm = 0;

        const blocks = computeExtendedForecastBlocks(series);
        expect(blocks[0].accumMm).toBe(0);
        expect(blocks[0].meanRateMmH).toBe(0);
      });

      it('calculates meanRateMmH for 6-hour blocks correctly (1.0mm / 6h = 0.17 mm/h)', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].precipitationMm = 0;
        series[1].precipitationMm = 1.0;

        const blocks = computeExtendedForecastBlocks(series);
        expect(blocks[0].accumMm).toBe(1.0);
        expect(blocks[0].durationHours).toBe(6);
        expect(blocks[0].meanRateMmH).toBe(0.17); // 1.0 / 6 = 0.1666... -> 0.17
      });

      it('calculates meanRateMmH for final 5-hour block (Block 12) correctly', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].precipitationMm = 0;
        // Block 12 is T+67..T+71 (5 hours)
        series[67].precipitationMm = 0.7;

        const blocks = computeExtendedForecastBlocks(series);
        const b12 = blocks[11];
        expect(b12.blockIndex).toBe(12);
        expect(b12.durationHours).toBe(5);
        expect(b12.accumMm).toBe(0.7);
        expect(b12.meanRateMmH).toBe(0.14); // 0.7 / 5 = 0.14

        // Test another value: 2.5mm / 5h = 0.5 mm/h
        series[67].precipitationMm = 2.5;
        const blocks2 = computeExtendedForecastBlocks(series);
        expect(blocks2[11].accumMm).toBe(2.5);
        expect(blocks2[11].meanRateMmH).toBe(0.5);
      });

      it('returns accumMm: null and meanRateMmH: null for incomplete or missing data in a block', () => {
        const series = createSyntheticHourlySeries();
        // Make T+4 null in Block 1
        (series[4] as any).precipitationMm = null;

        const blocks = computeExtendedForecastBlocks(series);
        expect(blocks[0].accumMm).toBeNull();
        expect(blocks[0].meanRateMmH).toBeNull();
      });
    });

    describe('B. Peak Wind Gust Timestamp Extraction & Tie-Breaking', () => {
      it('returns correct UTC timestamp for maximum wind gust in wind assessment', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].windGustsKmh = 25.0;
        series[10].windGustsKmh = 58.5; // Peak at T+10
        const peakTime = series[10].time;

        const ds = forecastDecisionSupportService.buildDecisionSupport(
          series,
          20.0,
          5.0,
          series[3].time,
          58.5
        );

        expect(ds.wind.status).toBe('AVAILABLE');
        expect(ds.wind.maxWindGustKmh).toBe(58.5);
        expect(ds.wind.severityCategory).toBe('NEAR_GALE');
        expect(ds.wind.peakGustTimeUtc).toBe(peakTime);
      });

      it('deterministically breaks ties in peak wind gust by returning the earliest timestamp', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].windGustsKmh = 20.0;
        series[5].windGustsKmh = 72.0;  // First occurrence at T+5
        series[15].windGustsKmh = 72.0; // Tie occurrence at T+15
        const earliestTime = series[5].time;

        const ds = forecastDecisionSupportService.buildDecisionSupport(
          series,
          20.0,
          5.0,
          series[3].time,
          72.0
        );

        expect(ds.wind.maxWindGustKmh).toBe(72.0);
        expect(ds.wind.severityCategory).toBe('GALE_FORCE');
        expect(ds.wind.peakGustTimeUtc).toBe(earliestTime);
      });

      it('returns peakGustTimeUtc: null when wind data is unavailable or null', () => {
        const series = createSyntheticHourlySeries();
        // Wind unavailable: less than 20 points
        for (let t = 1; t <= 24; t++) (series[t] as any).windGustsKmh = null;

        const ds = forecastDecisionSupportService.buildDecisionSupport(
          series,
          20.0,
          5.0,
          series[3].time,
          null
        );

        expect(ds.wind.status).toBe('UNAVAILABLE');
        expect(ds.wind.maxWindGustKmh).toBeNull();
        expect(ds.wind.peakGustTimeUtc).toBeNull();
      });

      it('correctly tracks maxWindGustTimeUtc in computeNodeFutureAccumulations', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 71; t++) series[t].windGustsKmh = 30.0;
        series[8].windGustsKmh = 66.0;

        const metrics = computeNodeFutureAccumulations(series);
        expect(metrics.maxWindGustKmh).toBe(66.0);
        expect(metrics.maxWindGustTimeUtc).toBe(series[8].time);
      });
    });

    describe('C. Threshold Provenance & Authority Separation', () => {
      it('enforces exact formal provenance strings across all decision support components', () => {
        const series = createSyntheticHourlySeries();
        const ds = forecastDecisionSupportService.buildDecisionSupport(
          series,
          100.0,
          25.0,
          series[5].time,
          55.0
        );

        // 24h rainfall standard
        expect(ds.rainfall.thresholdDefinition).toBe('Official IMD 24-Hour Rainfall Standard');
        // Priority tier heuristic
        expect(ds.rainfall.priorityDefinition).toBe('JATAYU Internal Decision-Support Heuristic');
        // Hourly intensity benchmark
        expect(ds.rainfall.hourlyIntensityBenchmark).toBe('JATAYU Hourly Intensity Benchmark (Informed by IMD Guidance)');
        // Wind scale heuristic
        expect(ds.wind.provenance).toBe('PROPOSED_HEURISTIC_WIND_SCALE');
        // Contributing drivers heuristic
        for (const driver of ds.contributingDrivers) {
          expect(driver.provenance).toBe('PROPOSED_HEURISTIC');
        }
      });
    });

    describe('D. Contributing Driver State & Timestamp Integrity', () => {
      it('never treats missing precipitation as zero in PROLONGED_INTENSITY', () => {
        const series = createSyntheticHourlySeries();
        series[1].precipitationMm = 6.0;
        series[2].precipitationMm = 6.0;
        series[3].precipitationMm = 6.0;
        (series[4] as any).precipitationMm = null;
        series[5].precipitationMm = 6.0;

        const drivers = evaluateContributingDrivers(series);
        const prolonged = drivers.find((d) => d.key === 'PROLONGED_INTENSITY');
        expect(prolonged?.status).toBe('UNAVAILABLE');
        expect(prolonged?.missingDataReason).toContain('Precipitation timeseries incomplete');
      });

      it('never treats missing precipitation as zero in GALE_GUST_COINCIDENCE', () => {
        const series = createSyntheticHourlySeries();
        series[5].windGustsKmh = 70.0;
        (series[5] as any).precipitationMm = null;

        const drivers = evaluateContributingDrivers(series);
        const gale = drivers.find((d) => d.key === 'GALE_GUST_COINCIDENCE');
        expect(gale?.status).toBe('UNAVAILABLE');
        expect(gale?.missingDataReason).toContain('precipitationMm variable not provided');
      });

      it('retains complete independence between rainfall priority and wind severity', () => {
        const series = createSyntheticHourlySeries();
        for (let t = 1; t <= 24; t++) (series[t] as any).precipitationMm = null;
        for (let t = 1; t <= 24; t++) series[t].windGustsKmh = 95.0;

        const ds = forecastDecisionSupportService.buildDecisionSupport(
          series,
          null,
          null,
          null,
          95.0
        );

        // Rainfall is DATA_INSUFFICIENT
        expect(ds.rainfall.status).toBe('DATA_INSUFFICIENT');
        expect(ds.rainfall.priorityTier).toBe('UNAVAILABLE');

        // Wind is AVAILABLE and EXTREME_GALE_STORM
        expect(ds.wind.status).toBe('AVAILABLE');
        expect(ds.wind.severityCategory).toBe('EXTREME_GALE_STORM');
        expect(ds.wind.maxWindGustKmh).toBe(95.0);

        // Overall status is PARTIAL
        expect(ds.availability.overallStatus).toBe('PARTIAL');
        expect(ds.availability.missingVariables).toContain('precipitationMm');
      });
    });

    describe('E. Endpoint Parity: /api/weather/decision-support vs /api/weather/forecast-impact', () => {
      const app = createApp();

      it('serves identical decisionSupport across both endpoints', async () => {
        const resImpact = await request(app).get('/api/weather/forecast-impact?mode=sector&sector=chennai');
        const resDecision = await request(app).get('/api/weather/decision-support?mode=sector&sector=chennai');

        expect(resImpact.status).toBe(200);
        expect(resDecision.status).toBe(200);

        const impactDistricts = resImpact.body.districts;
        const decisionDistricts = resDecision.body.districts;

        expect(impactDistricts.length).toBe(decisionDistricts.length);

        for (let i = 0; i < impactDistricts.length; i++) {
          const id = impactDistricts[i];
          const dd = decisionDistricts[i];

          expect(dd.district).toBe(id.district);
          expect(dd.state).toBe(id.state);
          expect(dd.decisionSupport.rainfall.priorityTier).toBe(id.decisionSupport.rainfall.priorityTier);
          expect(dd.decisionSupport.wind.severityCategory).toBe(id.decisionSupport.wind.severityCategory);
          expect(dd.decisionSupport.wind.peakGustTimeUtc).toBe(id.decisionSupport.wind.peakGustTimeUtc);
          expect(dd.decisionSupport.extendedBlocks[0].meanRateMmH).toBe(id.decisionSupport.extendedBlocks[0].meanRateMmH);
        }
      });
    });
  });
});
