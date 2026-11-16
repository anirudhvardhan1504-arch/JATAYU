/**
 * Pressure Isobar Contour & Extrema Service for JATAYU Tactical Map 2.0
 *
 * Implements standard Marching Squares isobar extraction and local extrema detection (H/L)
 * from Mean Sea Level Pressure (MSLP in hPa) numerical weather prediction grids.
 *
 * Scientific & Meteorological Requirements:
 * - Uses ONLY pressureMslHpa (reduced to mean sea level). Never substitutes surface pressure.
 * - Standard isobar intervals (configurable 2 hPa or 4 hPa) aligned to standard multiples.
 * - Deterministic saddle cell disambiguation using cell center arithmetic mean.
 * - Non-extrapolation: Contours terminate at data boundaries with zero bleed into no-data zones.
 * - Local extrema detection (H / L) with prominence thresholding, boundary edge exclusion,
 *   and non-maximum suppression within cluster radii.
 * - Output: Typed GeoJSON FeatureCollection (LineStrings for isobars, Points for H/L markers).
 */

import type {
  ForecastGridResponse,
} from './forecast';

// ============================================================================
// Types & Contracts
// ============================================================================

export type ContourIntervalHpa = 2 | 4;

export interface IsobarLineProperties {
  pressureHpa: number;
  label: string;
  isIndex: boolean; // True for standard index isobars (e.g. multiples of 8 or 1000/1012 hPa)
}

export interface ExtremaPointProperties {
  type: 'H' | 'L';
  pressureHpa: number;
  label: string;
  prominenceHpa: number;
  isForecastExtrema: true;
  notice: string;
}

export type IsobarFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString, IsobarLineProperties>;
export type ExtremaFeature = GeoJSON.Feature<GeoJSON.Point, ExtremaPointProperties>;

export interface PressureContourResult {
  contours: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString, IsobarLineProperties>;
  extrema: GeoJSON.FeatureCollection<GeoJSON.Point, ExtremaPointProperties>;
  minPressureHpa: number;
  maxPressureHpa: number;
  intervalHpa: ContourIntervalHpa;
  timestepIndex: number;
  validTime: string;
  generatedAt: string;
}

export interface ContourEngineOptions {
  intervalHpa?: ContourIntervalHpa; // default 4 hPa (or 2 hPa for high-gradient mesoscale)
  gridResolution?: number; // resolution of evaluation grid in degrees (default: 0.125° or 0.25°)
  maxDistanceDegrees?: number; // max distance cutoff for no-data boundaries
  prominenceThresholdHpa?: number; // min prominence for H/L markers (default: 0.8 hPa)
  suppressionRadiusDegrees?: number; // cluster suppression distance (default: 0.5°)
}

// ============================================================================
// Marching Squares Algorithm
// ============================================================================

type Point2D = [number, number]; // [lon, lat]

interface LineSegment {
  p1: Point2D;
  p2: Point2D;
}

/**
 * Linearly interpolates between two geographic coordinates based on value and isobar target.
 */
function interpolateEdge(
  lon1: number,
  lat1: number,
  val1: number,
  lon2: number,
  lat2: number,
  val2: number,
  isobar: number
): Point2D {
  const delta = val2 - val1;
  const t = Math.abs(delta) < 1e-9 ? 0.5 : (isobar - val1) / delta;
  const clampedT = Math.max(0, Math.min(1, t));
  return [
    lon1 + (lon2 - lon1) * clampedT,
    lat1 + (lat2 - lat1) * clampedT,
  ];
}

/**
 * Extracts line segments for a single grid cell using standard Marching Squares.
 * Saddle ambiguity (cases 5 and 10) is resolved deterministically via the cell center average.
 */
function processCellMarchingSquares(
  lon0: number,
  lon1: number,
  lat0: number,
  lat1: number,
  val0: number, // Bottom-Left (0, 0)
  val1: number, // Bottom-Right (1, 0)
  val2: number, // Top-Right (1, 1)
  val3: number, // Top-Left (0, 1)
  isobar: number
): LineSegment[] {
  let cellIndex = 0;
  if (val0 >= isobar) cellIndex |= 1;
  if (val1 >= isobar) cellIndex |= 2;
  if (val2 >= isobar) cellIndex |= 4;
  if (val3 >= isobar) cellIndex |= 8;

  if (cellIndex === 0 || cellIndex === 15) {
    return [];
  }

  // Edge points:
  // e0 = Bottom edge (val0 -> val1)
  // e1 = Right edge (val1 -> val2)
  // e2 = Top edge (val3 -> val2)
  // e3 = Left edge (val0 -> val3)
  const e0 = interpolateEdge(lon0, lat0, val0, lon1, lat0, val1, isobar);
  const e1 = interpolateEdge(lon1, lat0, val1, lon1, lat1, val2, isobar);
  const e2 = interpolateEdge(lon0, lat1, val3, lon1, lat1, val2, isobar);
  const e3 = interpolateEdge(lon0, lat0, val0, lon0, lat1, val3, isobar);

  const centerAvg = (val0 + val1 + val2 + val3) / 4;

  switch (cellIndex) {
    case 1: // BL
    case 14:
      return [{ p1: e3, p2: e0 }];

    case 2: // BR
    case 13:
      return [{ p1: e0, p2: e1 }];

    case 3: // Bottom
    case 12:
      return [{ p1: e3, p2: e1 }];

    case 4: // TR
    case 11:
      return [{ p1: e1, p2: e2 }];

    case 5: // BL & TR (Saddle 1)
      if (centerAvg >= isobar) {
        return [
          { p1: e3, p2: e2 },
          { p1: e0, p2: e1 },
        ];
      } else {
        return [
          { p1: e3, p2: e0 },
          { p1: e1, p2: e2 },
        ];
      }

    case 6: // Right
    case 9:
      return [{ p1: e0, p2: e2 }];

    case 7: // Not TL
    case 8: // Only TL
      return [{ p1: e3, p2: e2 }];

    case 10: // BR & TL (Saddle 2)
      if (centerAvg >= isobar) {
        return [
          { p1: e0, p2: e3 },
          { p1: e2, p2: e1 },
        ];
      } else {
        return [
          { p1: e0, p2: e1 },
          { p1: e2, p2: e3 },
        ];
      }

    default:
      return [];
  }
}

/**
 * Chains disconnected Marching Squares line segments into smooth, continuous GeoJSON LineStrings.
 */
function stitchSegmentsIntoLines(segments: LineSegment[], tolerance = 1e-4): Point2D[][] {
  if (segments.length === 0) return [];

  const remaining = segments.map((s) => ({
    p1: s.p1,
    p2: s.p2,
    used: false,
  }));

  const lines: Point2D[][] = [];

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].used) continue;

    remaining[i].used = true;
    const currentLine: Point2D[] = [remaining[i].p1, remaining[i].p2];

    let extended = true;
    while (extended) {
      extended = false;
      const head = currentLine[0];
      const tail = currentLine[currentLine.length - 1];

      for (let j = 0; j < remaining.length; j++) {
        if (remaining[j].used) continue;

        const seg = remaining[j];

        // Match tail to seg.p1
        if (Math.hypot(tail[0] - seg.p1[0], tail[1] - seg.p1[1]) < tolerance) {
          currentLine.push(seg.p2);
          seg.used = true;
          extended = true;
          break;
        }
        // Match tail to seg.p2
        if (Math.hypot(tail[0] - seg.p2[0], tail[1] - seg.p2[1]) < tolerance) {
          currentLine.push(seg.p1);
          seg.used = true;
          extended = true;
          break;
        }
        // Match head to seg.p2
        if (Math.hypot(head[0] - seg.p2[0], head[1] - seg.p2[1]) < tolerance) {
          currentLine.unshift(seg.p1);
          seg.used = true;
          extended = true;
          break;
        }
        // Match head to seg.p1
        if (Math.hypot(head[0] - seg.p1[0], head[1] - seg.p1[1]) < tolerance) {
          currentLine.unshift(seg.p2);
          seg.used = true;
          extended = true;
          break;
        }
      }
    }

    if (currentLine.length >= 2) {
      lines.push(currentLine);
    }
  }

  return lines;
}

// ============================================================================
// High & Low Pressure Extrema Detection
// ============================================================================

interface ExtremaCandidate {
  lon: number;
  lat: number;
  pressureHpa: number;
  type: 'H' | 'L';
  prominenceHpa: number;
}

/**
 * Detects local Highs (H) and Lows (L) across the MSLP field with boundary exclusions
 * and non-maximum suppression.
 */
function detectPressureExtrema(
  points: { lon: number; lat: number; pressureHpa: number }[],
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  prominenceThresholdHpa: number,
  suppressionRadiusDegrees: number
): ExtremaFeature[] {
  if (points.length < 5) return [];

  const candidates: ExtremaCandidate[] = [];
  const edgeBuffer = 0.35; // Do not place extrema on the immediate boundary edge

  for (let i = 0; i < points.length; i++) {
    const p = points[i];

    // Boundary edge exclusion
    if (
      p.lon <= bounds.minLon + edgeBuffer ||
      p.lon >= bounds.maxLon - edgeBuffer ||
      p.lat <= bounds.minLat + edgeBuffer ||
      p.lat >= bounds.maxLat - edgeBuffer
    ) {
      continue;
    }

    // Find neighborhood within 0.8°
    const neighbors: { lon: number; lat: number; pressureHpa: number; dist: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const other = points[j];
      const dist = Math.hypot(p.lon - other.lon, p.lat - other.lat);
      if (dist <= 0.8) {
        neighbors.push({ ...other, dist });
      }
    }

    // Must have at least 4 surrounding neighbors for topological stability
    if (neighbors.length < 4) continue;

    let isLocalHigh = true;
    let isLocalLow = true;
    let minDiff = Infinity;
    let maxDiff = -Infinity;

    for (const n of neighbors) {
      const diff = p.pressureHpa - n.pressureHpa;
      if (diff <= 0) isLocalHigh = false;
      if (diff >= 0) isLocalLow = false;

      if (diff < minDiff) minDiff = diff;
      if (diff > maxDiff) maxDiff = diff;
    }

    // Check prominence against neighborhood
    if (isLocalHigh) {
      const neighborAvg = neighbors.reduce((acc, n) => acc + n.pressureHpa, 0) / neighbors.length;
      const prominence = p.pressureHpa - neighborAvg;
      if (prominence >= prominenceThresholdHpa) {
        candidates.push({
          lon: p.lon,
          lat: p.lat,
          pressureHpa: p.pressureHpa,
          type: 'H',
          prominenceHpa: Math.round(prominence * 10) / 10,
        });
      }
    } else if (isLocalLow) {
      const neighborAvg = neighbors.reduce((acc, n) => acc + n.pressureHpa, 0) / neighbors.length;
      const prominence = neighborAvg - p.pressureHpa;
      if (prominence >= prominenceThresholdHpa) {
        candidates.push({
          lon: p.lon,
          lat: p.lat,
          pressureHpa: p.pressureHpa,
          type: 'L',
          prominenceHpa: Math.round(prominence * 10) / 10,
        });
      }
    }
  }

  // Non-maximum suppression within suppression radius
  const filtered: ExtremaCandidate[] = [];
  // Sort by prominence descending so strongest extrema take precedence
  candidates.sort((a, b) => b.prominenceHpa - a.prominenceHpa);

  for (const c of candidates) {
    const hasNearby = filtered.some(
      (existing) =>
        existing.type === c.type &&
        Math.hypot(existing.lon - c.lon, existing.lat - c.lat) < suppressionRadiusDegrees
    );

    if (!hasNearby) {
      filtered.push(c);
    }
  }

  // Format as GeoJSON Point features
  return filtered.map((ext) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [ext.lon, ext.lat],
    },
    properties: {
      type: ext.type,
      pressureHpa: Math.round(ext.pressureHpa * 10) / 10,
      label: `${ext.type} ${Math.round(ext.pressureHpa)}`,
      prominenceHpa: ext.prominenceHpa,
      isForecastExtrema: true,
      notice: 'Local NWP forecast-grid extrema. Not an official meteorological centre declaration.',
    },
  }));
}

// ============================================================================
// Core Isobar Generation Service
// ============================================================================

/**
 * Generates GeoJSON pressure isobars and H/L extrema points from an NWP forecast grid.
 */
export function generatePressureIsobars(
  response: ForecastGridResponse,
  timestepIndex = 0,
  options: ContourEngineOptions = {}
): PressureContourResult | null {
  const nodes = response?.nodes;
  if (!nodes || nodes.length === 0) return null;

  const validTimestep = Math.max(0, Math.min(timestepIndex, (nodes[0]?.hourly?.length || 72) - 1));
  const interval = options.intervalHpa ?? 4;
  const prominenceThreshold = options.prominenceThresholdHpa ?? 0.8;
  const suppressionRadius = options.suppressionRadiusDegrees ?? 0.5;

  // 1. Extract and deduplicate valid MSLP points
  const rawPoints: { lon: number; lat: number; pressureHpa: number }[] = [];
  const dedupMap = new Map<string, { lon: number; lat: number; sum: number; count: number }>();

  let minP = Infinity;
  let maxP = -Infinity;

  for (const node of nodes) {
    const lat = typeof node.modelLat === 'number' ? node.modelLat : node.requestedLat;
    const lon = typeof node.modelLon === 'number' ? node.modelLon : node.requestedLon;
    const pt = node.hourly?.[validTimestep];
    if (!pt || typeof pt.pressureMslHpa !== 'number') continue;

    const pMsl = pt.pressureMslHpa;
    if (pMsl < minP) minP = pMsl;
    if (pMsl > maxP) maxP = pMsl;

    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
    const existing = dedupMap.get(key);
    if (existing) {
      existing.sum += pMsl;
      existing.count += 1;
    } else {
      dedupMap.set(key, { lon, lat, sum: pMsl, count: 1 });
    }
  }

  for (const item of dedupMap.values()) {
    rawPoints.push({
      lon: item.lon,
      lat: item.lat,
      pressureHpa: item.sum / item.count,
    });
  }

  if (rawPoints.length < 4) return null;

  // 2. Compute geographic bounding box
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const p of rawPoints) {
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }

  const bounds = { minLon, maxLon, minLat, maxLat };
  const maxDistanceDeg = options.maxDistanceDegrees ?? 0.45;

  // 3. Resample onto regular evaluation mesh for Marching Squares
  const gridStep = options.gridResolution ?? 0.125; // 0.125° grid step provides clean, smooth contours
  const cols = Math.max(4, Math.floor((maxLon - minLon) / gridStep) + 1);
  const rows = Math.max(4, Math.floor((maxLat - minLat) / gridStep) + 1);

  // 2D scalar field array [row][col] and validity mask
  const scalarGrid: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const validMask: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));

  for (let r = 0; r < rows; r++) {
    const lat = minLat + r * gridStep;
    for (let c = 0; c < cols; c++) {
      const lon = minLon + c * gridStep;

      // IDW estimation from nearest raw points
      let nearestDist = Infinity;
      let weightSum = 0;
      let weightedVal = 0;

      for (let i = 0; i < rawPoints.length; i++) {
        const rp = rawPoints[i];
        const dist = Math.hypot(lon - rp.lon, lat - rp.lat);

        if (dist < nearestDist) nearestDist = dist;

        if (dist <= maxDistanceDeg) {
          if (dist < 1e-4) {
            weightSum = 1;
            weightedVal = rp.pressureHpa;
            break;
          }
          const w = 1 / (dist * dist);
          weightSum += w;
          weightedVal += w * rp.pressureHpa;
        }
      }

      // No-data boundary: Only consider valid if within maxDistanceDeg of support
      if (nearestDist <= maxDistanceDeg && weightSum > 0) {
        scalarGrid[r][c] = weightedVal / weightSum;
        validMask[r][c] = true;
      }
    }
  }

  // 4. Determine discrete isobar levels aligned to standard pressure multiples
  // E.g., for interval=4: ... 996, 1000, 1004, 1008, 1012, 1016, 1020 ...
  const startLevel = Math.ceil(minP / interval) * interval;
  const endLevel = Math.floor(maxP / interval) * interval;

  const isobarLevels: number[] = [];
  for (let lvl = startLevel; lvl <= endLevel; lvl += interval) {
    isobarLevels.push(lvl);
  }

  // 5. Run Marching Squares for each isobar level
  const contourFeatures: IsobarFeature[] = [];

  for (const isobar of isobarLevels) {
    const segments: LineSegment[] = [];

    for (let r = 0; r < rows - 1; r++) {
      const lat0 = minLat + r * gridStep;
      const lat1 = minLat + (r + 1) * gridStep;

      for (let c = 0; c < cols - 1; c++) {
        // Skip cell if any corner is in a no-data region
        if (!validMask[r][c] || !validMask[r][c + 1] || !validMask[r + 1][c + 1] || !validMask[r + 1][c]) {
          continue;
        }

        const lon0 = minLon + c * gridStep;
        const lon1 = minLon + (c + 1) * gridStep;

        const val0 = scalarGrid[r][c]; // BL
        const val1 = scalarGrid[r][c + 1]; // BR
        const val2 = scalarGrid[r + 1][c + 1]; // TR
        const val3 = scalarGrid[r + 1][c]; // TL

        const cellSegments = processCellMarchingSquares(
          lon0,
          lon1,
          lat0,
          lat1,
          val0,
          val1,
          val2,
          val3,
          isobar
        );

        if (cellSegments.length > 0) {
          segments.push(...cellSegments);
        }
      }
    }

    // Stitch segments into continuous lines
    const lines = stitchSegmentsIntoLines(segments);
    const isIndex = isobar % (interval * 2) === 0 || isobar === 1012 || isobar === 1000;

    for (const line of lines) {
      contourFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: line,
        },
        properties: {
          pressureHpa: isobar,
          label: `${isobar} hPa`,
          isIndex,
        },
      });
    }
  }

  // 6. Detect High and Low Extrema (H/L)
  const extremaFeatures = detectPressureExtrema(
    rawPoints,
    bounds,
    prominenceThreshold,
    suppressionRadius
  );

  return {
    contours: {
      type: 'FeatureCollection',
      features: contourFeatures,
    },
    extrema: {
      type: 'FeatureCollection',
      features: extremaFeatures,
    },
    minPressureHpa: Math.round(minP * 10) / 10,
    maxPressureHpa: Math.round(maxP * 10) / 10,
    intervalHpa: interval,
    timestepIndex: validTimestep,
    validTime: nodes[0]?.hourly?.[validTimestep]?.time || new Date().toISOString(),
    generatedAt: new Date().toISOString(),
  };
}
