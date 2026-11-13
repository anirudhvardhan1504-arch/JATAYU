/**
 * MapLibre Pressure Isobar Contour & Extrema Layer Manager
 *
 * Manages the lifecycle, styling, and z-index ordering of isobar LineStrings
 * and High/Low pressure extrema Point markers.
 *
 * Layer Hierarchy:
 * 1. Base Tile Layer
 * 2. NASA GIBS Satellite Layers ('nasa-gibs-satellite-layer-a / -b')
 * 3. RainViewer Radar Layer ('rainviewer-radar-layer')
 * 4. JATAYU Forecast Scalar Layer ('jatayu-forecast-scalar-layer')
 * 5. JATAYU PRESSURE CONTOURS ('jatayu-pressure-contours-line', 'jatayu-pressure-contours-label')  <-- THIS LAYER
 * 6. JATAYU PRESSURE EXTREMA ('jatayu-pressure-extrema-circle', 'jatayu-pressure-extrema-label')   <-- THIS LAYER
 * 7. SFINCS Hydrodynamic Simulation Layer ('adyar-simulation-fill', 'adyar-simulation-line')
 * 8. Interactive Pins & Markers
 */

import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import { ForecastGridResponse } from './forecast';
import {
  generatePressureIsobars,
  PressureContourResult,
  ContourIntervalHpa,
} from './pressure-contours';

export const PRESSURE_CONTOURS_SOURCE_ID = 'jatayu-pressure-contours-source';
export const PRESSURE_CONTOURS_LINE_LAYER_ID = 'jatayu-pressure-contours-line';
export const PRESSURE_CONTOURS_LABEL_LAYER_ID = 'jatayu-pressure-contours-label';

export const PRESSURE_EXTREMA_SOURCE_ID = 'jatayu-pressure-extrema-source';
export const PRESSURE_EXTREMA_CIRCLE_LAYER_ID = 'jatayu-pressure-extrema-circle';
export const PRESSURE_EXTREMA_LABEL_LAYER_ID = 'jatayu-pressure-extrema-label';

export interface PressureLayerOptions {
  response: ForecastGridResponse | null;
  timestepIndex: number;
  intervalHpa?: ContourIntervalHpa; // 2 or 4 hPa
  visible: boolean;
}

/**
 * Determines the target layer ID before which the pressure contour layers should be inserted.
 * Must be inserted BEFORE SFINCS simulation layers to maintain correct layer hierarchy.
 */
function findBeforeLayerId(map: MapLibreMap): string | undefined {
  if (map.getLayer('adyar-simulation-fill')) {
    return 'adyar-simulation-fill';
  }
  if (map.getLayer('adyar-simulation-line')) {
    return 'adyar-simulation-line';
  }
  return undefined;
}

/**
 * Synchronizes pressure isobars and H/L extrema with MapLibre GL.
 */
export function syncPressureLayers(
  map: MapLibreMap,
  options: PressureLayerOptions
): PressureContourResult | null {
  if (!map || typeof map.getLayer !== 'function') return null;

  const { response, timestepIndex, intervalHpa = 4, visible } = options;

  // If layer is hidden or no forecast data is available
  if (!visible || !response || !response.nodes || response.nodes.length === 0) {
    hidePressureLayers(map);
    return null;
  }

  // 1. Generate contours and extrema GeoJSON
  const result = generatePressureIsobars(response, timestepIndex, { intervalHpa });
  if (!result) {
    hidePressureLayers(map);
    return null;
  }

  const beforeLayer = findBeforeLayerId(map);

  // 2. Synchronize Contours Source
  let contourSource = map.getSource(PRESSURE_CONTOURS_SOURCE_ID) as GeoJSONSource | undefined;
  if (!contourSource) {
    map.addSource(PRESSURE_CONTOURS_SOURCE_ID, {
      type: 'geojson',
      data: result.contours,
    });
  } else if (typeof contourSource.setData === 'function') {
    contourSource.setData(result.contours);
  }

  // 3. Synchronize Extrema Source
  let extremaSource = map.getSource(PRESSURE_EXTREMA_SOURCE_ID) as GeoJSONSource | undefined;
  if (!extremaSource) {
    map.addSource(PRESSURE_EXTREMA_SOURCE_ID, {
      type: 'geojson',
      data: result.extrema,
    });
  } else if (typeof extremaSource.setData === 'function') {
    extremaSource.setData(result.extrema);
  }

  // 4. Create Contour Line Layer if not present
  if (!map.getLayer(PRESSURE_CONTOURS_LINE_LAYER_ID)) {
    map.addLayer(
      {
        id: PRESSURE_CONTOURS_LINE_LAYER_ID,
        type: 'line',
        source: PRESSURE_CONTOURS_SOURCE_ID,
        paint: {
          'line-color': [
            'case',
            ['get', 'isIndex'],
            '#0284c7', // Sky-600 bold for index isobars
            '#64748b', // Slate-500 for intermediate isobars
          ],
          'line-width': [
            'case',
            ['get', 'isIndex'],
            2.2,
            1.2,
          ],
          'line-opacity': 0.85,
        },
        layout: {
          visibility: 'visible',
          'line-join': 'round',
          'line-cap': 'round',
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(PRESSURE_CONTOURS_LINE_LAYER_ID, 'visibility', 'visible');
  }

  // 5. Create Contour Label Layer (Symbol)
  if (!map.getLayer(PRESSURE_CONTOURS_LABEL_LAYER_ID)) {
    map.addLayer(
      {
        id: PRESSURE_CONTOURS_LABEL_LAYER_ID,
        type: 'symbol',
        source: PRESSURE_CONTOURS_SOURCE_ID,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-letter-spacing': 0.05,
          'text-max-angle': 30,
          visibility: 'visible',
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(PRESSURE_CONTOURS_LABEL_LAYER_ID, 'visibility', 'visible');
  }

  // 6. Create Extrema Marker Layer (Circles)
  if (!map.getLayer(PRESSURE_EXTREMA_CIRCLE_LAYER_ID)) {
    map.addLayer(
      {
        id: PRESSURE_EXTREMA_CIRCLE_LAYER_ID,
        type: 'circle',
        source: PRESSURE_EXTREMA_SOURCE_ID,
        paint: {
          'circle-radius': 14,
          'circle-color': [
            'match',
            ['get', 'type'],
            'H',
            '#0284c7', // Blue circle for High
            '#e11d48', // Crimson circle for Low
            '#475569',
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
        layout: {
          visibility: 'visible',
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(PRESSURE_EXTREMA_CIRCLE_LAYER_ID, 'visibility', 'visible');
  }

  // 7. Create Extrema Text Label Layer ('H' or 'L')
  if (!map.getLayer(PRESSURE_EXTREMA_LABEL_LAYER_ID)) {
    map.addLayer(
      {
        id: PRESSURE_EXTREMA_LABEL_LAYER_ID,
        type: 'symbol',
        source: PRESSURE_EXTREMA_SOURCE_ID,
        layout: {
          'text-field': ['get', 'type'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
          visibility: 'visible',
        },
        paint: {
          'text-color': '#ffffff',
        },
      },
      beforeLayer
    );
  } else {
    map.setLayoutProperty(PRESSURE_EXTREMA_LABEL_LAYER_ID, 'visibility', 'visible');
  }

  return result;
}

/**
 * Hides all pressure contour and extrema layers without deleting sources.
 */
function hidePressureLayers(map: MapLibreMap): void {
  const layerIds = [
    PRESSURE_CONTOURS_LINE_LAYER_ID,
    PRESSURE_CONTOURS_LABEL_LAYER_ID,
    PRESSURE_EXTREMA_CIRCLE_LAYER_ID,
    PRESSURE_EXTREMA_LABEL_LAYER_ID,
  ];

  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', 'none');
    }
  }
}

/**
 * Removes all pressure contour sources and layers cleanly on unmount.
 */
export function removePressureLayers(map: MapLibreMap): void {
  if (!map || typeof map.getLayer !== 'function') return;

  const layerIds = [
    PRESSURE_EXTREMA_LABEL_LAYER_ID,
    PRESSURE_EXTREMA_CIRCLE_LAYER_ID,
    PRESSURE_CONTOURS_LABEL_LAYER_ID,
    PRESSURE_CONTOURS_LINE_LAYER_ID,
  ];

  for (const id of layerIds) {
    try {
      if (map.getLayer(id)) {
        map.removeLayer(id);
      }
    } catch {
      // Ignored
    }
  }

  const sourceIds = [PRESSURE_EXTREMA_SOURCE_ID, PRESSURE_CONTOURS_SOURCE_ID];
  for (const id of sourceIds) {
    try {
      if (map.getSource(id)) {
        map.removeSource(id);
      }
    } catch {
      // Ignored
    }
  }
}
