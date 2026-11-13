/**
 * MapLibre Forecast Scalar Layer Manager for JATAYU Tactical Map 2.0
 *
 * Manages the lifecycle, placement, raster image coordinates, opacity,
 * and visibility of the scalar forecast layer in MapLibre GL.
 *
 * Layer Hierarchy:
 * 1. Base Tile Layer
 * 2. NASA GIBS Satellite Layers ('nasa-gibs-satellite-layer-a / -b')
 * 3. RainViewer Radar Layer ('rainviewer-radar-layer')
 * 4. JATAYU FORECAST SCALAR LAYER ('jatayu-forecast-scalar-layer')  <-- THIS LAYER
 * 5. SFINCS Hydrodynamic Simulation Layer ('adyar-simulation-fill', 'adyar-simulation-line')
 * 6. Interactive Pins & Markers
 */

import type { Map as MapLibreMap, ImageSource } from 'maplibre-gl';
import {
  ForecastGridResponse,
  ForecastProductType,
} from './forecast';
import {
  interpolateForecastFrame,
  InterpolatedCanvasFrame,
} from './forecast-interpolator';

export const FORECAST_SCALAR_SOURCE_ID = 'jatayu-forecast-scalar-source';
export const FORECAST_SCALAR_LAYER_ID = 'jatayu-forecast-scalar-layer';

export interface ForecastLayerOptions {
  response: ForecastGridResponse | null;
  productType: ForecastProductType;
  timestepIndex: number;
  opacity: number; // 0 - 100
  visible: boolean;
}

/**
 * Determines the target layer ID before which the forecast layer should be inserted
 * to ensure strict adherence to layer ordering rules.
 */
function findBeforeLayerId(map: MapLibreMap): string | undefined {
  // Must be BELOW SFINCS simulation fill/line
  if (map.getLayer('adyar-simulation-fill')) {
    return 'adyar-simulation-fill';
  }
  if (map.getLayer('adyar-simulation-line')) {
    return 'adyar-simulation-line';
  }
  return undefined; // Top of raster stack if no simulation layer exists
}

/**
 * Synchronizes the MapLibre forecast scalar layer with the provided options.
 * Handles initial creation, dynamic raster image updates, opacity, and visibility changes.
 */
export function syncForecastScalarLayer(
  map: MapLibreMap,
  options: ForecastLayerOptions
): InterpolatedCanvasFrame | null {
  if (!map || typeof map.getLayer !== 'function') return null;

  const { response, productType, timestepIndex, opacity, visible } = options;

  // If layer is hidden or no forecast data is available
  if (!visible || !response || !response.nodes || response.nodes.length === 0) {
    if (map.getLayer(FORECAST_SCALAR_LAYER_ID)) {
      map.setLayoutProperty(FORECAST_SCALAR_LAYER_ID, 'visibility', 'none');
    }
    return null;
  }

  // 1. Generate interpolated raster frame
  const frame = interpolateForecastFrame(response, productType, timestepIndex);
  if (!frame) return null;

  const rasterOpacity = Math.max(0, Math.min(100, opacity)) / 100;
  const existingSource = map.getSource(FORECAST_SCALAR_SOURCE_ID) as ImageSource | undefined;

  // 2. If source exists, update image and coordinates
  if (existingSource && typeof (existingSource as any).updateImage === 'function') {
    try {
      (existingSource as any).updateImage({
        url: frame.dataUrl,
        coordinates: frame.coordinates,
      });
    } catch {
      // Re-create source if WebGL image replacement failed during style transitions
      recreateSourceAndLayer(map, frame, rasterOpacity);
    }
  } else if (!existingSource) {
    // 3. Create fresh source and layer if not already on the map
    recreateSourceAndLayer(map, frame, rasterOpacity);
  }

  // 4. Update layer paint and layout properties
  if (map.getLayer(FORECAST_SCALAR_LAYER_ID)) {
    map.setLayoutProperty(FORECAST_SCALAR_LAYER_ID, 'visibility', 'visible');
    map.setPaintProperty(FORECAST_SCALAR_LAYER_ID, 'raster-opacity', rasterOpacity);
  }

  return frame;
}

/**
 * Creates or re-creates the forecast ImageSource and RasterLayer.
 */
function recreateSourceAndLayer(
  map: MapLibreMap,
  frame: InterpolatedCanvasFrame,
  opacity: number
): void {
  // Clean up if already partially present
  if (map.getLayer(FORECAST_SCALAR_LAYER_ID)) {
    map.removeLayer(FORECAST_SCALAR_LAYER_ID);
  }
  if (map.getSource(FORECAST_SCALAR_SOURCE_ID)) {
    map.removeSource(FORECAST_SCALAR_SOURCE_ID);
  }

  // Add Image Source
  map.addSource(FORECAST_SCALAR_SOURCE_ID, {
    type: 'image',
    url: frame.dataUrl,
    coordinates: frame.coordinates,
  });

  const beforeLayer = findBeforeLayerId(map);

  // Add Raster Layer
  map.addLayer(
    {
      id: FORECAST_SCALAR_LAYER_ID,
      type: 'raster',
      source: FORECAST_SCALAR_SOURCE_ID,
      paint: {
        'raster-opacity': opacity,
        'raster-fade-duration': 0,
        'raster-resampling': 'linear',
      },
      layout: {
        visibility: 'visible',
      },
    },
    beforeLayer
  );
}

/**
 * Cleans up and removes the forecast scalar layer and source on unmount.
 */
export function removeForecastScalarLayer(map: MapLibreMap): void {
  if (!map || typeof map.getLayer !== 'function') return;

  try {
    if (map.getLayer(FORECAST_SCALAR_LAYER_ID)) {
      map.removeLayer(FORECAST_SCALAR_LAYER_ID);
    }
    if (map.getSource(FORECAST_SCALAR_SOURCE_ID)) {
      map.removeSource(FORECAST_SCALAR_SOURCE_ID);
    }
  } catch (err) {
    console.warn('[ForecastLayer] Error during layer removal:', err);
  }
}
