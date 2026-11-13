import { describe, it, expect } from 'vitest';
import {
  enrichDistrictsWithImpact,
  getFeatureBounds,
  IMD_CATEGORY_MAP_COLORS,
  FORECAST_IMPACT_SOURCE_ID,
  FORECAST_IMPACT_FILL_LAYER_ID,
  FORECAST_IMPACT_LINE_LAYER_ID,
  FORECAST_IMPACT_HIGHLIGHT_LAYER_ID,
} from '../services/forecast-impact-layer';
import type { ForecastImpactResponse } from '../services/forecast-impact';

describe('ForecastImpactLayer - Phase 3D-2B Unit Tests', () => {
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

  const mockImpactResponse: ForecastImpactResponse = {
    status: 'success',
    timestamp: '2026-11-13T12:00:00Z',
    metadata: {
      mode: 'sector',
      sector: 'chennai',
      model: 'ECMWF IFS',
      provider: 'Open-Meteo',
      runCycle: '00Z',
      initializationTime: '2026-11-13T00:00:00Z',
      nativeResolution: '0.25°',
      forecastResolution: '0.25° (~28 km)',
      samplingIntervalKm: 28,
      timestepsAvailable: 72,
      isFallback: false,
      isStale: false,
    },
    summary: {
      totalDistricts: 2,
      districtsWithSufficientCoverage: 2,
      districtsWithCentroidFallback: 0,
      districtsUnrepresented: 0,
      maxFuture24hMm: 215.4,
      dominantImdCategory: 'EXTREMELY_HEAVY_RAIN',
    },
    districts: [
      {
        district: 'CHENNAI',
        state: 'TAMIL NADU',
        metrics: {
          futureAccum24hMm: 215.4,
          futureAccum48hMm: 310.2,
          futureAccum72hMm: null,
          maxHourlyPrecipMm: 45.2,
          peakPrecipHourIndex: 8,
          peakPrecipTimestamp: '2026-11-13T08:00:00Z',
          riskLevel: 'CRITICAL',
        },
        classification: {
          imdRainfallCategory: 'EXTREMELY_HEAVY_RAIN',
          imdColorToken: '#C026D3',
          narrative: 'Extremely heavy rainfall expected',
          officialImdAlert: null,
        },
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'MULTI_NODE_REPRESENTATIVE',
          nodeCount: 4,
          nodeDensityPer1000SqKm: 2.3,
          meanDistanceKm: 8.5,
          maxDistanceKm: 14.2,
          defensibleGridSpacingKm: 28,
        },
        population: null,
        exposure: {
          chokePointsCoLocated: [
            {
              id: 'VP-01',
              name: 'Saidapet Bridge Bottleneck',
              severity: 'CRITICAL',
              type: 'BOTTLENECK',
              coordinates: [80.22, 13.01],
            },
          ],
        },
      },
      {
        district: 'PUNCH',
        state: 'JAMMU AND KASHMIR',
        metrics: {
          futureAccum24hMm: 4.2,
          futureAccum48hMm: 8.0,
          futureAccum72hMm: null,
          maxHourlyPrecipMm: 1.1,
          peakPrecipHourIndex: 3,
          peakPrecipTimestamp: '2026-11-13T03:00:00Z',
          riskLevel: 'LOW',
        },
        classification: {
          imdRainfallCategory: 'LIGHT_RAIN',
          imdColorToken: '#0284C7',
          narrative: 'Light rainfall expected',
          officialImdAlert: null,
        },
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'SINGLE_NODE_LOCALIZED',
          nodeCount: 1,
          nodeDensityPer1000SqKm: 0.6,
          meanDistanceKm: 12.0,
          maxDistanceKm: 12.0,
          defensibleGridSpacingKm: 28,
        },
        population: null,
        exposure: {
          chokePointsCoLocated: [],
        },
      },
    ],
  };

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
  });

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
});
