/**
 * Unified 72-Hour Forecast Timeline Controller for JATAYU Tactical Map 2.0
 *
 * Synchronizes the 72-hour NWP forecast timeline (T+0 through T+71 discrete hourly timesteps)
 * across all active forecast visualization engines:
 * 1. Scalar forecast canvas (Precipitation, Wind, Temp, Humidity, MSLP)
 * 2. Pressure isobar contours (Marching Squares 2/4 hPa)
 * 3. High/low pressure synoptic extrema
 * 4. Wind particle velocity streamlines
 *
 * Preserves strict architectural separation between:
 * - LIVE MAPS: RainViewer radar & NASA GIBS satellite observation timelines
 * - FORECAST MAPS: Numerical weather prediction valid times
 */

import type {
  ForecastGridResponse,
} from './forecast';
import {
  FORECAST_TOTAL_TIMESTEPS,
} from './forecast';

export interface ForecastTimeInfo {
  index: number;
  stepLabel: string;
  isoTime: string;
  formattedUtc: string;
  initTime: string;
  runCycle: string;
  model: string;
  provider: string;
  isFallback: boolean;
  isStale: boolean;
}

export const FORECAST_SPEED_PRESETS = [
  { label: '0.5x', ms: 1600 },
  { label: '1x', ms: 800 },
  { label: '2x', ms: 400 },
] as const;

/**
 * Formats an ISO forecast valid timestamp into a clean UTC display string.
 * Example: '2026-11-13T14:00' -> '13 Nov 14:00 UTC'
 */
export function formatForecastValidTime(isoTime: string): string {
  if (!isoTime) return '--:-- UTC';
  try {
    const d = new Date(isoTime.endsWith('Z') ? isoTime : `${isoTime}Z`);
    if (isNaN(d.getTime())) {
      // Fallback manual parse for 'YYYY-MM-DDTHH:mm'
      const parts = isoTime.split('T');
      if (parts.length === 2) {
        return `${parts[0]} ${parts[1]} UTC`;
      }
      return isoTime;
    }
    const day = d.getUTCDate();
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const minutes = d.getUTCMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${hours}:${minutes} UTC`;
  } catch {
    return isoTime;
  }
}

/**
 * Returns formatted metadata and validity information for a specific forecast timestep index.
 */
export function getForecastTimeInfo(
  response: ForecastGridResponse | null | undefined,
  timestepIndex: number
): ForecastTimeInfo {
  const safeIndex = Math.max(0, Math.min(timestepIndex, FORECAST_TOTAL_TIMESTEPS - 1));
  const padHour = safeIndex.toString().padStart(2, '0');
  const stepLabel = `T+${padHour}h`;

  const node = response?.nodes?.[0];
  const point = node?.hourly?.[safeIndex];
  const isoTime = point?.time || '';
  const formattedUtc = formatForecastValidTime(isoTime);

  const meta = response?.metadata;
  const initTime = meta?.initializationTime ? formatForecastValidTime(meta.initializationTime) : 'Init';
  const runCycle = meta?.runCycle || '00Z';
  const model = meta?.model || 'ECMWF IFS (0.25°)';
  const provider = meta?.provider || 'Open-Meteo ECMWF Open Data';
  const isFallback = Boolean(meta?.isFallback);
  const isStale = Boolean(meta?.isStale);

  return {
    index: safeIndex,
    stepLabel,
    isoTime,
    formattedUtc,
    initTime,
    runCycle,
    model,
    provider,
    isFallback,
    isStale,
  };
}

/**
 * Computes the next forecast timestep index with optional loop.
 */
export function getNextForecastIndex(
  currentIndex: number,
  totalSteps: number = FORECAST_TOTAL_TIMESTEPS,
  loop: boolean = true
): number {
  if (totalSteps <= 0) return 0;
  const next = currentIndex + 1;
  if (next >= totalSteps) {
    return loop ? 0 : totalSteps - 1;
  }
  return next;
}

/**
 * Computes the previous forecast timestep index with optional loop.
 */
export function getPrevForecastIndex(
  currentIndex: number,
  totalSteps: number = FORECAST_TOTAL_TIMESTEPS,
  loop: boolean = true
): number {
  if (totalSteps <= 0) return 0;
  const prev = currentIndex - 1;
  if (prev < 0) {
    return loop ? totalSteps - 1 : 0;
  }
  return prev;
}

/**
 * Safely clamps the forecast index within valid bounds.
 */
export function clampForecastIndex(
  index: number,
  totalSteps: number = FORECAST_TOTAL_TIMESTEPS
): number {
  if (isNaN(index) || index < 0) return 0;
  if (index >= totalSteps) return totalSteps - 1;
  return Math.floor(index);
}
