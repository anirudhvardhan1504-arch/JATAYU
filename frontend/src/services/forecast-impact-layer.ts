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
import type { ForecastImpactResponse, ImdRainfallCategory } from './forecast-impact';

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

export const VALID_IMD_CATEGORIES = new Set<string>([
  'NO_RAIN',
  'LIGHT_RAIN',
  'MODERATE_RAIN',
  'HEAVY_RAIN',
  'VERY_HEAVY_RAIN',
  'EXTREMELY_HEAVY_RAIN',
]);

/**
 * Authoritative 24-hour IMD accumulated rainfall classifier.
 * Strictly adheres to comparison operators in backend/src/services/forecast-impact.service.ts
 * and risk.service.ts:
 * - 0.0 mm: NO_RAIN
 * - >0.0 and <15.0 mm: LIGHT_RAIN
 * - 15.0 to <64.5 mm: MODERATE_RAIN
 * - 64.5 to <115.5 mm: HEAVY_RAIN
 * - 115.5 to <204.5 mm: VERY_HEAVY_RAIN
 * - >=204.5 mm: EXTREMELY_HEAVY_RAIN
 * Null, undefined, or NaN rainfall is never converted to NO_RAIN; returns INSUFFICIENT_DATA.
 */
export function classifyImd24hRainfall(accumMm: number | null | undefined): ImdRainfallCategory | 'INSUFFICIENT_DATA' {
  if (accumMm === null || accumMm === undefined || typeof accumMm !== 'number' || isNaN(accumMm) || accumMm < 0) {
    return 'INSUFFICIENT_DATA';
  }
  if (accumMm === 0) return 'NO_RAIN';
  if (accumMm < 15.0) return 'LIGHT_RAIN';
  if (accumMm < 64.5) return 'MODERATE_RAIN';
  if (accumMm < 115.5) return 'HEAVY_RAIN';
  if (accumMm < 204.5) return 'VERY_HEAVY_RAIN';
  return 'EXTREMELY_HEAVY_RAIN';
}

export const IMD_CATEGORY_MAP_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  EXTREMELY_HEAVY_RAIN: {
    fill: '#C026D3', // Fuchsia / Purple (>= 204.5 mm)
    stroke: '#F0ABFC',
    label: 'Extremely Heavy (≥ 204.5 mm)',
  },
  VERY_HEAVY_RAIN: {
    fill: '#DC2626', // Red (115.5 - 204.4 mm)
    stroke: '#FCA5A5',
    label: 'Very Heavy (115.5–204.4 mm)',
  },
  HEAVY_RAIN: {
    fill: '#EA580C', // Orange (64.5 - 115.4 mm)
    stroke: '#FDBA74',
    label: 'Heavy (64.5–115.4 mm)',
  },
  MODERATE_RAIN: {
    fill: '#D97706', // Amber (15.0 - 64.4 mm)
    stroke: '#FDE68A',
    label: 'Moderate (15.0–64.4 mm)',
  },
  LIGHT_RAIN: {
    fill: '#0284C7', // Sky / Cyan (0.1 - 14.9 mm)
    stroke: '#7DD3FC',
    label: 'Light (0.1–14.9 mm)',
  },
  NO_RAIN: {
    fill: '#334155', // Slate (0.0 mm / Nil)
    stroke: '#64748B',
    label: 'No Rain (0.0 mm / Nil)',
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

/**
 * Sets or overrides the cached district boundaries GeoJSON (useful for tests and offline seeding).
 */
export function setCachedBaseDistrictGeoJSON(geojson: GeoJSON.FeatureCollection | null): void {
  cachedBaseDistrictGeoJSON = geojson;
}

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
      let category: ImdRainfallCategory | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
      let accum24h: number | null = null;

      const rawAccum = match?.metrics?.futureAccum24hMm;
      const isValidNumber = typeof rawAccum === 'number' && !isNaN(rawAccum) && rawAccum >= 0;

      if (match && coverageStatus !== 'INSUFFICIENT_DATA' && isValidNumber) {
        accum24h = rawAccum;
        if (rawCategory && VALID_IMD_CATEGORIES.has(rawCategory)) {
          // Authoritative reuse of backend-provided classification
          category = rawCategory as ImdRainfallCategory;
        } else {
          // Fallback classification using authoritative IMD 24h accumulated rainfall operators
          category = classifyImd24hRainfall(accum24h);
        }
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

export const PROTECTED_OVERLAY_LAYER_IDS = new Set<string>([
  'jatayu-forecast-scalar-layer',
  'nasa-gibs-satellite-layer-a',
  'nasa-gibs-satellite-layer-b',
  'rainviewer-radar-layer',
  'jatayu-pressure-contours-line',
  'jatayu-pressure-contours-label',
  'jatayu-pressure-extrema-circle',
  'jatayu-pressure-extrema-label',
  'adyar-simulation-fill',
  'adyar-simulation-line',
]);

/**
 * Determines the layer ID before which the district forecast impact layers should be placed.
 *
 * Algorithm:
 * 1. Inspects the actual rendered MapLibre style layers from map.getStyle().layers (order: 0 to N-1).
 * 2. Finds the EARLIEST existing layer that belongs to PROTECTED_OVERLAY_LAYER_IDS.
 *    Inserting before this layer guarantees that district fills are strictly beneath
 *    EVERY active weather overlay (forecast scalar, satellite, radar, pressure contours/extrema, SFINCS).
 * 3. If no protected overlay exists, finds the EARLIEST basemap symbol layer (city/road/place labels)
 *    that is not one of our own district layers.
 *    Inserting before this layer guarantees that city names, roads, and tactical markers
 *    render crisply on top of the polygon fills.
 * 4. If neither a protected overlay nor a suitable symbol layer exists, returns undefined.
 *    syncForecastImpactLayers will NOT blindly insert the layer at the top; it will safely defer.
 */
export function findBeforeLayerId(map: MapLibreMap): string | undefined {
  if (!map) return undefined;

  let styleLayers: any[] = [];
  try {
    if (typeof map.getStyle === 'function') {
      const style = map.getStyle();
      if (style && Array.isArray(style.layers)) {
        styleLayers = style.layers;
      }
    }
  } catch (err) {
    console.warn('[ForecastImpactLayer] Error inspecting map style layers:', err);
  }

  // 1. Scan actual rendered layer stack in order (index 0 to N-1).
  // Find the EARLIEST existing protected overlay in rendered style order.
  const earliestOverlay = styleLayers.find((layer) => PROTECTED_OVERLAY_LAYER_IDS.has(layer.id));
  if (earliestOverlay) {
    return earliestOverlay.id;
  }

  // 2. Safe Basemap Fallback: Find earliest basemap symbol layer (labels / place names)
  const earliestSymbol = styleLayers.find(
    (layer) => layer.type === 'symbol' && !layer.id.startsWith('jatayu-forecast-impact-')
  );
  if (earliestSymbol) {
    return earliestSymbol.id;
  }

  // 3. No safe anchor layer found
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

  // If neither a protected overlay nor a symbol layer exists in the style,
  // do NOT silently insert at the top of the layer stack!
  // Defer insertion safely until a suitable style layer becomes available.
  if (!beforeLayer) {
    console.warn(
      '[ForecastImpactLayer] No protected overlay or basemap symbol layer available in current style. Deferring district layer insertion.'
    );
    if (typeof map.once === 'function') {
      map.once('styledata', () => {
        syncForecastImpactLayers(map, options);
      });
    }
    return;
  }

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
    if (typeof map.moveLayer === 'function' && beforeLayer) {
      try {
        const style = typeof map.getStyle === 'function' ? map.getStyle() : null;
        if (style && Array.isArray(style.layers)) {
          const fillIdx = style.layers.findIndex((l) => l.id === FORECAST_IMPACT_FILL_LAYER_ID);
          const targetIdx = style.layers.findIndex((l) => l.id === beforeLayer);
          if (fillIdx !== -1 && targetIdx !== -1 && fillIdx > targetIdx) {
            map.moveLayer(FORECAST_IMPACT_FILL_LAYER_ID, beforeLayer);
          }
        }
      } catch {
        // Ignore if style or moveLayer inspection fails
      }
    }
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
