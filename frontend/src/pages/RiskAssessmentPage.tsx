import React from 'react';
import {
  AlertCircle,
  ShieldAlert,
  Info,
  HelpCircle,
  Layers,
} from 'lucide-react';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import { IndicativeFloodRiskAssessment, RiskLevel } from '../types';

interface RiskAssessmentPageProps {
  location: { name: string; lat: number; lon: number };
  assessment: IndicativeFloodRiskAssessment | null;
}

export type StandardRiskClassification = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | 'UNKNOWN';

export function resolveStandardRisk(
  overallLevel: RiskLevel,
  dataCompleteness: string,
  riskScore: number
): {
  standardTier: StandardRiskClassification;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  guidance: string;
} {
  if (dataCompleteness === 'MINIMAL') {
    return {
      standardTier: 'UNKNOWN',
      label: 'UNKNOWN (DATA INCOMPLETE)',
      badgeBg: 'bg-charcoal/90',
      badgeText: 'text-jatayu-muted',
      badgeBorder: 'border-white/20',
      guidance: 'Insufficient environmental data coverage. An area is never assumed safe simply because telemetry is missing.',
    };
  }

  if (overallLevel === 'CRITICAL' || riskScore >= 80) {
    return {
      standardTier: 'SEVERE',
      label: 'SEVERE RISK',
      badgeBg: 'bg-red-950/70',
      badgeText: 'text-red-300',
      badgeBorder: 'border-red-500/50',
      guidance: 'Extreme multi-factor hazard signal. High probability of surface inundation and stormwater stagnation.',
    };
  }

  if (overallLevel === 'HIGH' || riskScore >= 60) {
    return {
      standardTier: 'HIGH',
      label: 'HIGH RISK',
      badgeBg: 'bg-orange-950/70',
      badgeText: 'text-orange-300',
      badgeBorder: 'border-orange-500/50',
      guidance: 'Substantial runoff accumulation potential. Drainage headroom compromised across depressed corridors.',
    };
  }

  if (overallLevel === 'GUARDED' || overallLevel === 'ELEVATED' || riskScore >= 30) {
    return {
      standardTier: 'MODERATE',
      label: 'MODERATE RISK',
      badgeBg: 'bg-amber-950/70',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/50',
      guidance: 'Localized ponding possible in low-lying depressions or obstructed stormwater inlets.',
    };
  }

  return {
    standardTier: 'LOW',
    label: 'LOW RISK',
    badgeBg: 'bg-emerald-950/70',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/50',
    guidance: 'Precipitation within baseline municipal absorption capacity under current observation window.',
  };
}

export const RiskAssessmentPage: React.FC<RiskAssessmentPageProps> = ({
  location,
  assessment,
}) => {
  if (!assessment) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title={`Indicative Flood Risk: ${location.name}`}
          subtitle="Deterministic multi-factor meteorological heuristic for emergency response triage"
          badge={<Badge sourceType="INDICATIVE_MODEL" size="md" />}
        />
        <div className="p-8 bento-card text-center text-jatayu-muted font-mono text-xs">
          FETCHING SERVER-SIDE RISK ASSESSMENT FOR SECTOR...
        </div>
      </div>
    );
  }

  const standardRisk = resolveStandardRisk(
    assessment.overallRiskLevel,
    assessment.dataCompleteness,
    assessment.riskScore
  );
  const factors = Object.values(assessment.factors);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Indicative Flood Risk: ${location.name}`}
        subtitle="Transparent rule-based assessment derived from live NWP precipitation and soil moisture"
        badge={
          <div className="flex items-center gap-2">
            <Badge sourceType="INDICATIVE_MODEL" size="md">
              INDICATIVE ASSESSMENT
            </Badge>
            {assessment.isStale && (
              <span className="px-2.5 py-1 text-xs font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40 rounded-lg">
                STALE TELEMETRY (&gt;90m)
              </span>
            )}
            <span
              className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border ${
                assessment.dataCompleteness === 'FULL'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              }`}
            >
              DATA: {assessment.dataCompleteness}
            </span>
          </div>
        }
        action={
          <div className="text-right font-mono text-xs text-jatayu-muted">
            <div>DATA TIMESTAMP: <strong className="text-jatayu-primary">{assessment.dataTimestamp}</strong></div>
            <div>ASSESSED: <strong className="text-jatayu-secondary">{new Date(assessment.assessedAt).toLocaleTimeString()}</strong></div>
          </div>
        }
      />

      {/* Mandatory Operational Disclaimer Box */}
      <div className="p-4 bg-amber-950/30 border border-amber-500/40 rounded-2xl shadow-subtle flex items-start gap-3 backdrop-blur-md">
        <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-200/90 leading-relaxed font-sans">
          <p className="font-bold uppercase tracking-wider text-[11px] mb-0.5 text-amber-300">
            MANDATORY OPERATIONAL DISCLAIMER
          </p>
          <p className="font-medium text-amber-100">{assessment.disclaimer.statement}</p>
          <p className="mt-1 text-[11px] text-amber-300/80 font-mono">
            Model: {assessment.disclaimer.modelType} | Status: {assessment.disclaimer.validationStatus} | Confidence: {assessment.dataConfidence}
          </p>
        </div>
      </div>

      {/* Missing Inputs Warning (if any) */}
      {assessment.explanation.missingInputs.length > 0 && (
        <div className="p-4 bg-surface-secondary border border-amber-500/30 rounded-2xl text-xs text-jatayu-secondary flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-jatayu-primary uppercase text-[11px]">
              Missing Environmental Measurements Detected:
            </span>
            <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-[11px] text-jatayu-muted">
              {assessment.explanation.missingInputs.map((input, idx) => (
                <li key={idx}>
                  <strong className="text-jatayu-secondary">{input}</strong>: Omitted from calculation; remaining active factor weights re-normalized proportionally.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Composite Score & Primary Drivers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composite Score Card (1 col) */}
        <div className="bento-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <span className="text-xs font-medium uppercase tracking-wider text-jatayu-secondary">
                Standard Risk Classification
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border uppercase ${standardRisk.badgeBg} ${standardRisk.badgeText} ${standardRisk.badgeBorder}`}
              >
                {standardRisk.label}
              </span>
            </div>

            <div className="text-center py-4">
              <div className="text-5xl font-extrabold font-mono text-jatayu-primary tracking-tight">
                {assessment.riskScore}
                <span className="text-xl text-jatayu-muted font-normal"> / 100</span>
              </div>
              <div className="text-[11px] font-medium text-jatayu-muted mt-1 uppercase tracking-wider">
                Heuristic Multi-Factor Index
              </div>
              <p className="text-xs text-jatayu-secondary font-sans mt-3 px-2 leading-relaxed">
                {standardRisk.guidance}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-jatayu-secondary">
              <span className="text-jatayu-muted">Peak 1h Intensity:</span>
              <strong className="text-jatayu-primary">{assessment.metrics.peakIntensity1hMm.toFixed(1)} mm/h</strong>
            </div>
            <div className="flex justify-between text-jatayu-secondary">
              <span className="text-jatayu-muted">Next 24h Projected Rain:</span>
              <strong className="text-jatayu-primary">{assessment.metrics.next24hRainfallMm.toFixed(1)} mm</strong>
            </div>
            <div className="flex justify-between text-jatayu-secondary">
              <span className="text-jatayu-muted">Soil Moisture (0-7cm):</span>
              <strong className="text-jatayu-primary">
                {assessment.metrics.soilMoistureVolumetricPercent !== null
                  ? `${(assessment.metrics.soilMoistureVolumetricPercent * 100).toFixed(1)}%`
                  : 'UNAVAILABLE'}
              </strong>
            </div>
          </div>
        </div>

        {/* Primary Drivers & Operational Context (2 cols) */}
        <div className="lg:col-span-2 bento-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-jatayu-primary">
                  Primary Risk Drivers & Synthesis
                </h3>
              </div>
              <span className="text-xs font-mono text-jatayu-muted uppercase">
                CONFIDENCE: {assessment.dataConfidence}
              </span>
            </div>

            <p className="text-xs text-jatayu-secondary leading-relaxed font-medium mb-3">
              {assessment.explanation.summary}
            </p>

            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-jatayu-muted">
                Identified Key Hazard Drivers:
              </div>
              <ul className="space-y-1.5 text-xs text-jatayu-secondary">
                {assessment.explanation.primaryDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-surface-secondary/70 p-2.5 rounded-xl border border-white/5">
                    <span className="font-mono text-amber-400 font-bold">•</span>
                    <span className="text-jatayu-primary">{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 text-xs font-mono text-jatayu-muted flex flex-wrap items-center justify-between gap-2">
            <div>
              <span>METEOROLOGY: </span>
              <strong className="text-jatayu-secondary">{assessment.explanation.meteorologicalContext}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Factor Contributions Table */}
      <div className="bento-card p-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-jatayu-primary">
              Transparent Multi-Factor Decomposition Matrix
            </h3>
          </div>
          <span className="text-xs font-mono text-jatayu-muted">WEIGHTED CONTRIBUTIONS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {factors.map((factor, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                factor.status === 'UNAVAILABLE'
                  ? 'bg-surface-secondary/50 border-white/5 opacity-75'
                  : 'bg-surface-secondary/80 border-white/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-bold text-jatayu-primary block">{factor.name}</span>
                    <span className="text-[10px] font-mono text-jatayu-muted uppercase">
                      Basis: {factor.basis.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-jatayu-accent">
                      Score: {factor.score} / 100
                    </span>
                    <span className="text-[10px] font-mono text-jatayu-muted block">
                      Weight: {(factor.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-charcoal/90 h-2.5 rounded-full overflow-hidden my-2 border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      factor.status === 'UNAVAILABLE'
                        ? 'bg-jatayu-disabled'
                        : factor.score >= 70
                        ? 'bg-gradient-to-r from-orange-500 to-red-500'
                        : factor.score >= 45
                        ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                        : 'bg-gradient-to-r from-emerald-500 to-mint'
                    }`}
                    style={{ width: `${factor.score}%` }}
                  ></div>
                </div>

                <div className="text-xs space-y-1 mt-2 text-jatayu-secondary">
                  <div className="flex justify-between">
                    <span className="text-jatayu-muted">Observed Value:</span>
                    <strong className="font-mono text-jatayu-primary">
                      {factor.observedValue !== null ? factor.observedValue : 'UNAVAILABLE'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-jatayu-muted">Benchmark:</span>
                    <span className="font-mono text-[11px] text-jatayu-secondary">{factor.benchmark}</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 pt-2 border-t border-white/10 text-[11px] text-jatayu-muted leading-relaxed">
                {factor.notes}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Assumptions & Limitations Documentation Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bento-card p-5">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10 font-bold text-jatayu-primary text-xs uppercase tracking-wider">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Documented Model Assumptions</span>
          </div>
          <ul className="space-y-1.5 text-jatayu-secondary leading-relaxed">
            {assessment.explanation.modelAssumptions.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bento-card p-5">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/10 font-bold text-jatayu-primary text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Scientific & Practical Limitations</span>
          </div>
          <ul className="space-y-1.5 text-jatayu-secondary leading-relaxed">
            {assessment.explanation.limitations.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
