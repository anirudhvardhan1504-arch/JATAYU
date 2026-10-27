import { WeatherService } from './weather.service.js';
import {
  WeatherForecastResponse,
} from '../types/weather.types.js';
import {
  IndicativeFloodRiskAssessment,
  RiskLevel,
  DataCompleteness,
  RiskExplanation,
  FactorContribution,
} from '../types/risk.types.js';

export interface IRiskService {
  assessRisk(lat: number, lon: number, locationName?: string): Promise<IndicativeFloodRiskAssessment>;
}

/**
 * Deterministic scoring function for Short-Term Rainfall Intensity (1h mm/h).
 * Evaluates instantaneous convective intensity over current observation and next 6-hour forecast window.
 *
 * Benchmark references:
 * - 0 - 2.5 mm/h: Negligible / Trace rainfall
 * - 2.5 - 7.5 mm/h: Light rainfall
 * - 7.5 - 15.0 mm/h: Moderate rainfall (heuristic drainage capacity threshold)
 * - 15.0 - 35.0 mm/h: Heavy rainfall intensity (aligned with IMD intense rainfall guidance)
 * - 35.0 - 50.0 mm/h: Very Heavy convective rainfall
 * - >= 50.0 mm/h: Extreme convective downpour / localized cloudburst intensity
 */
export function scoreRainfallIntensity(peakMmH: number): number {
  if (typeof peakMmH !== 'number' || isNaN(peakMmH) || !isFinite(peakMmH) || peakMmH <= 0) {
    return 0;
  }
  if (peakMmH < 2.5) return Math.round((peakMmH / 2.5) * 15); // Negligible: 0-15
  if (peakMmH < 7.5) return Math.round(15 + ((peakMmH - 2.5) / 5.0) * 20); // Light: 15-35
  if (peakMmH < 15.0) return Math.round(35 + ((peakMmH - 7.5) / 7.5) * 20); // Moderate: 35-55
  if (peakMmH < 35.0) return Math.round(55 + ((peakMmH - 15.0) / 20.0) * 25); // Heavy: 55-80
  if (peakMmH < 50.0) return Math.round(80 + ((peakMmH - 35.0) / 15.0) * 15); // Very Heavy: 80-95
  return Math.min(100, Math.round(95 + ((peakMmH - 50.0) / 50.0) * 5)); // Extreme downpour: 95-100
}

/**
 * Deterministic scoring function for 48h Combined Rainfall Accumulation (past 24h observed NWP + next 24h forecast, mm).
 *
 * Benchmark references:
 * - Aligned with IMD 24h cumulative precipitation category thresholds adapted as a 48h volumetric accumulation indicator:
 *   - < 15.0 mm: Minor / Low cumulative volume
 *   - 15.0 - 64.4 mm: Moderate rainfall accumulation
 *   - 64.5 - 115.4 mm: Heavy rainfall benchmark (IMD 24h Heavy threshold: 64.5 mm)
 *   - 115.5 - 204.4 mm: Very Heavy rainfall benchmark (IMD 24h Very Heavy threshold: 115.5 mm)
 *   - >= 204.5 mm: Extremely Heavy rainfall benchmark (IMD 24h Extremely Heavy threshold: 204.5 mm)
 */
export function scoreRainfallAccumulation(accumMm: number): number {
  if (typeof accumMm !== 'number' || isNaN(accumMm) || !isFinite(accumMm) || accumMm <= 0) {
    return 0;
  }
  if (accumMm < 15.0) return Math.round((accumMm / 15.0) * 15); // Minor: 0-15
  if (accumMm < 64.5) return Math.round(15 + ((accumMm - 15.0) / 49.5) * 30); // Moderate: 15-45
  if (accumMm < 115.5) return Math.round(45 + ((accumMm - 64.5) / 51.0) * 25); // Heavy: 45-70
  if (accumMm < 204.5) return Math.round(70 + ((accumMm - 115.5) / 89.0) * 20); // Very Heavy: 70-90
  return Math.min(100, Math.round(90 + ((accumMm - 204.5) / 100.0) * 10)); // Extremely Heavy: 90-100
}

/**
 * Deterministic scoring function for Volumetric Soil Moisture (0-7cm m³/m³).
 * Note: Engineering heuristic assumption representing upper-root zone infiltration deficit proxy.
 * Not a validated laboratory pedological hydraulic conductivity assessment.
 *
 * Heuristic benchmarks:
 * - < 0.15 m³/m³: Dry soil profile, high baseline infiltration capacity
 * - 0.15 - 0.28 m³/m³: Moderate field moisture, standard absorption
 * - 0.28 - 0.38 m³/m³: High moisture, reduced infiltration absorption rate
 * - >= 0.38 m³/m³: Near/at field saturation proxy, elevated potential for surface runoff generation
 */
export function scoreSoilSaturation(volumetricFraction: number): number {
  if (
    typeof volumetricFraction !== 'number' ||
    isNaN(volumetricFraction) ||
    !isFinite(volumetricFraction) ||
    volumetricFraction <= 0
  ) {
    return 0;
  }
  if (volumetricFraction < 0.15) {
    return Math.max(0, Math.round((volumetricFraction / 0.15) * 20)); // Dry: 0-20
  }
  if (volumetricFraction < 0.28) {
    return Math.round(20 + ((volumetricFraction - 0.15) / 0.13) * 30); // Moderate: 20-50
  }
  if (volumetricFraction < 0.38) {
    return Math.round(50 + ((volumetricFraction - 0.28) / 0.10) * 30); // High saturation: 50-80
  }
  return Math.min(100, Math.round(80 + ((volumetricFraction - 0.38) / 0.12) * 20)); // Saturated: 80-100
}

/**
 * Deterministic scoring function for Topographic Elevation vulnerability proxy (meters Above Mean Sea Level).
 * Note: Engineering heuristic screening proxy. Lower-elevation coastal and basin deltaic zones have
 * flatter gravity drainage gradients, increasing susceptibility to stormwater stagnation.
 * This is NOT a hydraulic hydrodynamic model and does not account for micro-topographic LiDAR,
 * storm sewer conduits, or tidal surge.
 */
export function scoreTopographicVulnerability(elevationMeters: number | null): number {
  if (
    elevationMeters === null ||
    typeof elevationMeters !== 'number' ||
    isNaN(elevationMeters) ||
    !isFinite(elevationMeters)
  ) {
    return 40; // Neutral baseline assumption when elevation is unmeasured
  }
  if (elevationMeters <= 10) return 75; // Low coastal/deltaic basin
  if (elevationMeters <= 35) return 60; // Lowland floodplain
  if (elevationMeters <= 100) return 40; // Moderate elevation
  if (elevationMeters <= 300) return 25; // Elevated terrain
  return 15; // Highland / steep shedding terrain
}

export function determineRiskTier(score: number): RiskLevel {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 45) return 'ELEVATED';
  if (score >= 25) return 'GUARDED';
  return 'LOW';
}

export class RiskService implements IRiskService {
  private weatherService: WeatherService;

  constructor(weatherService?: WeatherService) {
    this.weatherService = weatherService || new WeatherService();
  }

  public async assessRisk(
    lat: number,
    lon: number,
    locationName: string = 'Operational Target'
  ): Promise<IndicativeFloodRiskAssessment> {
    const forecast = await this.weatherService.getForecast(lat, lon, locationName);
    return this.calculateAssessment(forecast);
  }

  public calculateAssessment(forecast: WeatherForecastResponse): IndicativeFloodRiskAssessment {
    const assessedAt = new Date().toISOString();
    const missingInputs: string[] = [];

    // 1. Peak short-term intensity: check current precipitation rate or max hourly rate in next 6h
    const currentPrecip = forecast.current.precipitationMm;
    let peakHourly6h = currentPrecip;
    if (forecast.hourly && forecast.hourly.length > 0) {
      const next6Hours = forecast.hourly.slice(0, 6);
      for (const h of next6Hours) {
        if (h.precipitationMm > peakHourly6h) {
          peakHourly6h = h.precipitationMm;
        }
      }
    }
    const intensityScore = scoreRainfallIntensity(peakHourly6h);

    // 2. Accumulation: past 24h + next 24h
    const past24h = forecast.accumulations.past24hRainfallMm;
    const next24h = forecast.accumulations.next24hRainfallMm;
    const next72h = forecast.accumulations.next72hRainfallMm;
    const combined48h = (past24h ?? 0) + next24h;
    const accumulationScore = scoreRainfallAccumulation(combined48h);

    // 3. Soil moisture: check if measured from upstream
    const measuredSoil =
      forecast.current.soilMoisture0To7cm ??
      forecast.soilProfile.moisture0To7cm;

    let soilScore = 0;
    let soilStatus: 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE' = 'MEASURED';
    let soilObservedValue: string | number | null = null;

    if (measuredSoil !== undefined && measuredSoil !== null && !isNaN(measuredSoil)) {
      soilScore = scoreSoilSaturation(measuredSoil);
      soilObservedValue = `${(measuredSoil * 100).toFixed(1)}% (${measuredSoil.toFixed(3)} m³/m³)`;
    } else {
      soilStatus = 'UNAVAILABLE';
      soilObservedValue = null;
      missingInputs.push('Root-zone volumetric soil moisture (0-7cm)');
    }

    // 4. Topographic elevation
    const rawElevation = forecast.elevation;
    const elevation =
      typeof rawElevation === 'number' && !isNaN(rawElevation) && isFinite(rawElevation)
        ? rawElevation
        : null;

    let topoScore = 0;
    let topoStatus: 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE' = 'MEASURED';
    let topoObservedValue: string | number | null = null;

    if (elevation !== null) {
      topoScore = scoreTopographicVulnerability(elevation);
      topoObservedValue = `${elevation} m MSL`;
      topoStatus = 'MEASURED';
    } else {
      topoStatus = 'UNAVAILABLE';
      topoObservedValue = null;
      missingInputs.push('Digital terrain elevation (m MSL)');
    }

    // Dynamic weight allocation (never silently substitutes zero for missing inputs)
    // Nominal weights: Intensity (0.35), Accumulation (0.30), Soil (0.20), Topography (0.15)
    const nominalWeights = {
      intensity: 0.35,
      accumulation: 0.30,
      soil: 0.20,
      topography: 0.15,
    };

    const activeWeightTotal =
      nominalWeights.intensity +
      nominalWeights.accumulation +
      (soilStatus !== 'UNAVAILABLE' ? nominalWeights.soil : 0) +
      (topoStatus !== 'UNAVAILABLE' ? nominalWeights.topography : 0);

    const normalizedWeights = {
      intensity: nominalWeights.intensity / activeWeightTotal,
      accumulation: nominalWeights.accumulation / activeWeightTotal,
      soil: soilStatus !== 'UNAVAILABLE' ? nominalWeights.soil / activeWeightTotal : 0,
      topography: topoStatus !== 'UNAVAILABLE' ? nominalWeights.topography / activeWeightTotal : 0,
    };

    const weightedIntensity = Math.round(intensityScore * normalizedWeights.intensity);
    const weightedAccum = Math.round(accumulationScore * normalizedWeights.accumulation);
    const weightedSoil = soilStatus !== 'UNAVAILABLE' ? Math.round(soilScore * normalizedWeights.soil) : 0;
    const weightedTopo = topoStatus !== 'UNAVAILABLE' ? Math.round(topoScore * normalizedWeights.topography) : 0;

    const compositeScore = Math.min(
      100,
      Math.max(0, weightedIntensity + weightedAccum + weightedSoil + weightedTopo)
    );

    const overallRiskLevel = determineRiskTier(compositeScore);

    // Data completeness & confidence determination
    let completeness: DataCompleteness = 'FULL';
    let confidence: 'HIGH' | 'MODERATE' | 'LOW' = 'HIGH';

    if (missingInputs.length === 1) {
      completeness = 'PARTIAL';
      confidence = 'MODERATE';
    } else if (missingInputs.length >= 2) {
      completeness = 'MINIMAL';
      confidence = 'LOW';
    }
    if (forecast.current.isStale) {
      confidence = 'LOW';
    }

    // Structure Factor Contributions
    const factors: {
      rainfallIntensity: FactorContribution;
      rainfallAccumulation: FactorContribution;
      soilSaturation: FactorContribution;
      topographicVulnerability: FactorContribution;
    } = {
      rainfallIntensity: {
        name: 'Short-Term Peak Rainfall Intensity',
        score: intensityScore,
        weight: Math.round(normalizedWeights.intensity * 100) / 100,
        weightedScore: weightedIntensity,
        observedValue: `${peakHourly6h.toFixed(1)} mm/h`,
        unit: 'mm/h',
        benchmark: 'IMD Heavy Rain > 15 mm/h | Very Heavy > 35 mm/h',
        basis: 'AUTHORITATIVE_METEOROLOGY' as const,
        status: 'MEASURED' as const,
        notes: `Peak hourly precipitation evaluated over current observation and next 6-hour forecast window.`,
      },
      rainfallAccumulation: {
        name: '48h Antecedent & Forecast Rainfall Accumulation',
        score: accumulationScore,
        weight: Math.round(normalizedWeights.accumulation * 100) / 100,
        weightedScore: weightedAccum,
        observedValue: `${combined48h.toFixed(1)} mm (Past 24h: ${past24h ?? 'N/A'} mm, Next 24h: ${next24h.toFixed(1)} mm)`,
        unit: 'mm',
        benchmark: 'IMD Daily Warning Thresholds (> 64.5 mm / > 115.5 mm)',
        basis: 'AUTHORITATIVE_METEOROLOGY' as const,
        status: 'MEASURED' as const,
        notes: `Combined 48-hour moisture volume (rolling 24h observed NWP analysis + next 24h numerical forecast).`,
      },
      soilSaturation: {
        name: 'Root-Zone Soil Saturation & Infiltration Deficit',
        score: soilScore,
        weight: Math.round(normalizedWeights.soil * 100) / 100,
        weightedScore: weightedSoil,
        observedValue: soilObservedValue,
        unit: 'm³/m³',
        benchmark: 'Field Capacity Saturated >= 0.38 m³/m³',
        basis: 'ENGINEERING_ASSUMPTION' as const,
        status: soilStatus,
        notes:
          soilStatus === 'UNAVAILABLE'
            ? 'Telemetry unavailable from provider. Factor omitted from scoring; remaining weights re-normalized.'
            : 'Volumetric soil moisture fraction at 0-7cm depth. Saturated soils generate rapid overland runoff.',
      },
      topographicVulnerability: {
        name: 'Topographic Basin Elevation Factor',
        score: topoScore,
        weight: Math.round(normalizedWeights.topography * 100) / 100,
        weightedScore: weightedTopo,
        observedValue: topoObservedValue,
        unit: 'meters',
        benchmark: 'Heuristic coastal/deltaic lowland reference (<= 35 m MSL)',
        basis: 'ENGINEERING_ASSUMPTION',
        status: topoStatus,
        notes:
          topoStatus === 'UNAVAILABLE'
            ? 'Elevation unmeasured in numerical forecast payload. Factor excluded; remaining weights re-normalized.'
            : `Regional grid elevation proxy (${elevation} m MSL). Lower elevations possess flatter gravitational drainage gradients.`,
      },
    };

    // Primary drivers identification (screening indicators, avoiding premature overflow claims)
    const drivers: string[] = [];
    if (intensityScore >= 55) {
      drivers.push(`Elevated short-term rainfall intensity (${peakHourly6h.toFixed(1)} mm/h) poses localized flash-ponding potential.`);
    }
    if (accumulationScore >= 50) {
      drivers.push(`Substantial 48h rainfall volume (${combined48h.toFixed(1)} mm) challenges local storm drainage absorption capacity.`);
    }
    if (soilStatus === 'MEASURED' && soilScore >= 60) {
      drivers.push(`Upper-layer soil moisture indicates reduced infiltration headroom, increasing potential surface runoff fraction.`);
    }
    if (elevation !== null && elevation <= 25) {
      drivers.push(`Low-lying terrain profile (${elevation} m MSL) suggests vulnerability to gravity drainage stagnation.`);
    }
    if (drivers.length === 0) {
      drivers.push('Rainfall intensity and cumulative totals are currently within baseline municipal drainage absorption capacity.');
    }

    const explanation: RiskExplanation = {
      summary: `Indicative rainfall hazard screening index calculated at ${compositeScore}/100 (${overallRiskLevel} Tier) for ${forecast.location.name}.`,
      primaryDrivers: drivers,
      meteorologicalContext: `Atmospheric analysis from Open-Meteo (${forecast.dataSource.model}). Current rain rate: ${currentPrecip} mm/h, 72h total anticipated: ${next72h.toFixed(1)} mm.`,
      missingInputs,
      modelAssumptions: [
        'Weights (Intensity: 35%, Accumulation: 30%, Soil: 20%, Topography: 15%) are engineering heuristic screening assumptions, not calibrated hydraulic probabilities.',
        'Soil moisture threshold of 0.38 m³/m³ is an empirical upper root-zone infiltration proxy, not a geotechnical or pedological field survey.',
        'Topographic elevation is taken from regional numerical terrain grids and does not reflect high-resolution LiDAR micro-topography or local storm sewer networks.',
      ],
      limitations: [
        'Indicative screening assessment only — not a validated hydraulic or hydrodynamic flood inundation model.',
        'Does not simulate culvert flow, storm pipe backflow, pumping stations, river bathymetry, or coastal tidal surges.',
        'Never replaces official emergency advisories or government warnings. Authoritative disaster directives must be obtained directly from authorized meteorological and disaster agencies (e.g. IMD / NDMA / CWC).',
      ],
    };

    return {
      location: forecast.location,
      assessedAt,
      dataTimestamp: forecast.current.timestamp,
      isStale: forecast.current.isStale,
      overallRiskLevel,
      riskScore: compositeScore,
      dataCompleteness: completeness,
      dataConfidence: confidence,
      factors,
      metrics: {
        peakIntensity1hMm: peakHourly6h,
        past24hRainfallMm: past24h,
        next24hRainfallMm: next24h,
        next72hRainfallMm: next72h,
        soilMoistureVolumetricPercent: measuredSoil ?? null,
        elevationMeters: elevation,
      },
      explanation,
      disclaimer: {
        isHydraulicallyValidated: false,
        modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC',
        statement:
          'Indicative assessment only — not a validated hydraulic flood model. Derived strictly from numerical precipitation estimates and empirical infiltration heuristics.',
        validationStatus: 'UNVALIDATED_PROTOTYPE',
      },
      sourceType: 'INDICATIVE_MODEL',
      sourceAttribution: 'JATAYU Indicative Hydro-Engine (Pre-Validation)',
    };
  }
}
