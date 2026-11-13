/**
 * Forecast Impact Service for JATAYU Tactical Map 2.0 (Phase 3D-1)
 *
 * Translates gridded Numerical Weather Prediction (NWP) time-series
 * into district-level rainfall hazard metrics, quality-verified accumulations,
 * and supported local infrastructure exposure counts.
 *
 * Core Principles:
 * 1. Strict Precipitation Interval Semantics:
 *    - T+0 is the analysis hour ending at initialization (past hour).
 *    - Prospective accumulations sum future hours:
 *      6h: T+1 to T+6 (6 terms)
 *      12h: T+1 to T+12 (12 terms)
 *      24h: T+1 to T+24 (24 terms)
 *      48h: T+1 to T+48 (48 terms)
 *      72h: strictly null under 72-timestep contract (T+0..T+71 contains only 71 future hours).
 * 2. Missing-Data & Continuity Integrity:
 *    - Verifies sequential 3600-second timestamp increments.
 *    - Flags missing or invalid values; never interpolates missing temporal rain.
 * 3. Spatial Aggregation Rigor:
 *    - Point-in-polygon (PIP) for interior nodes.
 *    - Bounded centroid fallback (<= 25 km in sector mode).
 *    - In national synoptic mode: explicit SYNOPTIC_INDICATIVE disclosure.
 * 4. Authoritative IMD Standardization:
 *    - Uses exact IMD 24h rainfall criteria (Light, Moderate, Heavy, Very Heavy, Extremely Heavy).
 *    - Official IMD warning bulletin status kept separate; no synthetic composite scores.
 * 5. Local Exposure Boundaries:
 *    - Emergency facilities counted only where data exists.
 *    - Historical choke points strictly evaluated for Chennai (6 points).
 *    - Zero consumption of experimental unvalidated SFINCS outputs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  ForecastGridMode,
  OperationalSectorKey,
  ForecastGridNode,
  HourlyGridDataPoint,
} from '../types/forecast-grid.types.js';
import {
  ImdRainfallCategory,
  ImdHourlyRateCategory,
  DistrictCoverageStatus,
  DistrictSamplingMethod,
  DistrictDataQuality,
  DistrictClassification,
  DistrictLocalExposure,
  DistrictForecastImpact,
  ForecastImpactResponse,
  ForecastImpactMetadata,
} from '../types/forecast-impact.types.js';
import { forecastGridService, ForecastGridService } from './forecast-grid.service.js';
import { DistrictBoundaryService } from './district.service.js';
import { AlertService } from './alert.service.js';
import { DisasterAlert } from '../types/alert.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DistrictCentroidRecord {
  district: string;
  state: string;
  censusCode?: string;
  centroid: { lat: number; lon: number };
}

export interface VerifiedFacilityRecord {
  id: string;
  name: string;
  category: 'HOSPITAL' | 'SHELTER' | 'FIRE_STATION' | string;
  district: string;
  state: string;
  location: { latitude: number; longitude: number };
}

export interface VulnerabilityPointRecord {
  id: string;
  name: string;
  coordinate: [number, number]; // [lon, lat]
  radiusMeters: number;
  severity: string;
  type: string;
  description: string;
  source: string;
}

/**
 * Calculates Haversine great-circle distance between two geographic coordinates in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates timestamp continuity across an hourly grid timeseries.
 * Expects sequential timestamps incremented by exactly 3600 seconds (1 hour).
 */
export function validateHourlyContinuity(hourly: HourlyGridDataPoint[]): {
  isValid: boolean;
  qualityNotice?: string;
} {
  if (!hourly || hourly.length === 0) {
    return { isValid: false, qualityNotice: 'Empty hourly timeseries' };
  }

  for (let i = 1; i < hourly.length; i++) {
    const prevTime = new Date(hourly[i - 1].time).getTime();
    const currTime = new Date(hourly[i].time).getTime();

    if (isNaN(prevTime) || isNaN(currTime)) {
      return {
        isValid: false,
        qualityNotice: `Invalid ISO timestamp encountered at index ${i} ('${hourly[i].time}')`,
      };
    }

    const diffMs = currTime - prevTime;
    if (diffMs === 0) {
      return {
        isValid: false,
        qualityNotice: `Duplicate timestamp detected at index ${i} ('${hourly[i].time}')`,
      };
    }

    if (diffMs !== 3600000) {
      return {
        isValid: false,
        qualityNotice: `Non-uniform time step of ${diffMs / 1000}s detected between index ${i - 1} ('${hourly[i - 1].time}') and index ${i} ('${hourly[i].time}') (expected 3600s)`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Computes future precipitation accumulations, peak rain rates, and wind gusts
 * with strict adherence to prospective interval semantics (T+1 to T+K).
 */
export function computeNodeFutureAccumulations(hourly: HourlyGridDataPoint[]): {
  accum6hMm: number | null;
  accum12hMm: number | null;
  accum24hMm: number | null;
  accum48hMm: number | null;
  accum72hMm: number | null;
  accum72hQualityReason?: string;
  peakHourlyRateMmH: number | null;
  peakHourlyTimeUtc: string | null;
  maxWindGustKmh: number | null;
  quality: DistrictDataQuality;
} {
  const continuity = validateHourlyContinuity(hourly);
  const totalAvailable = hourly ? hourly.length : 0;

  const quality: DistrictDataQuality = {
    isComplete: continuity.isValid && totalAvailable >= 72,
    totalExpectedHours: 72,
    totalAvailableHours: totalAvailable,
    continuityValid: continuity.isValid,
    qualityNotice: continuity.qualityNotice,
  };

  // Helper to sum future intervals strictly from T+1 through T+targetHours
  function sumFutureInterval(targetHours: number): number | null {
    if (!continuity.isValid) return null;
    if (totalAvailable < targetHours + 1) return null;

    let sum = 0;
    for (let t = 1; t <= targetHours; t++) {
      const pt = hourly[t];
      if (
        !pt ||
        typeof pt.precipitationMm !== 'number' ||
        isNaN(pt.precipitationMm) ||
        pt.precipitationMm < 0
      ) {
        return null; // Missing or corrupt precipitation value
      }
      sum += pt.precipitationMm;
    }
    return Math.round(sum * 10) / 10;
  }

  const accum6hMm = sumFutureInterval(6);
  const accum12hMm = sumFutureInterval(12);
  const accum24hMm = sumFutureInterval(24);
  const accum48hMm = sumFutureInterval(48);

  // 72h accumulation evaluation under T+0..T+71 contract:
  // Under the existing 72-timestep contract (indices 0..71), only 71 future hours exist (T+1..T+71).
  // A complete 72-hour future accumulation requires T+72 (length 73).
  let accum72hMm: number | null = null;
  let accum72hQualityReason: string | undefined;

  if (totalAvailable < 73) {
    accum72hMm = null;
    accum72hQualityReason =
      'INSUFFICIENT_FORECAST_HORIZON: NWP contract provides 71 future hours (T+1..T+71); complete 72-hour future accumulation requires T+72.';
  } else {
    accum72hMm = sumFutureInterval(72);
  }

  // Peak future rain rate & max wind gust across available future hours
  let peakRate: number | null = null;
  let peakTime: string | null = null;
  let maxGust: number | null = null;

  if (totalAvailable > 1) {
    let currentPeak = -1;
    let currentGust = -1;

    for (let t = 1; t < totalAvailable; t++) {
      const pt = hourly[t];
      if (pt && typeof pt.precipitationMm === 'number' && !isNaN(pt.precipitationMm) && pt.precipitationMm >= 0) {
        if (pt.precipitationMm > currentPeak) {
          currentPeak = pt.precipitationMm;
          peakTime = pt.time;
        }
      }
      if (pt && typeof pt.windGustsKmh === 'number' && !isNaN(pt.windGustsKmh)) {
        if (pt.windGustsKmh > currentGust) {
          currentGust = pt.windGustsKmh;
        }
      }
    }

    if (currentPeak >= 0) {
      peakRate = Math.round(currentPeak * 10) / 10;
    }
    if (currentGust >= 0) {
      maxGust = Math.round(currentGust * 10) / 10;
    }
  }

  return {
    accum6hMm,
    accum12hMm,
    accum24hMm,
    accum48hMm,
    accum72hMm,
    accum72hQualityReason,
    peakHourlyRateMmH: peakRate,
    peakHourlyTimeUtc: peakTime,
    maxWindGustKmh: maxGust,
    quality,
  };
}

/**
 * Categorizes 24-hour precipitation accumulation against official IMD criteria.
 * Reuses the benchmark thresholds documented in backend/src/services/risk.service.ts.
 */
export function classifyImd24hRainfall(accumMm: number | null): ImdRainfallCategory {
  if (accumMm === null || isNaN(accumMm) || accumMm < 0) {
    return 'NO_RAIN';
  }
  if (accumMm === 0) return 'NO_RAIN';
  if (accumMm < 15.0) return 'LIGHT_RAIN';
  if (accumMm < 64.5) return 'MODERATE_RAIN';
  if (accumMm < 115.5) return 'HEAVY_RAIN';
  if (accumMm < 204.5) return 'VERY_HEAVY_RAIN';
  return 'EXTREMELY_HEAVY_RAIN';
}

/**
 * Categorizes peak hourly rainfall rate (mm/h) against IMD intensity benchmarks.
 */
export function classifyImdHourlyRate(rateMmH: number | null): ImdHourlyRateCategory {
  if (rateMmH === null || isNaN(rateMmH) || rateMmH <= 0) return 'NEGLIGIBLE';
  if (rateMmH < 2.5) return 'NEGLIGIBLE';
  if (rateMmH < 7.5) return 'LIGHT';
  if (rateMmH < 15.0) return 'MODERATE';
  if (rateMmH < 35.0) return 'HEAVY';
  if (rateMmH < 50.0) return 'VERY_HEAVY';
  return 'TORRENTIAL';
}

export class ForecastImpactService {
  private gridService: ForecastGridService;
  private boundaryService: DistrictBoundaryService;
  private alertService: AlertService;

  // Cached geospatial datasets
  private districtCentroids: Map<string, DistrictCentroidRecord> = new Map();
  private verifiedFacilities: VerifiedFacilityRecord[] = [];
  private chennaiChokepoints: VulnerabilityPointRecord[] = [];
  private isGeoDataLoaded = false;

  constructor(
    gridService?: ForecastGridService,
    boundaryService?: DistrictBoundaryService,
    alertService?: AlertService
  ) {
    this.gridService = gridService || forecastGridService;
    this.boundaryService = boundaryService || new DistrictBoundaryService();
    this.alertService = alertService || new AlertService();
    this.loadGeospatialDatasets();
  }

  /**
   * Initializes static geospatial lookup tables (centroids, facilities, chokepoints).
   */
  private loadGeospatialDatasets(): void {
    if (this.isGeoDataLoaded) return;

    try {
      // 1. Load India District GeoJSON and precompute centroids
      const defaultGeoPath = path.resolve(__dirname, '../data/geo/india_districts_simplified.geojson');
      const fallbackSrcGeoPath = path.resolve(__dirname, '../../src/data/geo/india_districts_simplified.geojson');
      const geoPath = fs.existsSync(defaultGeoPath) ? defaultGeoPath : fallbackSrcGeoPath;

      if (fs.existsSync(geoPath)) {
        const rawJson = fs.readFileSync(geoPath, 'utf-8');
        const geojson = JSON.parse(rawJson);

        if (Array.isArray(geojson.features)) {
          for (const feature of geojson.features) {
            const props = feature.properties || {};
            const district = String(props.district || '').toUpperCase().trim();
            const state = String(props.state || '').toUpperCase().trim();
            const censusCode = props.censusCode ? String(props.censusCode) : undefined;

            if (district && feature.geometry) {
              const centroid = this.calculateCentroid(feature.geometry);
              if (centroid) {
                const key = `${district}::${state}`;
                this.districtCentroids.set(key, {
                  district,
                  state,
                  censusCode,
                  centroid,
                });
              }
            }
          }
        }
      }

      // 2. Load Verified Critical Emergency Facilities
      const defaultFacPath = path.resolve(__dirname, '../data/geo/verified_facilities.json');
      const fallbackSrcFacPath = path.resolve(__dirname, '../../src/data/geo/verified_facilities.json');
      const facPath = fs.existsSync(defaultFacPath) ? defaultFacPath : fallbackSrcFacPath;

      if (fs.existsSync(facPath)) {
        const rawFac = fs.readFileSync(facPath, 'utf-8');
        const parsed = JSON.parse(rawFac);
        if (Array.isArray(parsed)) {
          this.verifiedFacilities = parsed;
        }
      }

      // 3. Load Flood Vulnerability Choke Points (strictly Chennai domain)
      const defaultVulnPath = path.resolve(__dirname, '../data/geo/flood_vulnerability_points.json');
      const fallbackSrcVulnPath = path.resolve(__dirname, '../../src/data/geo/flood_vulnerability_points.json');
      const vulnPath = fs.existsSync(defaultVulnPath) ? defaultVulnPath : fallbackSrcVulnPath;

      if (fs.existsSync(vulnPath)) {
        const rawVuln = fs.readFileSync(vulnPath, 'utf-8');
        const parsed = JSON.parse(rawVuln);
        if (Array.isArray(parsed)) {
          this.chennaiChokepoints = parsed;
        }
      }

      this.isGeoDataLoaded = true;
    } catch (err: any) {
      console.warn('[ForecastImpactService] Geospatial datasets initialization warning:', err.message);
    }
  }

  /**
   * Helper to calculate simple polygon centroid from geometry coordinates.
   */
  private calculateCentroid(geom: any): { lat: number; lon: number } | null {
    if (!geom || !geom.coordinates) return null;

    let totalLat = 0;
    let totalLon = 0;
    let count = 0;

    const processCoords = (coords: any) => {
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        totalLon += coords[0];
        totalLat += coords[1];
        count++;
      } else if (Array.isArray(coords)) {
        for (const c of coords) {
          processCoords(c);
        }
      }
    };

    processCoords(geom.coordinates);
    return count > 0 ? { lat: totalLat / count, lon: totalLon / count } : null;
  }

  /**
   * Main service handler: Generates district-level forecast impact assessment.
   */
  public async getForecastImpact(
    mode: ForecastGridMode = 'sector',
    sectorKey: OperationalSectorKey = 'chennai',
    forceRefresh: boolean = false
  ): Promise<ForecastImpactResponse> {
    this.loadGeospatialDatasets();

    // Step 1: Ingest authoritative NWP forecast grid
    const gridResponse = await this.gridService.getForecastGrid(mode, sectorKey, forceRefresh);
    const nodes = gridResponse.nodes || [];
    const gridMeta = gridResponse.metadata;

    // Step 2: Ingest live/cached official IMD RSS warnings
    let officialAlerts: DisasterAlert[] = [];
    try {
      const rawAlerts = await this.alertService.fetchRawIMDAlerts();
      officialAlerts = rawAlerts.alerts || [];
    } catch (err) {
      // Graceful fallback to empty alerts if IMD RSS unavailable
      officialAlerts = [];
    }

    // Step 3: Spatial association — map grid nodes to districts via Point-in-Polygon
    // Group: `${district}::${state}` -> ForecastGridNode[]
    const districtNodesMap = new Map<string, ForecastGridNode[]>();

    for (const node of nodes) {
      const match = this.boundaryService.findDistrictByCoordinates(node.modelLat, node.modelLon);
      if (match && match.matchStatus === 'RESOLVED_DISTRICT') {
        const key = `${match.canonicalDistrict}::${match.canonicalState}`;
        if (!districtNodesMap.has(key)) {
          districtNodesMap.set(key, []);
        }
        districtNodesMap.get(key)!.push(node);
      }
    }

    // Step 4: Evaluate District Impacts
    const districtImpacts: DistrictForecastImpact[] = [];

    if (mode === 'sector') {
      // In sector mode: evaluate districts that have interior nodes,
      // plus compact districts within 25 km of returned sector grid nodes.
      const candidateDistricts = new Map<string, DistrictCentroidRecord>();

      // A) All districts containing at least one interior node
      for (const key of districtNodesMap.keys()) {
        const centroidRecord = this.districtCentroids.get(key);
        if (centroidRecord) {
          candidateDistricts.set(key, centroidRecord);
        } else {
          const [dist, st] = key.split('::');
          candidateDistricts.set(key, {
            district: dist,
            state: st,
            centroid: { lat: 0, lon: 0 },
          });
        }
      }

      // B) Proximity check: check all districts whose centroid is <= 25 km from nearest node
      for (const [key, record] of this.districtCentroids.entries()) {
        if (candidateDistricts.has(key)) continue;

        let minDist = Infinity;
        for (const node of nodes) {
          const d = haversineDistanceKm(record.centroid.lat, record.centroid.lon, node.modelLat, node.modelLon);
          if (d < minDist) minDist = d;
        }

        if (minDist <= 25.0) {
          candidateDistricts.set(key, record);
        }
      }

      // Build impact for each candidate district in sector
      for (const [key, record] of candidateDistricts.entries()) {
        const interiorNodes = districtNodesMap.get(key) || [];
        const impact = this.buildDistrictImpact(
          record,
          interiorNodes,
          nodes,
          officialAlerts,
          'sector',
          25.0
        );
        if (impact) {
          districtImpacts.push(impact);
        }
      }
    } else {
      // In national synoptic mode: evaluate all registered 641 districts
      for (const [key, record] of this.districtCentroids.entries()) {
        const interiorNodes = districtNodesMap.get(key) || [];
        const impact = this.buildDistrictImpact(
          record,
          interiorNodes,
          nodes,
          officialAlerts,
          'national',
          75.0 // synoptic proximity boundary
        );
        if (impact) {
          districtImpacts.push(impact);
        }
      }
    }

    // Sort by 24h accumulation descending (nulls placed at end)
    districtImpacts.sort((a, b) => {
      const valA = a.metrics.futureAccum24hMm ?? -1;
      const valB = b.metrics.futureAccum24hMm ?? -1;
      return valB - valA;
    });

    // Summary counts
    let sufficientCount = 0;
    let heavyCount = 0;
    let veryHeavyCount = 0;
    let extremeCount = 0;

    for (const d of districtImpacts) {
      if (d.coverage.status === 'SUFFICIENT_MESOSCALE' || d.coverage.status === 'SYNOPTIC_INDICATIVE') {
        sufficientCount++;
      }
      if (d.metrics.futureAccum24hMm !== null) {
        if (d.metrics.futureAccum24hMm >= 204.5) {
          extremeCount++;
          veryHeavyCount++;
          heavyCount++;
        } else if (d.metrics.futureAccum24hMm >= 115.5) {
          veryHeavyCount++;
          heavyCount++;
        } else if (d.metrics.futureAccum24hMm >= 64.5) {
          heavyCount++;
        }
      }
    }

    const metadata: ForecastImpactMetadata = {
      provider: gridMeta.provider,
      model: gridMeta.model,
      nativeResolution: gridMeta.nativeResolution,
      initializationTime: gridMeta.initializationTime,
      runCycle: gridMeta.runCycle,
      validStartTime: gridMeta.validStartTime,
      validEndTime: gridMeta.validEndTime,
      generatedAt: new Date().toISOString(),
      mode,
      activeSector: mode === 'sector' ? sectorKey : undefined,
      isFallback: gridMeta.isFallback,
      isStale: gridMeta.isStale,
      fallbackReason: gridMeta.fallbackReason,
      staleReason: gridMeta.staleReason,
      scientificDisclaimer:
        mode === 'national'
          ? 'SYNOPTIC_INDICATIVE_ONLY: National macro-mesh (1.5° spacing) provides regional synoptic trends. Small-scale orographic and convective extremes are unrepresented. Not for municipal civil defense directives.'
          : 'MESOSCALE_FORECAST_ASSESSMENT: Derived from NWP precipitation accumulation. Does not model 2D hydrodynamic overland flow, stormwater backwater surcharge, or reservoir breaches.',
      dataQualityDisclaimer:
        'Rainfall metrics represent prospective accumulations from initialization time (T+1 onwards). T+0 analysis hour is excluded. Future 72h accumulation is null under T+0..T+71 contract.',
      accumulationConvention: 'Prospective hourly accumulation: 6h (T+1..T+6), 12h (T+1..T+12), 24h (T+1..T+24), 48h (T+1..T+48).',
    };

    return {
      metadata,
      summary: {
        districtsEvaluated: districtImpacts.length,
        districtsWithSufficientCoverage: sufficientCount,
        districtsInHeavyOrAbove: heavyCount,
        districtsInVeryHeavyOrAbove: veryHeavyCount,
        districtsInExtremelyHeavy: extremeCount,
        topImpactedDistricts: districtImpacts.slice(0, 15),
      },
      districts: districtImpacts,
    };
  }

  /**
   * Constructs an individual DistrictForecastImpact object with strict coverage and quality boundaries.
   */
  private buildDistrictImpact(
    districtRecord: DistrictCentroidRecord,
    interiorNodes: ForecastGridNode[],
    allSectorNodes: ForecastGridNode[],
    officialAlerts: DisasterAlert[],
    mode: ForecastGridMode,
    maxFallbackDistanceKm: number
  ): DistrictForecastImpact | null {
    const { district, state, censusCode, centroid } = districtRecord;

    let status: DistrictCoverageStatus = 'INSUFFICIENT_DATA';
    let method: DistrictSamplingMethod = 'NONE';
    let contributingNodes: ForecastGridNode[] = [];
    let meanDistanceKm: number | undefined;
    let coverageNotice: string | undefined;

    if (interiorNodes.length > 0) {
      contributingNodes = interiorNodes;
      method = 'POLYGON_INTERIOR';
      status = mode === 'sector' ? 'SUFFICIENT_MESOSCALE' : 'SYNOPTIC_INDICATIVE';
    } else {
      // Find nearest grid node to district centroid
      let nearestNode: ForecastGridNode | null = null;
      let minDistance = Infinity;

      for (const node of allSectorNodes) {
        const d = haversineDistanceKm(centroid.lat, centroid.lon, node.modelLat, node.modelLon);
        if (d < minDistance) {
          minDistance = d;
          nearestNode = node;
        }
      }

      if (nearestNode && minDistance <= maxFallbackDistanceKm) {
        contributingNodes = [nearestNode];
        method = 'PROXIMITY_CENTROID_BOUNDED';
        meanDistanceKm = Math.round(minDistance * 10) / 10;
        status = mode === 'sector' ? 'SUFFICIENT_MESOSCALE' : 'SYNOPTIC_INDICATIVE';
        coverageNotice = `Estimated from nearest NWP node located ${meanDistanceKm} km from district centroid.`;
      } else {
        status = 'INSUFFICIENT_DATA';
        method = 'NONE';
        coverageNotice = `No NWP forecast grid nodes within defensible radius (${maxFallbackDistanceKm} km).`;
      }
    }

    // If insufficient coverage, return with null metrics
    if (status === 'INSUFFICIENT_DATA' || contributingNodes.length === 0) {
      return {
        district,
        state,
        censusCode,
        coverage: {
          status: 'INSUFFICIENT_DATA',
          nodeCount: 0,
          method: 'NONE',
          coverageNotice,
        },
        metrics: {
          futureAccum6hMm: null,
          futureAccum12hMm: null,
          futureAccum24hMm: null,
          futureAccum48hMm: null,
          futureAccum72hMm: null,
          accum72hQualityReason: 'INSUFFICIENT_SPATIAL_COVERAGE',
          peakHourlyRateMmH: null,
          peakHourlyTimeUtc: null,
          peakHourlyRateCategory: 'NEGLIGIBLE',
          maxWindGustKmh: null,
        },
        dataQuality: {
          isComplete: false,
          totalExpectedHours: 72,
          totalAvailableHours: 0,
          continuityValid: false,
          qualityNotice: coverageNotice,
        },
        classification: {
          imdRainfallCategory: 'NO_RAIN',
          thresholdDefinition: 'IMD 24h: < 15mm (No Rain / Light Rain)',
        },
        localExposure: this.calculateLocalExposure(district),
      };
    }

    // Aggregate contributing nodes
    const nodeMetricsList = contributingNodes.map((node) =>
      computeNodeFutureAccumulations(node.hourly || [])
    );

    // Compute average accumulations across contributing nodes
    function averageMetric(getter: (m: ReturnType<typeof computeNodeFutureAccumulations>) => number | null): number | null {
      const validVals: number[] = [];
      for (const m of nodeMetricsList) {
        const v = getter(m);
        if (v !== null && !isNaN(v)) {
          validVals.push(v);
        }
      }
      if (validVals.length === 0) return null;
      const sum = validVals.reduce((acc, val) => acc + val, 0);
      return Math.round((sum / validVals.length) * 10) / 10;
    }

    const futureAccum6hMm = averageMetric((m) => m.accum6hMm);
    const futureAccum12hMm = averageMetric((m) => m.accum12hMm);
    const futureAccum24hMm = averageMetric((m) => m.accum24hMm);
    const futureAccum48hMm = averageMetric((m) => m.accum48hMm);
    const futureAccum72hMm = averageMetric((m) => m.accum72hMm); // strictly null unless length >= 73

    // Extrema: max peak rate and max gust across contributing nodes
    let peakRate: number | null = null;
    let peakTime: string | null = null;
    let maxGust: number | null = null;

    for (const m of nodeMetricsList) {
      if (m.peakHourlyRateMmH !== null && (peakRate === null || m.peakHourlyRateMmH > peakRate)) {
        peakRate = m.peakHourlyRateMmH;
        peakTime = m.peakHourlyTimeUtc;
      }
      if (m.maxWindGustKmh !== null && (maxGust === null || m.maxWindGustKmh > maxGust)) {
        maxGust = m.maxWindGustKmh;
      }
    }

    // Continuity and data quality aggregation
    const allContinuous = nodeMetricsList.every((m) => m.quality.continuityValid);
    const minHours = Math.min(...nodeMetricsList.map((m) => m.quality.totalAvailableHours));

    const quality: DistrictDataQuality = {
      isComplete: allContinuous && minHours >= 72,
      totalExpectedHours: 72,
      totalAvailableHours: minHours,
      continuityValid: allContinuous,
      qualityNotice: allContinuous
        ? undefined
        : nodeMetricsList.find((m) => m.quality.qualityNotice)?.quality.qualityNotice,
    };

    // IMD Rainfall Classification
    const imdCategory = classifyImd24hRainfall(futureAccum24hMm);
    const imdRateCategory = classifyImdHourlyRate(peakRate);

    // Official IMD Warning Bulletin match
    let officialAlertMatch: DistrictClassification['officialImdAlert'] | undefined;
    for (const alert of officialAlerts) {
      if (this.alertService.getBoundaryService().isBulletinMatch(alert.headline, district, state)) {
        const severity = alert.severity;
        let color: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' = 'GREEN';
        if (severity === 'EMERGENCY') color = 'RED';
        else if (severity === 'WARNING') color = 'ORANGE';
        else if (severity === 'WATCH') color = 'YELLOW';

        officialAlertMatch = {
          severity,
          color,
          headline: alert.headline,
          issuedAt: alert.issuedAt,
        };
        break;
      }
    }

    const classification: DistrictClassification = {
      imdRainfallCategory: imdCategory,
      thresholdDefinition: this.getImdThresholdDefinition(imdCategory),
      officialImdAlert: officialAlertMatch,
    };

    return {
      district,
      state,
      censusCode,
      coverage: {
        status,
        nodeCount: contributingNodes.length,
        method,
        meanDistanceKm,
        coverageNotice,
      },
      metrics: {
        futureAccum6hMm,
        futureAccum12hMm,
        futureAccum24hMm,
        futureAccum48hMm,
        futureAccum72hMm,
        accum72hQualityReason:
          futureAccum72hMm === null
            ? 'INSUFFICIENT_FORECAST_HORIZON: NWP contract provides 71 future hours (T+1..T+71); complete 72-hour future accumulation requires T+72.'
            : undefined,
        peakHourlyRateMmH: peakRate,
        peakHourlyTimeUtc: peakTime,
        peakHourlyRateCategory: imdRateCategory,
        maxWindGustKmh: maxGust,
      },
      dataQuality: quality,
      classification,
      localExposure: this.calculateLocalExposure(district),
    };
  }

  /**
   * Helper to retrieve formal threshold definitions for IMD 24h categories.
   */
  private getImdThresholdDefinition(cat: ImdRainfallCategory): string {
    switch (cat) {
      case 'NO_RAIN':
        return 'IMD 24h: 0.0 mm (Nil / Trace)';
      case 'LIGHT_RAIN':
        return 'IMD 24h: 0.1 - 15.0 mm (Light Rain)';
      case 'MODERATE_RAIN':
        return 'IMD 24h: 15.0 - 64.4 mm (Moderate Rain)';
      case 'HEAVY_RAIN':
        return 'IMD 24h: 64.5 - 115.4 mm (Heavy Rain)';
      case 'VERY_HEAVY_RAIN':
        return 'IMD 24h: 115.5 - 204.4 mm (Very Heavy Rain)';
      case 'EXTREMELY_HEAVY_RAIN':
        return 'IMD 24h: >= 204.5 mm (Extremely Heavy Rain)';
    }
  }

  /**
   * Evaluates local infrastructure and historical vulnerability point exposure.
   */
  private calculateLocalExposure(district: string): DistrictLocalExposure {
    const districtUpper = district.toUpperCase().trim();

    // 1. Emergency Facilities
    const matchedFacilities = this.verifiedFacilities.filter(
      (f) => String(f.district || '').toUpperCase().trim() === districtUpper
    );

    let hospitals = 0;
    let shelters = 0;
    let fireStations = 0;
    let other = 0;

    for (const fac of matchedFacilities) {
      const cat = String(fac.category || '').toUpperCase();
      if (cat.includes('HOSPITAL') || cat.includes('HEALTH') || cat.includes('MEDICAL')) {
        hospitals++;
      } else if (cat.includes('SHELTER') || cat.includes('RELIEF') || cat.includes('COMMUNITY')) {
        shelters++;
      } else if (cat.includes('FIRE')) {
        fireStations++;
      } else {
        other++;
      }
    }

    // 2. Choke points: strictly for Chennai
    let chokepointsCount: number | undefined;
    let exposureNotice: string;

    if (districtUpper === 'CHENNAI') {
      chokepointsCount = this.chennaiChokepoints.length;
      exposureNotice = `Evaluated against ${this.chennaiChokepoints.length} verified historical Adyar River basin and arterial drainage bottlenecks.`;
    } else {
      exposureNotice =
        'Historical flood choke points registry is localized to Chennai Adyar basin; no historical choke points registered for this district.';
    }

    return {
      verifiedEmergencyFacilitiesCount: matchedFacilities.length,
      facilityTypes: {
        hospitals,
        shelters,
        fireStations,
        other,
      },
      chennaiHistoricalChokepointsCount: chokepointsCount,
      exposureNotice,
    };
  }
}

// Global Singleton Instance
export const forecastImpactService = new ForecastImpactService();
