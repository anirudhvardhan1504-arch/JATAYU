import { describe, it, expect, vi } from 'vitest';
import {
  enrichDistrictsWithImpact,
  getFeatureBounds,
  findBeforeLayerId,
  classifyImd24hRainfall,
  VALID_IMD_CATEGORIES,
  IMD_CATEGORY_MAP_COLORS,
  FORECAST_IMPACT_SOURCE_ID,
  FORECAST_IMPACT_FILL_LAYER_ID,
  FORECAST_IMPACT_LINE_LAYER_ID,
  FORECAST_IMPACT_HIGHLIGHT_LAYER_ID,
} from '../services/forecast-impact-layer';
import type { ForecastImpactResponse, DistrictForecastImpact } from '../services/forecast-impact';

describe('ForecastImpactLayer - Phase 3D-2B & 3D-2B1 Unit Tests', () => {
  const mockBaseGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          district: 'CHENNAI',
          state: 'TAMIL NADU',
          census_code: '603',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [80.1, 12.9],
              [80.3, 12.9],
              [80.3, 13.2],
              [80.1, 13.2],
              [80.1, 12.9],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          district: 'KANCHIPURAM',
          state: 'TAMIL NADU',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [79.5, 12.5],
              [79.9, 12.5],
              [79.9, 13.0],
              [79.5, 13.0],
              [79.5, 12.5],
            ],
          ],
        },
      },
      {
        type: 'Feature',
        properties: {
          district: 'PUNCH',
          state: 'JAMMU AND KASHMIR',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [74.0, 33.5],
              [74.3, 33.5],
              [74.3, 33.9],
              [74.0, 33.9],
              [74.0, 33.5],
            ],
          ],
        },
      },
    ],
  };

  const createMockDistrict = (overrides: Partial<DistrictForecastImpact> = {}): DistrictForecastImpact => ({
    district: 'CHENNAI',
    state: 'TAMIL NADU',
    censusCode: '603',
    coverage: {
      status: 'SUFFICIENT_MESOSCALE',
      spatialDensity: 'MULTI_NODE_REPRESENTATIVE',
      nodeCount: 4,
      method: 'POLYGON_INTERIOR',
      meanDistanceKm: 8.5,
      coverageNotice: undefined,
    },
    metrics: {
      futureAccum6hMm: 45.0,
      futureAccum12hMm: 110.0,
      futureAccum24hMm: 215.4,
      futureAccum48hMm: 310.2,
      futureAccum72hMm: null,
      accum72hQualityReason: 'Only 71 hours future NWP available',
      peakHourlyRateMmH: 45.2,
      peakHourlyTimeUtc: '2026-11-13T08:00:00Z',
      peakHourlyRateCategory: 'HEAVY',
      maxWindGustKmh: 65.0,
    },
    dataQuality: {
      isComplete: true,
      totalExpectedHours: 72,
      totalAvailableHours: 72,
      continuityValid: true,
    },
    classification: {
      imdRainfallCategory: 'EXTREMELY_HEAVY_RAIN',
      thresholdDefinition: 'IMD 24h: >= 204.5 mm (Extremely Heavy Rain)',
    },
    localExposure: {
      verifiedEmergencyFacilitiesCount: 12,
      facilityTypes: {
        hospitals: 3,
        shelters: 6,
        fireStations: 0,
        other: 3,
      },
      exposureNotice: '12 facilities co-located',
    },
    ...overrides,
  });

  const mockImpactResponse: ForecastImpactResponse = {
    metadata: {
      provider: 'Open-Meteo',
      model: 'ECMWF IFS',
      nativeResolution: '0.25° regular lat/lon',
      gridSamplingResolution: '0.25° (~28 km nominal)',
      initializationTime: '2026-11-13T00:00:00Z',
      runCycle: '00Z',
      validStartTime: '2026-11-13T01:00:00Z',
      validEndTime: '2026-11-16T00:00:00Z',
      generatedAt: '2026-11-13T12:00:00Z',
      mode: 'sector',
      activeSector: 'chennai',
      isFallback: false,
      isStale: false,
      scientificDisclaimer: 'Meteorological hazard forecast only',
      dataQualityDisclaimer: 'Aggregated from NWP grid nodes',
      accumulationConvention: 'Prospective accumulation from T+1',
    },
    summary: {
      districtsEvaluated: 2,
      districtsWithSufficientCoverage: 2,
      districtsInHeavyOrAbove: 1,
      districtsInVeryHeavyOrAbove: 1,
      districtsInExtremelyHeavy: 1,
      topImpactedDistricts: [],
    },
    districts: [
      createMockDistrict({
        district: 'CHENNAI',
        state: 'TAMIL NADU',
        metrics: {
          futureAccum6hMm: 45.0,
          futureAccum12hMm: 110.0,
          futureAccum24hMm: 215.4,
          futureAccum48hMm: 310.2,
          futureAccum72hMm: null,
          accum72hQualityReason: 'Only 71 hours future NWP available',
          peakHourlyRateMmH: 45.2,
          peakHourlyTimeUtc: '2026-11-13T08:00:00Z',
          peakHourlyRateCategory: 'HEAVY',
          maxWindGustKmh: 65.0,
        },
        classification: {
          imdRainfallCategory: 'EXTREMELY_HEAVY_RAIN',
          thresholdDefinition: 'IMD 24h: >= 204.5 mm (Extremely Heavy Rain)',
        },
      }),
      createMockDistrict({
        district: 'PUNCH',
        state: 'JAMMU AND KASHMIR',
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'SINGLE_NODE_LOCALIZED',
          nodeCount: 1,
          method: 'POLYGON_INTERIOR',
          meanDistanceKm: 12.0,
          coverageNotice: 'Single node localized sampling',
        },
        metrics: {
          futureAccum6hMm: 1.0,
          futureAccum12hMm: 2.5,
          futureAccum24hMm: 4.2,
          futureAccum48hMm: 8.0,
          futureAccum72hMm: null,
          accum72hQualityReason: 'Only 71 hours future NWP available',
          peakHourlyRateMmH: 1.1,
          peakHourlyTimeUtc: '2026-11-13T03:00:00Z',
          peakHourlyRateCategory: 'LIGHT',
          maxWindGustKmh: 20.0,
        },
        classification: {
          imdRainfallCategory: 'LIGHT_RAIN',
          thresholdDefinition: 'IMD 24h: 0.1 - 15.0 mm (Light Rain)',
        },
      }),
    ],
  };

  describe('1. Layer Identifiers and Color Palette Definitions', () => {
    it('exposes standard layer identifiers and color palette definitions', () => {
      expect(FORECAST_IMPACT_SOURCE_ID).toBe('jatayu-forecast-impact-districts-source');
      expect(FORECAST_IMPACT_FILL_LAYER_ID).toBe('jatayu-forecast-impact-districts-fill');
      expect(FORECAST_IMPACT_LINE_LAYER_ID).toBe('jatayu-forecast-impact-districts-line');
      expect(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID).toBe('jatayu-forecast-impact-districts-highlight');

      expect(IMD_CATEGORY_MAP_COLORS.EXTREMELY_HEAVY_RAIN.fill).toBe('#C026D3');
      expect(IMD_CATEGORY_MAP_COLORS.VERY_HEAVY_RAIN.fill).toBe('#DC2626');
      expect(IMD_CATEGORY_MAP_COLORS.HEAVY_RAIN.fill).toBe('#EA580C');
      expect(IMD_CATEGORY_MAP_COLORS.MODERATE_RAIN.fill).toBe('#D97706');
      expect(IMD_CATEGORY_MAP_COLORS.LIGHT_RAIN.fill).toBe('#0284C7');
      expect(IMD_CATEGORY_MAP_COLORS.NO_RAIN.fill).toBe('#334155');
      expect(IMD_CATEGORY_MAP_COLORS.INSUFFICIENT_DATA.fill).toBe('#1E293B');

      // 24h accumulation threshold labels (Phase 3D-2B1 correction)
      expect(IMD_CATEGORY_MAP_COLORS.EXTREMELY_HEAVY_RAIN.label).toContain('≥ 204.5 mm');
      expect(IMD_CATEGORY_MAP_COLORS.VERY_HEAVY_RAIN.label).toContain('115.5–204.4 mm');
      expect(IMD_CATEGORY_MAP_COLORS.HEAVY_RAIN.label).toContain('64.5–115.4 mm');
      expect(IMD_CATEGORY_MAP_COLORS.MODERATE_RAIN.label).toContain('15.0–64.4 mm');
      expect(IMD_CATEGORY_MAP_COLORS.LIGHT_RAIN.label).toContain('0.1–14.9 mm');
      expect(IMD_CATEGORY_MAP_COLORS.NO_RAIN.label).toContain('0.0 mm / Nil');
    });

    it('defines the complete set of valid IMD categories', () => {
      expect(VALID_IMD_CATEGORIES.has('NO_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.has('LIGHT_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.has('MODERATE_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.has('HEAVY_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.has('VERY_HEAVY_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.has('EXTREMELY_HEAVY_RAIN')).toBe(true);
      expect(VALID_IMD_CATEGORIES.size).toBe(6);
    });
  });

  describe('2. Authoritative 24-Hour IMD Classification Boundaries', () => {
    it('classifies 0.0 mm as NO_RAIN', () => {
      expect(classifyImd24hRainfall(0.0)).toBe('NO_RAIN');
      expect(classifyImd24hRainfall(0)).toBe('NO_RAIN');
    });

    it('classifies 0.1 mm as LIGHT_RAIN', () => {
      expect(classifyImd24hRainfall(0.1)).toBe('LIGHT_RAIN');
    });

    it('classifies 14.99 mm as LIGHT_RAIN', () => {
      expect(classifyImd24hRainfall(14.99)).toBe('LIGHT_RAIN');
    });

    it('classifies 15.0 mm as MODERATE_RAIN (boundary operator: < 15.0 vs >= 15.0)', () => {
      expect(classifyImd24hRainfall(15.0)).toBe('MODERATE_RAIN');
    });

    it('classifies 64.4 mm as MODERATE_RAIN', () => {
      expect(classifyImd24hRainfall(64.4)).toBe('MODERATE_RAIN');
    });

    it('classifies 64.5 mm as HEAVY_RAIN (boundary operator: < 64.5 vs >= 64.5)', () => {
      expect(classifyImd24hRainfall(64.5)).toBe('HEAVY_RAIN');
    });

    it('classifies 115.4 mm as HEAVY_RAIN', () => {
      expect(classifyImd24hRainfall(115.4)).toBe('HEAVY_RAIN');
    });

    it('classifies 115.5 mm as VERY_HEAVY_RAIN (boundary operator: < 115.5 vs >= 115.5)', () => {
      expect(classifyImd24hRainfall(115.5)).toBe('VERY_HEAVY_RAIN');
    });

    it('classifies 204.4 mm as VERY_HEAVY_RAIN', () => {
      expect(classifyImd24hRainfall(204.4)).toBe('VERY_HEAVY_RAIN');
    });

    it('classifies 204.5 mm as EXTREMELY_HEAVY_RAIN (boundary operator: >= 204.5)', () => {
      expect(classifyImd24hRainfall(204.5)).toBe('EXTREMELY_HEAVY_RAIN');
      expect(classifyImd24hRainfall(350.0)).toBe('EXTREMELY_HEAVY_RAIN');
    });

    it('strictly maps null, undefined, NaN, and negative rainfall to INSUFFICIENT_DATA, never NO_RAIN', () => {
      expect(classifyImd24hRainfall(null)).toBe('INSUFFICIENT_DATA');
      expect(classifyImd24hRainfall(undefined)).toBe('INSUFFICIENT_DATA');
      expect(classifyImd24hRainfall(NaN)).toBe('INSUFFICIENT_DATA');
      expect(classifyImd24hRainfall(-5)).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('3. GeoJSON Feature Enrichment & Category Styling', () => {
    it('enriches base GeoJSON features with forecast impact metrics and colors', () => {
      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, mockImpactResponse, null);
      expect(enriched.features.length).toBe(3);

      const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
      expect(chennai).toBeDefined();
      expect(chennai?.properties?.hasData).toBe(true);
      expect(chennai?.properties?.accum24h).toBe(215.4);
      expect(chennai?.properties?.category).toBe('EXTREMELY_HEAVY_RAIN');
      expect(chennai?.properties?.fillColor).toBe('#C026D3');
      expect(chennai?.properties?.isSingleNode).toBe(false);

      // Kanchipuram is not in the mock API response -> neutral unrepresented styling
      const kanchipuram = enriched.features.find((f) => f.properties?.district === 'KANCHIPURAM');
      expect(kanchipuram).toBeDefined();
      expect(kanchipuram?.properties?.hasData).toBe(false);
      expect(kanchipuram?.properties?.category).toBe('INSUFFICIENT_DATA');
      expect(kanchipuram?.properties?.fillColor).toBe('#1E293B');
    });

    it('correctly tags single-node localized districts to prevent false confidence', () => {
      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, mockImpactResponse, null);
      const punch = enriched.features.find((f) => f.properties?.district === 'PUNCH');
      expect(punch).toBeDefined();
      expect(punch?.properties?.hasData).toBe(true);
      expect(punch?.properties?.isSingleNode).toBe(true);
      expect(punch?.properties?.spatialDensity).toBe('SINGLE_NODE_LOCALIZED');
      expect(punch?.properties?.category).toBe('LIGHT_RAIN');
      expect(punch?.properties?.fillColor).toBe('#0284C7');
    });

    it('identifies selected district and configures highlight properties', () => {
      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, mockImpactResponse, 'CHENNAI');
      const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
      const punch = enriched.features.find((f) => f.properties?.district === 'PUNCH');

      expect(chennai?.properties?.isSelected).toBe(true);
      expect(chennai?.properties?.strokeColor).toBe('#FFFFFF');
      expect(chennai?.properties?.fillOpacity).toBe(0.85);

      expect(punch?.properties?.isSelected).toBe(false);
      expect(punch?.properties?.fillOpacity).toBe(0.65);
    });

    it('tags national synoptic mode features as indicative with dashed styling', () => {
      const nationalResponse: ForecastImpactResponse = {
        ...mockImpactResponse,
        metadata: {
          ...mockImpactResponse.metadata,
          mode: 'national',
        },
      };
      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, nationalResponse, null);
      const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
      expect(chennai?.properties?.isIndicative).toBe(true);
    });

    it('calculates geographic bounding boxes accurately for camera focusing', () => {
      const chennaiFeature = mockBaseGeoJSON.features[0];
      const bounds = getFeatureBounds(chennaiFeature);
      expect(bounds).not.toBeNull();
      if (bounds) {
        expect(bounds[0]).toBeCloseTo(80.1);
        expect(bounds[1]).toBeCloseTo(12.9);
        expect(bounds[2]).toBeCloseTo(80.3);
        expect(bounds[3]).toBeCloseTo(13.2);
      }
    });

    it('handles null response safely with neutral unrepresented styling across all features', () => {
      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, null, null);
      expect(enriched.features.length).toBe(3);
      for (const f of enriched.features) {
        expect(f.properties?.hasData).toBe(false);
        expect(f.properties?.category).toBe('INSUFFICIENT_DATA');
        expect(f.properties?.fillColor).toBe('#1E293B');
        expect(f.properties?.accum24h).toBeNull();
      }
    });

    it('never converts null or undefined rainfall into NO_RAIN in district enrichment', () => {
      const testResponse: ForecastImpactResponse = {
        ...mockImpactResponse,
        districts: [
          createMockDistrict({
            district: 'CHENNAI',
            state: 'TAMIL NADU',
            coverage: {
              status: 'INSUFFICIENT_DATA',
              spatialDensity: 'UNREPRESENTED',
              nodeCount: 0,
              method: 'NONE',
            },
            metrics: {
              futureAccum6hMm: null,
              futureAccum12hMm: null,
              futureAccum24hMm: null,
              futureAccum48hMm: null,
              futureAccum72hMm: null,
              peakHourlyRateMmH: null,
              peakHourlyTimeUtc: null,
              peakHourlyRateCategory: 'NEGLIGIBLE',
              maxWindGustKmh: null,
            },
            classification: {
              imdRainfallCategory: 'NO_RAIN', // Upstream might wrongly tag null as NO_RAIN
              thresholdDefinition: 'IMD 24h: 0.0 mm',
            },
          }),
        ],
      };

      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, testResponse, null);
      const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
      expect(chennai?.properties?.category).toBe('INSUFFICIENT_DATA');
      expect(chennai?.properties?.fillColor).toBe('#1E293B');
      expect(chennai?.properties?.accum24h).toBeNull();
    });

    it('properly falls back to classifyImd24hRainfall when rawCategory is missing or invalid', () => {
      const testResponse: ForecastImpactResponse = {
        ...mockImpactResponse,
        districts: [
          createMockDistrict({
            district: 'CHENNAI',
            state: 'TAMIL NADU',
            metrics: {
              futureAccum6hMm: 20.0,
              futureAccum12hMm: 45.0,
              futureAccum24hMm: 65.0, // Should classify as HEAVY_RAIN (64.5 - 115.4)
              futureAccum48hMm: 100.0,
              futureAccum72hMm: null,
              peakHourlyRateMmH: 12.0,
              peakHourlyTimeUtc: null,
              peakHourlyRateCategory: 'HEAVY',
              maxWindGustKmh: 40.0,
            },
            classification: {
              imdRainfallCategory: 'INVALID_CATEGORY' as any, // Missing / corrupted category
              thresholdDefinition: '',
            },
          }),
        ],
      };

      const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, testResponse, null);
      const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
      expect(chennai?.properties?.category).toBe('HEAVY_RAIN');
      expect(chennai?.properties?.fillColor).toBe('#EA580C');
      expect(chennai?.properties?.accum24h).toBe(65.0);
    });

    it('verifies exact boundary values when classifying 24h rainfall in enriched features', () => {
      const testCases: { value: number; expectedCategory: string; expectedColor: string }[] = [
        { value: 0.0, expectedCategory: 'NO_RAIN', expectedColor: '#334155' },
        { value: 0.1, expectedCategory: 'LIGHT_RAIN', expectedColor: '#0284C7' },
        { value: 14.99, expectedCategory: 'LIGHT_RAIN', expectedColor: '#0284C7' },
        { value: 15.0, expectedCategory: 'MODERATE_RAIN', expectedColor: '#D97706' },
        { value: 64.4, expectedCategory: 'MODERATE_RAIN', expectedColor: '#D97706' },
        { value: 64.5, expectedCategory: 'HEAVY_RAIN', expectedColor: '#EA580C' },
        { value: 115.4, expectedCategory: 'HEAVY_RAIN', expectedColor: '#EA580C' },
        { value: 115.5, expectedCategory: 'VERY_HEAVY_RAIN', expectedColor: '#DC2626' },
        { value: 204.4, expectedCategory: 'VERY_HEAVY_RAIN', expectedColor: '#DC2626' },
        { value: 204.5, expectedCategory: 'EXTREMELY_HEAVY_RAIN', expectedColor: '#C026D3' },
      ];

      for (const tc of testCases) {
        const resp: ForecastImpactResponse = {
          ...mockImpactResponse,
          districts: [
            createMockDistrict({
              district: 'CHENNAI',
              state: 'TAMIL NADU',
              metrics: {
                futureAccum6hMm: tc.value * 0.25,
                futureAccum12hMm: tc.value * 0.5,
                futureAccum24hMm: tc.value,
                futureAccum48hMm: tc.value * 1.5,
                futureAccum72hMm: null,
                peakHourlyRateMmH: 5.0,
                peakHourlyTimeUtc: null,
                peakHourlyRateCategory: 'LIGHT',
                maxWindGustKmh: 30.0,
              },
              classification: {
                imdRainfallCategory: tc.expectedCategory as any,
                thresholdDefinition: '',
              },
            }),
          ],
        };

        const enriched = enrichDistrictsWithImpact(mockBaseGeoJSON, resp, null);
        const chennai = enriched.features.find((f) => f.properties?.district === 'CHENNAI');
        expect(chennai?.properties?.category).toBe(tc.expectedCategory);
        expect(chennai?.properties?.fillColor).toBe(tc.expectedColor);
        expect(chennai?.properties?.accum24h).toBe(tc.value);
      }
    });
  });

  describe('4. Map Layer Stacking & Precedence Verification', () => {
    it('places district layers below existing forecast scalar canvas layer', () => {
      const mockMap: any = {
        getLayer: vi.fn((id: string) => (id === 'jatayu-forecast-scalar-layer' ? {} : undefined)),
        getStyle: vi.fn(() => ({ layers: [] })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBe('jatayu-forecast-scalar-layer');
    });

    it('places district layers below satellite raster buffer layer', () => {
      const mockMap: any = {
        getLayer: vi.fn((id: string) => (id === 'nasa-gibs-satellite-layer-a' ? {} : undefined)),
        getStyle: vi.fn(() => ({ layers: [] })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBe('nasa-gibs-satellite-layer-a');
    });

    it('places district layers below rainviewer radar layer', () => {
      const mockMap: any = {
        getLayer: vi.fn((id: string) => (id === 'rainviewer-radar-layer' ? {} : undefined)),
        getStyle: vi.fn(() => ({ layers: [] })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBe('rainviewer-radar-layer');
    });

    it('places district layers below pressure contour lines and extrema markers', () => {
      const mockMap: any = {
        getLayer: vi.fn((id: string) => (id === 'jatayu-pressure-contours-line' ? {} : undefined)),
        getStyle: vi.fn(() => ({ layers: [] })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBe('jatayu-pressure-contours-line');
    });

    it('places district layers below SFINCS hydrodynamic simulation layers', () => {
      const mockMap: any = {
        getLayer: vi.fn((id: string) => (id === 'adyar-simulation-fill' ? {} : undefined)),
        getStyle: vi.fn(() => ({ layers: [] })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBe('adyar-simulation-fill');
    });

    it('safely falls back to inserting below basemap symbol layers when no weather overlays exist', () => {
      const mockMap: any = {
        getLayer: vi.fn(() => undefined),
        getStyle: vi.fn(() => ({
          layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill' },
            { id: 'road_network', type: 'line' },
            { id: 'place_labels', type: 'symbol' },
            { id: 'poi_labels', type: 'symbol' },
          ],
        })),
      };

      const target = findBeforeLayerId(mockMap);
      // Must be inserted before 'place_labels' so district fill is rendered below city/road labels
      expect(target).toBe('place_labels');
    });

    it('returns undefined safely when no overlays and no symbol layers are present in style', () => {
      const mockMap: any = {
        getLayer: vi.fn(() => undefined),
        getStyle: vi.fn(() => ({
          layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill' },
          ],
        })),
      };

      const target = findBeforeLayerId(mockMap);
      expect(target).toBeUndefined();
    });
  });
});
