import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  PhoneCall,
  Radio,
  Truck,
  Building,
  FileCheck2,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Activity,
  AlertCircle,
  Clock,
  Info,
} from 'lucide-react';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import {
  CurrentWeatherObservation,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
  ThreatPhase,
} from '../types';
import { evaluateThreatMatrix } from '../utils/threatMatrix';

interface PreparednessPageProps {
  location: { name: string; lat: number; lon: number };
  weather?: CurrentWeatherObservation | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
}

interface ChecklistItem {
  id: string;
  phase: 'EARLY_WATCH' | 'CRITICAL_ALERT' | 'EVACUATION';
  title: string;
  description: string;
  assignedRole: string;
  completed: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'CHK-01',
    phase: 'EARLY_WATCH',
    title: 'Establish Incident Command Post (ICP)',
    description: 'Designate primary operations center with dual-redundant satellite uplink and backup generator verification.',
    assignedRole: 'District Disaster Officer',
    completed: true,
  },
  {
    id: 'CHK-02',
    phase: 'EARLY_WATCH',
    title: 'Inspect Low-Lying Stormwater Outfalls',
    description: 'Deploy inspection teams to clear debris from major drainage outfalls, flapper valves, and culverts.',
    assignedRole: 'Municipal Engineering Works',
    completed: true,
  },
  {
    id: 'CHK-03',
    phase: 'CRITICAL_ALERT',
    title: 'Pre-position Submersible Heavy De-watering Pumps',
    description: 'Stage 500-GPM mobile diesel pumps at identified vulnerable underpasses and subway ingress points.',
    assignedRole: 'Fire & Rescue Services',
    completed: false,
  },
  {
    id: 'CHK-04',
    phase: 'CRITICAL_ALERT',
    title: 'Issue Targeted Public Vulnerability Notifications',
    description: 'Broadcast SMS Cell-Broadcast alerts and local siren warnings to ground-floor residents in critical catchments.',
    assignedRole: 'Civil Defense Public Information',
    completed: false,
  },
  {
    id: 'CHK-05',
    phase: 'EVACUATION',
    title: 'Activate Designated High-Ground Relief Shelters',
    description: 'Unlock community storm shelters, inspect drinking water filtration units, and position medical emergency triage kits.',
    assignedRole: 'Revenue & Social Welfare Team',
    completed: false,
  },
  {
    id: 'CHK-06',
    phase: 'EVACUATION',
    title: 'Secure Essential Road Arteries & Transit Corridors',
    description: 'Deploy traffic police barricades on inundated low-lying roadways; signpost hazard-free elevated bypass routes.',
    assignedRole: 'Traffic Police & Transport Division',
    completed: false,
  },
];

export const PreparednessPage: React.FC<PreparednessPageProps> = ({
  location,
  weather,
  riskAssessment,
  alertFeed,
}) => {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [activePhaseFilter, setActivePhaseFilter] = useState<ThreatPhase | 'ALL'>('ALL');

  // Evaluate operational threat phase and evidentiary health using deterministic engine
  const threatEvaluation = useMemo(() => {
    return evaluateThreatMatrix({ weather, riskAssessment, alertFeed });
  }, [weather, riskAssessment, alertFeed]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const completedCount = items.filter((i) => i.completed).length;

  const filteredItems = useMemo(() => {
    if (activePhaseFilter === 'ALL' || activePhaseFilter === 'INSUFFICIENT_DATA') return items;
    return items.filter((i) => i.phase === activePhaseFilter);
  }, [items, activePhaseFilter]);

  const resolvedDistrict = alertFeed?.geographicResolution?.resolvedDistrict || location.name;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Civil Defense Preparedness Protocols"
        subtitle={`Standard Operating Procedure (SOP) readiness matrix for ${location.name}`}
        badge={<Badge variant="emerald">SOP READINESS: {completedCount}/{items.length} VERIFIED</Badge>}
      />

      {/* Dynamic Operational Threat Phase Assessment Banner */}
      <div className="bg-white border border-slate-200 rounded p-5 shadow-subtle space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-navy-900" />
            <div>
              <h3 className="text-sm font-bold text-navy-900 font-mono uppercase">
                Dynamic Operational Threat Assessment
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Real-time SOP trigger analysis for <span className="font-semibold text-slate-700">{resolvedDistrict}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 uppercase">OPERATIONAL STATUS:</span>
            {threatEvaluation.phase === 'EVACUATION' && (
              <span className="px-2.5 py-1 rounded bg-red-100 border border-red-300 text-red-800 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse">
                <Flame className="w-3.5 h-3.5 text-red-600" />
                PHASE 3: EVACUATION
              </span>
            )}
            {threatEvaluation.phase === 'CRITICAL_ALERT' && (
              <span className="px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs font-mono font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                PHASE 2: CRITICAL ALERT
              </span>
            )}
            {threatEvaluation.phase === 'EARLY_WATCH' && (
              <span className="px-2.5 py-1 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                PHASE 1: EARLY WATCH
              </span>
            )}
            {threatEvaluation.phase === 'INSUFFICIENT_DATA' && (
              <span className="px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-xs font-mono font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                INSUFFICIENT DATA
              </span>
            )}
          </div>
        </div>

        {/* Primary Trigger / Evidence Basis Ribbon */}
        <div
          className={`p-3 rounded border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
            threatEvaluation.phase === 'EVACUATION'
              ? 'bg-red-50 border-red-200 text-red-900'
              : threatEvaluation.phase === 'CRITICAL_ALERT'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : threatEvaluation.phase === 'INSUFFICIENT_DATA'
              ? 'bg-slate-50 border-slate-300 text-slate-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong className="uppercase">Evaluation Basis:</strong> {threatEvaluation.primaryTrigger}
            </span>
          </div>
          {threatEvaluation.isWeatherStale && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              <Clock className="w-3 h-3" />
              <span>WEATHER TELEMETRY STALE (&gt;90 MIN)</span>
            </div>
          )}
        </div>

        {/* Live Operational Triggers (4 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {/* Card 1: Live Precipitation */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[10px] text-slate-500 block uppercase">LIVE PRECIPITATION</span>
            {weather ? (
              <div>
                <span className="font-bold text-navy-900 text-sm">
                  {weather.precipitationMm.toFixed(1)} mm/h
                </span>
                <span
                  className={`block text-[9px] mt-0.5 ${
                    weather.isStale ? 'text-amber-700 font-bold' : 'text-slate-500'
                  }`}
                >
                  {weather.isStale ? 'STALE (>90m OBS)' : 'OBSERVED (OPEN-METEO)'}
                </span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-red-700 text-sm">UNAVAILABLE</span>
                <span className="block text-[9px] text-slate-400 mt-0.5">TELEMETRY OFFLINE</span>
              </div>
            )}
          </div>

          {/* Card 2: Flood Risk Index */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[10px] text-slate-500 block uppercase">FLOOD RISK INDEX</span>
            {riskAssessment ? (
              <div>
                <span className="font-bold text-navy-900 text-sm">
                  {riskAssessment.riskScore}/100 [{riskAssessment.overallRiskLevel}]
                </span>
                <span className="block text-[9px] text-slate-500 mt-0.5">INDICATIVE HEURISTIC</span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-slate-600 text-sm">UNAVAILABLE</span>
                <span className="block text-[9px] text-slate-400 mt-0.5">SCREENING PENDING</span>
              </div>
            )}
          </div>

          {/* Card 3: Official IMD Warnings */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[10px] text-slate-500 block uppercase">OFFICIAL IMD NOTICES</span>
            {alertFeed && alertFeed.feedStatus !== 'UPSTREAM_FALLBACK' ? (
              <div>
                <span className="font-bold text-navy-900 text-sm">
                  {alertFeed.itemCount} WARNINGS
                </span>
                <span className="block text-[9px] text-slate-500 mt-0.5">IMD NOWCAST FEED</span>
              </div>
            ) : alertFeed && alertFeed.officialAlerts && alertFeed.officialAlerts.length > 0 ? (
              <div>
                <span className="font-bold text-amber-800 text-sm">
                  {alertFeed.officialAlerts.length} WARNINGS (CACHED)
                </span>
                <span className="block text-[9px] text-amber-700 mt-0.5">CACHED BULLETIN</span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-red-700 text-sm">FEED UNAVAILABLE</span>
                <span className="block text-[9px] text-slate-400 mt-0.5">NOT VERIFIED / OFFLINE</span>
              </div>
            )}
          </div>

          {/* Card 4: Evidence Health */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
            <span className="text-[10px] text-slate-500 block uppercase">EVIDENTIARY STATUS</span>
            <span
              className={`font-bold text-sm block ${
                threatEvaluation.hasSufficientData ? 'text-emerald-700' : 'text-slate-700'
              }`}
            >
              {threatEvaluation.hasSufficientData ? 'VERIFIED COMPLETE' : 'INADEQUATE EVIDENCE'}
            </span>
            <span className="block text-[9px] text-slate-400 mt-0.5 truncate" title={threatEvaluation.primaryTrigger}>
              {threatEvaluation.hasSufficientData ? 'ALL SOURCES FRESH' : 'STANDBY PROTOCOL'}
            </span>
          </div>
        </div>
      </div>

      {/* Readiness Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-blue-700">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-500">COMMS STATUS</span>
            <div className="text-sm font-bold text-navy-900 font-mono">PRIMARY + HF BACKUP</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-500">SHELTER CAPACITY</span>
            <div className="text-sm font-bold text-navy-900 font-mono">14 NODES (STANDBY)</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-slate-500">RESCUE ASSETS</span>
            <div className="text-sm font-bold text-navy-900 font-mono">22 UNITS PRE-STAGED</div>
          </div>
        </div>
      </div>

      {/* Main Action Checklist */}
      <div className="bg-white border border-slate-200 rounded p-6 shadow-subtle">
        <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-slate-200 gap-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-navy-900">
              Operational Action Sequence Checklist
            </h3>
          </div>

          {/* Phase Filter Tabs */}
          <div className="flex items-center gap-1.5">
            {(['ALL', 'EARLY_WATCH', 'CRITICAL_ALERT', 'EVACUATION'] as const).map((ph) => {
              const isSelected = activePhaseFilter === ph;
              const isRecommended = (ph as string) === threatEvaluation.phase;
              return (
                <button
                  key={ph}
                  onClick={() => setActivePhaseFilter(ph)}
                  className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                    isSelected
                      ? 'bg-navy-900 text-white border-navy-900 font-semibold'
                      : isRecommended
                      ? 'bg-amber-50 text-amber-900 border-amber-300 font-medium'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {ph === 'ALL' ? 'ALL PHASES' : ph.replace('_', ' ')}
                  {ph !== 'ALL' && isRecommended && ' *'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Insufficient-Data Standby Advisory Banner */}
        {threatEvaluation.phase === 'INSUFFICIENT_DATA' && (
          <div className="mb-4 p-3 rounded bg-slate-50 border border-slate-300 text-xs text-slate-700 font-sans flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold font-mono uppercase text-slate-800">
                Operational Standby Notice (Insufficient Telemetry Evidence):
              </span>
              <p className="mt-0.5">
                Baseline Phase 1 safety cannot be confirmed because one or more telemetry sources are
                offline, unverified, or stale. Complete communications verification (Item CHK-01) and
                maintain active contact with local meteorological controls before demobilizing response units.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isTargetPhase = item.phase === threatEvaluation.phase;
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`p-3.5 rounded border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  item.completed
                    ? 'bg-slate-50 border-slate-200 text-slate-600'
                    : isTargetPhase
                    ? 'bg-amber-50/50 border-amber-400/80 text-navy-900 shadow-sm'
                    : 'bg-white border-slate-300 text-navy-900 hover:border-slate-400'
                }`}
              >
                <div className="mt-0.5 text-navy-900">
                  {item.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Square className={`w-4 h-4 ${isTargetPhase ? 'text-amber-600' : 'text-slate-400'}`} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${item.completed ? 'line-through text-slate-500' : 'text-navy-900'}`}>
                        {item.title}
                      </span>
                      {isTargetPhase && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-mono text-[9px] font-bold">
                          ACTIVE PROTOCOL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
                        {item.assignedRole}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{item.id}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emergency Contact Directory */}
      <div className="bg-white border border-slate-200 rounded p-5 shadow-subtle">
        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-200">
          <PhoneCall className="w-4 h-4 text-navy-900" />
          <h3 className="text-sm font-bold text-navy-900">
            Rapid Response Coordination Directory — {resolvedDistrict}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 bg-warm-200/60 border border-slate-200 rounded">
            <span className="text-slate-500 block text-[11px]">STATE EOC:</span>
            <span className="font-bold text-navy-900 text-sm">1070 / +91-22-22027990</span>
          </div>
          <div className="p-3 bg-warm-200/60 border border-slate-200 rounded">
            <span className="text-slate-500 block text-[11px]">DISTRICT CONTROL ({resolvedDistrict.toUpperCase()}):</span>
            <span className="font-bold text-navy-900 text-sm">1077 / EXT-402</span>
          </div>
          <div className="p-3 bg-warm-200/60 border border-slate-200 rounded">
            <span className="text-slate-500 block text-[11px]">NDRF BATTALION:</span>
            <span className="font-bold text-navy-900 text-sm">011-24363260</span>
          </div>
          <div className="p-3 bg-warm-200/60 border border-slate-200 rounded">
            <span className="text-slate-500 block text-[11px]">MET OBSERVATORY:</span>
            <span className="font-bold text-navy-900 text-sm">IMD REGIONAL DESK</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreparednessPage;
