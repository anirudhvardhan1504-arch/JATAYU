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

const RISK_TIER_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; description: string }> = {
  LOW: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    description: 'Baseline precipitation screening. Meteorological inputs indicate precipitation is within typical municipal absorption capacity.',
  },
  GUARDED: {
    text: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    description: 'Minor screening alert. Localized surface ponding possible in low-lying depressions or obstructed stormwater inlets.',
  },
  ELEVATED: {
    text: 'text-amber-800',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    description: 'Elevated screening indicator. Increased potential for urban waterlogging in low-lying corridors as soil infiltration headroom decreases.',
  },
  HIGH: {
    text: 'text-orange-800',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    description: 'High screening alert. Strong multi-factor precipitation signal indicating substantial surface runoff accumulation potential.',
  },
  CRITICAL: {
    text: 'text-red-800',
    bg: 'bg-red-50',
    border: 'border-red-300',
    description: 'Severe multi-factor screening threshold reached. Concurrently intense rainfall and saturated soil indicate extreme runoff accumulation potential.',
  },
};

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
        <div className="p-8 bg-white border border-slate-200 rounded text-center text-slate-500 font-mono text-xs">
          FETCHING SERVER-SIDE RISK ASSESSMENT FOR SECTOR...
        </div>
      </div>
    );
  }

  const tierInfo = RISK_TIER_COLORS[assessment.overallRiskLevel];
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
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
                STALE TELEMETRY (&gt;90m)
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border ${
                assessment.dataCompleteness === 'FULL'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              DATA: {assessment.dataCompleteness}
            </span>
          </div>
        }
        action={
          <div className="text-right font-mono text-[11px] text-slate-500">
            <div>DATA TIMESTAMP: <strong className="text-navy-900">{assessment.dataTimestamp}</strong></div>
            <div>ASSESSED: <strong className="text-slate-700">{new Date(assessment.assessedAt).toLocaleTimeString()}</strong></div>
          </div>
        }
      />

      {/* Mandatory Operational Disclaimer Box */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded shadow-subtle flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-700 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold uppercase tracking-wider font-mono text-[11px] mb-0.5 text-amber-800">
            MANDATORY OPERATIONAL DISCLAIMER
          </p>
          <p className="font-medium">{assessment.disclaimer.statement}</p>
          <p className="mt-1 text-[11px] text-amber-700 font-mono">
            Model: {assessment.disclaimer.modelType} | Status: {assessment.disclaimer.validationStatus} | Confidence: {assessment.dataConfidence}
          </p>
        </div>
      </div>

      {/* Missing Inputs Warning (if any) */}
      {assessment.explanation.missingInputs.length > 0 && (
        <div className="p-3.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-700 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold font-mono text-slate-800 uppercase text-[11px]">
              Missing Environmental Measurements Detected:
            </span>
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-[11px] text-slate-600">
              {assessment.explanation.missingInputs.map((input, idx) => (
                <li key={idx}>
                  <strong>{input}</strong>: Omitted from calculation; remaining active factor weights re-normalized proportionally.
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Composite Score & Primary Drivers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composite Score Card (1 col) */}
        <div className="bg-white border border-slate-200 rounded p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
                Composite Hazard Index
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded border uppercase ${tierInfo.bg} ${tierInfo.text} ${tierInfo.border}`}
              >
                {assessment.overallRiskLevel} TIER
              </span>
            </div>

            <div className="text-center py-5">
              <div className="text-5xl font-extrabold font-mono text-navy-900 tracking-tight">
                {assessment.riskScore}
                <span className="text-xl text-slate-400 font-normal"> / 100</span>
              </div>
              <p className="text-xs text-slate-600 font-sans mt-3 px-2 leading-relaxed">
                {tierInfo.description}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2 text-xs font-mono">
            <div className="flex justify-between text-slate-600">
              <span>Peak 1h Intensity:</span>
              <strong className="text-navy-900">{assessment.metrics.peakIntensity1hMm.toFixed(1)} mm/h</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Next 24h Projected Rain:</span>
              <strong className="text-navy-900">{assessment.metrics.next24hRainfallMm.toFixed(1)} mm</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Soil Moisture (0-7cm):</span>
              <strong className="text-navy-900">
                {assessment.metrics.soilMoistureVolumetricPercent !== null
                  ? `${(assessment.metrics.soilMoistureVolumetricPercent * 100).toFixed(1)}%`
                  : 'UNAVAILABLE'}
              </strong>
            </div>
          </div>
        </div>

        {/* Primary Drivers & Operational Context (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-6 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <h3 className="text-sm font-bold text-navy-900">
                  Primary Risk Drivers & Synthesis
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500 uppercase">
                CONFIDENCE: {assessment.dataConfidence}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium mb-3">
              {assessment.explanation.summary}
            </p>

            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-mono font-semibold uppercase text-slate-500">
                Identified Key Hazard Drivers:
              </div>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {assessment.explanation.primaryDrivers.map((driver, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="font-mono text-amber-600 font-bold">•</span>
                    <span>{driver}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-xs font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span>METEOROLOGY: </span>
              <strong className="text-slate-800">{assessment.explanation.meteorologicalContext}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Factor Contributions Table */}
      <div className="bg-white border border-slate-200 rounded p-6 shadow-subtle">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-navy-900" />
            <h3 className="text-sm font-bold text-navy-900">
              Transparent Multi-Factor Decomposition Matrix
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">WEIGHTED CONTRIBUTIONS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {factors.map((factor, idx) => (
            <div
              key={idx}
              className={`p-4 rounded border flex flex-col justify-between ${
                factor.status === 'UNAVAILABLE'
                  ? 'bg-slate-50 border-slate-200 opacity-75'
                  : 'bg-warm-100/60 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-xs font-bold text-navy-900 block">{factor.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Basis: {factor.basis.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-navy-900">
                      Score: {factor.score} / 100
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Weight: {(factor.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-2 rounded overflow-hidden my-2">
                  <div
                    className={`h-full rounded ${
                      factor.status === 'UNAVAILABLE'
                        ? 'bg-slate-400'
                        : factor.score >= 70
                        ? 'bg-red-600'
                        : factor.score >= 45
                        ? 'bg-amber-600'
                        : 'bg-blue-600'
                    }`}
                    style={{ width: `${factor.score}%` }}
                  ></div>
                </div>

                <div className="text-xs space-y-1 mt-2 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Observed Value:</span>
                    <strong className="font-mono text-slate-800">
                      {factor.observedValue !== null ? factor.observedValue : 'UNAVAILABLE'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Benchmark:</span>
                    <span className="font-mono text-[11px] text-slate-700">{factor.benchmark}</span>
                  </div>
                </div>
              </div>

              <p className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                {factor.notes}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Assumptions & Limitations Documentation Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-200 font-bold font-mono text-navy-900 text-[11px] uppercase">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            <span>Documented Model Assumptions</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 leading-relaxed">
            {assessment.explanation.modelAssumptions.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-blue-500 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle">
          <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-200 font-bold font-mono text-navy-900 text-[11px] uppercase">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Scientific & Practical Limitations</span>
          </div>
          <ul className="space-y-1.5 text-slate-600 leading-relaxed">
            {assessment.explanation.limitations.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-600 font-bold">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
