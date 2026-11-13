import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  ForecastGridService,
  calculateWindVelocityVectors,
  generateSectorClusterCoordinates,
  generateNationalSynopticCoordinates,
  OPERATIONAL_SECTOR_CLUSTERS,
} from '../services/forecast-grid.service.js';

describe('Phase 3B-1: Forecast Grid Service & Mathematical Physics Verification', () => {
  describe('1. Wind Aerodynamic Vector Decomposition (u, v)', () => {
    it('accurately derives u and v vectors with verified sign and magnitude for cardinal directions', () => {
      const speedKmh = 36; // 10 m/s

      // Case 1: Wind from North (0°) -> Blows Southward (u=0, v=-10)
      const north = calculateWindVelocityVectors(speedKmh, 0);
      expect(north.uMs).toBeCloseTo(0, 1);
      expect(north.vMs).toBeCloseTo(-10, 1);

      // Case 2: Wind from East (90°) -> Blows Westward (u=-10, v=0)
      const east = calculateWindVelocityVectors(speedKmh, 90);
      expect(east.uMs).toBeCloseTo(-10, 1);
      expect(east.vMs).toBeCloseTo(0, 1);

      // Case 3: Wind from South (180°) -> Blows Northward (u=0, v=+10)
      const south = calculateWindVelocityVectors(speedKmh, 180);
      expect(south.uMs).toBeCloseTo(0, 1);
      expect(south.vMs).toBeCloseTo(10, 1);

      // Case 4: Wind from West (270°) -> Blows Eastward (u=+10, v=0)
      const west = calculateWindVelocityVectors(speedKmh, 270);
      expect(west.uMs).toBeCloseTo(10, 1);
      expect(west.vMs).toBeCloseTo(0, 1);

      // Case 5: Calm wind (0 km/h) -> (u=0, v=0)
      const calm = calculateWindVelocityVectors(0, 45);
      expect(calm.uMs).toBe(0);
      expect(calm.vMs).toBe(0);

      // Case 6: South-Westerly Monsoon flow (225° at 36 km/h) -> (u=+7.07, v=+7.07)
      const monsoon = calculateWindVelocityVectors(speedKmh, 225);
      expect(monsoon.uMs).toBeCloseTo(7.07, 1);
      expect(monsoon.vMs).toBeCloseTo(7.07, 1);
    });
  });

  describe('2. Hierarchical Grid Coordinate Generation & Sectors', () => {
    it('generates exact 7x7 (49) mesoscale coordinates for all 5 operational sectors at 0.25° spacing', () => {
      const sectors = Object.keys(OPERATIONAL_SECTOR_CLUSTERS) as Array<keyof typeof OPERATIONAL_SECTOR_CLUSTERS>;
      expect(sectors).toEqual(['mumbai', 'chennai', 'guwahati', 'kolkata', 'dehradun']);

      for (const sectorKey of sectors) {
        const coords = generateSectorClusterCoordinates(sectorKey);
        expect(coords.length).toBe(49);

        // Verify latitude and longitude bounds
        const sectorDef = OPERATIONAL_SECTOR_CLUSTERS[sectorKey];
        coords.forEach((c) => {
          expect(c.latitude).toBeGreaterThanOrEqual(sectorDef.latRange[0]);
          expect(c.latitude).toBeLessThanOrEqual(sectorDef.latRange[1]);
          expect(c.longitude).toBeGreaterThanOrEqual(sectorDef.lonRange[0]);
          expect(c.longitude).toBeLessThanOrEqual(sectorDef.lonRange[1]);
          expect(c.sectorKey).toBe(sectorKey);
        });

        // Exactly one centroid
        const centroids = coords.filter((c) => c.isSectorCentroid);
        expect(centroids.length).toBe(1);
      }
    });

    it('generates national synoptic grid within Indian territorial bounds', () => {
      const synoptic = generateNationalSynopticCoordinates(1.5);
      expect(synoptic.length).toBeGreaterThan(50);
      synoptic.forEach((c) => {
        expect(c.latitude).toBeGreaterThanOrEqual(8.0);
        expect(c.latitude).toBeLessThanOrEqual(36.0);
        expect(c.longitude).toBeGreaterThanOrEqual(68.0);
        expect(c.longitude).toBeLessThanOrEqual(96.0);
      });
    });
  });

  describe('3. Forecast Grid Service Upstream Mocking, Deduplication & Failover', () => {
    let service: ForecastGridService;

    // Helper to generate a realistic mock Open-Meteo response
    function createMockResponse(lats: number[], lons: number[], baseTemp: number = 25) {
      return lats.map((lat, idx) => ({
        latitude: Math.round(lat * 4) / 4, // Snap to 0.25° grid
        longitude: Math.round(lons[idx] * 4) / 4,
        elevation: 10,
        hourly: {
          time: Array.from({ length: 72 }, (_, h) => {
            const d = new Date(Date.UTC(2026, 10, 13, h, 0, 0));
            return d.toISOString().slice(0, 16);
          }),
          temperature_2m: Array.from({ length: 72 }, (_, h) => baseTemp + Math.sin(h / 6) * 5),
          apparent_temperature: Array.from({ length: 72 }, (_, h) => baseTemp + 2),
          relative_humidity_2m: Array.from({ length: 72 }, () => 70),
          precipitation: Array.from({ length: 72 }, (_, h) => (h % 12 === 0 ? 5.5 : 0.5)),
          rain: Array.from({ length: 72 }, () => 0.5),
          showers: Array.from({ length: 72 }, () => 0),
          pressure_msl: Array.from({ length: 72 }, () => 1012.5),
          surface_pressure: Array.from({ length: 72 }, () => 1011.0),
          wind_speed_10m: Array.from({ length: 72 }, () => 18), // 18 km/h = 5 m/s
          wind_direction_10m: Array.from({ length: 72 }, () => 270), // Westerly
          wind_gusts_10m: Array.from({ length: 72 }, () => 28),
        },
      }));
    }

    beforeEach(() => {
      service = new ForecastGridService({
        cacheTtlMs: 1000, // 1s TTL for testing
        dailyBudgetCalls: 500,
        batchChunkSize: 50,
      });
      vi.restoreAllMocks();
    });

    it('fetches ECMWF forecast grid, deduplicates snapped coordinates, and parses 72-hour timesteps', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const u = new URL(url.toString());
        const latArr = u.searchParams.get('latitude')!.split(',').map(Number);
        const lonArr = u.searchParams.get('longitude')!.split(',').map(Number);
        const mockPayload = createMockResponse(latArr, lonArr);
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
          text: async () => JSON.stringify(mockPayload),
        } as Response;
      });

      const res = await service.getForecastGrid('sector', 'mumbai');

      expect(fetchSpy).toHaveBeenCalled();
      expect(res.metadata.provider).toBe('Open-Meteo ECMWF Open Data');
      expect(res.metadata.model).toBe('ECMWF IFS (0.25°)');
      expect(res.metadata.isFallback).toBe(false);
      expect(res.metadata.runCycle).toBe('00Z');
      expect(res.metadata.totalTimesteps).toBe(72);
      expect(res.metadata.gridNodeCount).toBe(49);
      expect(res.metadata.deduplicatedNodeCount).toBeLessThanOrEqual(49);
      expect(res.nodes.length).toBe(res.metadata.deduplicatedNodeCount);

      // Verify node parsing and accumulation semantics
      const node0 = res.nodes[0];
      expect(node0.hourly.length).toBe(72);
      expect(node0.hourly[0].precipitationMm).toBe(5.5);
      expect(node0.accum24hMm).toBeGreaterThan(0);
      expect(node0.accum72hMm).toBeGreaterThan(node0.accum24hMm);
      expect(node0.hourly[0].uMs).toBeCloseTo(5.0, 1); // 18 km/h Westerly = +5 m/s u
      expect(node0.hourly[0].vMs).toBeCloseTo(0, 1);

      // Verify quota deduction
      const quota = service.getQuotaStatus();
      expect(quota.dailyCallsUsed).toBe(49);
    });

    it('falls back to NOAA GFS when ECMWF upstream returns HTTP 503 or error', async () => {
      let callCount = 0;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        callCount++;
        const urlStr = url.toString();
        if (urlStr.includes('/ecmwf')) {
          // ECMWF fails with 503 Gateway Unavailable
          return {
            ok: false,
            status: 503,
            statusText: 'Service Unavailable',
            text: async () => 'ECMWF data assimilation maintenance',
          } as Response;
        } else if (urlStr.includes('/gfs')) {
          // GFS succeeds
          const u = new URL(urlStr);
          const latArr = u.searchParams.get('latitude')!.split(',').map(Number);
          const lonArr = u.searchParams.get('longitude')!.split(',').map(Number);
          const mockPayload = createMockResponse(latArr, lonArr, 28);
          return {
            ok: true,
            status: 200,
            json: async () => mockPayload,
            text: async () => JSON.stringify(mockPayload),
          } as Response;
        }
        throw new Error('Unexpected URL');
      });

      const res = await service.getForecastGrid('sector', 'chennai');

      expect(fetchSpy).toHaveBeenCalledTimes(2); // 1 ECMWF attempt + 1 GFS fallback
      expect(res.metadata.provider).toBe('Open-Meteo NOAA GFS');
      expect(res.metadata.model).toBe('NOAA GFS (0.25°)');
      expect(res.metadata.isFallback).toBe(true);
      expect(res.metadata.fallbackReason).toContain('ECMWF');
    });

    it('coalesces multiple in-flight concurrent requests for the same sector', async () => {
      let fetchCalls = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        fetchCalls++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        const u = new URL(url.toString());
        const latArr = u.searchParams.get('latitude')!.split(',').map(Number);
        const lonArr = u.searchParams.get('longitude')!.split(',').map(Number);
        const mockPayload = createMockResponse(latArr, lonArr);
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
          text: async () => JSON.stringify(mockPayload),
        } as Response;
      });

      // Fire 4 concurrent requests at the exact same time
      const [res1, res2, res3, res4] = await Promise.all([
        service.getForecastGrid('sector', 'kolkata'),
        service.getForecastGrid('sector', 'kolkata'),
        service.getForecastGrid('sector', 'kolkata'),
        service.getForecastGrid('sector', 'kolkata'),
      ]);

      expect(fetchCalls).toBe(1); // Only ONE network batch executed!
      expect(res1).toBe(res2);
      expect(res2).toBe(res3);
      expect(res3).toBe(res4);
    });

    it('enforces daily quota budget and gracefully serves stale cache when budget exhausted', async () => {
      // Seed the cache with 1 valid request
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const u = new URL(url.toString());
        const latArr = u.searchParams.get('latitude')!.split(',').map(Number);
        const lonArr = u.searchParams.get('longitude')!.split(',').map(Number);
        const mockPayload = createMockResponse(latArr, lonArr);
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
          text: async () => JSON.stringify(mockPayload),
        } as Response;
      });

      await service.getForecastGrid('sector', 'dehradun');

      // Now set budget used right at the limit
      service.setDailyCallsUsedForTesting(500);

      // Force refresh while budget is exhausted
      const staleRes = await service.getForecastGrid('sector', 'dehradun', true);
      expect(staleRes.metadata.isStale).toBe(true);
      expect(staleRes.metadata.staleReason).toBe('DAILY_BUDGET_EXHAUSTED');
      expect(staleRes.metadata.dailyBudgetRemaining).toBe(0);
    });
  });

  describe('4. Express Route Integration: GET /api/weather/forecast-grid', () => {
    const app = createApp();

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 200 with typed ForecastGridResponse for valid sector query', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const u = new URL(url.toString());
        const latArr = u.searchParams.get('latitude')!.split(',').map(Number);
        const lonArr = u.searchParams.get('longitude')!.split(',').map(Number);
        const mockPayload = latArr.map((lat, idx) => ({
          latitude: lat,
          longitude: lonArr[idx],
          elevation: 14,
          hourly: {
            time: Array.from({ length: 72 }, (_, h) => `2026-11-13T${h < 10 ? '0' + h : h}:00`),
            temperature_2m: Array.from({ length: 72 }, () => 24.5),
            apparent_temperature: Array.from({ length: 72 }, () => 26.0),
            relative_humidity_2m: Array.from({ length: 72 }, () => 65),
            precipitation: Array.from({ length: 72 }, () => 1.2),
            rain: Array.from({ length: 72 }, () => 1.2),
            showers: Array.from({ length: 72 }, () => 0),
            pressure_msl: Array.from({ length: 72 }, () => 1013.2),
            surface_pressure: Array.from({ length: 72 }, () => 1011.8),
            wind_speed_10m: Array.from({ length: 72 }, () => 12),
            wind_direction_10m: Array.from({ length: 72 }, () => 180),
            wind_gusts_10m: Array.from({ length: 72 }, () => 20),
          },
        }));
        return {
          ok: true,
          status: 200,
          json: async () => mockPayload,
          text: async () => JSON.stringify(mockPayload),
        } as Response;
      });

      const res = await request(app).get('/api/weather/forecast-grid?mode=sector&sector=mumbai');
      expect(res.status).toBe(200);
      expect(res.body.metadata).toBeDefined();
      expect(res.body.metadata.mode).toBe('sector');
      expect(res.body.metadata.activeSector).toBe('mumbai');
      expect(res.body.nodes).toBeDefined();
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.nodes.length).toBeGreaterThan(0);
    });

    it('rejects invalid mode with 400 and INVALID_GRID_MODE', async () => {
      const res = await request(app).get('/api/weather/forecast-grid?mode=invalid_mode');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_GRID_MODE');
    });

    it('rejects invalid sector with 400 and INVALID_SECTOR_KEY', async () => {
      const res = await request(app).get('/api/weather/forecast-grid?mode=sector&sector=unknown_city');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SECTOR_KEY');
    });
  });
});
