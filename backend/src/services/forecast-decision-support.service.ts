/**
 * Forecast Decision Support Service for JATAYU Tactical Map 2.0 (Phase 3E-1)
 *
 * Implements deterministic, explainable district-level meteorological decision support:
 * 1. Gapless Five-Tier Meteorological Rainfall Priority (decoupled from wind kinematics and flood inundation).
 * 2. Independent Aerodynamic Wind Severity Scale (decoupled from precipitation).
 * 3. First-24-Hour Trajectory Analysis and Extended Forecast Blocks (W1..W12, handling incomplete 5h block W12).
 * 4. Temporal Milestones (Onset, Peak, Cessation, Elevated Durations).
 * 5. Three-State Contributing Drivers (TRIGGERED, NOT_TRIGGERED, UNAVAILABLE with explicit missing-data reasons).
 * 6. Localized Pressure-Tendency Gap Isolation (MSLP strictly evaluated; 3h index range 3..71, 6h range 6..71).
 * 7. Meteorological Data Availability Policy (Core vs Optional variables).
 *
 * Zero composite numerical risk scores. Zero LLM hallucinations.
 */

import { HourlyGridDataPoint } from '../types/forecast-grid.types.js';
import {
  RainfallPriorityTier,
  WindSeverityCategory,
  First24hTrajectory,
  OverallDataStatus,
  DistrictMeteorologicalAvailability,
  DistrictRainfallAssessment,
  DistrictWindAssessment,
  ContributingDriverState,
  TemporalMilestones,
  ExtendedForecastBlock,
  DistrictDecisionSupport,
} from '../types/forecast-impact.types.js';
import {
  classifyImd24hRainfall,
  classifyImdHourlyRate,
} from './forecast-impact.service.js';

/**
 * Validates timestamp continuity and existence of a continuous interval [startIdx, endIdx].
 */
export function isContiguousInterval(
  hourly: HourlyGridDataPoint[],
  startIdx: number,
  endIdx: number
): boolean {
  if (!hourly || hourly.length <= endIdx || startIdx < 0) return false;
  let prevMs = new Date(hourly[startIdx]?.time || '').getTime();
  if (isNaN(prevMs)) return false;

  for (let i = startIdx + 1; i <= endIdx; i++) {
    const pt = hourly[i];
    if (!pt || !pt.time) return false;
    const currMs = new Date(pt.time).getTime();
    if (isNaN(currMs) || currMs - prevMs !== 3600000) {
      return false;
    }
    prevMs = currMs;
  }
  return true;
}

export interface ContinuityMask {
  isFullyContinuous: boolean;
  stepContiguous: boolean[];
}

/**
 * Scans timestamp continuity across the timeseries once.
 */
export function getContinuityMask(hourly: HourlyGridDataPoint[]): ContinuityMask {
  const n = hourly ? hourly.length : 0;
  if (n <= 1) return { isFullyContinuous: n === 1, stepContiguous: [] };

  const stepContiguous = new Array<boolean>(n).fill(false);
  let allContiguous = true;
  let prevMs = new Date(hourly[0]?.time || '').getTime();
  if (isNaN(prevMs)) allContiguous = false;

  for (let i = 1; i < n; i++) {
    const pt = hourly[i];
    if (!pt || !pt.time) {
      allContiguous = false;
      continue;
    }
    const currMs = new Date(pt.time).getTime();
    if (!isNaN(prevMs) && !isNaN(currMs) && currMs - prevMs === 3600000) {
      stepContiguous[i] = true;
    } else {
      allContiguous = false;
    }
    prevMs = currMs;
  }

  return { isFullyContinuous: allContiguous, stepContiguous };
}

export function isRangeContiguous(mask: ContinuityMask, startIdx: number, endIdx: number): boolean {
  if (mask.isFullyContinuous) return true;
  for (let i = startIdx + 1; i <= endIdx; i++) {
    if (!mask.stepContiguous[i]) return false;
  }
  return true;
}

/**
 * Evaluates core and optional meteorological variable completeness.
 */
export function evaluateMeteorologicalAvailability(
  hourly: HourlyGridDataPoint[],
  mask?: ContinuityMask
): DistrictMeteorologicalAvailability {
  if (!hourly || hourly.length === 0) {
    return {
      overallStatus: 'UNAVAILABLE',
      isPrecipitationAvailable: false,
      isWindAvailable: false,
      isPressureAvailable: false,
      missingVariables: ['precipitationMm', 'windGustsKmh', 'pressureMslHpa'],
    };
  }

  const cMask = mask || getContinuityMask(hourly);

  // 1. Core variable: precipitation across T+1..T+24
  let isPrecipitationAvailable = false;
  if (hourly.length >= 25 && isRangeContiguous(cMask, 0, 24)) {
    let allValid = true;
    for (let t = 1; t <= 24; t++) {
      const p = hourly[t]?.precipitationMm;
      if (typeof p !== 'number' || isNaN(p) || p < 0) {
        allValid = false;
        break;
      }
    }
    isPrecipitationAvailable = allValid;
  }

  // 2. Core variable: wind gusts across T+1..T+24
  let isWindAvailable = false;
  if (hourly.length >= 25) {
    let validCount = 0;
    for (let t = 1; t <= 24; t++) {
      const g = hourly[t]?.windGustsKmh;
      if (typeof g === 'number' && !isNaN(g) && g >= 0) {
        validCount++;
      }
    }
    isWindAvailable = validCount >= 20;
  }

  // 3. Core variable: mean sea-level pressure across T+0..T+71
  let isPressureAvailable = false;
  if (hourly.length >= 72 && isRangeContiguous(cMask, 0, 71)) {
    let allValid = true;
    for (let t = 0; t < 72; t++) {
      const p = hourly[t]?.pressureMslHpa;
      if (typeof p !== 'number' || isNaN(p) || p <= 0) {
        allValid = false;
        break;
      }
    }
    isPressureAvailable = allValid;
  }

  const missingVariables: string[] = [];
  if (!isPrecipitationAvailable) missingVariables.push('precipitationMm');
  if (!isWindAvailable) missingVariables.push('windGustsKmh');
  if (!isPressureAvailable) missingVariables.push('pressureMslHpa');

  let overallStatus: OverallDataStatus;
  if (isPrecipitationAvailable && isWindAvailable && isPressureAvailable) {
    overallStatus = 'COMPLETE';
  } else if (isPrecipitationAvailable || isWindAvailable || isPressureAvailable) {
    overallStatus = 'PARTIAL';
  } else {
    overallStatus = 'UNAVAILABLE';
  }

  return {
    overallStatus,
    isPrecipitationAvailable,
    isWindAvailable,
    isPressureAvailable,
    missingVariables,
  };
}

/**
 * Evaluates rainfall priority tier using deterministic top-down precedence.
 * Purely evaluated on prospective 24h accumulation and peak hourly rain rate.
 */
export function evaluateRainfallPriorityTier(
  accum24hMm: number | null,
  peakHourlyRateMmH: number | null
): RainfallPriorityTier {
  if (accum24hMm === null || isNaN(accum24hMm) || accum24hMm < 0) {
    return 'UNAVAILABLE';
  }

  const rate = peakHourlyRateMmH !== null && !isNaN(peakHourlyRateMmH) && peakHourlyRateMmH >= 0
    ? peakHourlyRateMmH
    : 0;

  // Tier 1 (Critical Hazard)
  if (accum24hMm >= 204.5 || rate >= 50.0) {
    return 'TIER_1_CRITICAL';
  }

  // Tier 2 (Elevated Hazard)
  if (accum24hMm >= 115.5 || rate >= 35.0) {
    return 'TIER_2_ELEVATED';
  }

  // Tier 3 (Watch)
  if (accum24hMm >= 64.5 || rate >= 15.0) {
    return 'TIER_3_WATCH';
  }

  // Tier 4 (Advisory)
  if (accum24hMm >= 15.0 || rate >= 7.5) {
    return 'TIER_4_ADVISORY';
  }

  // Tier 5 (Routine / Minimal Rain Hazard)
  return 'TIER_5_ROUTINE';
}

/**
 * Evaluates wind severity category exclusively on peak 10m wind gust.
 */
export function evaluateWindSeverity(
  maxWindGustKmh: number | null
): WindSeverityCategory {
  if (maxWindGustKmh === null || isNaN(maxWindGustKmh) || maxWindGustKmh < 0) {
    return 'UNAVAILABLE';
  }

  if (maxWindGustKmh >= 85.0) return 'EXTREME_GALE_STORM';
  if (maxWindGustKmh >= 65.0) return 'GALE_FORCE';
  if (maxWindGustKmh >= 50.0) return 'NEAR_GALE';
  if (maxWindGustKmh >= 40.0) return 'MODERATE_BREEZE';
  return 'ROUTINE';
}

/**
 * Evaluates first-24h rainfall trajectory over four non-overlapping 6-hour windows.
 * Evaluates strictly in deterministic tactical precedence order:
 * Step 1: Data Validity
 * Step 2: STABLE_LOW (max < 15mm)
 * Step 3: DELAYED_ONSET (dry opening (W1+W2 < 5), heavy late (W3+W4 >= 25))
 * Step 4: INTENSIFYING (ongoing compounding event)
 * Step 5: IMMEDIATE_PEAK (front-loaded burst with steep cliff)
 * Step 6: SUBSIDING (steady monotonic relaxation)
 * Step 7: PERSISTENT_UNIFORM (sustained rain)
 * Step 8: MIXED_OR_VARIABLE (deterministic fallback)
 */
export function evaluateFirst24hTrajectory(
  w1: number | null,
  w2: number | null,
  w3: number | null,
  w4: number | null
): First24hTrajectory {
  if (
    w1 === null || isNaN(w1) || w1 < 0 ||
    w2 === null || isNaN(w2) || w2 < 0 ||
    w3 === null || isNaN(w3) || w3 < 0 ||
    w4 === null || isNaN(w4) || w4 < 0
  ) {
    return 'UNAVAILABLE';
  }

  const maxW = Math.max(w1, w2, w3, w4);
  const minW = Math.min(w1, w2, w3, w4);

  // Step 2: STABLE_LOW
  if (maxW < 15.0) {
    return 'STABLE_LOW';
  }

  // Step 3: DELAYED_ONSET
  if ((w1 + w2) < 5.0 && (w3 + w4) >= 25.0) {
    return 'DELAYED_ONSET';
  }

  // Step 4: INTENSIFYING
  if ((w2 >= 1.5 * w1 && w2 >= 15.0) || (w3 >= 1.5 * w2 && w3 >= 15.0)) {
    return 'INTENSIFYING';
  }

  // Step 5: IMMEDIATE_PEAK
  if (w1 === maxW && w1 >= 15.0 && w2 < 0.70 * w1) {
    return 'IMMEDIATE_PEAK';
  }

  // Step 6: SUBSIDING
  if (w1 >= 15.0 && w1 > w2 && w2 > w3 && w3 > w4) {
    return 'SUBSIDING';
  }

  // Step 7: PERSISTENT_UNIFORM
  if (maxW >= 15.0 && maxW > 0 && (minW / maxW) >= 0.60) {
    return 'PERSISTENT_UNIFORM';
  }

  // Step 8: Deterministic Fallback
  return 'MIXED_OR_VARIABLE';
}

/**
 * Computes first-24h temporal milestones and trajectory.
 */
export function computeTemporalMilestones(
  hourly: HourlyGridDataPoint[],
  mask?: ContinuityMask
): TemporalMilestones {
  const defaultMilestones: TemporalMilestones = {
    w1Mm: null,
    w2Mm: null,
    w3Mm: null,
    w4Mm: null,
    first24hTrajectory: 'UNAVAILABLE',
    onsetHourUtc: null,
    peakHourUtc: null,
    cessationHourUtc: null,
    elevatedHoursTotal: 0,
    longestElevatedRunHours: 0,
  };

  const cMask = mask || getContinuityMask(hourly);

  if (!hourly || hourly.length < 25 || !isRangeContiguous(cMask, 0, 24)) {
    return defaultMilestones;
  }

  function sumBlock(start: number, end: number): number | null {
    let sum = 0;
    for (let t = start; t <= end; t++) {
      const p = hourly[t]?.precipitationMm;
      if (typeof p !== 'number' || isNaN(p) || p < 0) return null;
      sum += p;
    }
    return Math.round(sum * 10) / 10;
  }

  const w1 = sumBlock(1, 6);
  const w2 = sumBlock(7, 12);
  const w3 = sumBlock(13, 18);
  const w4 = sumBlock(19, 24);

  const trajectory = evaluateFirst24hTrajectory(w1, w2, w3, w4);

  // Future prospective hours (indices 1..available)
  const totalAvailable = hourly.length;
  let onsetHourUtc: string | null = null;
  let peakRate = -1;
  let peakIdx = -1;
  let peakHourUtc: string | null = null;
  let elevatedHoursTotal = 0;
  let currentRun = 0;
  let longestElevatedRunHours = 0;

  for (let t = 1; t < totalAvailable; t++) {
    const pt = hourly[t];
    const p = pt?.precipitationMm;
    if (typeof p === 'number' && !isNaN(p) && p >= 0) {
      if (onsetHourUtc === null && p >= 2.5) {
        onsetHourUtc = pt.time;
      }
      if (p > peakRate) {
        peakRate = p;
        peakIdx = t;
        peakHourUtc = pt.time;
      }
      if (p >= 5.0) {
        elevatedHoursTotal++;
        currentRun++;
        if (currentRun > longestElevatedRunHours) {
          longestElevatedRunHours = currentRun;
        }
      } else {
        currentRun = 0;
      }
    }
  }

  // Cessation: first hour t > peakIdx where 3 consecutive hours are < 2.5 mm/h
  let cessationHourUtc: string | null = null;
  if (peakIdx > 0 && peakIdx + 3 < totalAvailable) {
    for (let t = peakIdx + 1; t + 2 < totalAvailable; t++) {
      const p0 = hourly[t]?.precipitationMm ?? 999;
      const p1 = hourly[t + 1]?.precipitationMm ?? 999;
      const p2 = hourly[t + 2]?.precipitationMm ?? 999;
      if (p0 < 2.5 && p1 < 2.5 && p2 < 2.5) {
        cessationHourUtc = hourly[t].time;
        break;
      }
    }
  }

  return {
    w1Mm: w1,
    w2Mm: w2,
    w3Mm: w3,
    w4Mm: w4,
    first24hTrajectory: trajectory,
    onsetHourUtc,
    peakHourUtc,
    cessationHourUtc,
    elevatedHoursTotal,
    longestElevatedRunHours,
  };
}

/**
 * Computes 12 extended forecast blocks across prospective horizon T+1..T+71.
 * Blocks 1..11 are exactly 6 hours. Block 12 is strictly 5 hours (T+67..T+71).
 */
export function computeExtendedForecastBlocks(
  hourly: HourlyGridDataPoint[]
): ExtendedForecastBlock[] {
  const blocks: ExtendedForecastBlock[] = [];
  const ranges = [
    { blockIndex: 1, startHour: 1, endHour: 6, durationHours: 6, isIncomplete: false },
    { blockIndex: 2, startHour: 7, endHour: 12, durationHours: 6, isIncomplete: false },
    { blockIndex: 3, startHour: 13, endHour: 18, durationHours: 6, isIncomplete: false },
    { blockIndex: 4, startHour: 19, endHour: 24, durationHours: 6, isIncomplete: false },
    { blockIndex: 5, startHour: 25, endHour: 30, durationHours: 6, isIncomplete: false },
    { blockIndex: 6, startHour: 31, endHour: 36, durationHours: 6, isIncomplete: false },
    { blockIndex: 7, startHour: 37, endHour: 42, durationHours: 6, isIncomplete: false },
    { blockIndex: 8, startHour: 43, endHour: 48, durationHours: 6, isIncomplete: false },
    { blockIndex: 9, startHour: 49, endHour: 54, durationHours: 6, isIncomplete: false },
    { blockIndex: 10, startHour: 55, endHour: 60, durationHours: 6, isIncomplete: false },
    { blockIndex: 11, startHour: 61, endHour: 66, durationHours: 6, isIncomplete: false },
    { blockIndex: 12, startHour: 67, endHour: 71, durationHours: 5, isIncomplete: true },
  ];

  const totalAvailable = hourly ? hourly.length : 0;

  for (const r of ranges) {
    if (totalAvailable <= r.endHour) {
      blocks.push({
        ...r,
        accumMm: null,
        meanRateMmH: null,
      });
      continue;
    }

    let sum = 0;
    let valid = true;
    for (let t = r.startHour; t <= r.endHour; t++) {
      const p = hourly[t]?.precipitationMm;
      if (typeof p !== 'number' || isNaN(p) || p < 0) {
        valid = false;
        break;
      }
      sum += p;
    }

    if (!valid) {
      blocks.push({
        ...r,
        accumMm: null,
        meanRateMmH: null,
      });
    } else {
      const accum = Math.round(sum * 10) / 10;
      const rate = Math.round((accum / r.durationHours) * 10) / 10;
      blocks.push({
        ...r,
        accumMm: accum,
        meanRateMmH: rate,
      });
    }
  }

  return blocks;
}

/**
 * Evaluates five contributing drivers with three-state logic (TRIGGERED, NOT_TRIGGERED, UNAVAILABLE).
 * Includes strict localized gap isolation for pressure tendency (MSLP only).
 */
export function evaluateContributingDrivers(
  hourly: HourlyGridDataPoint[],
  mask?: ContinuityMask
): ContributingDriverState[] {
  const drivers: ContributingDriverState[] = [];
  const totalAvailable = hourly ? hourly.length : 0;
  const cMask = mask || getContinuityMask(hourly);

  // 1. CONVECTIVE_BURST
  // Requires precipitationMm and showersMm in T+1..T+24
  let convectiveState: ContributingDriverState = {
    key: 'CONVECTIVE_BURST',
    status: 'NOT_TRIGGERED',
    provenance: 'PROPOSED_HEURISTIC',
  };

  if (totalAvailable < 25) {
    convectiveState = {
      key: 'CONVECTIVE_BURST',
      status: 'UNAVAILABLE',
      missingDataReason: 'Hourly timeseries shorter than 24 prospective hours',
      provenance: 'PROPOSED_HEURISTIC',
    };
  } else {
    let hasShowersData = true;
    let burstTriggered = false;
    let burstEvidence: ContributingDriverState['evidence'] | undefined;

    for (let t = 1; t <= 24; t++) {
      const pt = hourly[t];
      if (!pt || typeof pt.showersMm !== 'number' || isNaN(pt.showersMm)) {
        hasShowersData = false;
        break;
      }
      const p = pt.precipitationMm;
      const s = pt.showersMm;
      if (typeof p === 'number' && !isNaN(p) && p >= 15.0 && s >= 0) {
        const ratio = Math.round((s / p) * 100) / 100;
        if (ratio >= 0.50) {
          burstTriggered = true;
          burstEvidence = {
            observedValue: ratio,
            threshold: 0.50,
            units: 'ratio',
            timestampUtc: pt.time,
          };
          break;
        }
      }
    }

    if (!hasShowersData) {
      convectiveState = {
        key: 'CONVECTIVE_BURST',
        status: 'UNAVAILABLE',
        missingDataReason: 'showersMm variable not provided in NWP cycle',
        provenance: 'PROPOSED_HEURISTIC',
      };
    } else if (burstTriggered) {
      convectiveState = {
        key: 'CONVECTIVE_BURST',
        status: 'TRIGGERED',
        evidence: burstEvidence,
        provenance: 'PROPOSED_HEURISTIC',
      };
    }
  }
  drivers.push(convectiveState);

  // 2. PROLONGED_INTENSITY
  // Requires continuous precipitation in T+1..T+24
  let prolongedState: ContributingDriverState = {
    key: 'PROLONGED_INTENSITY',
    status: 'NOT_TRIGGERED',
    provenance: 'PROPOSED_HEURISTIC',
  };

  if (totalAvailable < 25 || !isRangeContiguous(cMask, 0, 24)) {
    prolongedState = {
      key: 'PROLONGED_INTENSITY',
      status: 'UNAVAILABLE',
      missingDataReason: 'Precipitation timeseries incomplete or discontinuous across T+1..T+24',
      provenance: 'PROPOSED_HEURISTIC',
    };
  } else {
    let currentRun = 0;
    let maxRun = 0;
    for (let t = 1; t <= 24; t++) {
      const p = hourly[t]?.precipitationMm;
      if (typeof p === 'number' && !isNaN(p) && p >= 5.0) {
        currentRun++;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 0;
      }
    }

    if (maxRun >= 4) {
      prolongedState = {
        key: 'PROLONGED_INTENSITY',
        status: 'TRIGGERED',
        evidence: {
          observedValue: maxRun,
          threshold: 4,
          units: 'hours',
        },
        provenance: 'PROPOSED_HEURISTIC',
      };
    }
  }
  drivers.push(prolongedState);

  // 3. GALE_GUST_COINCIDENCE
  // Requires windGustsKmh and precipitationMm in T+1..T+24
  let gustCoincidenceState: ContributingDriverState = {
    key: 'GALE_GUST_COINCIDENCE',
    status: 'NOT_TRIGGERED',
    provenance: 'PROPOSED_HEURISTIC',
  };

  if (totalAvailable < 25) {
    gustCoincidenceState = {
      key: 'GALE_GUST_COINCIDENCE',
      status: 'UNAVAILABLE',
      missingDataReason: 'Hourly timeseries shorter than 24 prospective hours',
      provenance: 'PROPOSED_HEURISTIC',
    };
  } else {
    let hasGustData = true;
    let coincidenceTriggered = false;
    let evidence: ContributingDriverState['evidence'] | undefined;

    for (let t = 1; t <= 24; t++) {
      const pt = hourly[t];
      if (!pt || typeof pt.windGustsKmh !== 'number' || isNaN(pt.windGustsKmh)) {
        hasGustData = false;
        break;
      }
      const g = pt.windGustsKmh;
      if (g >= 65.0) {
        // Check rain at t-1, t, t+1
        const pCurrent = pt.precipitationMm ?? 0;
        const pPrev = t > 1 ? (hourly[t - 1]?.precipitationMm ?? 0) : 0;
        const pNext = t < 24 ? (hourly[t + 1]?.precipitationMm ?? 0) : 0;
        if (pCurrent >= 7.5 || pPrev >= 7.5 || pNext >= 7.5) {
          coincidenceTriggered = true;
          evidence = {
            observedValue: g,
            threshold: 65.0,
            units: 'km/h',
            timestampUtc: pt.time,
          };
          break;
        }
      }
    }

    if (!hasGustData) {
      gustCoincidenceState = {
        key: 'GALE_GUST_COINCIDENCE',
        status: 'UNAVAILABLE',
        missingDataReason: 'windGustsKmh variable not provided in NWP cycle',
        provenance: 'PROPOSED_HEURISTIC',
      };
    } else if (coincidenceTriggered) {
      gustCoincidenceState = {
        key: 'GALE_GUST_COINCIDENCE',
        status: 'TRIGGERED',
        evidence,
        provenance: 'PROPOSED_HEURISTIC',
      };
    }
  }
  drivers.push(gustCoincidenceState);

  // 4. RAPID_BAROMETRIC_DROP
  // Strictly evaluates pressureMslHpa (MSLP only). Zero substitution with surface pressure!
  // Independent 3h tendency for t in [3, 71] (up to 69 steps).
  // Independent 6h tendency for t in [6, 71] (up to 66 steps).
  // A gap at index k invalidates t in [k, k+m].
  let pressureDropState: ContributingDriverState = {
    key: 'RAPID_BAROMETRIC_DROP',
    status: 'NOT_TRIGGERED',
    provenance: 'PROPOSED_HEURISTIC',
  };

  let valid3hWindows = 0;
  let valid6hWindows = 0;
  let maxDrop3h = -1;
  let maxDrop6h = -1;
  let maxDrop3hTime: string | null = null;
  let maxDrop6hTime: string | null = null;

  const maxEvaluatedHour = Math.min(71, totalAvailable - 1);

  // Evaluate 3-hour tendency: t in [3, maxEvaluatedHour]
  for (let t = 3; t <= maxEvaluatedHour; t++) {
    // Window [t-3, t] requires all 4 points to be continuous and have valid pressureMslHpa
    if (isRangeContiguous(cMask, t - 3, t)) {
      const pBase = hourly[t - 3]?.pressureMslHpa;
      const pTarget = hourly[t]?.pressureMslHpa;
      if (
        typeof pBase === 'number' && !isNaN(pBase) && pBase > 0 &&
        typeof pTarget === 'number' && !isNaN(pTarget) && pTarget > 0
      ) {
        // Also verify intermediate points t-2, t-1 have valid pressure
        const p1 = hourly[t - 2]?.pressureMslHpa;
        const p2 = hourly[t - 1]?.pressureMslHpa;
        if (
          typeof p1 === 'number' && !isNaN(p1) && p1 > 0 &&
          typeof p2 === 'number' && !isNaN(p2) && p2 > 0
        ) {
          valid3hWindows++;
          const drop = Math.round((pBase - pTarget) * 10) / 10;
          if (drop > maxDrop3h) {
            maxDrop3h = drop;
            maxDrop3hTime = hourly[t]?.time || null;
          }
        }
      }
    }
  }

  // Evaluate 6-hour tendency: t in [6, maxEvaluatedHour]
  for (let t = 6; t <= maxEvaluatedHour; t++) {
    // Window [t-6, t] requires all 7 points to be continuous and have valid pressureMslHpa
    if (isRangeContiguous(cMask, t - 6, t)) {
      const pBase = hourly[t - 6]?.pressureMslHpa;
      const pTarget = hourly[t]?.pressureMslHpa;
      if (
        typeof pBase === 'number' && !isNaN(pBase) && pBase > 0 &&
        typeof pTarget === 'number' && !isNaN(pTarget) && pTarget > 0
      ) {
        let intermediatesValid = true;
        for (let j = t - 5; j < t; j++) {
          const pj = hourly[j]?.pressureMslHpa;
          if (typeof pj !== 'number' || isNaN(pj) || pj <= 0) {
            intermediatesValid = false;
            break;
          }
        }
        if (intermediatesValid) {
          valid6hWindows++;
          const drop = Math.round((pBase - pTarget) * 10) / 10;
          if (drop > maxDrop6h) {
            maxDrop6h = drop;
            maxDrop6hTime = hourly[t]?.time || null;
          }
        }
      }
    }
  }

  if (valid3hWindows === 0 && valid6hWindows === 0) {
    pressureDropState = {
      key: 'RAPID_BAROMETRIC_DROP',
      status: 'UNAVAILABLE',
      missingDataReason: 'Mean sea-level pressure timeseries has no contiguous 3h or 6h segments',
      provenance: 'PROPOSED_HEURISTIC',
    };
  } else if (maxDrop3h >= 3.0 || maxDrop6h >= 5.0) {
    const is3hDominant = (maxDrop3h / 3.0) >= (maxDrop6h / 5.0);
    pressureDropState = {
      key: 'RAPID_BAROMETRIC_DROP',
      status: 'TRIGGERED',
      evidence: {
        observedValue: is3hDominant ? maxDrop3h : maxDrop6h,
        threshold: is3hDominant ? 3.0 : 5.0,
        units: 'hPa',
        timestampUtc: is3hDominant ? (maxDrop3hTime || undefined) : (maxDrop6hTime || undefined),
      },
      provenance: 'PROPOSED_HEURISTIC',
    };
  }
  drivers.push(pressureDropState);

  // 5. IMMINENT_ONSET
  // Requires precipitationMm in hours T+1..T+3
  let imminentState: ContributingDriverState = {
    key: 'IMMINENT_ONSET',
    status: 'NOT_TRIGGERED',
    provenance: 'PROPOSED_HEURISTIC',
  };

  if (totalAvailable < 4) {
    imminentState = {
      key: 'IMMINENT_ONSET',
      status: 'UNAVAILABLE',
      missingDataReason: 'Initial 3-hour precipitation timeseries incomplete',
      provenance: 'PROPOSED_HEURISTIC',
    };
  } else {
    let initialValid = true;
    let onsetHour: number | null = null;
    let onsetTime: string | null = null;

    for (let t = 1; t <= 3; t++) {
      const p = hourly[t]?.precipitationMm;
      if (typeof p !== 'number' || isNaN(p) || p < 0) {
        initialValid = false;
        break;
      }
      if (onsetHour === null && p >= 2.5) {
        onsetHour = t;
        onsetTime = hourly[t].time;
      }
    }

    if (!initialValid) {
      imminentState = {
        key: 'IMMINENT_ONSET',
        status: 'UNAVAILABLE',
        missingDataReason: 'Initial 3-hour precipitation timeseries incomplete',
        provenance: 'PROPOSED_HEURISTIC',
      };
    } else if (onsetHour !== null) {
      imminentState = {
        key: 'IMMINENT_ONSET',
        status: 'TRIGGERED',
        evidence: {
          observedValue: onsetHour,
          threshold: 3,
          units: 'hours',
          timestampUtc: onsetTime || undefined,
        },
        provenance: 'PROPOSED_HEURISTIC',
      };
    }
  }
  drivers.push(imminentState);

  return drivers;
}

/**
 * Builds complete DistrictDecisionSupport structure for a district.
 */
export function buildDistrictDecisionSupport(
  hourly: HourlyGridDataPoint[],
  accum24hMm: number | null,
  peakHourlyRateMmH: number | null,
  peakHourlyTimeUtc: string | null,
  maxWindGustKmh: number | null,
  officialAlertMatch?: DistrictDecisionSupport['officialImdAlert'],
  precomputedMask?: ContinuityMask
): DistrictDecisionSupport {
  const mask = precomputedMask || getContinuityMask(hourly);
  const availability = evaluateMeteorologicalAvailability(hourly, mask);

  // Rainfall Assessment
  let rainfall: DistrictRainfallAssessment;
  if (!availability.isPrecipitationAvailable || accum24hMm === null) {
    rainfall = {
      status: 'DATA_INSUFFICIENT',
      priorityTier: 'UNAVAILABLE',
      imd24hCategory: 'UNAVAILABLE',
      accum24hMm: null,
      peakHourlyRateMmH: null,
      peakHourlyCategory: 'UNAVAILABLE',
      peakHourlyTimeUtc: null,
      thresholdDefinition: 'Official IMD 24-Hour Rainfall Standard',
      priorityDefinition: 'JATAYU Internal Decision-Support Heuristic',
      insufficientReason: 'Precipitation timeseries incomplete or discontinuous across T+1..T+24',
    };
  } else {
    const imdCategory = classifyImd24hRainfall(accum24hMm);
    const imdRateCategory = classifyImdHourlyRate(peakHourlyRateMmH);
    const priorityTier = evaluateRainfallPriorityTier(accum24hMm, peakHourlyRateMmH);
    rainfall = {
      status: 'AVAILABLE',
      priorityTier,
      imd24hCategory: imdCategory,
      accum24hMm,
      peakHourlyRateMmH,
      peakHourlyCategory: imdRateCategory,
      peakHourlyTimeUtc,
      thresholdDefinition: 'Official IMD 24-Hour Rainfall Standard',
      priorityDefinition: 'JATAYU Internal Decision-Support Heuristic',
    };
  }

  // Wind Assessment
  let wind: DistrictWindAssessment;
  if (!availability.isWindAvailable || maxWindGustKmh === null) {
    wind = {
      status: 'UNAVAILABLE',
      severityCategory: 'UNAVAILABLE',
      maxWindGustKmh: null,
      peakGustTimeUtc: null,
      provenance: 'PROPOSED_HEURISTIC_WIND_SCALE',
      insufficientReason: 'Wind gust timeseries missing or incomplete across T+1..T+24',
    };
  } else {
    const severityCategory = evaluateWindSeverity(maxWindGustKmh);
    wind = {
      status: 'AVAILABLE',
      severityCategory,
      maxWindGustKmh,
      peakGustTimeUtc: null,
      provenance: 'PROPOSED_HEURISTIC_WIND_SCALE',
    };
  }

  // Temporal Milestones and Extended Blocks
  const temporalMilestones = computeTemporalMilestones(hourly, mask);
  const extendedBlocks = computeExtendedForecastBlocks(hourly);
  const contributingDrivers = evaluateContributingDrivers(hourly, mask);

  return {
    availability,
    rainfall,
    wind,
    temporalMilestones,
    extendedBlocks,
    contributingDrivers,
    officialImdAlert: officialAlertMatch,
  };
}

export class ForecastDecisionSupportService {
  public evaluateAvailability(hourly: HourlyGridDataPoint[]): DistrictMeteorologicalAvailability {
    return evaluateMeteorologicalAvailability(hourly);
  }

  public evaluateRainfall(
    accum24hMm: number | null,
    peakHourlyRateMmH: number | null
  ): RainfallPriorityTier {
    return evaluateRainfallPriorityTier(accum24hMm, peakHourlyRateMmH);
  }

  public evaluateWind(maxWindGustKmh: number | null): WindSeverityCategory {
    return evaluateWindSeverity(maxWindGustKmh);
  }

  public evaluateTrajectory(
    w1: number | null,
    w2: number | null,
    w3: number | null,
    w4: number | null
  ): First24hTrajectory {
    return evaluateFirst24hTrajectory(w1, w2, w3, w4);
  }

  public evaluateDrivers(hourly: HourlyGridDataPoint[]): ContributingDriverState[] {
    return evaluateContributingDrivers(hourly);
  }

  public buildDecisionSupport(
    hourly: HourlyGridDataPoint[],
    accum24hMm: number | null,
    peakHourlyRateMmH: number | null,
    peakHourlyTimeUtc: string | null,
    maxWindGustKmh: number | null,
    officialAlertMatch?: DistrictDecisionSupport['officialImdAlert'],
    precomputedMask?: ContinuityMask
  ): DistrictDecisionSupport {
    return buildDistrictDecisionSupport(
      hourly,
      accum24hMm,
      peakHourlyRateMmH,
      peakHourlyTimeUtc,
      maxWindGustKmh,
      officialAlertMatch,
      precomputedMask
    );
  }
}

export const forecastDecisionSupportService = new ForecastDecisionSupportService();
