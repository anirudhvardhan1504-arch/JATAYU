/**
 * ==============================================================================
 * JATAYU Threat Matrix & Operational Readiness Decision Engine
 * ==============================================================================
 *
 * This module defines the deterministic business logic for evaluating civil defense
 * threat phases based on multi-source disaster intelligence:
 * 1. Live Meteorological NWP Observations (Open-Meteo)
 * 2. Indicative Flood Risk Screening Heuristics (JATAYU Internal 4-Factor Model)
 * 3. Official Severe Weather Bulletins (India Meteorological Department Nowcast)
 *
 * ------------------------------------------------------------------------------
 * THREAT PHASE HIERARCHY & ESCALATION RULES (Phase 2G Specification)
 * ------------------------------------------------------------------------------
 * • PHASE 3: EVACUATION (Highest Severity)
 *   - Trigger 3A: Official IMD warning with severity 'EMERGENCY'.
 *   - Trigger 3B: Observed precipitation intensity >= 35.0 mm/h.
 *   - Trigger 3C: Indicative flood risk category 'HIGH' or 'CRITICAL' (Score >= 65).
 *   - Action: Immediate life-safety evacuation, high-ground shelter activation.
 *
 * • PHASE 2: CRITICAL_ALERT
 *   - Trigger 2A: Official IMD warning with severity 'WARNING'.
 *   - Trigger 2B: Observed precipitation intensity >= 10.0 mm/h (and < 35.0 mm/h).
 *   - Trigger 2C: Indicative flood risk category 'ELEVATED' (Score 45 - 64).
 *   - NOTE: 'GUARDED' risk (Score 25 - 44) alone DOES NOT trigger Phase 2.
 *   - Action: Pre-position pumps, inspect stormwater outfalls, public notices.
 *
 * • PHASE 1: EARLY_WATCH (Baseline Vigilance)
 *   - Condition: All required telemetry sources are fresh and verified normal.
 *   - Risk is 'LOW' (Score 0-24) or 'GUARDED' (Score 25-44).
 *   - Precipitation intensity < 10.0 mm/h.
 *   - Zero official Emergency or Warning bulletins active.
 *   - Action: Standard monitoring, incident command post readiness.
 *
 * • INSUFFICIENT_DATA (Inadequate Operational Evidence)
 *   - Condition: Neither Phase 3 nor Phase 2 triggers are active, BUT available
 *     telemetry is missing, stale (>90 mins), or unreachable.
 *   - Crucial Safety Rule: The absence of returned alerts or observations is NEVER
 *     interpreted as proof of safety or zero rainfall.
 *   - Action: Standby protocols active; prioritize communication and data link verification.
 *
 * ------------------------------------------------------------------------------
 * PRECEDENCE & CONFLICT RESOLUTION
 * ------------------------------------------------------------------------------
 * Higher-severity conditions take absolute precedence over lower-severity conditions:
 * Phase 3 (EVACUATION) > Phase 2 (CRITICAL_ALERT) > Phase 1 (EARLY_WATCH).
 * Valid higher-severity triggers supported by available evidence are NEVER suppressed
 * because another unrelated source is missing.
 * ==============================================================================
 */

import {
  CurrentWeatherObservation,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
  ThreatEvaluationResult,
} from '../types';

export interface ThreatMatrixInputs {
  weather?: CurrentWeatherObservation | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
}

export function evaluateThreatMatrix(inputs: ThreatMatrixInputs): ThreatEvaluationResult {
  const { weather, riskAssessment, alertFeed } = inputs;

  // 1. Evaluate Individual Source Integrity & Freshness
  const isWeatherAvailable = weather !== null && weather !== undefined;
  const isWeatherStale = Boolean(isWeatherAvailable && weather.isStale);
  const weatherHealth: 'FRESH' | 'STALE' | 'UNAVAILABLE' = !isWeatherAvailable
    ? 'UNAVAILABLE'
    : isWeatherStale
    ? 'STALE'
    : 'FRESH';

  const isRiskAvailable =
    riskAssessment !== null &&
    riskAssessment !== undefined &&
    Boolean(riskAssessment.overallRiskLevel);
  const riskHealth: 'AVAILABLE' | 'UNAVAILABLE' = isRiskAvailable ? 'AVAILABLE' : 'UNAVAILABLE';

  // Alert feed is considered verified if the response is present and not an unpopulated fallback
  const isAlertAvailable =
    alertFeed !== null &&
    alertFeed !== undefined &&
    !(alertFeed.feedStatus === 'UPSTREAM_FALLBACK' && (!alertFeed.officialAlerts || alertFeed.officialAlerts.length === 0));
  const alertHealth: 'VERIFIED' | 'UNAVAILABLE' = isAlertAvailable ? 'VERIFIED' : 'UNAVAILABLE';

  // Compile missing data reasons
  const missingDataReasons: string[] = [];
  if (weatherHealth === 'UNAVAILABLE') {
    missingDataReasons.push('Live meteorological observation unavailable');
  } else if (weatherHealth === 'STALE') {
    missingDataReasons.push('Meteorological telemetry latency exceeds 90 minutes');
  }
  if (riskHealth === 'UNAVAILABLE') {
    missingDataReasons.push('Indicative flood risk assessment unavailable');
  }
  if (alertHealth === 'UNAVAILABLE') {
    missingDataReasons.push('Official IMD Nowcast bulletin feed unreachable');
  }

  const sourceHealth = {
    weather: weatherHealth,
    riskAssessment: riskHealth,
    alertFeed: alertHealth,
  };

  // 2. Evaluate PHASE 3 (EVACUATION) Triggers
  // Trigger 3A: Official IMD EMERGENCY Warning (Independent of indicative risk)
  const hasEmergencyAlert = Boolean(
    alertFeed?.officialAlerts?.some((a) => a.severity === 'EMERGENCY')
  );
  if (hasEmergencyAlert) {
    return {
      phase: 'EVACUATION',
      phaseLabel: 'PHASE 3: EVACUATION',
      primaryTrigger: 'Official IMD EMERGENCY Warning bulletin active for sector',
      triggerSeverity: 'CRITICAL',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // Trigger 3B: Severe Precipitation Intensity (>= 35.0 mm/h)
  const rainIntensity = typeof weather?.precipitationMm === 'number' ? weather.precipitationMm : null;
  if (rainIntensity !== null && rainIntensity >= 35.0) {
    return {
      phase: 'EVACUATION',
      phaseLabel: 'PHASE 3: EVACUATION',
      primaryTrigger: `Severe Precipitation Intensity (${rainIntensity.toFixed(1)} mm/h >= 35.0 mm/h threshold)`,
      triggerSeverity: 'CRITICAL',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // Trigger 3C: Indicative Flood Risk Tier HIGH or CRITICAL
  const riskTier = riskAssessment?.overallRiskLevel;
  if (riskTier === 'CRITICAL' || riskTier === 'HIGH') {
    return {
      phase: 'EVACUATION',
      phaseLabel: 'PHASE 3: EVACUATION',
      primaryTrigger: `Indicative Flood Risk Tier ${riskTier} (Score: ${riskAssessment?.riskScore ?? 0}/100)`,
      triggerSeverity: 'CRITICAL',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // 3. Evaluate PHASE 2 (CRITICAL_ALERT) Triggers
  // Trigger 2A: Official IMD WARNING Bulletin (Independent of indicative risk)
  const hasWarningAlert = Boolean(
    alertFeed?.officialAlerts?.some((a) => a.severity === 'WARNING')
  );
  if (hasWarningAlert) {
    return {
      phase: 'CRITICAL_ALERT',
      phaseLabel: 'PHASE 2: CRITICAL ALERT',
      primaryTrigger: 'Official IMD WARNING Bulletin active for sector',
      triggerSeverity: 'HIGH',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // Trigger 2B: Heavy Precipitation Intensity (>= 10.0 mm/h and < 35.0 mm/h)
  if (rainIntensity !== null && rainIntensity >= 10.0) {
    return {
      phase: 'CRITICAL_ALERT',
      phaseLabel: 'PHASE 2: CRITICAL ALERT',
      primaryTrigger: `Heavy Precipitation Intensity (${rainIntensity.toFixed(1)} mm/h >= 10.0 mm/h threshold)`,
      triggerSeverity: 'HIGH',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // Trigger 2C: Indicative Flood Risk Tier ELEVATED (Score 45 - 64)
  // NOTE: 'GUARDED' (Score 25 - 44) is explicitly excluded from Phase 2
  if (riskTier === 'ELEVATED') {
    return {
      phase: 'CRITICAL_ALERT',
      phaseLabel: 'PHASE 2: CRITICAL ALERT',
      primaryTrigger: `Indicative Flood Risk Tier ELEVATED (Score: ${riskAssessment?.riskScore ?? 0}/100)`,
      triggerSeverity: 'ELEVATED',
      sourceHealth,
      hasSufficientData: true,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // 4. Insufficient-Data & Baseline Watch Evaluation
  // If no higher-severity conditions were triggered, we must verify if available
  // evidence is adequate to confirm a safe Phase 1: EARLY WATCH.
  const hasSufficientData =
    weatherHealth === 'FRESH' &&
    riskHealth === 'AVAILABLE' &&
    alertHealth === 'VERIFIED';

  if (!hasSufficientData) {
    const primaryMissing =
      missingDataReasons.length > 0
        ? missingDataReasons[0]
        : 'Inadequate operational evidence to confirm baseline safety';

    return {
      phase: 'INSUFFICIENT_DATA',
      phaseLabel: 'INSUFFICIENT DATA',
      primaryTrigger: primaryMissing,
      triggerSeverity: 'UNKNOWN',
      sourceHealth,
      hasSufficientData: false,
      missingDataReasons,
      isWeatherStale,
    };
  }

  // 5. PHASE 1: EARLY WATCH (Fresh, verified baseline)
  const isGuarded = riskTier === 'GUARDED';
  return {
    phase: 'EARLY_WATCH',
    phaseLabel: 'PHASE 1: EARLY WATCH',
    primaryTrigger: isGuarded
      ? `Guarded vigilance: Risk Tier GUARDED (${riskAssessment?.riskScore ?? 0}/100) below Phase 2 escalation threshold; meteorology and alerts clear`
      : 'Baseline vigilance: All meteorological observations, flood risk heuristics, and IMD feeds verified normal',
    triggerSeverity: 'LOW',
    sourceHealth,
    hasSufficientData: true,
    missingDataReasons: [],
    isWeatherStale: false,
  };
}
