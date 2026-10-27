import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { evaluateThreatMatrix } from '../utils/threatMatrix';
import { PreparednessPage } from '../pages/PreparednessPage';
import {
  CurrentWeatherObservation,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
  DisasterAlert,
} from '../types';

// ==============================================================================
// Mock Data Factories for Deterministic Testing
// ==============================================================================

function createMockWeather(overrides: Partial<CurrentWeatherObservation> = {}): CurrentWeatherObservation {
  return {
    location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
    timestamp: '2026-10-25T12:00:00Z',
    fetchedAt: '2026-10-25T12:02:00Z',
    temperatureC: 28.5,
    apparentTemperatureC: 32.0,
    relativeHumidityPercent: 80,
    precipitationMm: 0.0,
    rainMm: 0.0,
    showersMm: 0.0,
    windSpeedKmh: 15.0,
    windDirectionDegrees: 180,
    windGustsKmh: 20.0,
    surfacePressureHpa: 1010.0,
    weatherCode: 1,
    weatherDescription: 'Mainly clear',
    isStale: false,
    sourceType: 'OBSERVED',
    sourceAttribution: 'Open-Meteo NWP Analysis',
    units: {
      temperature: '°C',
      relativeHumidity: '%',
      precipitation: 'mm/h',
      rain: 'mm/h',
      showers: 'mm/h',
      windSpeed: 'km/h',
      windDirection: '°',
      windGusts: 'km/h',
      surfacePressure: 'hPa',
      soilMoisture: 'm³/m³',
    },
    ...overrides,
  };
}

function createMockRisk(overrides: Partial<IndicativeFloodRiskAssessment> = {}): IndicativeFloodRiskAssessment {
  return {
    location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
    assessedAt: '2026-10-25T12:02:00Z',
    dataTimestamp: '2026-10-25T12:00:00Z',
    isStale: false,
    overallRiskLevel: 'LOW',
    riskScore: 15,
    dataCompleteness: 'FULL',
    dataConfidence: 'HIGH',
    factors: {
      rainfallIntensity: {
        name: 'Rainfall Intensity',
        score: 0,
        weight: 0.35,
        weightedScore: 0,
        observedValue: 0,
        unit: 'mm/h',
        benchmark: 'IMD Rain Benchmark',
        basis: 'AUTHORITATIVE_METEOROLOGY',
        status: 'MEASURED',
        notes: 'Clear',
      },
      rainfallAccumulation: {
        name: '72h Accumulation',
        score: 10,
        weight: 0.2,
        weightedScore: 2,
        observedValue: 5,
        unit: 'mm',
        benchmark: 'IMD 72h Benchmark',
        basis: 'AUTHORITATIVE_METEOROLOGY',
        status: 'MEASURED',
        notes: 'Low',
      },
      soilSaturation: {
        name: 'Soil Saturation',
        score: 20,
        weight: 0.25,
        weightedScore: 5,
        observedValue: 0.2,
        unit: 'm³/m³',
        benchmark: 'Volumetric Benchmark',
        basis: 'ENGINEERING_ASSUMPTION',
        status: 'MEASURED',
        notes: 'Moderate',
      },
      topographicVulnerability: {
        name: 'Topography',
        score: 40,
        weight: 0.2,
        weightedScore: 8,
        observedValue: 14,
        unit: 'm',
        benchmark: 'AMSL Benchmark',
        basis: 'ENGINEERING_ASSUMPTION',
        status: 'MEASURED',
        notes: 'Coastal lowlands',
      },
    },
    metrics: {
      peakIntensity1hMm: 0,
      past24hRainfallMm: 0,
      next24hRainfallMm: 5,
      next72hRainfallMm: 10,
      soilMoistureVolumetricPercent: 20,
      elevationMeters: 14,
    },
    explanation: {
      summary: 'Baseline low risk under clear conditions.',
      primaryDrivers: [],
      meteorologicalContext: 'Clear skies',
      missingInputs: [],
      modelAssumptions: [],
      limitations: [],
    },
    disclaimer: {
      isHydraulicallyValidated: false,
      modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC',
      statement: 'Indicative screening prototype only.',
      validationStatus: 'UNVALIDATED_PROTOTYPE',
    },
    sourceType: 'INDICATIVE_MODEL',
    sourceAttribution: 'JATAYU Indicative Model',
    ...overrides,
  };
}

function createMockAlerts(
  officialAlerts: DisasterAlert[] = [],
  overrides: Partial<AlertFeedResponse> = {}
): AlertFeedResponse {
  return {
    fetchedAt: '2026-10-25T12:02:00Z',
    source: 'IMD RSS 2.0 Feed',
    feedStatus: 'LIVE_VERIFIED',
    itemCount: officialAlerts.length,
    geographicResolution: {
      coordinates: { latitude: 19.076, longitude: 72.8777 },
      resolvedDistrict: 'Mumbai Suburban',
      resolvedState: 'MAHARASHTRA',
      matchStatus: 'RESOLVED_DISTRICT',
      datasetSource: 'DataMeet India Maps',
      vintage: '2011 Census',
    },
    officialAlerts,
    nationwideAlerts: [],
    indicativeAlerts: [],
    demonstrationScenarios: [],
    disclaimer: 'Official bulletins issued by India Meteorological Department.',
    limitations: [],
    ...overrides,
  };
}

function createAlert(severity: 'ADVISORY' | 'WATCH' | 'WARNING' | 'EMERGENCY'): DisasterAlert {
  return {
    id: `ALT-${severity}-01`,
    category: 'RAINFALL',
    severity,
    headline: `IMD ${severity} Bulletin for Mumbai Suburban`,
    description: `Official meteorological warning issued with severity ${severity}.`,
    issuedAt: '2026-10-25T11:30:00Z',
    effectiveUntil: '2026-10-25T15:30:00Z',
    affectedArea: {
      name: 'Mumbai Suburban District',
      matchMethod: 'EXACT_DISTRICT',
    },
    recommendedActions: ['Monitor local updates.'],
    sourceType: 'OFFICIAL_FORECAST',
    sourceAgency: 'India Meteorological Department (IMD)',
    isOfficialWarning: true,
    status: 'ACTIVE',
  };
}

// ==============================================================================
// 14 Mission-Critical Decision-Table Scenarios
// ==============================================================================

describe('Phase 2G: Preparedness Threat Matrix Decision-Table & Boundary Audit', () => {
  // Scenario 1: GUARDED risk alone does not trigger Phase 2
  it('Scenario 1: GUARDED, low rainfall, no official warnings -> Phase 1: EARLY_WATCH', () => {
    const weather = createMockWeather({ precipitationMm: 2.5 });
    const risk = createMockRisk({ overallRiskLevel: 'GUARDED', riskScore: 32 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EARLY_WATCH');
    expect(result.phaseLabel).toBe('PHASE 1: EARLY WATCH');
    expect(result.primaryTrigger).toContain('Guarded vigilance');
    expect(result.hasSufficientData).toBe(true);
  });

  // Scenario 2: ELEVATED risk triggers Phase 2
  it('Scenario 2: ELEVATED, low rainfall, no warnings -> Phase 2: CRITICAL_ALERT', () => {
    const weather = createMockWeather({ precipitationMm: 1.0 });
    const risk = createMockRisk({ overallRiskLevel: 'ELEVATED', riskScore: 54 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('CRITICAL_ALERT');
    expect(result.phaseLabel).toBe('PHASE 2: CRITICAL ALERT');
    expect(result.primaryTrigger).toContain('Indicative Flood Risk Tier ELEVATED');
  });

  // Scenario 3: HIGH or CRITICAL risk triggers Phase 3
  it('Scenario 3A: HIGH risk -> Phase 3: EVACUATION', () => {
    const weather = createMockWeather({ precipitationMm: 5.0 });
    const risk = createMockRisk({ overallRiskLevel: 'HIGH', riskScore: 72 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
    expect(result.primaryTrigger).toContain('Indicative Flood Risk Tier HIGH');
  });

  it('Scenario 3B: CRITICAL risk -> Phase 3: EVACUATION', () => {
    const weather = createMockWeather({ precipitationMm: 5.0 });
    const risk = createMockRisk({ overallRiskLevel: 'CRITICAL', riskScore: 92 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
    expect(result.primaryTrigger).toContain('Indicative Flood Risk Tier CRITICAL');
  });

  // Scenario 4: Official WARNING with low indicative risk -> Phase 2
  it('Scenario 4: Official WARNING with low indicative risk -> Phase 2: CRITICAL_ALERT', () => {
    const weather = createMockWeather({ precipitationMm: 2.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 10 });
    const alerts = createMockAlerts([createAlert('WARNING')]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('CRITICAL_ALERT');
    expect(result.phaseLabel).toBe('PHASE 2: CRITICAL ALERT');
    expect(result.primaryTrigger).toContain('Official IMD WARNING Bulletin');
  });

  // Scenario 5: Official EMERGENCY with low indicative risk -> Phase 3
  it('Scenario 5: Official EMERGENCY with low indicative risk -> Phase 3: EVACUATION', () => {
    const weather = createMockWeather({ precipitationMm: 3.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 12 });
    const alerts = createMockAlerts([createAlert('EMERGENCY')]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
    expect(result.primaryTrigger).toContain('Official IMD EMERGENCY Warning');
  });

  // Scenario 6: Rainfall exactly 10.0 mm/h -> Phase 2 boundary
  it('Scenario 6: Rainfall exactly 10.0 mm/h -> Phase 2: CRITICAL_ALERT boundary', () => {
    const weather = createMockWeather({ precipitationMm: 10.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 18 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('CRITICAL_ALERT');
    expect(result.phaseLabel).toBe('PHASE 2: CRITICAL ALERT');
    expect(result.primaryTrigger).toContain('10.0 mm/h >= 10.0 mm/h threshold');
  });

  // Scenario 7: Rainfall exactly 35.0 mm/h -> Phase 3 boundary
  it('Scenario 7: Rainfall exactly 35.0 mm/h -> Phase 3: EVACUATION boundary', () => {
    const weather = createMockWeather({ precipitationMm: 35.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 20 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
    expect(result.primaryTrigger).toContain('35.0 mm/h >= 35.0 mm/h threshold');
  });

  // Scenario 8: Rainfall immediately below thresholds
  it('Scenario 8A: Rainfall 9.9 mm/h (below 10.0 mm/h) -> Phase 1: EARLY_WATCH', () => {
    const weather = createMockWeather({ precipitationMm: 9.9 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 15 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EARLY_WATCH');
    expect(result.phaseLabel).toBe('PHASE 1: EARLY WATCH');
  });

  it('Scenario 8B: Rainfall 34.9 mm/h (below 35.0 mm/h) -> Phase 2: CRITICAL_ALERT', () => {
    const weather = createMockWeather({ precipitationMm: 34.9 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 20 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('CRITICAL_ALERT');
    expect(result.phaseLabel).toBe('PHASE 2: CRITICAL ALERT');
    expect(result.primaryTrigger).toContain('34.9 mm/h >= 10.0 mm/h threshold');
  });

  // Scenario 9: Missing all three input sources -> INSUFFICIENT_DATA
  it('Scenario 9: Missing all three input sources -> INSUFFICIENT_DATA (not unqualified Phase 1)', () => {
    const result = evaluateThreatMatrix({ weather: null, riskAssessment: null, alertFeed: null });

    expect(result.phase).toBe('INSUFFICIENT_DATA');
    expect(result.phaseLabel).toBe('INSUFFICIENT DATA');
    expect(result.hasSufficientData).toBe(false);
    expect(result.missingDataReasons.length).toBeGreaterThanOrEqual(3);
  });

  // Scenario 10: Weather unavailable but valid official EMERGENCY warning available -> Phase 3
  it('Scenario 10: Weather unavailable but official EMERGENCY warning available -> Phase 3: EVACUATION', () => {
    const alerts = createMockAlerts([createAlert('EMERGENCY')]);

    const result = evaluateThreatMatrix({ weather: null, riskAssessment: null, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
    expect(result.primaryTrigger).toContain('Official IMD EMERGENCY Warning');
  });

  // Scenario 11: Alert feed unavailable -> does not represent absence of alerts as confirmed absence of warnings
  it('Scenario 11: Alert feed unavailable with low weather and low risk -> INSUFFICIENT_DATA', () => {
    const weather = createMockWeather({ precipitationMm: 0.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 10 });

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: null });

    expect(result.phase).toBe('INSUFFICIENT_DATA');
    expect(result.phaseLabel).toBe('INSUFFICIENT DATA');
    expect(result.hasSufficientData).toBe(false);
    expect(result.missingDataReasons).toContain('Official IMD Nowcast bulletin feed unreachable');
  });

  // Scenario 12: Stale weather data -> displays stale-data condition and yields INSUFFICIENT_DATA
  it('Scenario 12: Stale weather telemetry with low rainfall and no warnings -> INSUFFICIENT_DATA', () => {
    const weather = createMockWeather({ precipitationMm: 0.0, isStale: true });
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 15 });
    const alerts = createMockAlerts([]);

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('INSUFFICIENT_DATA');
    expect(result.isWeatherStale).toBe(true);
    expect(result.missingDataReasons).toContain('Meteorological telemetry latency exceeds 90 minutes');
  });

  // Scenario 13: Conflicting severity signals -> highest supported severity takes precedence
  it('Scenario 13: Conflicting signals (Rain 40 mm/h [P3], IMD Alert WARNING [P2], Risk LOW) -> Phase 3: EVACUATION', () => {
    const weather = createMockWeather({ precipitationMm: 40.0 }); // Triggers Phase 3
    const risk = createMockRisk({ overallRiskLevel: 'LOW', riskScore: 12 });
    const alerts = createMockAlerts([createAlert('WARNING')]); // Triggers Phase 2

    const result = evaluateThreatMatrix({ weather, riskAssessment: risk, alertFeed: alerts });

    expect(result.phase).toBe('EVACUATION');
    expect(result.phaseLabel).toBe('PHASE 3: EVACUATION');
  });

  // Scenario 14: Sector changes -> matrix reflects newly selected sector immediately
  it('Scenario 14: Sector changes dynamically re-evaluate the threat matrix', () => {
    // Sector A: High risk (Mumbai)
    const mumbaiWeather = createMockWeather({
      location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
      precipitationMm: 38.0,
    });
    const mumbaiResult = evaluateThreatMatrix({ weather: mumbaiWeather, riskAssessment: null, alertFeed: null });
    expect(mumbaiResult.phase).toBe('EVACUATION');

    // Sector B: Baseline risk (Delhi)
    const delhiWeather = createMockWeather({
      location: { latitude: 28.6139, longitude: 77.209, name: 'Delhi NCR' },
      precipitationMm: 1.0,
    });
    const delhiRisk = createMockRisk({
      location: { latitude: 28.6139, longitude: 77.209, name: 'Delhi NCR' },
      overallRiskLevel: 'LOW',
      riskScore: 10,
    });
    const delhiAlerts = createMockAlerts([], {
      geographicResolution: {
        coordinates: { latitude: 28.6139, longitude: 77.209 },
        resolvedDistrict: 'New Delhi',
        resolvedState: 'DELHI',
        matchStatus: 'RESOLVED_DISTRICT',
        datasetSource: 'DataMeet India Maps',
        vintage: '2011 Census',
      },
    });

    const delhiResult = evaluateThreatMatrix({
      weather: delhiWeather,
      riskAssessment: delhiRisk,
      alertFeed: delhiAlerts,
    });

    expect(delhiResult.phase).toBe('EARLY_WATCH');
    expect(delhiResult.phaseLabel).toBe('PHASE 1: EARLY WATCH');
  });
});

// ==============================================================================
// Component Integration Tests for PreparednessPage
// ==============================================================================

describe('Phase 2G: PreparednessPage Component Integration', () => {
  it('renders INSUFFICIENT DATA banner and operational trigger cards when alert feed is missing', () => {
    const weather = createMockWeather({ precipitationMm: 5.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW' });

    render(
      <PreparednessPage
        location={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
        weather={weather}
        riskAssessment={risk}
        alertFeed={null}
      />
    );

    // Header badge
    expect(screen.getByText('INSUFFICIENT DATA')).toBeInTheDocument();

    // Trigger card for IMD notices should display FEED UNAVAILABLE, not 0 WARNINGS
    expect(screen.getByText('FEED UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('NOT VERIFIED / OFFLINE')).toBeInTheDocument();

    // Standby notice present
    expect(screen.getByText(/Operational Standby Notice/i)).toBeInTheDocument();
  });

  it('renders PHASE 2: CRITICAL ALERT with active protocol highlighting when rain is 12 mm/h', () => {
    const weather = createMockWeather({ precipitationMm: 12.0 });
    const risk = createMockRisk({ overallRiskLevel: 'LOW' });
    const alerts = createMockAlerts([]);

    render(
      <PreparednessPage
        location={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
        weather={weather}
        riskAssessment={risk}
        alertFeed={alerts}
      />
    );

    expect(screen.getByText('PHASE 2: CRITICAL ALERT')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE PROTOCOL').length).toBeGreaterThan(0);
  });

  it('toggles checklist item completion state and updates SOP counter', () => {
    const weather = createMockWeather();
    const risk = createMockRisk();
    const alerts = createMockAlerts([]);

    render(
      <PreparednessPage
        location={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
        weather={weather}
        riskAssessment={risk}
        alertFeed={alerts}
      />
    );

    // Initial counter is 2/6 verified
    expect(screen.getByText(/SOP READINESS: 2\/6 VERIFIED/i)).toBeInTheDocument();

    // Click on an uncompleted item
    const item = screen.getByText('Pre-position Submersible Heavy De-watering Pumps');
    fireEvent.click(item);

    // Counter increments to 3/6 verified
    expect(screen.getByText(/SOP READINESS: 3\/6 VERIFIED/i)).toBeInTheDocument();
  });
});
