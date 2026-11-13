/**
 * MapLibre District Forecast Impact Layer Manager for JATAYU Tactical Map 2.0 (Phase 3D-2B)
 *
 * Visualizes district-level meteorological rainfall hazard categories across
 * administrative polygons without presenting precipitation as flood inundation.
 *
 * Layer Hierarchy:
 * 1. Base Tile Layer (CARTO Dark Matter)
 * 2. JATAYU DISTRICT FORECAST IMPACT LAYERS ('jatayu-forecast-impact-districts-fill/line') <-- THIS LAYER
 * 3. JATAYU FORECAST SCALAR LAYER ('jatayu-forecast-scalar-layer')
 * 4. NASA GIBS Satellite Layers ('nasa-gibs-satellite-layer-a / -b')
 * 5. RainViewer Radar Layer ('rainviewer-radar-layer')
 * 6. JATAYU PRESSURE CONTOURS ('jatayu-pressure-contours-line', 'jatayu-pressure-contours-label')
 * 7. JATAYU PRESSURE EXTREMA ('jatayu-pressure-extrema-circle', 'jatayu-pressure-extrema-label')
 * 8. JATAYU WIND PARTICLES CANVAS
 * 9. SFINCS Hydrodynamic Simulation Layer ('adyar-simulation-fill', 'adyar-simulation-line')
 * 10. Interactive Reticle & Markers
 */

import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import type { ForecastImpactResponse } from './forecast-impact';

export const FORECAST_IMPACT_SOURCE_ID = 'jatayu-forecast-impact-districts-source';
export const FORECAST_IMPACT_FILL_LAYER_ID = 'jatayu-forecast-impact-districts-fill';
export const FORECAST_IMPACT_LINE_LAYER_ID = 'jatayu-forecast-impact-districts-line';
export const FORECAST_IMPACT_HIGHLIGHT_LAYER_ID = 'jatayu-forecast-impact-districts-highlight';

export interface ForecastImpactLayerOptions {
  response: ForecastImpactResponse | null;
  selectedDistrict: string | null;
  opacity: number; // 0 - 100
  visible: boolean;
  onSelectDistrict?: (districtName: string, state: string) => void;
}

export const IMD_CATEGORY_MAP_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  EXTREMELY_HEAVY_RAIN: {
    fill: '#C026D3', // Fuchsia / Purple (>= 204.5 mm)
    stroke: '#F0ABFC',
    label: 'Extremely Heavy (≥ 204.5 mm)',
  },
  VERY_HEAVY_RAIN: {
    fill: '#DC2626', // Red (115.6 - 204.4 mm)
    stroke: '#FCA5A5',
    label: 'Very Heavy (115.6 - 204.4 mm)',
  },
  HEAVY_RAIN: {
    fill: '#EA580C', // Orange (64.5 - 115.5 mm)
    stroke: '#FDBA74',
    label: 'Heavy (64.5 - 115.5 mm)',
  },
  MODERATE_RAIN: {
    fill: '#D97706', // Amber (15.6 - 64.4 mm)
    stroke: '#FDE68A',
    label: 'Moderate (15.6 - 64.4 mm)',
  },
  LIGHT_RAIN: {
    fill: '#0284C7', // Sky / Cyan (2.5 - 15.5 mm)
    stroke: '#7DD3FC',
    label: 'Light (2.5 - 15.5 mm)',
  },
  NO_RAIN: {
    fill: '#334155', // Slate (< 2.5 mm)
    stroke: '#64748B',
    label: 'No Rain (< 2.5 mm)',
  },
  INSUFFICIENT_DATA: {
    fill: '#1E293B', // Neutral dark slate (insufficient or unrepresented)
    stroke: '#475569',
    label: 'Insufficient Coverage (No Data)',
  },
};

// In-Memory Cached District Base GeoJSON
let cachedBaseDistrictGeoJSON: GeoJSON.FeatureCollection | null = null;
let inFlightFetch: Promise<GeoJSON.FeatureCollection | null> | null = null;

// Map event listener tracking to prevent duplicate bindings
let activeClickListener: ((e: any) => void) | null = null;
let activeMouseEnterListener: (() => void) | null = null;
let activeMouseLeaveListener: (() => void) | null = null;
let lastFocusedDistrict: string | null = null;

/**
 * Loads the canonical 641-district simplified GeoJSON.
 * Reuses in-memory cached copy once fetched.
 */
export async function loadDistrictGeoJSON(): Promise<GeoJSON.FeatureCollection | null> {
  if (cachedBaseDistrictGeoJSON) {
    return cachedBaseDistrictGeoJSON;
  }

  if (inFlightFetch) {
    return inFlightFetch;
  }

  inFlightFetch = (async () => {
    try {
      const response = await fetch('/data/india_districts_simplified.geojson');
      if (!response.ok) {
        throw new Error(`Failed to load district boundaries: HTTP ${response.status}`);
      }
      const data: GeoJSON.FeatureCollection = await response.json();
      cachedBaseDistrictGeoJSON = data;
      return data;
    } catch (err) {
      console.warn('[ForecastImpactLayer] Could not fetch district GeoJSON:', err);
      return null;
    } finally {
      inFlightFetch = null;
    }
  })();

  return inFlightFetch;
}

/**
 * Calculates the bounding box [minLon, minLat, maxLon, maxLat] of a GeoJSON Feature.
 */
export function getFeatureBounds(feature: GeoJSON.Feature): [number, number, number, number] | null {
  const geom = feature.geometry;
  if (!geom) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  function traverseCoords(coords: any) {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (const c of coords) {
        traverseCoords(c);
      }
    }
  }

  traverseCoords((geom as any).coordinates);
  if (minLon === Infinity || minLat === Infinity) return null;
  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Enriches the district GeoJSON with actual forecast impact metrics and category colors.
 */
export function enrichDistrictsWithImpact(
  baseGeoJSON: GeoJSON.FeatureCollection,
  impactResponse: ForecastImpactResponse | null,
  selectedDistrict: string | null
): GeoJSON.FeatureCollection {
  if (!impactResponse || !impactResponse.districts || impactResponse.districts.length === 0) {
    // Return with neutral unrepresented styling
    return {
      type: 'FeatureCollection',
      features: baseGeoJSON.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          hasData: false,
          accum24h: null,
          category: 'INSUFFICIENT_DATA',
          coverageStatus: 'INSUFFICIENT_DATA',
          spatialDensity: 'UNREPRESENTED',
          isSingleNode: false,
          isIndicative: false,
          isSelected: false,
          fillColor: IMD_CATEGORY_MAP_COLORS.INSUFFICIENT_DATA.fill,
          strokeColor: IMD_CATEGORY_MAP_COLORS.INSUFFICIENT_DATA.stroke,
          fillOpacity: 0.15,
        },
      })),
    };
  }

  const isIndicative = impactResponse.metadata?.mode === 'national';
  const selectedNorm = selectedDistrict ? selectedDistrict.trim().toUpperCase() : null;

  // Build lookup map from API response districts
  const impactMap = new Map<string, any>();
  for (const d of impactResponse.districts) {
    const dName = (d.district || (d as any).districtName || '').trim().toUpperCase();
    const sName = (d.state || '').trim().toUpperCase();
    if (dName) {
      impactMap.set(`${dName}::${sName}`, d);
      // Fallback secondary lookup by district name alone
      if (!impactMap.has(dName)) {
        impactMap.set(dName, d);
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features: baseGeoJSON.features.map((feature) => {
      const props = feature.properties || {};
      const dName = String(props.district || '').trim().toUpperCase();
      const sName = String(props.state || '').trim().toUpperCase();
      const match = impactMap.get(`${dName}::${sName}`) || impactMap.get(dName);

      const hasData = Boolean(match);
      const isSelected = Boolean(selectedNorm && (selectedNorm === dName || selectedNorm.includes(dName)));
      const rawCategory = match?.classification?.imdRainfallCategory;
      const coverageStatus = match?.coverage?.status || 'INSUFFICIENT_DATA';
      const spatialDensity = match?.coverage?.spatialDensity || 'UNREPRESENTED';
      const isSingleNode = spatialDensity === 'SINGLE_NODE_LOCALIZED';
      const isCentroidFallback = spatialDensity === 'CENTROID_PROXIMITY_ONLY';

      // Missing or invalid metrics must not be rendered as zero rainfall
      let category = 'INSUFFICIENT_DATA';
      let accum24h: number | null = null;

      if (match && coverageStatus !== 'INSUFFICIENT_DATA' && match.metrics && match.metrics.futureAccum24hMm !== null) {
        category = rawCategory || 'NO_RAIN';
        accum24h = match.metrics.futureAccum24hMm;
      }

      const styleDef = IMD_CATEGORY_MAP_COLORS[category] || IMD_CATEGORY_MAP_COLORS.INSUFFICIENT_DATA;
      const fillOpacity = isSelected ? 0.85 : hasData && category !== 'INSUFFICIENT_DATA' ? 0.65 : 0.15;

      return {
        ...feature,
        properties: {
          ...props,
          district: dName,
          state: sName,
          hasData,
          accum24h,
          category,
          categoryLabel: styleDef.label,
          coverageStatus,
          spatialDensity,
          isSingleNode,
          isCentroidFallback,
          isIndicative,
          isSelected,
          fillColor: styleDef.fill,
          strokeColor: isSelected ? '#FFFFFF' : styleDef.stroke,
          fillOpacity,
        },
      };
    }),
  };
}

/**
 * Finds the layer ID before which the district layers should be placed.
 * Placed before pressure contours, wind particles, and SFINCS simulation layers.
 */
function findBeforeLayerId(map: MapLibreMap): string | undefined {
  if (map.getLayer('jatayu-pressure-contours-line')) {
    return 'jatayu-pressure-contours-line';
  }
  if (map.getLayer('jatayu-pressure-extrema-circle')) {
    return 'jatayu-pressure-extrema-circle';
  }
  if (map.getLayer('adyar-simulation-fill')) {
    return 'adyar-simulation-fill';
  }
  if (map.getLayer('adyar-simulation-line')) {
    return 'adyar-simulation-line';
  }
  return undefined;
}

/**
 * Synchronizes the District Forecast Impact layers with MapLibre.
 */
export async function syncForecastImpactLayers(
  map: MapLibreMap,
  options: ForecastImpactLayerOptions
): Promise<void> {
  if (!map || typeof map.getLayer !== 'function') return;

  const { response, selectedDistrict, opacity = 65, visible, onSelectDistrict } = options;

  if (!visible) {
    hideForecastImpactLayers(map);
    return;
  }

  // Load district boundaries GeoJSON
  const baseGeoJSON = await loadDistrictGeoJSON();
  if (!baseGeoJSON) return;

  const enrichedGeoJSON = enrichDistrictsWithImpact(baseGeoJSON, response, selectedDistrict);
  const beforeLayer = findBeforeLayerId(map);
  const opacityRatio = Math.max(0.05, Math.min(1.0, opacity / 100));

  // 1. Source Management
  const existingSource = map.getSource(FORECAST_IMPACT_SOURCE_ID) as GeoJSONSource | undefined;
  if (!existingSource) {
    map.addSource(FORECAST_IMPACT_SOURCE_ID, {
      type: 'geojson',
      data: enrichedGeoJSON,
    });
  } else {
    existingSource.setData(enrichedGeoJSON);
  }

  // 2. Fill Layer
  if (!map.getLayer(FORECAST_IMPACT_FILL_LAYER_ID)) {
    map.addLayer(
      {
        id: FORECAST_IMPACT_FILL_LAYER_ID,
        type: 'fill',
        source: FORECAST_IMPACT_SOURCE_ID,
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': ['*', ['get', 'fillOpacity'], opacityRatio],
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(FORECAST_IMPACT_FILL_LAYER_ID, 'visibility', 'visible');
    map.setPaintProperty(FORECAST_IMPACT_FILL_LAYER_ID, 'fill-opacity', [
      '*',
      ['get', 'fillOpacity'],
      opacityRatio,
    ]);
  }

  // 3. Line Layer (Outlines with dashed styling for indicative national results)
  const isIndicative = response?.metadata?.mode === 'national';
  if (!map.getLayer(FORECAST_IMPACT_LINE_LAYER_ID)) {
    map.addLayer(
      {
        id: FORECAST_IMPACT_LINE_LAYER_ID,
        type: 'line',
        source: FORECAST_IMPACT_SOURCE_ID,
        paint: {
          'line-color': ['get', 'strokeColor'],
          'line-width': ['case', ['get', 'isSelected'], 2.5, 1],
          'line-opacity': 0.85,
          ...(isIndicative ? { 'line-dasharray': [3, 2] } : {}),
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(FORECAST_IMPACT_LINE_LAYER_ID, 'visibility', 'visible');
    try {
      if (isIndicative) {
        map.setPaintProperty(FORECAST_IMPACT_LINE_LAYER_ID, 'line-dasharray', [3, 2]);
      } else {
        map.setPaintProperty(FORECAST_IMPACT_LINE_LAYER_ID, 'line-dasharray', null as any);
      }
    } catch {
      // Ignore if paint property reset is not supported in this runtime
    }
  }

  // 4. Highlight Ring Layer for Selected District
  if (!map.getLayer(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID)) {
    map.addLayer(
      {
        id: FORECAST_IMPACT_HIGHLIGHT_LAYER_ID,
        type: 'line',
        source: FORECAST_IMPACT_SOURCE_ID,
        filter: ['==', ['get', 'isSelected'], true],
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 3,
          'line-opacity': 1,
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID, 'visibility', 'visible');
    map.setFilter(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID, ['==', ['get', 'isSelected'], true]);
  }

  // 5. Interactive Click & Hover Event Bindings
  if (activeClickListener) {
    map.off('click', FORECAST_IMPACT_FILL_LAYER_ID, activeClickListener);
  }
  if (activeMouseEnterListener) {
    map.off('mouseenter', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseEnterListener);
  }
  if (activeMouseLeaveListener) {
    map.off('mouseleave', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseLeaveListener);
  }

  activeClickListener = (e: any) => {
    if (!e.features || e.features.length === 0) return;
    const feat = e.features[0];
    const props = feat.properties || {};
    const d = props.district;
    const s = props.state;
    if (d && onSelectDistrict) {
      onSelectDistrict(d, s);
    }
  };

  activeMouseEnterListener = () => {
    map.getCanvas().style.cursor = 'pointer';
  };

  activeMouseLeaveListener = () => {
    map.getCanvas().style.cursor = '';
  };

  map.on('click', FORECAST_IMPACT_FILL_LAYER_ID, activeClickListener);
  map.on('mouseenter', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseEnterListener);
  map.on('mouseleave', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseLeaveListener);

  // 6. Camera Focus on Selected District
  if (selectedDistrict && selectedDistrict !== lastFocusedDistrict) {
    const selectedFeature = enrichedGeoJSON.features.find(
      (f) => String(f.properties?.district || '').toUpperCase() === selectedDistrict.toUpperCase()
    );
    if (selectedFeature) {
      const bounds = getFeatureBounds(selectedFeature);
      if (bounds) {
        lastFocusedDistrict = selectedDistrict;
        map.fitBounds(
          [
            [bounds[0], bounds[1]],
            [bounds[2], bounds[3]],
          ],
          { padding: 80, maxZoom: 10, duration: 800 }
        );
      }
    }
  } else if (!selectedDistrict) {
    lastFocusedDistrict = null;
  }
}

/**
 * Hides all Forecast Impact map layers.
 */
export function hideForecastImpactLayers(map: MapLibreMap): void {
  if (!map || typeof map.getLayer !== 'function') return;
  if (map.getLayer(FORECAST_IMPACT_FILL_LAYER_ID)) {
    map.setLayoutProperty(FORECAST_IMPACT_FILL_LAYER_ID, 'visibility', 'none');
  }
  if (map.getLayer(FORECAST_IMPACT_LINE_LAYER_ID)) {
    map.setLayoutProperty(FORECAST_IMPACT_LINE_LAYER_ID, 'visibility', 'none');
  }
  if (map.getLayer(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID)) {
    map.setLayoutProperty(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID, 'visibility', 'none');
  }
}

/**
 * Completely removes Forecast Impact map layers and source.
 */
export function removeForecastImpactLayers(map: MapLibreMap): void {
  if (!map || typeof map.removeLayer !== 'function') return;

  if (activeClickListener) {
    map.off('click', FORECAST_IMPACT_FILL_LAYER_ID, activeClickListener);
    activeClickListener = null;
  }
  if (activeMouseEnterListener) {
    map.off('mouseenter', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseEnterListener);
    activeMouseEnterListener = null;
  }
  if (activeMouseLeaveListener) {
    map.off('mouseleave', FORECAST_IMPACT_FILL_LAYER_ID, activeMouseLeaveListener);
    activeMouseLeaveListener = null;
  }

  if (map.getLayer(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID)) {
    map.removeLayer(FORECAST_IMPACT_HIGHLIGHT_LAYER_ID);
  }
  if (map.getLayer(FORECAST_IMPACT_LINE_LAYER_ID)) {
    map.removeLayer(FORECAST_IMPACT_LINE_LAYER_ID);
  }
  if (map.getLayer(FORECAST_IMPACT_FILL_LAYER_ID)) {
    map.removeLayer(FORECAST_IMPACT_FILL_LAYER_ID);
  }
  if (map.getSource(FORECAST_IMPACT_SOURCE_ID)) {
    map.removeSource(FORECAST_IMPACT_SOURCE_ID);
  }
  lastFocusedDistrict = null;
}
