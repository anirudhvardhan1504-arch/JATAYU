import { DataSourceType, GeoLocation } from './weather.types.js';

export type RiskLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'CRITICAL';
export type DataCompleteness = 'FULL' | 'PARTIAL' | 'MINIMAL';
export type FactorStatus = 'MEASURED' | 'ESTIMATED' | 'UNAVAILABLE';

export interface FactorContribution {
  name: string;
  score: number; // 0 - 100
  weight: number; // e.g. 0.35
  weightedScore: number;
  observedValue: string | number | null;
  unit: string;
  benchmark: string; // Regional/authoritative reference (e.g. IMD Heavy Rain)
  basis: 'AUTHORITATIVE_METEOROLOGY' | 'ENGINEERING_ASSUMPTION';
  status: FactorStatus;
  notes: string;
}

export interface RiskExplanation {
  summary: string;
  primaryDrivers: string[];
  meteorologicalContext: string;
  missingInputs: string[];
  modelAssumptions: string[];
  limitations: string[];
}

export interface IndicativeFloodRiskAssessment {
  location: GeoLocation;
  assessedAt: string;
  dataTimestamp: string;
  isStale: boolean;
  overallRiskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  dataCompleteness: DataCompleteness;
  dataConfidence: 'HIGH' | 'MODERATE' | 'LOW';
  factors: {
    rainfallIntensity: FactorContribution;
    rainfallAccumulation: FactorContribution;
    soilSaturation: FactorContribution;
    topographicVulnerability: FactorContribution;
  };
  metrics: {
    peakIntensity1hMm: number;
    past24hRainfallMm: number | null;
    next24hRainfallMm: number;
    next72hRainfallMm: number;
    soilMoistureVolumetricPercent: number | null;
    elevationMeters: number | null;
  };
  explanation: RiskExplanation;
  disclaimer: {
    isHydraulicallyValidated: false;
    modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC';
    statement: string;
    validationStatus: 'UNVALIDATED_PROTOTYPE';
  };
  sourceType: DataSourceType;
  sourceAttribution: string;
}
