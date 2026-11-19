import React, { useState, useMemo, useEffect } from 'react';
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
  RotateCcw,
  Waves,
  Wind,
  CloudRain,
  Shield,
} from 'lucide-react';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import { Luxury3DIcon } from '../components/common/Luxury3DIcon';
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

interface KitItem {
  id: string;
  title: string;
  description: string;
  category: 'water_food' | 'medical' | 'tools' | 'documents';
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    id: 'CHK-01',
    phase: 'EARLY_WATCH',
    title: 'Establish Incident Command Post (ICP)',
    description: 'Designate primary operations center with dual-redundant satellite uplink and backup generator verification.',
    assignedRole: 'District Disaster Officer',
    completed: false,
  },
  {
    id: 'CHK-02',
    phase: 'EARLY_WATCH',
    title: 'Inspect Low-Lying Stormwater Outfalls',
    description: 'Deploy inspection teams to clear debris from major drainage outfalls, flapper valves, and culverts.',
    assignedRole: 'Municipal Engineering Works',
    completed: false,
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
    title: 'Dispatch Amphibious Search & Rescue Assets',
    description: 'Mobilize SDRF / NDRF rubberized inflatable boats (RIBs) and swift-water technicians along designated evacuation corridors.',
    assignedRole: 'SDRF / NDRF Battalion',
    completed: false,
  },
];

const EMERGENCY_KIT_ITEMS: KitItem[] = [
  {
    id: 'KIT-01',
    title: 'Drinking Water (3-5 Litres per Person per Day)',
    description: 'Minimum 3-day supply in sealed, food-grade containers for drinking and basic sanitation.',
    category: 'water_food',
  },
  {
    id: 'KIT-02',
    title: 'Non-Perishable Food & High-Energy Rations',
    description: 'High-energy biscuits, canned beans/lentils, dry fruits, and ready-to-eat rations.',
    category: 'water_food',
  },
  {
    id: 'KIT-03',
    title: 'First-Aid Kit & Antiseptic Supplies',
    description: 'Antiseptic wipes, sterile bandages, burn cream, ORS packets, and emergency dressing.',
    category: 'medical',
  },
  {
    id: 'KIT-04',
    title: 'Essential Chronic & Prescription Medicines',
    description: '7-14 day supply of personal life-critical prescription medicines and inhalers.',
    category: 'medical',
  },
  {
    id: 'KIT-05',
    title: 'High-Intensity LED Flashlight & Spare Batteries',
    description: 'Water-resistant LED torch plus sealed alkaline batteries or solar power-bank.',
    category: 'tools',
  },
  {
    id: 'KIT-06',
    title: 'Charged Power Bank & Charging Cables',
    description: 'Minimum 20,000mAh portable battery pack charged to 100% and kept in airtight cover.',
    category: 'tools',
  },
  {
    id: 'KIT-07',
    title: 'Important Documents in Waterproof Pouch',
    description: 'Sealed ziplock containing Aadhaar, voter ID, property records, bank books, and emergency cash.',
    category: 'documents',
  },
  {
    id: 'KIT-08',
    title: 'Laminated Emergency Contact Directory',
    description: 'Hard-copy laminated phone directory of relatives, doctor, local SEOC, and NDRF hotlines.',
    category: 'documents',
  },
  {
    id: 'KIT-09',
    title: 'Loud Emergency Whistle / Signaling Device',
    description: 'High-frequency pea-less whistle for acoustic signalling to rescue boats in darkness.',
    category: 'tools',
  },
];

export const PreparednessPage: React.FC<PreparednessPageProps> = ({
  location,
  weather,
  riskAssessment,
  alertFeed,
}) => {
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jatayu_preparedness_sop_checklist');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_CHECKLIST;
  });

  const [activePhaseFilter, setActivePhaseFilter] = useState<ThreatPhase | 'ALL'>('ALL');
  const [selectedDisaster, setSelectedDisaster] = useState<'FLOOD' | 'CYCLONE' | 'RAIN'>('FLOOD');
  const [floodStage, setFloodStage] = useState<'BEFORE' | 'DURING' | 'AFTER'>('BEFORE');
  const [cycloneStage, setCycloneStage] = useState<'BEFORE' | 'DURING'>('BEFORE');

  const [packedKitIds, setPackedKitIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jatayu_gobag_packed_ids');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return [];
  });

  const [completedFloodTasks, setCompletedFloodTasks] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jatayu_flood_tasks');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jatayu_preparedness_sop_checklist', JSON.stringify(items));
    }
  }, [items]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jatayu_gobag_packed_ids', JSON.stringify(packedKitIds));
    }
  }, [packedKitIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jatayu_flood_tasks', JSON.stringify(completedFloodTasks));
    }
  }, [completedFloodTasks]);

  const toggleFloodTask = (taskId: string) => {
    setCompletedFloodTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const threatEvaluation = useMemo(() => {
    return evaluateThreatMatrix({
      weather,
      riskAssessment,
      alertFeed,
    });
  }, [weather, riskAssessment, alertFeed]);


  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const toggleKitItem = (id: string) => {
    setPackedKitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetKit = () => {
    setPackedKitIds([]);
  };

  const completedCount = items.filter((i) => i.completed).length;

  const filteredItems = useMemo(() => {
    if (activePhaseFilter === 'ALL' || activePhaseFilter === 'INSUFFICIENT_DATA') return items;
    return items.filter((i) => i.phase === activePhaseFilter);
  }, [items, activePhaseFilter]);

  const resolvedDistrict = alertFeed?.geographicResolution?.resolvedDistrict || location.name;

  const kitProgressPercent = Math.round((packedKitIds.length / EMERGENCY_KIT_ITEMS.length) * 100);
  const remainingKitCount = EMERGENCY_KIT_ITEMS.length - packedKitIds.length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Civil Defense Preparedness Protocols"
        subtitle={`Standard Operating Procedure (SOP) readiness matrix for ${location.name}`}
        badge={<Badge variant="emerald">SOP CHECKLIST: {completedCount}/{items.length} CONFIRMED</Badge>}
      />

      {/* Dynamic Operational Threat Phase Assessment Banner */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-jatayu-primary font-mono uppercase">
                Dynamic Operational Threat Assessment
              </h3>
              <p className="text-xs text-jatayu-secondary font-sans">
                Real-time SOP trigger analysis for <span className="font-semibold text-emerald-400">{resolvedDistrict}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-jatayu-muted uppercase">OPERATIONAL STATUS:</span>
            {threatEvaluation.phase === 'EVACUATION' && (
              <span className="px-3 py-1 rounded-full bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                PHASE 3: EVACUATION
              </span>
            )}
            {threatEvaluation.phase === 'CRITICAL_ALERT' && (
              <span className="px-3 py-1 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                PHASE 2: CRITICAL ALERT
              </span>
            )}
            {threatEvaluation.phase === 'EARLY_WATCH' && (
              <span className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,217,154,0.25)]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                PHASE 1: EARLY WATCH
              </span>
            )}
            {threatEvaluation.phase === 'INSUFFICIENT_DATA' && (
              <span className="px-3 py-1 rounded-full bg-charcoal border border-white/10 text-jatayu-secondary text-xs font-mono font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-jatayu-muted" />
                INSUFFICIENT DATA
              </span>
            )}
          </div>
        </div>

        {/* Primary Trigger / Evidence Basis Ribbon */}
        <div
          className={`p-3.5 rounded-xl border text-xs font-mono flex flex-wrap items-center justify-between gap-2 ${
            threatEvaluation.phase === 'EVACUATION'
              ? 'bg-red-950/40 border-red-500/40 text-red-200'
              : threatEvaluation.phase === 'CRITICAL_ALERT'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              : threatEvaluation.phase === 'INSUFFICIENT_DATA'
              ? 'bg-obsidian/70 border-white/10 text-jatayu-secondary'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong className="uppercase">Evaluation Basis:</strong> {threatEvaluation.primaryTrigger}
            </span>
          </div>
          {threatEvaluation.isWeatherStale && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40">
              <Clock className="w-3 h-3" />
              <span>WEATHER TELEMETRY STALE (&gt;90 MIN)</span>
            </div>
          )}
        </div>

        {/* Live Operational Triggers (4 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
          {/* Card 1: Live Precipitation */}
          <div className="p-3 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-[10px] text-jatayu-muted block uppercase">LIVE PRECIPITATION</span>
            {weather ? (
              <div>
                <span className="font-bold text-jatayu-primary text-sm">
                  {weather.precipitationMm.toFixed(1)} mm/h
                </span>
                <span
                  className={`block text-[9px] mt-0.5 ${
                    weather.isStale ? 'text-amber-400 font-bold' : 'text-emerald-400'
                  }`}
                >
                  {weather.isStale ? 'STALE (>90m OBS)' : 'OBSERVED (OPEN-METEO)'}
                </span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-red-400 text-sm">UNAVAILABLE</span>
                <span className="block text-[9px] text-jatayu-muted mt-0.5">TELEMETRY OFFLINE</span>
              </div>
            )}
          </div>

          {/* Card 2: Flood Risk Index */}
          <div className="p-3 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-[10px] text-jatayu-muted block uppercase">FLOOD RISK INDEX</span>
            {riskAssessment ? (
              <div>
                <span className="font-bold text-jatayu-primary text-sm">
                  {riskAssessment.riskScore}/100 [{riskAssessment.overallRiskLevel}]
                </span>
                <span className="block text-[9px] text-emerald-400 mt-0.5">INDICATIVE HEURISTIC</span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-slate-500 text-sm">UNAVAILABLE</span>
                <span className="block text-[9px] text-jatayu-muted mt-0.5">SCREENING PENDING</span>
              </div>
            )}
          </div>

          {/* Card 3: Official IMD Warnings */}
          <div className="p-3 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-[10px] text-jatayu-muted block uppercase">OFFICIAL IMD NOTICES</span>
            {alertFeed && alertFeed.feedStatus !== 'UPSTREAM_FALLBACK' ? (
              <div>
                <span className="font-bold text-jatayu-primary text-sm">
                  {alertFeed.itemCount} WARNINGS
                </span>
                <span className="block text-[9px] text-emerald-400 mt-0.5">IMD NOWCAST FEED</span>
              </div>
            ) : alertFeed && alertFeed.officialAlerts && alertFeed.officialAlerts.length > 0 ? (
              <div>
                <span className="font-bold text-amber-400 text-sm">
                  {alertFeed.officialAlerts.length} WARNINGS (CACHED)
                </span>
                <span className="block text-[9px] text-amber-300 mt-0.5">CACHED BULLETIN</span>
              </div>
            ) : (
              <div>
                <span className="font-bold text-red-400 text-sm">FEED UNAVAILABLE</span>
                <span className="block text-[9px] text-jatayu-muted mt-0.5">NOT VERIFIED / OFFLINE</span>
              </div>
            )}
          </div>

          {/* Card 4: Evidence Health */}
          <div className="p-3 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-[10px] text-jatayu-muted block uppercase">EVIDENTIARY STATUS</span>
            <span
              className={`font-bold text-sm block ${
                threatEvaluation.hasSufficientData ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              {threatEvaluation.hasSufficientData ? 'VERIFIED COMPLETE' : 'INADEQUATE EVIDENCE'}
            </span>
            <span className="block text-[9px] text-jatayu-muted mt-0.5 truncate" title={threatEvaluation.primaryTrigger}>
              {threatEvaluation.hasSufficientData ? 'ALL SOURCES FRESH' : 'STANDBY PROTOCOL'}
            </span>
          </div>
        </div>
      </div>

      {/* Auxiliary Civil Defense Information Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-dark-emerald/70 border border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(0,217,154,0.2)]">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-jatayu-secondary">COMMS STATUS</span>
            <div className="text-sm font-bold text-jatayu-primary font-mono">LOCAL STATUS NOT VERIFIED</div>
          </div>
        </div>

        <div className="bento-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(0,217,154,0.2)]">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-jatayu-secondary">SHELTER CAPACITY</span>
            <div className="text-sm font-bold text-jatayu-primary font-mono">LIVE CAPACITY UNAVAILABLE</div>
          </div>
        </div>

        <div className="bento-card p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase text-jatayu-secondary">RESCUE ASSETS</span>
            <div className="text-sm font-bold text-jatayu-primary font-mono">LOCAL STATUS NOT VERIFIED</div>
          </div>
        </div>
      </div>

      {/* Main Operational Action Checklist (SOPs) */}
      <div className="bento-card p-6">
        <div className="flex flex-wrap items-center justify-between pb-3.5 mb-4 border-b border-white/10 gap-3">
          <div className="flex items-center gap-2.5">
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-jatayu-primary">
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
                  className={`px-3 py-1 text-xs font-mono rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(0,217,154,0.2)] font-semibold'
                      : isRecommended
                      ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 font-medium'
                      : 'bg-obsidian/60 text-jatayu-secondary border-white/10 hover:border-white/20'
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
          <div className="mb-4 p-3.5 rounded-xl bg-obsidian/70 border border-white/10 text-xs text-jatayu-secondary font-sans flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-bold font-mono uppercase text-jatayu-primary">
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
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                  item.completed
                    ? 'bg-obsidian/40 border-white/5 text-jatayu-muted'
                    : isTargetPhase
                    ? 'bg-amber-950/30 border-amber-500/40 text-jatayu-primary shadow-subtle'
                    : 'bg-obsidian/70 border-white/10 text-jatayu-primary hover:border-emerald-500/40'
                }`}
              >
                <div className="mt-0.5 text-jatayu-primary">
                  {item.completed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className={`w-4 h-4 ${isTargetPhase ? 'text-amber-400' : 'text-slate-500'}`} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${item.completed ? 'line-through text-jatayu-muted' : 'text-jatayu-primary'}`}>
                        {item.title}
                      </span>
                      {isTargetPhase && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono text-[9px] font-bold">
                          ACTIVE PROTOCOL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-charcoal border border-white/10 rounded-full text-jatayu-secondary">
                        {item.assignedRole}
                      </span>
                      <span className="text-[10px] font-mono text-jatayu-muted">{item.id}</span>
                    </div>
                  </div>
                  <p className="text-xs text-jatayu-secondary leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CITIZEN EMERGENCY GO-BAG PREPAREDNESS KIT */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Luxury3DIcon type="supply-kit" size={44} />
            <div>
              <h3 className="text-sm font-bold text-jatayu-primary">
                Citizen Emergency "Go-Bag" Essential Kit
              </h3>
              <p className="text-xs text-jatayu-secondary">
                Essential 72-hour survival supplies recommended by NDMA & SDMA for household disaster readiness
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-400">
                {kitProgressPercent}% COMPLETE
              </span>
              <span className="block text-[10px] font-mono text-jatayu-muted">
                {remainingKitCount === 0 ? 'All 9 items packed' : `${remainingKitCount} remaining to pack`}
              </span>
            </div>
            <button
              onClick={resetKit}
              title="Reset checklist progress"
              className="p-1.5 text-xs text-jatayu-secondary hover:text-jatayu-primary hover:bg-white/5 rounded-xl border border-white/10 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-mono">Reset</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-obsidian h-2.5 rounded-full overflow-hidden border border-white/5 p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-mint shadow-[0_0_12px_rgba(0,217,154,0.4)]"
            style={{ width: `${kitProgressPercent}%` }}
          />
        </div>

        {/* Interactive Kit Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {EMERGENCY_KIT_ITEMS.map((kit) => {
            const isPacked = packedKitIds.includes(kit.id);
            return (
              <div
                key={kit.id}
                onClick={() => toggleKitItem(kit.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isPacked
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-primary shadow-[0_0_10px_rgba(0,217,154,0.1)]'
                    : 'bg-obsidian/70 border-white/10 text-jatayu-primary hover:border-white/20'
                }`}
              >
                <div className="mt-0.5">
                  {isPacked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        isPacked ? 'line-through text-emerald-300' : 'text-jatayu-primary'
                      }`}
                    >
                      {kit.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-jatayu-secondary leading-relaxed">{kit.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DISASTER-SPECIFIC PREPAREDNESS GUIDANCE (Flood, Cyclone, Extreme Rainfall) */}
      <div className="bento-card p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-jatayu-primary">
                Disaster Specific Preparedness Protocols
              </h3>
              <p className="text-xs text-jatayu-secondary">
                Actionable step-by-step guidance tailored to the event lifecycle
              </p>
            </div>
          </div>

          {/* Disaster Type Switcher */}
          <div className="flex items-center gap-1.5 bg-obsidian/70 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setSelectedDisaster('FLOOD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedDisaster === 'FLOOD'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(0,217,154,0.2)] font-bold'
                  : 'text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              <Waves className="w-3.5 h-3.5 text-emerald-400" />
              Flood
            </button>
            <button
              onClick={() => setSelectedDisaster('CYCLONE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedDisaster === 'CYCLONE'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              <Wind className="w-3.5 h-3.5 text-cyan-400" />
              Cyclone
            </button>
            <button
              onClick={() => setSelectedDisaster('RAIN')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedDisaster === 'RAIN'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                  : 'text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
              Extreme Rain
            </button>
          </div>
        </div>

        {/* FLOOD GUIDANCE */}
        {selectedDisaster === 'FLOOD' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-xs font-mono text-jatayu-muted uppercase">TIMELINE STAGE:</span>
              {(['BEFORE', 'DURING', 'AFTER'] as const).map((stage) => (
                <button
                  key={stage}
                  onClick={() => setFloodStage(stage)}
                  className={`px-3 py-1 text-xs font-mono rounded-xl border transition-all cursor-pointer ${
                    floodStage === stage
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-[0_0_10px_rgba(0,217,154,0.2)]'
                      : 'bg-obsidian/60 text-jatayu-secondary border-white/10 hover:border-white/20'
                  }`}
                >
                  {stage === 'BEFORE' ? '1. Before Flood' : stage === 'DURING' ? '2. During Flood' : '3. After Flood'}
                </button>
              ))}
            </div>

            {floodStage === 'BEFORE' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div
                  onClick={() => toggleFloodTask('FL-B1')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-B1')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-obsidian/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-B1') ? 'line-through text-emerald-300' : 'text-jatayu-primary'}`}>
                      1. Clear Drainage & Gullies
                    </span>
                    {completedFloodTasks.includes('FL-B1') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Inspect storm drains, rainwater downpipes, and drainage traps outside your residence. Clear dead foliage, plastic waste, and silt deposits to facilitate free gravity discharge.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-B2')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-B2')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-obsidian/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-B2') ? 'line-through text-emerald-300' : 'text-jatayu-primary'}`}>
                      2. Elevate Essential Utilities
                    </span>
                    {completedFloodTasks.includes('FL-B2') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Move essential electronic appliances, refrigerators, inverters, and heavy gas cylinders off ground floor slabs. Elevate switchboards and inverter batteries above high-water marks.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-B3')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-B3')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-obsidian/70 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-B3') ? 'line-through text-emerald-300' : 'text-jatayu-primary'}`}>
                      3. Identify High-Ground Shelters
                    </span>
                    {completedFloodTasks.includes('FL-B3') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Locate the nearest designated municipal relief shelter on the JATAYU Facilities map. Agree on a family rendezvous point outside vulnerable low-lying catchments.
                  </p>
                </div>
              </div>
            )}

            {floodStage === 'DURING' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div
                  onClick={() => toggleFloodTask('FL-D1')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-D1')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-red-950/30 border-red-500/30 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-D1') ? 'line-through text-emerald-300' : 'text-red-300'}`}>
                      1. Disconnect Electrical Mains
                    </span>
                    {completedFloodTasks.includes('FL-D1') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-red-200/90 leading-relaxed">
                    Switch off electrical mains at the master MCB and shut main LPG gas valves. Never touch electrical switches, fuses, or appliances while standing in puddle water.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-D2')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-D2')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-red-950/30 border-red-500/30 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-D2') ? 'line-through text-emerald-300' : 'text-red-300'}`}>
                      2. Avoid Driving or Walking in Flood
                    </span>
                    {completedFloodTasks.includes('FL-D2') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-red-200/90 leading-relaxed">
                    <strong>Turn Around, Don't Drown:</strong> 15 cm of fast-moving water can knock an adult down, and 30 cm can float most passenger cars. Beware of missing manhole covers.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-D3')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-D3')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-red-950/30 border-red-500/30 hover:border-red-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-D3') ? 'line-through text-emerald-300' : 'text-red-300'}`}>
                      3. Ascend to Higher Storeys
                    </span>
                    {completedFloodTasks.includes('FL-D3') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-red-200/90 leading-relaxed">
                    If trapped in a single-storey house, climb onto elevated countertops or roofs if structurally sound. Keep an emergency whistle and flashlight ready for rescue identification.
                  </p>
                </div>
              </div>
            )}

            {floodStage === 'AFTER' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div
                  onClick={() => toggleFloodTask('FL-A1')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-A1')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-A1') ? 'line-through text-emerald-300' : 'text-emerald-300'}`}>
                      1. Water & Food Sanitation
                    </span>
                    {completedFloodTasks.includes('FL-A1') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-emerald-200/90 leading-relaxed">
                    Boil municipal or borewell drinking water vigorously for at least 1 minute before consumption. Discard all perishable food items that came into direct contact with stagnant floodwaters.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-A2')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-A2')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-A2') ? 'line-through text-emerald-300' : 'text-emerald-300'}`}>
                      2. Reptile & Electric Hazard Checks
                    </span>
                    {completedFloodTasks.includes('FL-A2') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-emerald-200/90 leading-relaxed">
                    Floodwaters displace venomous snakes, rodents, and scorpions into living quarters. Check corners and dark shelves with a torch. Have a certified electrician inspect wiring before restoring power.
                  </p>
                </div>

                <div
                  onClick={() => toggleFloodTask('FL-A3')}
                  className={`p-4 rounded-xl border space-y-1.5 cursor-pointer transition-all select-none ${
                    completedFloodTasks.includes('FL-A3')
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-jatayu-secondary'
                      : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold font-mono block ${completedFloodTasks.includes('FL-A3') ? 'line-through text-emerald-300' : 'text-emerald-300'}`}>
                      3. Document Property Damage
                    </span>
                    {completedFloodTasks.includes('FL-A3') ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-emerald-200/90 leading-relaxed">
                    Photograph high-water level marks on walls, submerged vehicles, and structural cracks before clearing silt. Retain photos for state disaster relief compensation and insurance claims.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CYCLONE GUIDANCE */}
        {selectedDisaster === 'CYCLONE' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-xs font-mono text-jatayu-muted uppercase">TIMELINE STAGE:</span>
              {(['BEFORE', 'DURING'] as const).map((stage) => (
                <button
                  key={stage}
                  onClick={() => setCycloneStage(stage)}
                  className={`px-3 py-1 text-xs font-mono rounded-xl border transition-all cursor-pointer ${
                    cycloneStage === stage
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                      : 'bg-obsidian/60 text-jatayu-secondary border-white/10 hover:border-white/20'
                  }`}
                >
                  {stage === 'BEFORE' ? '1. Before Cyclone' : '2. During Cyclone'}
                </button>
              ))}
            </div>

            {cycloneStage === 'BEFORE' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-obsidian/70 border border-white/10 rounded-xl space-y-1.5">
                  <span className="font-bold text-jatayu-primary font-mono block">1. Trim Branches & Secure Fixtures</span>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Prune overhanging tree branches close to power lines and glass windows. Fasten outdoor sheet roofing, advertising boards, solar panels, and water tank covers with tie-down cables.
                  </p>
                </div>
                <div className="p-4 bg-obsidian/70 border border-white/10 rounded-xl space-y-1.5">
                  <span className="font-bold text-jatayu-primary font-mono block">2. Reinforce Glass Apertures</span>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Apply heavy-duty adhesive tape in criss-cross pattern over glass window panes to prevent flying splinter shards. Close storm shutters firmly on windward exposures.
                  </p>
                </div>
                <div className="p-4 bg-obsidian/70 border border-white/10 rounded-xl space-y-1.5">
                  <span className="font-bold text-jatayu-primary font-mono block">3. Charge Storage & Fill Tanks</span>
                  <p className="text-jatayu-secondary leading-relaxed">
                    Charge inverters, emergency lights, and mobile phones fully. Municipal pumping stations typically suspend water distribution during gale-force storms; fill overhead storage tanks in advance.
                  </p>
                </div>
              </div>
            )}

            {cycloneStage === 'DURING' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1.5">
                  <span className="font-bold text-amber-300 font-mono block">1. Remain in Interior Rooms</span>
                  <p className="text-amber-200/90 leading-relaxed">
                    Stay away from external windows, balconies, and unreinforced glass panels. Gather family members in an interior ground or first-floor corridor beneath structural lintels.
                  </p>
                </div>
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1.5">
                  <span className="font-bold text-amber-300 font-mono block">2. Beware the Eye of the Cyclone</span>
                  <p className="text-amber-200/90 leading-relaxed">
                    If winds drop suddenly and skies clear, the eye of the storm is passing over. <strong>Do NOT step outside</strong> — severe gale winds will resume from the opposite direction within minutes.
                  </p>
                </div>
                <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1.5">
                  <span className="font-bold text-amber-300 font-mono block">3. Unplug Electronics & Gas</span>
                  <p className="text-amber-200/90 leading-relaxed">
                    Keep appliances unplugged to safeguard against severe lightning-induced voltage surges. Shut off LPG cylinder valves. Rely strictly on battery-operated radios for IMD track updates.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXTREME RAINFALL GUIDANCE */}
        {selectedDisaster === 'RAIN' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-1.5">
              <span className="font-bold text-indigo-300 font-mono block">1. Basement & Vehicle Precautions</span>
              <p className="text-indigo-200/90 leading-relaxed">
                Relocate vehicles parked in underground basement ramps or low-lying curb alignments to elevated roads or designated flyover ramps before drainage networks surcharge.
              </p>
            </div>
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-1.5">
              <span className="font-bold text-indigo-300 font-mono block">2. Monitor Railway & Subway Sump Wells</span>
              <p className="text-indigo-200/90 leading-relaxed">
                Check whether stormwater de-watering pumps are operating on automatic float switches. Keep sandbags or water barriers stacked at basement garage entries.
              </p>
            </div>
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-1.5">
              <span className="font-bold text-indigo-300 font-mono block">3. Avoid Underpasses & Waterlogged Dips</span>
              <p className="text-indigo-200/90 leading-relaxed">
                Railway and highway underpasses accumulate catastrophic 2-3 meter water depths in minutes. Avoid known bottleneck underpasses identified in the JATAYU Risk & Safe Route layers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Contact Directory */}
      <div className="bento-card p-6">
        <div className="flex items-center gap-2 pb-2.5 mb-3.5 border-b border-white/10">
          <PhoneCall className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-jatayu-primary">
            Rapid Response Coordination Directory — {resolvedDistrict}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3.5 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-jatayu-muted block text-[11px]">EMERGENCY:</span>
            <span className="font-bold text-jatayu-primary text-sm">112</span>
          </div>
          <div className="p-3.5 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-jatayu-muted block text-[11px]">LOCAL CONTROL ({resolvedDistrict.toUpperCase()}):</span>
            <span className="font-bold text-jatayu-primary text-sm">SOURCE NOT CONFIGURED</span>
          </div>
          <div className="p-3.5 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-jatayu-muted block text-[11px]">RESPONSE ASSETS:</span>
            <span className="font-bold text-jatayu-primary text-sm">STATUS NOT VERIFIED</span>
          </div>
          <div className="p-3.5 bg-obsidian/60 border border-white/10 rounded-xl">
            <span className="text-jatayu-muted block text-[11px]">WEATHER BULLETINS:</span>
            <span className="font-bold text-jatayu-primary text-sm">CHECK IMD ALERTS</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreparednessPage;
