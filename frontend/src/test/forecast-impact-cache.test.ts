import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as apiModule from '../services/api';
import {
  getForecastImpact,
  clearForecastImpactClientCache,
  type ForecastImpactResponse,
} from '../services/forecast-impact';

describe('ForecastImpact Service - Coalescing, Caching & Recovery Tests (Phase 3D-3)', () => {
  beforeEach(() => {
    clearForecastImpactClientCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearForecastImpactClientCache();
    vi.restoreAllMocks();
  });

  const createMockImpactResponse = (
    mode: 'sector' | 'national' = 'sector',
    sector: string = 'chennai'
  ): ForecastImpactResponse => ({
    metadata: {
      provider: 'Open-Meteo ECMWF Open Data',
      model: 'ECMWF IFS (0.25°)',
      nativeResolution: '0.25° regular lat/lon',
      gridSamplingResolution: `${sector.toUpperCase()} 0.25° Mesoscale Cluster`,
      initializationTime: '2026-11-13T00:00:00.000Z',
      runCycle: '00Z',
      validStartTime: '2026-11-13T01:00:00.000Z',
      validEndTime: '2026-11-16T00:00:00.000Z',
      generatedAt: '2026-11-13T00:05:00.000Z',
      mode,
      activeSector: mode === 'sector' ? (sector as any) : undefined,
      isFallback: false,
      isStale: false,
      scientificDisclaimer: 'Meteorological hazard forecast assessment only.',
      dataQualityDisclaimer: 'Prospective accumulation from T+1.',
      accumulationConvention: '6h, 12h, 24h, 48h prospective.',
    },
    summary: {
      districtsEvaluated: 8,
      districtsWithSufficientCoverage: 8,
      districtsInHeavyOrAbove: 0,
      districtsInVeryHeavyOrAbove: 0,
      districtsInExtremelyHeavy: 0,
      topImpactedDistricts: [],
    },
    districts: [
      {
        district: 'CHENNAI',
        state: 'TAMIL NADU',
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'MULTI_NODE_REPRESENTATIVE',
          nodeCount: 3,
          method: 'POLYGON_INTERIOR',
        },
        metrics: {
          futureAccum6hMm: 0.5,
          futureAccum12hMm: 1.0,
          futureAccum24hMm: 1.5,
          futureAccum48hMm: 2.0,
          futureAccum72hMm: null,
          accum72hQualityReason: 'NWP contract provides 71 future hours (T+1..T+71).',
          peakHourlyRateMmH: 0.5,
          peakHourlyTimeUtc: '2026-11-13T06:00:00Z',
          peakHourlyRateCategory: 'LIGHT',
          maxWindGustKmh: 25.0,
        },
        dataQuality: {
          isComplete: true,
          totalExpectedHours: 72,
          totalAvailableHours: 72,
          continuityValid: true,
        },
        classification: {
          imdRainfallCategory: 'LIGHT_RAIN',
          thresholdDefinition: 'IMD 24h: 0.1 - 14.9 mm (Light Rain)',
        },
        localExposure: {
          verifiedEmergencyFacilitiesCount: 15,
          facilityTypes: {
            hospitals: 5,
            shelters: 8,
            fireStations: 2,
            other: 0,
          },
          exposureNotice: 'Verified local facilities within administrative district boundary.',
        },
      },
    ],
  });

  describe('1. Client-Side Request Coalescing', () => {
    it('coalesces multiple simultaneous identical requests into a single in-flight network call', async () => {
      let resolveRequest: (val: any) => void = () => {};
      const networkPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });

      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockImplementation(() => networkPromise as any);

      // Trigger two simultaneous identical calls
      const p1 = getForecastImpact('sector', 'chennai', false);
      const p2 = getForecastImpact('sector', 'chennai', false);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      const mockData = createMockImpactResponse('sector', 'chennai');
      resolveRequest(mockData);

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe(res2);
      expect(res1.summary.districtsEvaluated).toBe(8);
    });

    it('removes in-flight entry after completion so subsequent calls after resolution do not reuse pending promise', async () => {
      const mockData = createMockImpactResponse('sector', 'chennai');
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockData);

      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      // Force refresh to bypass cache; should make a second network call cleanly
      await getForecastImpact('sector', 'chennai', true);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });

    it('cleans up in-flight promise upon failure so failed calls do not permanently wedge the service', async () => {
      const fetchJsonSpy = vi
        .spyOn(apiModule, 'fetchJson')
        .mockRejectedValueOnce(new Error('Network error: Gateway Timeout 504'))
        .mockResolvedValueOnce(createMockImpactResponse('sector', 'chennai'));

      // First call fails
      await expect(getForecastImpact('sector', 'chennai', false)).rejects.toThrow('Network error: Gateway Timeout 504');
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      // Second call immediately after failure must attempt a new fetch, not return the rejected promise
      const recovery = await getForecastImpact('sector', 'chennai', false);
      expect(recovery.summary.districtsEvaluated).toBe(8);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });

    it('ensures different sectors and modes never share in-flight promises', async () => {
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockImplementation(async (endpoint: string) => {
        if (endpoint.includes('mode=national')) {
          return createMockImpactResponse('national', 'all');
        }
        if (endpoint.includes('sector=mumbai')) {
          return createMockImpactResponse('sector', 'mumbai');
        }
        return createMockImpactResponse('sector', 'chennai');
      });

      const pChennai = getForecastImpact('sector', 'chennai', false);
      const pMumbai = getForecastImpact('sector', 'mumbai', false);
      const pNational = getForecastImpact('national', 'chennai', false);

      const [resChennai, resMumbai, resNational] = await Promise.all([pChennai, pMumbai, pNational]);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(3);
      expect(resChennai.metadata.activeSector).toBe('chennai');
      expect(resMumbai.metadata.activeSector).toBe('mumbai');
      expect(resNational.metadata.mode).toBe('national');
    });
  });

  describe('2. Five-Minute In-Memory Client Cache', () => {
    it('serves subsequent calls within 5-minute TTL from memory without network calls', async () => {
      const mockData = createMockImpactResponse('sector', 'chennai');
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockData);

      const first = await getForecastImpact('sector', 'chennai', false);
      const second = await getForecastImpact('sector', 'chennai', false);

      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it('re-fetches when cache TTL expires (> 5 minutes)', async () => {
      const mockData = createMockImpactResponse('sector', 'chennai');
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockData);

      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      // Advance clock by 4 minutes (should hit cache)
      currentTime += 4 * 60 * 1000;
      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      // Advance clock past 5 minutes (TTL expired, should re-fetch)
      currentTime += 2 * 60 * 1000;
      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });

    it('bypasses cache when refresh=true is specified', async () => {
      const mockData = createMockImpactResponse('sector', 'chennai');
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockData);

      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      await getForecastImpact('sector', 'chennai', true);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });

    it('clearForecastImpactClientCache purges all cached entries', async () => {
      const mockData = createMockImpactResponse('sector', 'chennai');
      const fetchJsonSpy = vi.spyOn(apiModule, 'fetchJson').mockResolvedValue(mockData);

      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(1);

      clearForecastImpactClientCache();

      await getForecastImpact('sector', 'chennai', false);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });

    it('never caches failed or error responses', async () => {
      const fetchJsonSpy = vi
        .spyOn(apiModule, 'fetchJson')
        .mockRejectedValueOnce(new Error('HTTP Error 429: API rate limit exceeded'))
        .mockResolvedValueOnce(createMockImpactResponse('sector', 'chennai'));

      await expect(getForecastImpact('sector', 'chennai', false)).rejects.toThrow('HTTP Error 429');

      // Subsequent call must not serve a cached error
      const recovered = await getForecastImpact('sector', 'chennai', false);
      expect(recovered.summary.districtsEvaluated).toBe(8);
      expect(fetchJsonSpy).toHaveBeenCalledTimes(2);
    });
  });
});
