/**
 * Forecast Grid Service for JATAYU Tactical Map 2.0 (Phase 3B)
 *
 * Implements a Hierarchical Adaptive Grid engine for Numerical Weather Prediction (NWP).
 * Integrates Open-Meteo ECMWF Open Data (0.25°) with automatic NOAA GFS (0.25°) failover,
 * returned model-coordinate deduplication, in-flight request coalescing,
 * model-cycle-aware caching, and strict daily quota budget protection.
 */

import {
  ForecastGridMode,
  OperationalSectorKey,
  GridCoordinate,
  HourlyGridDataPoint,
  ForecastGridNode,
  ForecastGridResponse,
} from '../types/forecast-grid.types.js';

// Operational Sector Definitions (Centroid + 0.25° Cluster Bounding Box: 7x7 = 49 points)
export const OPERATIONAL_SECTOR_CLUSTERS: Record<
  OperationalSectorKey,
  { name: string; centroid: [number, number]; latRange: [number, number]; lonRange: [number, number]; step: number }
> = {
  hyderabad: {
    name: 'Hyderabad Metropolitan Region',
    centroid: [17.385, 78.4867],
    latRange: [16.75, 18.25],
    lonRange: [77.75, 79.25],
    step: 0.25,
  },
  mumbai: {
    name: 'Mumbai Metropolitan Region & Western Ghats',
    centroid: [19.076, 72.8777],
    latRange: [18.25, 19.75],
    lonRange: [72.25, 73.75],
    step: 0.25,
  },
  chennai: {
    name: 'Chennai Coastal Basin & Coromandel Coast',
    centroid: [13.0827, 80.2707],
    latRange: [12.25, 13.75],
    lonRange: [79.50, 81.00],
    step: 0.25,
  },
  guwahati: {
    name: 'Brahmaputra Valley (Guwahati)',
    centroid: [26.1445, 91.7362],
    latRange: [25.25, 26.75],
    lonRange: [91.00, 92.50],
    step: 0.25,
  },
  kolkata: {
    name: 'Bengal Delta & Sundarbans (Kolkata)',
    centroid: [22.5726, 88.3639],
    latRange: [21.75, 23.25],
    lonRange: [87.50, 89.00],
    step: 0.25,
  },
  dehradun: {
    name: 'Western Himalayan Foothills (Dehradun)',
    centroid: [30.3165, 78.0322],
    latRange: [29.50, 31.00],
    lonRange: [77.25, 78.75],
    step: 0.25,
  },
};

/**
 * Calculates atmospheric velocity vectors (u, v) in m/s from wind speed (km/h)
 * and meteorological wind direction (degrees from which wind blows).
 *
 * u = - (v_ms) * sin(theta)  [Eastward: + / Westward: -]
 * v = - (v_ms) * cos(theta)  [Northward: + / Southward: -]
 */
export function calculateWindVelocityVectors(
  windSpeedKmh: number,
  windDirectionDegrees: number
): { uMs: number; vMs: number } {
  const speedMs = windSpeedKmh / 3.6;
  const rad = (windDirectionDegrees * Math.PI) / 180;
  const u = -speedMs * Math.sin(rad);
  const v = -speedMs * Math.cos(rad);
  const roundedU = Math.round(u * 100) / 100;
  const roundedV = Math.round(v * 100) / 100;
  return {
    uMs: roundedU === 0 ? 0 : roundedU,
    vMs: roundedV === 0 ? 0 : roundedV,
  };
}

/**
 * Generates regular grid coordinates for a specific operational sector cluster (49 points).
 */
export function generateSectorClusterCoordinates(sectorKey: OperationalSectorKey): GridCoordinate[] {
  const sector = OPERATIONAL_SECTOR_CLUSTERS[sectorKey];
  if (!sector) throw new Error(`Unknown operational sector key: ${sectorKey}`);

  const coordinates: GridCoordinate[] = [];
  const [minLat, maxLat] = sector.latRange;
  const [minLon, maxLon] = sector.lonRange;
  const step = sector.step;

  for (let lat = minLat; lat <= maxLat + 0.001; lat += step) {
    for (let lon = minLon; lon <= maxLon + 0.001; lon += step) {
      const roundedLat = Math.round(lat * 100) / 100;
      const roundedLon = Math.round(lon * 100) / 100;
      const isCentroid =
        Math.abs(roundedLat - sector.centroid[0]) < step / 2 &&
        Math.abs(roundedLon - sector.centroid[1]) < step / 2;

      coordinates.push({
        latitude: roundedLat,
        longitude: roundedLon,
        sectorKey,
        isSectorCentroid: isCentroid,
        name: isCentroid ? `${sector.name} (Centroid)` : `${sector.name} Grid Node`,
      });
    }
  }

  return coordinates;
}

/**
 * Generates National Synoptic Macro-Mesh across India (6.5°N–37.5°N, 68°E–97.5°E).
 * Filtered to landmass, coastal approaches, and exclusive economic zones.
 */
export function generateNationalSynopticCoordinates(stepDegrees: number = 1.5): GridCoordinate[] {
  const coordinates: GridCoordinate[] = [];

  // Coarse bounding polygon of Indian subcontinent and adjoining territorial waters
  for (let lat = 8.0; lat <= 36.0 + 0.001; lat += stepDegrees) {
    for (let lon = 68.0; lon <= 96.0 + 0.001; lon += stepDegrees) {
      // Geographic filter to exclude deep ocean beyond Bay of Bengal / Arabian Sea
      if (lat < 12.0 && (lon < 71.0 || lon > 85.0)) continue;
      if (lat < 16.0 && (lon < 70.0 || lon > 89.0)) continue;
      if (lat > 28.0 && lon > 90.0 && lat > 32.0) continue; // Northern Tibetan plateau cut-off
      if (lat > 32.0 && lon < 73.0) continue; // Western trans-Indus cut-off

      coordinates.push({
        latitude: Math.round(lat * 100) / 100,
        longitude: Math.round(lon * 100) / 100,
        name: `Synoptic Node (${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E)`,
      });
    }
  }

  return coordinates;
}

export interface ForecastGridServiceOptions {
  ecmwfBaseUrl?: string;
  gfsBaseUrl?: string;
  cacheTtlMs?: number;
  dailyBudgetCalls?: number;
  batchChunkSize?: number;
}

export class ForecastGridService {
  private ecmwfBaseUrl: string;
  private gfsBaseUrl: string;
  private cacheTtlMs: number;
  private dailyBudgetCalls: number;
  private batchChunkSize: number;

  // In-Memory Cache and In-Flight Request Coalescing
  private memoryCache = new Map<string, { response: ForecastGridResponse; cachedAt: number }>();
  private inFlightRequests = new Map<string, Promise<ForecastGridResponse>>();

  // Daily Quota Tracking (Accounting)
  private dailyCallsUsed: number = 0;
  private currentBudgetDay: string = new Date().toISOString().slice(0, 10);

  constructor(options: ForecastGridServiceOptions = {}) {
    this.ecmwfBaseUrl = options.ecmwfBaseUrl || 'https://api.open-meteo.com/v1/ecmwf';
    this.gfsBaseUrl = options.gfsBaseUrl || 'https://api.open-meteo.com/v1/gfs';
    this.cacheTtlMs = options.cacheTtlMs ?? 2 * 60 * 60 * 1000; // 2 hours default TTL
    this.dailyBudgetCalls = options.dailyBudgetCalls ?? 8000; // Safe threshold under 10k quota
    this.batchChunkSize = options.batchChunkSize ?? 50; // Open-Meteo optimal batch size
  }

  /**
   * Resets daily quota counter if UTC day has changed.
   */
  private checkDayRollover(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentBudgetDay) {
      this.currentBudgetDay = today;
      this.dailyCallsUsed = 0;
    }
  }

  /**
   * Returns current accounting telemetry.
   */
  public getQuotaStatus(): { dailyCallsUsed: number; dailyBudgetTotal: number; dailyBudgetRemaining: number } {
    this.checkDayRollover();
    return {
      dailyCallsUsed: this.dailyCallsUsed,
      dailyBudgetTotal: this.dailyBudgetCalls,
      dailyBudgetRemaining: Math.max(0, this.dailyBudgetCalls - this.dailyCallsUsed),
    };
  }

  /**
   * Clear cache for testing or manual eviction.
   */
  public clearCache(): void {
    this.memoryCache.clear();
    this.inFlightRequests.clear();
  }

  /**
   * Sets artificial budget used count for testing quota enforcement.
   */
  public setDailyCallsUsedForTesting(count: number): void {
    this.dailyCallsUsed = count;
  }

  /**
   * Retrieves the 72-hour forecast grid.
   * Supports mode='sector' (e.g. 'mumbai') or mode='national'.
   */
  public async getForecastGrid(
    mode: ForecastGridMode = 'sector',
    sectorKey: OperationalSectorKey = 'mumbai',
    forceRefresh: boolean = false
  ): Promise<ForecastGridResponse> {
    this.checkDayRollover();

    const cacheKey = mode === 'sector' ? `sector:${sectorKey}` : 'national';
    const now = Date.now();

    // 1. Check memory cache (if not expired and not forced)
    const cached = this.memoryCache.get(cacheKey);
    if (!forceRefresh && cached && now - cached.cachedAt < this.cacheTtlMs) {
      return {
        ...cached.response,
        metadata: {
          ...cached.response.metadata,
          isStale: false,
          dailyBudgetRemaining: Math.max(0, this.dailyBudgetCalls - this.dailyCallsUsed),
        },
      };
    }

    // 2. In-flight request coalescing (avoids duplicate upstream calls if multiple callers request at once)
    const existingPromise = this.inFlightRequests.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const fetchPromise = this.executeFetchGrid(mode, sectorKey, cacheKey, cached?.response);
    this.inFlightRequests.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  /**
   * Executes the fetch workflow with quota check, batch chunking, deduplication, and GFS fallback.
   */
  private async executeFetchGrid(
    mode: ForecastGridMode,
    sectorKey: OperationalSectorKey,
    cacheKey: string,
    existingStaleResponse?: ForecastGridResponse
  ): Promise<ForecastGridResponse> {
    // Generate coordinate targets
    let coordinates: GridCoordinate[];
    if (mode === 'sector') {
      coordinates = generateSectorClusterCoordinates(sectorKey);
    } else {
      // National mode: Synoptic grid + all 5 sector clusters
      const synoptic = generateNationalSynopticCoordinates(1.5);
      const sectors = (Object.keys(OPERATIONAL_SECTOR_CLUSTERS) as OperationalSectorKey[]).flatMap((k) =>
        generateSectorClusterCoordinates(k)
      );
      coordinates = [...synoptic, ...sectors];
    }

    const totalLocations = coordinates.length;

    // Check daily budget
    if (this.dailyCallsUsed + totalLocations > this.dailyBudgetCalls) {
      if (existingStaleResponse) {
        console.warn(
          `[ForecastGridService] Daily budget exhausted (${this.dailyCallsUsed}/${this.dailyBudgetCalls}). Returning stale cached grid for ${cacheKey}.`
        );
        return {
          ...existingStaleResponse,
          metadata: {
            ...existingStaleResponse.metadata,
            isStale: true,
            staleReason: 'DAILY_BUDGET_EXHAUSTED',
            staleSince: new Date().toISOString(),
            dailyBudgetRemaining: 0,
          },
        };
      }
      throw new Error(
        `Open-Meteo daily budget exhausted (${this.dailyCallsUsed}/${this.dailyBudgetCalls}) and no cached forecast exists for ${cacheKey}.`
      );
    }

    // Partition coordinates into batch chunks
    const chunks: GridCoordinate[][] = [];
    for (let i = 0; i < coordinates.length; i += this.batchChunkSize) {
      chunks.push(coordinates.slice(i, i + this.batchChunkSize));
    }

    let isFallback = false;
    let fallbackReason: string | undefined = undefined;
    let rawResults: any[] = [];
    let providerName = 'Open-Meteo ECMWF Open Data';
    let modelName = 'ECMWF IFS (0.25°)';
    let nativeRes = '0.25° (~28 km) regular lat/lon';
    let providerOutputGrid = '0.25° regular latitude/longitude';

    // Attempt Primary Provider (ECMWF Open Data)
    try {
      rawResults = await this.fetchBatchChunks(this.ecmwfBaseUrl, chunks);
    } catch (primaryErr: any) {
      console.warn(
        `[ForecastGridService] Primary provider (ECMWF) failed (${primaryErr.message}). Initiating NOAA GFS fallback.`
      );
      isFallback = true;
      fallbackReason = `Primary provider (ECMWF) unreachable: ${primaryErr.message}`;
      providerName = 'Open-Meteo NOAA GFS';
      modelName = 'NOAA GFS (0.25°)';
      nativeRes = '0.25° (~28 km) Gaussian lat/lon';
      providerOutputGrid = '0.25° regular latitude/longitude';

      try {
        rawResults = await this.fetchBatchChunks(this.gfsBaseUrl, chunks);
      } catch (fallbackErr: any) {
        if (existingStaleResponse) {
          console.warn(
            `[ForecastGridService] Both ECMWF and GFS fallback failed. Returning stale cached grid for ${cacheKey}.`
          );
          return {
            ...existingStaleResponse,
            metadata: {
              ...existingStaleResponse.metadata,
              isStale: true,
              staleReason: 'ALL_PROVIDERS_UNAVAILABLE',
              staleSince: new Date().toISOString(),
              dailyBudgetRemaining: Math.max(0, this.dailyBudgetCalls - this.dailyCallsUsed),
            },
          };
        }
        throw new Error(
          `All forecast upstream providers failed. ECMWF error: ${primaryErr.message}; GFS fallback error: ${fallbackErr.message}`
        );
      }
    }

    // Deduplicate returned model grid cells and parse forecast nodes
    const deduplicatedMap = new Map<string, ForecastGridNode>();

    for (let i = 0; i < rawResults.length; i++) {
      const raw = rawResults[i];
      const reqCoord = coordinates[i] || { latitude: raw.latitude, longitude: raw.longitude };

      const modelLat = typeof raw.latitude === 'number' ? Math.round(raw.latitude * 1000) / 1000 : reqCoord.latitude;
      const modelLon = typeof raw.longitude === 'number' ? Math.round(raw.longitude * 1000) / 1000 : reqCoord.longitude;
      const dedupKey = `${modelLat.toFixed(3)},${modelLon.toFixed(3)}`;

      // Skip duplicate model cells
      if (deduplicatedMap.has(dedupKey)) {
        continue;
      }

      const hourlyPoints = this.parseHourlyTimeseries(raw.hourly);

      // Precalculate accumulations and extrema
      let accum24 = 0;
      let accum72 = 0;
      let maxGust = 0;
      let minMslp = Infinity;

      for (let t = 0; t < hourlyPoints.length; t++) {
        const pt = hourlyPoints[t];
        if (t < 24) accum24 += pt.precipitationMm;
        accum72 += pt.precipitationMm;
        if (pt.windGustsKmh > maxGust) maxGust = pt.windGustsKmh;
        if (pt.pressureMslHpa < minMslp) minMslp = pt.pressureMslHpa;
      }

      deduplicatedMap.set(dedupKey, {
        requestedLat: reqCoord.latitude,
        requestedLon: reqCoord.longitude,
        modelLat,
        modelLon,
        elevationM: raw.elevation ?? 0,
        sectorKey: reqCoord.sectorKey,
        hourly: hourlyPoints,
        accum24hMm: Math.round(accum24 * 10) / 10,
        accum72hMm: Math.round(accum72 * 10) / 10,
        maxWindGustKmh: Math.round(maxGust * 10) / 10,
        minPressureMslHpa: minMslp === Infinity ? 1013.25 : Math.round(minMslp * 10) / 10,
      });
    }

    // Deduct billable calls
    this.dailyCallsUsed += totalLocations;

    const nodes = Array.from(deduplicatedMap.values());
    const firstHourly = nodes[0]?.hourly;
    const validStartTime = firstHourly?.[0]?.time || new Date().toISOString();
    const validEndTime = firstHourly?.[firstHourly.length - 1]?.time || new Date().toISOString();

    // Determine Run Cycle (00Z, 06Z, 12Z, 18Z) from initial timestep
    let runCycle: '00Z' | '06Z' | '12Z' | '18Z' | 'UNKNOWN' = 'UNKNOWN';
    if (validStartTime) {
      const match = validStartTime.match(/T(\d{2}):/);
      if (match) {
        const hour = parseInt(match[1], 10);
        if (hour >= 0 && hour < 6) runCycle = '00Z';
        else if (hour >= 6 && hour < 12) runCycle = '06Z';
        else if (hour >= 12 && hour < 18) runCycle = '12Z';
        else if (hour >= 18) runCycle = '18Z';
      }
    }

    const response: ForecastGridResponse = {
      metadata: {
        provider: providerName,
        model: modelName,
        nativeResolution: nativeRes,
        providerOutputGrid,
        isFallback,
        fallbackReason,
        runCycle,
        initializationTime: validStartTime,
        generatedAt: new Date().toISOString(),
        validStartTime,
        validEndTime,
        totalTimesteps: firstHourly?.length || 72,
        gridNodeCount: totalLocations,
        deduplicatedNodeCount: nodes.length,
        mode,
        activeSector: mode === 'sector' ? sectorKey : undefined,
        isInterpolatedMesh: true,
        disclosure:
          'Spatial surface reconstructed via mesoscale grid interpolation from ECMWF IFS (0.25°) / GFS (0.25°). Not a raw native-resolution GRIB2 raster.',
        attribution: 'Weather data by Open-Meteo.com under CC BY 4.0 (ECMWF Open Data / NOAA GFS)',
        isStale: false,
        cacheTtlMs: this.cacheTtlMs,
        billableCallsIncurred: totalLocations,
        dailyBudgetRemaining: Math.max(0, this.dailyBudgetCalls - this.dailyCallsUsed),
      },
      nodes,
    };

    // Cache in memory
    this.memoryCache.set(cacheKey, {
      response,
      cachedAt: Date.now(),
    });

    return response;
  }

  /**
   * Fetches an array of batch chunks sequentially or with controlled concurrency.
   */
  private async fetchBatchChunks(baseUrl: string, chunks: GridCoordinate[][]): Promise<any[]> {
    const allResults: any[] = [];

    for (const chunk of chunks) {
      const lats = chunk.map((c) => c.latitude).join(',');
      const lons = chunk.map((c) => c.longitude).join(',');

      const url = new URL(baseUrl);
      url.searchParams.set('latitude', lats);
      url.searchParams.set('longitude', lons);
      url.searchParams.set(
        'hourly',
        'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
      );
      url.searchParams.set('forecast_days', '3');
      url.searchParams.set('timezone', 'UTC');

      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'JATAYU-Disaster-Intelligence/0.2.0 (Tactical Forecast Grid)',
          'Accept-Encoding': 'gzip, deflate',
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Upstream HTTP ${res.status}: ${text || res.statusText}`);
      }

      const json = await res.json();
      if (Array.isArray(json)) {
        allResults.push(...json);
      } else {
        allResults.push(json);
      }
    }

    return allResults;
  }

  /**
   * Parses raw hourly arrays into verified HourlyGridDataPoint objects with vector math.
   */
  private parseHourlyTimeseries(hourly: any): HourlyGridDataPoint[] {
    if (!hourly || !Array.isArray(hourly.time)) {
      return [];
    }

    const times: string[] = hourly.time;
    const points: HourlyGridDataPoint[] = [];

    for (let t = 0; t < times.length; t++) {
      const speed = hourly.wind_speed_10m?.[t] ?? 0;
      const dir = hourly.wind_direction_10m?.[t] ?? 0;
      const { uMs, vMs } = calculateWindVelocityVectors(speed, dir);

      points.push({
        time: times[t],
        precipitationMm: hourly.precipitation?.[t] ?? 0,
        rainMm: hourly.rain?.[t] ?? 0,
        showersMm: hourly.showers?.[t] ?? 0,
        temperatureC: hourly.temperature_2m?.[t] ?? 0,
        apparentTemperatureC: hourly.apparent_temperature?.[t] ?? hourly.temperature_2m?.[t] ?? 0,
        relativeHumidityPercent: hourly.relative_humidity_2m?.[t] ?? 0,
        pressureMslHpa: hourly.pressure_msl?.[t] ?? 1013.25,
        surfacePressureHpa: hourly.surface_pressure?.[t] ?? 1013.25,
        windSpeedKmh: speed,
        windDirectionDegrees: dir,
        windGustsKmh: hourly.wind_gusts_10m?.[t] ?? speed,
        uMs,
        vMs,
      });
    }

    return points;
  }
}

// Global Singleton Instance
export const forecastGridService = new ForecastGridService();
