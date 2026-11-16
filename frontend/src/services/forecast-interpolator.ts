/**
 * Spatial Forecast Interpolation Engine for JATAYU Tactical Map 2.0
 *
 * Reconstructs continuous 2D scalar fields from discrete NWP model grid nodes
 * (ECMWF IFS / NOAA GFS) across India's operational sectors and synoptic domains.
 *
 * Interpolation Mathematics:
 * - Inverse Distance Weighting (IDW, power p=2) with finite spatial cutoff (R_max).
 * - Strict no-extrapolation rule: Pixels outside the convex support domain (d_min > R_max)
 *   are assigned an alpha channel of 0 (fully transparent).
 * - Edge feathering: Smooth alpha attenuation near the perimeter to eliminate jagged boundaries.
 * - Coordinate deduplication: Nodes sharing identical physical model grid cells are merged
 *   with arithmetic mean aggregation to prevent zero-distance numerical singularities.
 *
 * Scientific Disclosure:
 * "Spatial surface reconstructed via mesoscale grid interpolation. Not a raw native-resolution GRIB2 raster."
 */

import {
  ForecastGridResponse,
  ForecastProductType,
} from './forecast';

export interface InterpolationBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export interface InterpolatedCanvasFrame {
  /** Canvas data URL (PNG) ready for MapLibre image/raster source */
  dataUrl: string;
  /** Bounding box coordinates in MapLibre ImageSource order: [top-left, top-right, bottom-right, bottom-left] */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  /** Geographic bounding box */
  bounds: InterpolationBounds;
  /** Value extrema across this frame */
  minValue: number;
  maxValue: number;
  /** Canvas raster dimensions */
  width: number;
  height: number;
}

export interface InterpolationOptions {
  /** Raster canvas resolution width (default: 160px for mesoscale, 240px for national) */
  width?: number;
  /** Raster canvas resolution height (default: 160px for mesoscale, 240px for national) */
  height?: number;
  /** Max distance cutoff in geographic degrees for interpolation support */
  maxDistanceDegrees?: number;
  /** IDW power parameter (default: 2) */
  idwPower?: number;
  /** Minimum opacity for valid data pixels (0 - 1, default: 0.85) */
  baseAlpha?: number;
}

// In-memory frame cache to prevent redundant canvas redraws during scrubbing
const frameCache = new Map<string, InterpolatedCanvasFrame>();

/**
 * Generates an in-memory canvas frame for a given forecast product and timestep index.
 */
export function interpolateForecastFrame(
  response: ForecastGridResponse,
  productType: ForecastProductType,
  timestepIndex: number,
  options: InterpolationOptions = {}
): InterpolatedCanvasFrame | null {
  const nodes = response?.nodes;
  if (!nodes || nodes.length === 0) return null;

  const validTimestep = Math.max(0, Math.min(timestepIndex, (nodes[0]?.hourly?.length || 72) - 1));
  const mode = response.metadata?.mode || 'sector';
  const sector = response.metadata?.activeSector || 'mumbai';
  const runCycle = response.metadata?.runCycle || '00Z';
  const initTime = response.metadata?.initializationTime || 'init';

  // Cache key includes model initialization, product, sector/mode, and timestep
  const cacheKey = `${mode}:${sector}:${initTime}:${runCycle}:${productType}:${validTimestep}`;
  const cached = frameCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. Extract and deduplicate points for this product and timestep
  const dataPoints: { lon: number; lat: number; value: number }[] = [];
  const dedupMap = new Map<string, { lon: number; lat: number; sum: number; count: number }>();

  for (const node of nodes) {
    // Prefer actual model coordinates; fallback to requested coordinates
    const lat = typeof node.modelLat === 'number' ? node.modelLat : node.requestedLat;
    const lon = typeof node.modelLon === 'number' ? node.modelLon : node.requestedLon;
    const pt = node.hourly?.[validTimestep];
    if (!pt) continue;

    let val = 0;
    switch (productType) {
      case 'precipitation':
        val = pt.precipitationMm ?? 0;
        break;
      case 'temperature':
        val = pt.temperatureC ?? 0;
        break;
      case 'humidity':
        val = pt.relativeHumidityPercent ?? 0;
        break;
      case 'pressure':
        val = pt.pressureMslHpa ?? 1013.25;
        break;
      case 'wind':
        val = pt.windSpeedKmh ?? 0;
        break;
    }

    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const existing = dedupMap.get(key);
    if (existing) {
      existing.sum += val;
      existing.count += 1;
    } else {
      dedupMap.set(key, { lon, lat, sum: val, count: 1 });
    }
  }

  for (const item of dedupMap.values()) {
    dataPoints.push({
      lon: item.lon,
      lat: item.lat,
      value: item.sum / item.count,
    });
  }

  if (dataPoints.length === 0) return null;

  // 2. Compute geographic bounding box with safety padding
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const p of dataPoints) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  // Determine grid resolution characteristics
  const isNational = mode === 'national';
  const paddingDeg = isNational ? 0.6 : 0.25;
  const maxDistanceDeg =
    options.maxDistanceDegrees ?? (isNational ? 1.8 : 0.45); // Max radius beyond which no-data transparency applies

  minLon -= paddingDeg;
  maxLon += paddingDeg;
  minLat -= paddingDeg;
  maxLat += paddingDeg;

  const width = options.width ?? (isNational ? 240 : 160);
  const height = options.height ?? (isNational ? 240 : 160);
  const power = options.idwPower ?? 2;
  const baseAlpha = options.baseAlpha ?? 0.85;

  // 3. Create offscreen canvas and pixel buffer
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  let ctx: any = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    // Headless environment without native canvas
  }
  if (!ctx || typeof ctx.createImageData !== 'function') return null;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const lonSpan = maxLon - minLon;
  const latSpan = maxLat - minLat;

  let frameMin = Infinity;
  let frameMax = -Infinity;

  // 4. Render spatial IDW interpolation with distance thresholding
  for (let y = 0; y < height; y++) {
    // Canvas y=0 corresponds to maxLat (top of map)
    const lat = maxLat - (y / (height - 1)) * latSpan;

    for (let x = 0; x < width; x++) {
      const lon = minLon + (x / (width - 1)) * lonSpan;
      const pixelIndex = (y * width + x) * 4;

      // Find distance to all data points
      let nearestDist = Infinity;
      let weightSum = 0;
      let weightedValueSum = 0;

      for (let i = 0; i < dataPoints.length; i++) {
        const dp = dataPoints[i];
        const dLon = lon - dp.lon;
        const dLat = lat - dp.lat;
        const dist = Math.sqrt(dLon * dLon + dLat * dLat);

        if (dist < nearestDist) {
          nearestDist = dist;
        }

        if (dist <= maxDistanceDeg) {
          if (dist < 0.0001) {
            // Effectively on top of the node
            weightSum = 1;
            weightedValueSum = dp.value;
            break;
          }
          const w = 1 / Math.pow(dist, power);
          weightSum += w;
          weightedValueSum += w * dp.value;
        }
      }

      // No extrapolation: transparent if beyond maxDistanceDeg
      if (nearestDist > maxDistanceDeg || weightSum === 0) {
        data[pixelIndex + 0] = 0;
        data[pixelIndex + 1] = 0;
        data[pixelIndex + 2] = 0;
        data[pixelIndex + 3] = 0;
        continue;
      }

      const interpolatedValue = weightedValueSum / weightSum;
      if (interpolatedValue < frameMin) frameMin = interpolatedValue;
      if (interpolatedValue > frameMax) frameMax = interpolatedValue;

      // Smooth edge feathering: fade alpha to zero as distance approaches maxDistanceDeg
      const featherStart = maxDistanceDeg * 0.75;
      let featherFactor = 1.0;
      if (nearestDist > featherStart) {
        featherFactor = Math.max(0, 1 - (nearestDist - featherStart) / (maxDistanceDeg - featherStart));
      }

      // Map interpolated scalar value to RGBA color
      const [r, g, b, alpha] = getColorForProductValue(productType, interpolatedValue, baseAlpha * featherFactor);

      data[pixelIndex + 0] = r;
      data[pixelIndex + 1] = g;
      data[pixelIndex + 2] = b;
      data[pixelIndex + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  let dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  try {
    dataUrl = canvas.toDataURL('image/png');
  } catch {
    // Headless / jsdom fallback
  }

  // MapLibre ImageSource coordinates: [top-left, top-right, bottom-right, bottom-left]
  const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
    [minLon, maxLat], // Top-Left
    [maxLon, maxLat], // Top-Right
    [maxLon, minLat], // Bottom-Right
    [minLon, minLat], // Bottom-Left
  ];

  const result: InterpolatedCanvasFrame = {
    dataUrl,
    coordinates,
    bounds: { minLon, maxLon, minLat, maxLat },
    minValue: frameMin === Infinity ? 0 : Math.round(frameMin * 10) / 10,
    maxValue: frameMax === -Infinity ? 0 : Math.round(frameMax * 10) / 10,
    width,
    height,
  };

  frameCache.set(cacheKey, result);
  return result;
}

/**
 * Clears the spatial frame cache.
 */
export function clearForecastFrameCache(): void {
  frameCache.clear();
}

/**
 * Product-specific continuous color scale mapping.
 * Returns [R, G, B, Alpha (0-1)].
 */
export function getColorForProductValue(
  productType: ForecastProductType,
  value: number,
  masterAlpha: number
): [number, number, number, number] {
  switch (productType) {
    case 'precipitation': {
      // 0.1 mm/h threshold: dry or trace conditions (<0.1 mm) remain transparent
      if (value < 0.1) {
        return [0, 0, 0, 0];
      }
      // Progressive rainfall scale from light cyan to deep crimson
      if (value < 2.5) {
        // Light rain: 0.1 - 2.5 mm
        const t = (value - 0.1) / (2.5 - 0.1);
        const rgb = lerpColor([103, 169, 207], [2, 129, 138], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.55];
      } else if (value < 7.5) {
        // Moderate rain: 2.5 - 7.5 mm
        const t = (value - 2.5) / (7.5 - 2.5);
        const rgb = lerpColor([2, 129, 138], [254, 217, 118], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.7];
      } else if (value < 15.0) {
        // Heavy rain: 7.5 - 15.0 mm
        const t = (value - 7.5) / (15.0 - 7.5);
        const rgb = lerpColor([254, 217, 118], [253, 141, 60], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.8];
      } else if (value < 30.0) {
        // Very heavy rain: 15.0 - 30.0 mm
        const t = (value - 15.0) / (30.0 - 15.0);
        const rgb = lerpColor([253, 141, 60], [227, 26, 28], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.85];
      } else if (value < 50.0) {
        // Extremely heavy rain: 30.0 - 50.0 mm
        const t = (value - 30.0) / (50.0 - 30.0);
        const rgb = lerpColor([227, 26, 28], [128, 0, 38], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.9];
      } else {
        // Torrential: > 50.0 mm
        return [128, 0, 38, masterAlpha * 0.92];
      }
    }

    case 'temperature': {
      // Temperature scale: -5°C (indigo) to 48°C+ (dark maroon)
      const clamped = Math.max(-5, Math.min(50, value));
      if (clamped < 15) {
        const t = Math.max(0, (clamped - -5) / 20);
        const rgb = lerpColor([49, 54, 149], [116, 173, 209], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.7];
      } else if (clamped < 25) {
        const t = (clamped - 15) / 10;
        const rgb = lerpColor([116, 173, 209], [224, 243, 248], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.65];
      } else if (clamped < 35) {
        const t = (clamped - 25) / 10;
        const rgb = lerpColor([224, 243, 248], [253, 174, 97], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.65];
      } else if (clamped < 42) {
        const t = (clamped - 35) / 7;
        const rgb = lerpColor([253, 174, 97], [244, 109, 67], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.72];
      } else {
        const t = Math.min(1, (clamped - 42) / 8);
        const rgb = lerpColor([244, 109, 67], [165, 0, 38], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.8];
      }
    }

    case 'humidity': {
      // Relative humidity: 0% (pale straw) to 100% (deep marine cyan)
      const clamped = Math.max(0, Math.min(100, value));
      if (clamped < 30) {
        const t = clamped / 30;
        const rgb = lerpColor([255, 255, 212], [254, 217, 142], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.55];
      } else if (clamped < 60) {
        const t = (clamped - 30) / 30;
        const rgb = lerpColor([254, 217, 142], [254, 153, 41], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.6];
      } else if (clamped < 80) {
        const t = (clamped - 60) / 20;
        const rgb = lerpColor([254, 153, 41], [65, 182, 196], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.65];
      } else {
        const t = (clamped - 80) / 20;
        const rgb = lerpColor([65, 182, 196], [34, 94, 168], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.75];
      }
    }

    case 'pressure': {
      // Mean Sea Level Pressure (MSLP): 970 hPa (deep cyclone) to 1030 hPa (anticyclone)
      const clamped = Math.max(970, Math.min(1030, value));
      if (clamped < 995) {
        // Severe cyclonic depression (<995 hPa)
        const t = Math.max(0, (clamped - 970) / 25);
        const rgb = lerpColor([73, 0, 106], [174, 1, 126], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.8];
      } else if (clamped < 1008) {
        // Monsoon low / depression (995 - 1008 hPa)
        const t = (clamped - 995) / 13;
        const rgb = lerpColor([174, 1, 126], [247, 104, 161], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.7];
      } else if (clamped < 1016) {
        // Standard atmospheric pressure (1008 - 1016 hPa)
        const t = (clamped - 1008) / 8;
        const rgb = lerpColor([247, 104, 161], [250, 159, 181], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.6];
      } else {
        // High pressure / anticyclone (> 1016 hPa)
        const t = Math.min(1, (clamped - 1016) / 14);
        const rgb = lerpColor([250, 159, 181], [253, 224, 221], t);
        return [rgb[0], rgb[1], rgb[2], masterAlpha * 0.55];
      }
    }

    default:
      return [0, 0, 0, 0];
  }
}

/**
 * Linear RGB color interpolation.
 */
function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  const clampedT = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clampedT),
    Math.round(c1[1] + (c2[1] - c1[1]) * clampedT),
    Math.round(c1[2] + (c2[2] - c1[2]) * clampedT),
  ];
}
