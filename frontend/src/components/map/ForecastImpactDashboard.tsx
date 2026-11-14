import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CloudRain,
  ShieldAlert,
  AlertTriangle,
  Building2,
  Wind,
  Compass,
  Info,
  ChevronRight,
  RefreshCw,
  Search,
  X,
  Radio,
  FileText,
  Zap,
  AlertCircle,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import {
  ForecastImpactResponse,
  getForecastImpact,
  IMD_RAINFALL_STYLES,
  SPATIAL_DENSITY_CONFIG,
  RAINFALL_PRIORITY_STYLES,
  WIND_SEVERITY_STYLES,
  TRAJECTORY_STYLES,
  CONTRIBUTING_DRIVERS_META,
  DATA_STATUS_STYLES,
  RainfallPriorityTier,
  WindSeverityCategory,
  First24hTrajectory,
  ContributingDriverKey,
  OverallDataStatus,
} from '../../services/forecast-impact';
import { ForecastGridMode, OperationalSectorKey } from '../../services/forecast';

export interface ForecastImpactDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  activeSectorKey?: OperationalSectorKey;
  onSelectSector?: (sector: OperationalSectorKey) => void;
  onSelectDistrict?: (district: string, state: string) => void;
  selectedDistrict?: string | null;
  onDataLoaded?: (data: ForecastImpactResponse) => void;
  className?: string;
}

const SECTOR_OPTIONS: { key: OperationalSectorKey; label: string; code: string }[] = [
  { key: 'chennai', label: 'Chennai Basin', code: 'CHE' },
  { key: 'mumbai', label: 'Mumbai Metro', code: 'MUM' },
  { key: 'kolkata', label: 'Kolkata Delta', code: 'CCU' },
  { key: 'dehradun', label: 'Dehradun Hills', code: 'DED' },
  { key: 'guwahati', label: 'Guwahati Valley', code: 'GHY' },
];

function formatUtcTimestamp(isoStr: string | null | undefined): string {
  if (!isoStr) return '--';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
  } catch {
    return isoStr;
  }
}

export const ForecastImpactDashboard: React.FC<ForecastImpactDashboardProps> = ({
  isOpen,
  onClose,
  activeSectorKey = 'chennai',
  onSelectSector,
  onSelectDistrict,
  selectedDistrict = null,
  onDataLoaded,
  className = '',
}) => {
  const [mode, setMode] = useState<ForecastGridMode>('sector');
  const [selectedSector, setSelectedSector] = useState<OperationalSectorKey>(activeSectorKey);
  const [impactData, setImpactData] = useState<ForecastImpactResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);

  // Sync selectedDistrict prop changes to expansion
  useEffect(() => {
    if (selectedDistrict) {
      setExpandedDistrictId(selectedDistrict.toUpperCase());
    }
  }, [selectedDistrict]);

  // Sync prop changes
  useEffect(() => {
    if (activeSectorKey) {
      setSelectedSector(activeSectorKey);
    }
  }, [activeSectorKey]);

  // Keep latest onDataLoaded callback in a ref to break the infinite re-render loop
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;
  useEffect(() => {
    onDataLoadedRef.current = onDataLoaded;
  }, [onDataLoaded]);

  // Fetch forecast impact intelligence
  const loadImpactData = useCallback(
    async (refresh: boolean = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getForecastImpact(mode, mode === 'sector' ? selectedSector : undefined, refresh);
        setImpactData(data);
        if (onDataLoadedRef.current) {
          onDataLoadedRef.current(data);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve forecast impact intelligence';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, selectedSector]
  );

  useEffect(() => {
    if (isOpen) {
      loadImpactData(false);
    }
  }, [isOpen, loadImpactData]);

  const handleSectorChange = (sec: OperationalSectorKey) => {
    setSelectedSector(sec);
    if (onSelectSector) {
      onSelectSector(sec);
    }
  };

  const handleModeChange = (newMode: ForecastGridMode) => {
    setMode(newMode);
  };

  const activeMode = impactData?.metadata?.mode ?? mode;
  const isNational = activeMode === 'national';
  const metadata = impactData?.metadata;
  const summary = impactData?.summary;
  const cleanModelName = (metadata?.model || '').replace(/\s*\([^)]*\)/, '').trim();

  // Mode-aware coverage counter: derives count strictly from API coverage status
  const coverageCount = useMemo(() => {
    if (!impactData?.districts) return summary?.districtsWithSufficientCoverage ?? 0;
    if (isNational) {
      return impactData.districts.filter((d) => d.coverage.status === 'SYNOPTIC_INDICATIVE').length;
    }
    return impactData.districts.filter((d) => d.coverage.status === 'SUFFICIENT_MESOSCALE').length;
  }, [impactData, summary, isNational]);

  // Priority Tier counts across active dataset
  const priorityTierCounts = useMemo(() => {
    const counts: Record<RainfallPriorityTier, number> = {
      TIER_1_CRITICAL: 0,
      TIER_2_ELEVATED: 0,
      TIER_3_WATCH: 0,
      TIER_4_ADVISORY: 0,
      TIER_5_ROUTINE: 0,
      UNAVAILABLE: 0,
    };
    if (!impactData?.districts) return counts;
    for (const d of impactData.districts) {
      const tier = d.decisionSupport?.rainfall?.priorityTier;
      if (tier && counts[tier] !== undefined) {
        counts[tier]++;
      } else {
        counts.UNAVAILABLE++;
      }
    }
    return counts;
  }, [impactData]);

  // Incomplete or unavailable meteorological data count
  const incompleteDataCount = useMemo(() => {
    if (!impactData?.districts) return 0;
    return impactData.districts.filter((d) => {
      const avail = d.decisionSupport?.availability?.overallStatus;
      if (avail) return avail !== 'COMPLETE';
      return !d.dataQuality.isComplete;
    }).length;
  }, [impactData]);

  // Filter districts by search query, Priority Tier, and IMD Category
  const filteredDistricts = useMemo(() => {
    if (!impactData?.districts) return [];
    return impactData.districts.filter((d) => {
      const distName = d.district || (d as any).districtName || '';
      const stateName = d.state || '';
      const matchesSearch =
        distName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stateName.toLowerCase().includes(searchQuery.toLowerCase());

      const priorityTier = d.decisionSupport?.rainfall?.priorityTier;
      const matchesPriority =
        selectedPriorityFilter === 'ALL' || priorityTier === selectedPriorityFilter;

      const matchesCat =
        selectedCategoryFilter === 'ALL' || d.classification?.imdRainfallCategory === selectedCategoryFilter;

      return matchesSearch && matchesPriority && matchesCat;
    });
  }, [impactData, searchQuery, selectedPriorityFilter, selectedCategoryFilter]);

  if (!isOpen) return null;

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[560px] md:w-[640px] lg:w-[720px] bg-navy-950/98 backdrop-blur-xl border-l border-navy-700/80 shadow-2xl flex flex-col font-mono text-slate-300 select-none animate-in slide-in-from-right duration-200 ${className}`}
      aria-label="Forecast Impact Intelligence Dashboard"
    >
      {/* 1. TOP OPERATIONAL DASHBOARD HEADER */}
      <div className="p-3 sm:p-4 border-b border-navy-800 bg-navy-900/90 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/40">
              <CloudRain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wider flex items-center gap-2">
                <span>FORECAST IMPACT INTELLIGENCE</span>
                <span
                  className="px-1.5 py-0.2 bg-teal-950 text-teal-300 text-[9px] rounded border border-teal-700 font-mono font-bold"
                  title="Forecast timeline spans 72 discrete steps (T+0..T+71). Prospective accumulations represent T+1..T+71; complete 72h future accumulation requires T+72."
                >
                  NWP 72H FORECAST WINDOW
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                District-level meteorological decision support & explainable multi-driver intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadImpactData(true)}
              disabled={isLoading}
              className="p-1.5 bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white rounded border border-navy-700 transition-colors cursor-pointer"
              title="Refresh Forecast Impact"
              aria-label="Refresh Forecast Impact"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white rounded border border-navy-700 transition-colors cursor-pointer"
              title="Close Forecast Impact Panel"
              aria-label="Close Forecast Impact Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode & Operational Sector Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-navy-800/80 text-[10px]">
          {/* Mode Segmented Switcher */}
          <div className="flex items-center gap-1 bg-navy-950 p-0.5 rounded border border-navy-800">
            <button
              onClick={() => handleModeChange('sector')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                mode === 'sector' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              MESOSCALE SECTOR
            </button>
            <button
              onClick={() => handleModeChange('national')}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                mode === 'national' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              NATIONAL SYNOPTIC
            </button>
          </div>

          {/* Sector Tabs (Visible in Sector Mode) */}
          {mode === 'sector' && (
            <div className="flex items-center gap-0.5 flex-wrap">
              {SECTOR_OPTIONS.map((sec) => (
                <button
                  key={sec.key}
                  onClick={() => handleSectorChange(sec.key)}
                  className={`px-1.5 py-0.5 rounded text-[9.5px] font-medium border transition-colors cursor-pointer ${
                    selectedSector === sec.key
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 font-bold'
                      : 'bg-navy-950 text-slate-400 border-navy-800 hover:text-white'
                  }`}
                  title={sec.label}
                >
                  <span className="hidden sm:inline">{sec.label}</span>
                  <span className="sm:hidden">{sec.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. ERROR OR LOADING BANNER */}
      {error && (
        <div className="p-3 bg-red-950/80 border-b border-red-700 text-red-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] font-mono leading-tight">
            <strong>Error:</strong> {error}
            <div className="mt-1">
              <button
                onClick={() => loadImpactData(true)}
                className="underline text-red-300 hover:text-white cursor-pointer"
              >
                Retry Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. SCROLLABLE DASHBOARD BODY */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 text-xs">
        {/* A. MODEL PROVENANCE & RESOLUTION METADATA CARD (Section G) */}
        {metadata && (
          <div className="p-3 bg-navy-900/80 border border-navy-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-navy-800">
              <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                <span>NWP MODEL ASSIMILATION & PROVENANCE</span>
              </div>
              <span className="px-1.5 py-0.2 bg-teal-950 text-teal-300 text-[9px] rounded border border-teal-800 font-bold">
                {metadata.runCycle && metadata.runCycle !== 'UNKNOWN' ? `${metadata.runCycle} CYCLE` : 'CYCLE UNAVAILABLE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500 block">FORECAST MODEL:</span>
                <strong className="text-slate-200 font-mono">{cleanModelName || metadata.model || 'Unavailable'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">UPSTREAM PROVIDER:</span>
                <strong className="text-slate-200 font-mono">{metadata.provider || 'Unavailable'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">NATIVE MODEL RESOLUTION:</span>
                <span className="text-slate-400 font-mono italic">Unavailable (unverified from upstream metadata)</span>
              </div>
              <div>
                <span className="text-slate-500 block">PROVIDER OUTPUT GRID:</span>
                <span className="text-teal-300 font-mono">{metadata.nativeResolution || 'Unavailable'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">JATAYU SAMPLING RESOLUTION:</span>
                <span className="text-cyan-300 font-mono">{metadata.gridSamplingResolution || 'Unavailable'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">RUN CYCLE / INITIALIZATION:</span>
                <span className="text-slate-300 font-mono">
                  {metadata.runCycle && metadata.runCycle !== 'UNKNOWN' ? `${metadata.runCycle} Cycle` : 'Cycle Unavailable'}
                  {metadata.initializationTime ? ` (Initialized: ${formatUtcTimestamp(metadata.initializationTime)})` : ' (Initialization Time Unavailable)'}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-navy-800 flex justify-between text-[9.5px]">
                <span className="text-slate-500">VALID FORECAST WINDOW:</span>
                <span className="text-slate-300 font-mono">
                  {metadata.validStartTime && metadata.validEndTime
                    ? `${formatUtcTimestamp(metadata.validStartTime)} → ${formatUtcTimestamp(metadata.validEndTime)}`
                    : 'Window Unavailable'}
                </span>
              </div>
            </div>

            {/* Failover / Stale Badges */}
            {metadata.isFallback && (
              <div className="p-1.5 bg-amber-950/70 border border-amber-600/70 rounded text-[9.5px] text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span>
                  <strong>FAILOVER ACTIVE:</strong> {metadata.fallbackReason || 'Primary ECMWF feed unavailable; operating on secondary NOAA GFS feed.'}
                </span>
              </div>
            )}

            {metadata.isStale && (
              <div className="p-1.5 bg-rose-950/70 border border-rose-600/70 rounded text-[9.5px] text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                <span>
                  <strong>STALE CACHE ACTIVE:</strong> {metadata.staleReason || 'Serving cached forecast data; upstream synchronization pending.'}
                </span>
              </div>
            )}

            {/* Scientific Transparency Notice */}
            <div className="pt-1.5 border-t border-navy-800 text-[9px] text-slate-400 leading-tight">
              <span className="font-bold text-slate-300">Operational Scope: </span>
              {metadata.scientificDisclaimer}
            </div>

            {/* Accumulation Horizon Semantics Notice */}
            <div className="pt-1 border-t border-navy-800/80 text-[8.5px] text-slate-400 leading-snug">
              <span className="font-bold text-teal-300">Accumulation Horizon Semantics: </span>
              NWP timeline covers 72 discrete hourly intervals (T+0 through T+71). Prospective accumulations represent future rainfall starting from T+1 (T+1..T+71). A complete 72-hour future accumulation requires T+72 and is strictly withheld.
            </div>
          </div>
        )}

        {/* B. NATIONAL COARSE-GRID MANDATORY DISCLOSURE (Section A) */}
        {isNational && (
          <div className="p-2.5 bg-indigo-950/40 border border-indigo-700/60 rounded-xl text-[9.5px] text-indigo-200 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 leading-snug">
              <span className="font-bold text-white uppercase tracking-wider block">
                NATIONAL SYNOPTIC COARSE-GRID (INDICATIVE ONLY; NON-MUNICIPAL)
              </span>
              <span>
                National synoptic macro-mesh (0.25° regular lat/lon; ~28 km nominal spacing) provides coarse synoptic prioritization across Indian districts. Intra-district microclimates, localized convective cells, and urban hydrodynamic drainage surcharge are unrepresented.
              </span>
            </div>
          </div>
        )}

        {/* C. KPI OVERVIEW TILES (Section A & B) */}
        {summary && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">EVALUATED</div>
                <div className="text-base font-bold text-white mt-0.5">{summary.districtsEvaluated}</div>
                <div className="text-[8.5px] text-slate-500">Districts in Domain</div>
              </div>

              <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
                <div className="text-[9px] text-slate-400 uppercase tracking-wider">
                  {isNational ? 'INDICATIVE COVERAGE' : 'SUFFICIENT MESOSCALE COVERAGE'}
                </div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {coverageCount}
                </div>
                <div className="text-[8.5px] text-slate-500 leading-tight mt-0.5">
                  {isNational
                    ? 'Synoptic Macro-Mesh (Indicative Only; Non-Municipal)'
                    : 'Mesoscale NWP Sampling (0.25° Grid; ~28 km nominal spacing)'}
                </div>
              </div>

              <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
                <div className="text-[9px] text-amber-400/90 uppercase tracking-wider">HEAVY OR ABOVE</div>
                <div className="text-base font-bold text-amber-400 mt-0.5">
                  {summary.districtsInHeavyOrAbove}
                </div>
                <div className="text-[8.5px] text-slate-500">24h ≥ 64.5 mm (IMD Heavy+)</div>
              </div>

              <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
                <div className="text-[9px] text-red-400/90 uppercase tracking-wider">SEVERE / EXTREME</div>
                <div className="text-base font-bold text-red-400 mt-0.5">
                  {summary.districtsInVeryHeavyOrAbove}
                </div>
                <div className="text-[8.5px] text-slate-500">
                  {incompleteDataCount > 0 ? `${incompleteDataCount} Incomplete Series` : '24h ≥ 115.5 mm'}
                </div>
              </div>
            </div>

            {/* Rainfall Priority Tier Distribution Strip */}
            <div className="p-2 bg-navy-900/70 border border-navy-800 rounded-lg space-y-1">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-between">
                <span>METEOROLOGICAL RAINFALL PRIORITY TIERS:</span>
                <span className="text-[8.5px] text-slate-500 font-normal">Deterministic Top-Down Decision Tree</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[9px] font-mono text-center">
                <div className="p-1 bg-rose-950/40 border border-rose-800/60 rounded">
                  <span className="text-rose-400 font-bold block">T1 Critical</span>
                  <strong className="text-white text-xs">{priorityTierCounts.TIER_1_CRITICAL}</strong>
                </div>
                <div className="p-1 bg-orange-950/40 border border-orange-800/60 rounded">
                  <span className="text-orange-400 font-bold block">T2 Elevated</span>
                  <strong className="text-white text-xs">{priorityTierCounts.TIER_2_ELEVATED}</strong>
                </div>
                <div className="p-1 bg-amber-950/40 border border-amber-800/60 rounded">
                  <span className="text-amber-400 font-bold block">T3 Watch</span>
                  <strong className="text-white text-xs">{priorityTierCounts.TIER_3_WATCH}</strong>
                </div>
                <div className="p-1 bg-sky-950/40 border border-sky-800/60 rounded">
                  <span className="text-sky-400 font-bold block">T4 Advisory</span>
                  <strong className="text-white text-xs">{priorityTierCounts.TIER_4_ADVISORY}</strong>
                </div>
                <div className="p-1 bg-slate-900 border border-slate-800 rounded">
                  <span className="text-slate-400 font-bold block">T5 Routine</span>
                  <strong className="text-white text-xs">{priorityTierCounts.TIER_5_ROUTINE}</strong>
                </div>
                <div className="p-1 bg-slate-950 border border-slate-800/60 rounded">
                  <span className="text-slate-500 font-bold block">Unavailable</span>
                  <strong className="text-slate-400 text-xs">{priorityTierCounts.UNAVAILABLE}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* D. SEARCH AND MULTI-FILTER BAR */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter by district or state name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-navy-900/90 border border-navy-800 text-white rounded-lg pl-8 pr-3 py-1.5 text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Reset Button if active filters */}
            {(selectedPriorityFilter !== 'ALL' || selectedCategoryFilter !== 'ALL' || searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedPriorityFilter('ALL');
                  setSelectedCategoryFilter('ALL');
                }}
                className="px-2 py-1 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded text-[9.5px] border border-navy-700 transition-colors cursor-pointer flex-shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Priority Tier Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap text-[9px]">
            <span className="text-[9px] text-slate-500 uppercase font-bold mr-0.5">Priority:</span>
            {[
              { id: 'ALL', label: 'All Tiers' },
              { id: 'TIER_1_CRITICAL', label: 'Tier 1 Critical' },
              { id: 'TIER_2_ELEVATED', label: 'Tier 2 Elevated' },
              { id: 'TIER_3_WATCH', label: 'Tier 3 Watch' },
              { id: 'TIER_4_ADVISORY', label: 'Tier 4 Advisory' },
              { id: 'TIER_5_ROUTINE', label: 'Tier 5 Routine' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPriorityFilter(p.id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                  selectedPriorityFilter === p.id
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                    : 'bg-navy-900 text-slate-400 border-navy-800 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* IMD 24h Category Filter Pills */}
          <div className="flex items-center gap-1 flex-wrap text-[9px]">
            <span className="text-[9px] text-slate-500 uppercase font-bold mr-0.5">IMD 24h:</span>
            {['ALL', 'EXTREMELY_HEAVY_RAIN', 'VERY_HEAVY_RAIN', 'HEAVY_RAIN', 'MODERATE_RAIN', 'LIGHT_RAIN'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                      : 'bg-navy-900 text-slate-400 border-navy-800 hover:text-white'
                  }`}
                >
                  {cat === 'ALL'
                    ? 'All IMD'
                    : cat.replace('_RAIN', '').replace('EXTREMELY_', 'Extreme ').replace('VERY_', 'V. ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* E. DISTRICT DECISION SUPPORT INTELLIGENCE LIST */}
        <div className="space-y-2">
          {isLoading && !impactData && (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
              <div className="text-xs font-mono">Synthesizing district-level meteorological decision support...</div>
            </div>
          )}

          {!isLoading && filteredDistricts.length === 0 && (
            <div className="p-6 bg-navy-900/40 border border-navy-800 rounded-xl text-center text-slate-400 space-y-1">
              <FileText className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">No districts match active filters</div>
              <p className="text-[10px] text-slate-500">
                Adjust search query, reset priority tier filters, or switch operational sector.
              </p>
            </div>
          )}

          {filteredDistricts.map((district) => {
            const isCardSelected = Boolean(
              selectedDistrict &&
                (selectedDistrict.toUpperCase() === district.district.toUpperCase() ||
                  selectedDistrict.toUpperCase().includes(district.district.toUpperCase()))
            );
            const isExpanded = expandedDistrictId === district.district || isCardSelected;
            const imdStyle = IMD_RAINFALL_STYLES[district.classification.imdRainfallCategory];
            const densityStyle = SPATIAL_DENSITY_CONFIG[district.coverage.spatialDensity];
            const isSingleNode = district.coverage.spatialDensity === 'SINGLE_NODE_LOCALIZED';
            const isCentroidFallback = district.coverage.spatialDensity === 'CENTROID_PROXIMITY_ONLY';
            const isUnrepresented = district.coverage.status === 'INSUFFICIENT_DATA';

            const ds = district.decisionSupport;
            const priorityTier: RainfallPriorityTier = ds?.rainfall?.priorityTier || 'TIER_5_ROUTINE';
            const priorityStyle = RAINFALL_PRIORITY_STYLES[priorityTier] || RAINFALL_PRIORITY_STYLES.TIER_5_ROUTINE;
            const windSeverity: WindSeverityCategory = ds?.wind?.severityCategory || 'ROUTINE';
            const windStyle = WIND_SEVERITY_STYLES[windSeverity] || WIND_SEVERITY_STYLES.ROUTINE;
            const availability = ds?.availability;
            const availStatus: OverallDataStatus = availability?.overallStatus || (district.dataQuality.isComplete ? 'COMPLETE' : 'PARTIAL');
            const availStyle = DATA_STATUS_STYLES[availStatus] || DATA_STATUS_STYLES.COMPLETE;
            const trajectory: First24hTrajectory = ds?.temporalMilestones?.first24hTrajectory || 'STABLE_LOW';
            const trajectoryStyle = TRAJECTORY_STYLES[trajectory] || TRAJECTORY_STYLES.STABLE_LOW;

            return (
              <div
                key={district.district}
                className={`border rounded-xl transition-all overflow-hidden ${
                  isCardSelected
                    ? 'bg-navy-900 border-amber-400 ring-2 ring-amber-400/60 shadow-lg'
                    : isExpanded
                    ? 'bg-navy-900/95 border-blue-500/60 shadow-lg'
                    : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
                }`}
              >
                {/* District Card Header Row */}
                <div
                  onClick={() => setExpandedDistrictId(isExpanded ? null : district.district)}
                  className="p-3 cursor-pointer flex items-start justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-white text-xs tracking-wide">
                        {district.district}
                      </h3>
                      {isCardSelected && (
                        <span className="text-[8.5px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/50 font-bold">
                          MAP ACTIVE
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({district.state})
                      </span>
                      {district.censusCode && (
                        <span className="text-[8.5px] px-1 py-0.2 bg-navy-950 text-slate-400 rounded border border-navy-800">
                          Census: {district.censusCode}
                        </span>
                      )}
                    </div>

                    {/* Decision Support Badges Row */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                      {/* Rainfall Priority Tier Badge */}
                      <span className={`px-1.5 py-0.2 rounded border font-bold ${priorityStyle.badge}`}>
                        {priorityStyle.shortLabel}
                      </span>

                      {/* Wind Severity Badge (Independent) */}
                      <span className={`px-1.5 py-0.2 rounded border font-medium ${windStyle.badge}`}>
                        {windStyle.label}
                      </span>

                      {/* Spatial Density Tag */}
                      <span className={`px-1.5 py-0.2 rounded border font-medium ${densityStyle.badge}`}>
                        {densityStyle.shortLabel} ({district.coverage.nodeCount} node{district.coverage.nodeCount === 1 ? '' : 's'})
                      </span>

                      {/* Overall Meteorological Data Status */}
                      <span
                        className={`px-1.5 py-0.2 rounded border text-[8.5px] ${availStyle.badge}`}
                        title={
                          availability?.missingVariables?.length
                            ? `Missing: ${availability.missingVariables
                                .map((v) =>
                                  v === 'pressureMslHpa'
                                    ? 'Mean Sea-Level Pressure (MSLP)'
                                    : v === 'windGustsKmh'
                                    ? '10m Wind Gusts'
                                    : v === 'precipitationMm'
                                    ? 'Precipitation Accumulation'
                                    : v
                                )
                                .join(', ')}`
                            : 'All NWP variables available'
                        }
                      >
                        {availStyle.label}
                      </span>

                      {/* Official IMD Bulletin Warning Pill (Separated Authority) */}
                      {district.classification.officialImdAlert && (
                        <span className="px-1.5 py-0.2 rounded border bg-orange-950 text-orange-300 border-orange-500 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-orange-400 flex-shrink-0" />
                          <span>IMD NOWCAST: {district.classification.officialImdAlert.severity}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 24h Rain Accumulation & Wind Gust Extrema */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[9.5px] text-slate-400">24h Rain:</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {district.metrics.futureAccum24hMm !== null ? `${district.metrics.futureAccum24hMm.toFixed(1)} mm` : '--'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                      <span>Gust:</span>
                      <span className="text-slate-200 font-bold">
                        {district.metrics.maxWindGustKmh !== null ? `${district.metrics.maxWindGustKmh.toFixed(1)} km/h` : '--'}
                      </span>
                    </div>

                    <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold ${imdStyle.badge}`}>
                      {imdStyle.label}
                    </span>
                  </div>
                </div>

                {/* Single Node Caution Banner */}
                {isSingleNode && (
                  <div className="px-3 py-1 bg-amber-950/30 border-y border-amber-800/40 text-[9px] text-amber-300/90 flex items-center gap-1.5 font-sans">
                    <Info className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span>
                      <strong>Localized Point Sampling:</strong> District estimate relies on a single interior NWP node. Intra-district microclimatic rainfall variability is unrepresented.
                    </span>
                  </div>
                )}

                {/* Centroid Proximity Banner */}
                {isCentroidFallback && (
                  <div className="px-3 py-1 bg-purple-950/30 border-y border-purple-800/40 text-[9px] text-purple-300/90 flex items-center gap-1.5 font-sans">
                    <Compass className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    <span>
                      <strong>Proximity Estimate:</strong> District contains 0 interior nodes; sampled from nearest NWP node located {district.coverage.meanDistanceKm} km from district centroid (bounded centroid fallback distance ≤ 25 km).
                    </span>
                  </div>
                )}

                {/* Insufficient Coverage Banner */}
                {isUnrepresented && (
                  <div className="px-3 py-1 bg-rose-950/40 border-y border-rose-800/50 text-[9px] text-rose-300 flex items-center gap-1.5 font-sans">
                    <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <span>
                      <strong>Insufficient Spatial Coverage:</strong> No NWP nodes located within defensible distance. Quantitative rainfall metrics are unavailable.
                    </span>
                  </div>
                )}

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="p-3 border-t border-navy-800/80 bg-navy-950/50 space-y-3">
                    {/* Overall Meteorological Data Status Notice if Partial or Unavailable */}
                    {availStatus !== 'COMPLETE' && (
                      <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded-lg text-[9px] text-amber-300 flex items-start gap-1.5 font-mono">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-200 uppercase tracking-wide block">
                            METEOROLOGICAL DATA AVAILABILITY: {availStyle.label}
                          </span>
                          {availability?.missingVariables && availability.missingVariables.length > 0 && (
                            <div className="text-[8.5px] text-amber-300/90 mt-0.5">
                              <strong>Missing Variables: </strong>
                              {availability.missingVariables
                                .map((v) =>
                                  v === 'pressureMslHpa'
                                    ? 'Mean Sea-Level Pressure (MSLP)'
                                    : v === 'windGustsKmh'
                                    ? '10m Wind Gusts'
                                    : v === 'precipitationMm'
                                    ? 'Precipitation Accumulation'
                                    : v
                                )
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SECTION C & D: RAINFALL INTELLIGENCE & INDEPENDENT WIND INTELLIGENCE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {/* RAINFALL INTELLIGENCE (Section C) */}
                      <div className="p-2.5 bg-navy-900/90 border border-navy-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-navy-800">
                          <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1">
                            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                            <span>RAINFALL INTELLIGENCE</span>
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] border ${priorityStyle.badge}`}>
                            {priorityStyle.label}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[9.5px]">
                          <div>
                            <span className="text-slate-400 block">Rainfall Priority Tier:</span>
                            <strong className="text-white font-mono">{priorityStyle.label}</strong>
                            <p className="text-[8.5px] text-slate-400 leading-tight mt-0.5">
                              {ds?.rainfall?.priorityDefinition || 'JATAYU Internal Decision-Support Heuristic'}: {priorityStyle.description}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-navy-800">
                            <div>
                              <span className="text-slate-400 block">24h Accumulation:</span>
                              <strong className="text-sky-300 text-xs font-mono">
                                {district.metrics.futureAccum24hMm !== null ? `${district.metrics.futureAccum24hMm.toFixed(1)} mm` : '--'}
                              </strong>
                              <span className="text-[8.5px] text-slate-400 block mt-0.5 leading-tight">
                                {district.classification.thresholdDefinition}
                              </span>
                            </div>

                            <div>
                              <span className="text-slate-400 block">Peak One-Hour Rainfall Rate:</span>
                              <strong className="text-white text-xs font-mono">
                                {district.metrics.peakHourlyRateMmH !== null ? `${district.metrics.peakHourlyRateMmH.toFixed(1)} mm/h` : '--'}
                              </strong>
                              <span className="text-[8.5px] text-teal-300 block mt-0.5">
                                {district.metrics.peakHourlyRateCategory} ({ds?.rainfall?.hourlyIntensityBenchmark || 'JATAYU Hourly Intensity Benchmark'})
                              </span>
                              {district.metrics.peakHourlyTimeUtc && (
                                <span className="text-[8px] text-slate-500 block">
                                  Valid: {formatUtcTimestamp(district.metrics.peakHourlyTimeUtc)} (Preceding-Hour Accumulation)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Explicit Scientific Distinction Safeguard */}
                          <div className="p-1 bg-navy-950 border border-navy-800/80 rounded text-[8px] text-slate-400 leading-tight">
                            <strong className="text-slate-300">Operational Safeguard: </strong>
                            Peak one-hour rainfall rate (mm/h) is derived from preceding-hour accumulation; 24h accumulation (mm) represents prospective cumulative volume across the forecast horizon.
                          </div>
                        </div>
                      </div>

                      {/* INDEPENDENT WIND INTELLIGENCE (Section D) */}
                      <div className="p-2.5 bg-navy-900/90 border border-navy-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-navy-800">
                          <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wide flex items-center gap-1">
                            <Wind className="w-3.5 h-3.5 text-teal-400" />
                            <span>INDEPENDENT WIND INTELLIGENCE</span>
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] border ${windStyle.badge}`}>
                            {windStyle.label}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-[9.5px]">
                          <div>
                            <span className="text-slate-400 block">Maximum 10m Wind Gust:</span>
                            <strong className="text-white text-xs font-mono">
                              {district.metrics.maxWindGustKmh !== null ? `${district.metrics.maxWindGustKmh.toFixed(1)} km/h` : '--'}
                            </strong>
                            <p className="text-[8.5px] text-slate-400 leading-tight mt-0.5">
                              {windStyle.description}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-navy-800">
                            <div>
                              <span className="text-slate-400 block">Peak Gust Time (UTC):</span>
                              <strong className="text-slate-200 font-mono text-[9px]">
                                {formatUtcTimestamp(ds?.wind?.peakGustTimeUtc || district.metrics.peakHourlyTimeUtc)}
                              </strong>
                              <span className="text-[8px] text-slate-500 block">Earliest timestamp on ties</span>
                            </div>

                            <div>
                              <span className="text-slate-400 block">Wind Scale Provenance:</span>
                              <span className="px-1 py-0.2 bg-navy-950 text-teal-300 text-[8.5px] rounded border border-navy-800 font-mono block">
                                {ds?.wind?.provenance || 'PROPOSED_HEURISTIC_WIND_SCALE'}
                              </span>
                            </div>
                          </div>

                          {/* Decoupled Safeguard */}
                          <div className="p-1 bg-navy-950 border border-navy-800/80 rounded text-[8px] text-slate-400 leading-tight">
                            <strong className="text-slate-300">Independence Principle: </strong>
                            Wind severity is computed independently from rainfall priority tier and never merged into an arbitrary composite score.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION E: FORECAST TRAJECTORY & TEMPORAL MILESTONES */}
                    <div className="p-2.5 bg-navy-900/80 border border-navy-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-navy-800 text-[10px]">
                        <span className="font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                          <span>FORECAST TRAJECTORY & TEMPORAL MILESTONES</span>
                        </span>
                        <span className={`px-2 py-0.2 rounded border text-[8.5px] font-bold ${trajectoryStyle.badge}`}>
                          {trajectoryStyle.label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[9.5px]">
                        <p className="text-[9px] text-slate-400">
                          <strong className="text-slate-300">{trajectoryStyle.label}: </strong>
                          {trajectoryStyle.description}
                        </p>

                        {/* Four 6-Hour Blocks (W1..W4) */}
                        <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                          <div className="p-1.5 bg-navy-950 border border-navy-800 rounded">
                            <span className="text-[8px] text-slate-400 block">W1 (T+1..6)</span>
                            <strong className="text-white text-[11px]">
                              {ds?.temporalMilestones?.w1Mm !== null && ds?.temporalMilestones?.w1Mm !== undefined ? `${ds.temporalMilestones.w1Mm} mm` : `${district.metrics.futureAccum6hMm ?? '--'} mm`}
                            </strong>
                          </div>
                          <div className="p-1.5 bg-navy-950 border border-navy-800 rounded">
                            <span className="text-[8px] text-slate-400 block">W2 (T+7..12)</span>
                            <strong className="text-white text-[11px]">
                              {ds?.temporalMilestones?.w2Mm !== null && ds?.temporalMilestones?.w2Mm !== undefined ? `${ds.temporalMilestones.w2Mm} mm` : '--'}
                            </strong>
                          </div>
                          <div className="p-1.5 bg-navy-950 border border-navy-800 rounded">
                            <span className="text-[8px] text-slate-400 block">W3 (T+13..18)</span>
                            <strong className="text-white text-[11px]">
                              {ds?.temporalMilestones?.w3Mm !== null && ds?.temporalMilestones?.w3Mm !== undefined ? `${ds.temporalMilestones.w3Mm} mm` : '--'}
                            </strong>
                          </div>
                          <div className="p-1.5 bg-navy-950 border border-navy-800 rounded">
                            <span className="text-[8px] text-slate-400 block">W4 (T+19..24)</span>
                            <strong className="text-white text-[11px]">
                              {ds?.temporalMilestones?.w4Mm !== null && ds?.temporalMilestones?.w4Mm !== undefined ? `${ds.temporalMilestones.w4Mm} mm` : '--'}
                            </strong>
                          </div>
                        </div>

                        {/* Temporal Milestones Data Points */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-navy-800 text-[9px]">
                          <div>
                            <span className="text-slate-500 block">ONSET HOUR:</span>
                            <strong className="text-slate-200 font-mono">
                              {ds?.temporalMilestones?.onsetHourUtc ? formatUtcTimestamp(ds.temporalMilestones.onsetHourUtc) : 'None detected'}
                            </strong>
                            <span className="text-[8px] text-slate-500 block">&ge; 2.5 mm/h threshold</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">PEAK RAIN HOUR:</span>
                            <strong className="text-slate-200 font-mono">
                              {ds?.temporalMilestones?.peakHourUtc ? formatUtcTimestamp(ds.temporalMilestones.peakHourUtc) : formatUtcTimestamp(district.metrics.peakHourlyTimeUtc)}
                            </strong>
                            <span className="text-[8px] text-slate-500 block">Peak 1h accumulation rate</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">CESSATION HOUR:</span>
                            <strong className="text-slate-200 font-mono">
                              {ds?.temporalMilestones?.cessationHourUtc ? formatUtcTimestamp(ds.temporalMilestones.cessationHourUtc) : 'Ongoing / Undetected'}
                            </strong>
                            <span className="text-[8px] text-slate-500 block">3h &lt; 2.5 mm/h post-peak</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">ELEVATED DURATION:</span>
                            <strong className="text-amber-300 font-mono">
                              {ds?.temporalMilestones?.elevatedHoursTotal ?? 0}h total ({ds?.temporalMilestones?.longestElevatedRunHours ?? 0}h max run)
                            </strong>
                            <span className="text-[8px] text-slate-500 block">Hours &ge; 5.0 mm/h</span>
                          </div>
                        </div>
                      </div>

                      {/* Extended Forecast Blocks W1..W12 (Section E) */}
                      {ds?.extendedBlocks && ds.extendedBlocks.length > 0 && (
                        <div className="pt-2 border-t border-navy-800 space-y-1">
                          <div className="flex items-center justify-between text-[9px] text-slate-400">
                            <span className="font-bold text-slate-300 uppercase">EXTENDED FORECAST BLOCKS (W1..W12; HORIZON T+1..T+71):</span>
                            <span className="text-[8.5px] text-teal-300 font-mono">Block 12 is strictly 5h (T+67..71)</span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1 text-[8px] font-mono text-center">
                            {ds.extendedBlocks.map((b) => (
                              <div
                                key={b.blockIndex}
                                className={`p-1 rounded border ${
                                  b.blockIndex === 12
                                    ? 'bg-teal-950/40 border-teal-700/60'
                                    : 'bg-navy-950 border-navy-800'
                                }`}
                                title={`Block ${b.blockIndex}: T+${b.startHour}..T+${b.endHour} (${b.durationHours}h) • Accum: ${b.accumMm !== null ? `${b.accumMm} mm` : '--'} • Mean: ${b.meanRateMmH !== null ? `${b.meanRateMmH} mm/h` : '--'}`}
                              >
                                <span className="text-slate-400 block font-bold">
                                  W{b.blockIndex} {b.blockIndex === 12 && '(5h)'}
                                </span>
                                <strong className="text-white block text-[9.5px]">
                                  {b.accumMm !== null ? `${b.accumMm}m` : '--'}
                                </strong>
                                <span className="text-slate-500 block text-[7.5px]">
                                  {b.meanRateMmH !== null ? `${b.meanRateMmH}m/h` : '--'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SECTION F: CONTRIBUTING DRIVERS (3-STATE EVALUATION) */}
                    <div className="p-2.5 bg-navy-900/80 border border-navy-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-navy-800 text-[10px]">
                        <span className="font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>CONTRIBUTING METEOROLOGICAL DRIVERS (3-STATE AUDIT)</span>
                        </span>
                        <span className="text-[8.5px] text-slate-400 font-mono">
                          Provenance: PROPOSED_HEURISTIC
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-[9px]">
                        {(ds?.contributingDrivers || [
                          { key: 'CONVECTIVE_BURST', status: 'NOT_TRIGGERED', provenance: 'PROPOSED_HEURISTIC' },
                          { key: 'PROLONGED_INTENSITY', status: 'NOT_TRIGGERED', provenance: 'PROPOSED_HEURISTIC' },
                          { key: 'GALE_GUST_COINCIDENCE', status: 'NOT_TRIGGERED', provenance: 'PROPOSED_HEURISTIC' },
                          { key: 'RAPID_BAROMETRIC_DROP', status: 'NOT_TRIGGERED', provenance: 'PROPOSED_HEURISTIC' },
                          { key: 'IMMINENT_ONSET', status: 'NOT_TRIGGERED', provenance: 'PROPOSED_HEURISTIC' },
                        ]).map((drv) => {
                          const meta = CONTRIBUTING_DRIVERS_META[drv.key as ContributingDriverKey];
                          const isTriggered = drv.status === 'TRIGGERED';
                          const isUnavailable = drv.status === 'UNAVAILABLE';

                          return (
                            <div
                              key={drv.key}
                              className={`p-2 rounded-lg border font-mono ${
                                isTriggered
                                  ? 'bg-amber-950/40 border-amber-600/70 text-amber-200'
                                  : isUnavailable
                                  ? 'bg-slate-950/50 border-slate-800 text-slate-400'
                                  : 'bg-navy-950 border-navy-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between pb-1 mb-1 border-b border-navy-800/80">
                                <span className="font-bold text-white text-[9.5px]">
                                  {meta?.title || drv.key}
                                </span>
                                <span
                                  className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                    isTriggered
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60'
                                      : isUnavailable
                                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                                  }`}
                                >
                                  {drv.status}
                                </span>
                              </div>

                              <p className="text-[8px] text-slate-400 leading-tight">
                                {meta?.criterion}
                              </p>

                              {isTriggered && drv.evidence && (
                                <div className="mt-1 pt-1 border-t border-amber-800/60 text-[8px] text-amber-300">
                                  <div>
                                    <strong>Observed: </strong>
                                    {drv.evidence.observedValue} {drv.evidence.units} (Threshold: {drv.evidence.threshold} {drv.evidence.units})
                                  </div>
                                  {drv.evidence.timestampUtc && (
                                    <div className="text-[7.5px] text-amber-400/80 mt-0.5">
                                      Timestamp: {formatUtcTimestamp(drv.evidence.timestampUtc)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {isUnavailable && drv.missingDataReason && (
                                <div className="mt-1 pt-1 border-t border-slate-800 text-[8px] text-slate-400 italic">
                                  {drv.missingDataReason}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* PROSPECTIVE ACCUMULATIONS TIMELINE GRID */}
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
                        <span>PROSPECTIVE FORECAST ACCUMULATIONS:</span>
                        <span className="text-[9px] text-slate-500 font-normal">Excludes T+0 analysis hour</span>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
                        <div className="p-1.5 bg-navy-900 border border-navy-800 rounded">
                          <span className="text-[9px] text-slate-400 block">6h (T+1..6)</span>
                          <strong className="text-white text-xs">
                            {district.metrics.futureAccum6hMm !== null ? `${district.metrics.futureAccum6hMm} mm` : '--'}
                          </strong>
                        </div>

                        <div className="p-1.5 bg-navy-900 border border-navy-800 rounded">
                          <span className="text-[9px] text-slate-400 block">12h (T+1..12)</span>
                          <strong className="text-white text-xs">
                            {district.metrics.futureAccum12hMm !== null ? `${district.metrics.futureAccum12hMm} mm` : '--'}
                          </strong>
                        </div>

                        <div className="p-1.5 bg-navy-900 border border-blue-500/40 rounded bg-blue-950/20">
                          <span className="text-[9px] text-blue-300 block font-bold">24h (T+1..24)</span>
                          <strong className="text-blue-300 text-xs">
                            {district.metrics.futureAccum24hMm !== null ? `${district.metrics.futureAccum24hMm} mm` : '--'}
                          </strong>
                        </div>

                        <div className="p-1.5 bg-navy-900 border border-navy-800 rounded">
                          <span className="text-[9px] text-slate-400 block">48h (T+1..48)</span>
                          <strong className="text-white text-xs">
                            {district.metrics.futureAccum48hMm !== null ? `${district.metrics.futureAccum48hMm} mm` : '--'}
                          </strong>
                        </div>

                        {/* 72h accumulation: strictly rendered as Unavailable when null */}
                        <div className="p-1.5 bg-navy-900 border border-navy-800 rounded opacity-80" title={district.metrics.accum72hQualityReason}>
                          <span className="text-[9px] text-slate-400 block">72h (T+1..72)</span>
                          <strong className="text-amber-400/90 text-[10px]">
                            {district.metrics.futureAccum72hMm !== null ? `${district.metrics.futureAccum72hMm} mm` : 'Unavailable*'}
                          </strong>
                        </div>
                      </div>

                      {district.metrics.accum72hQualityReason && (
                        <p className="text-[8.5px] text-slate-400 italic">
                          *{district.metrics.accum72hQualityReason}
                        </p>
                      )}
                    </div>

                    {/* OFFICIAL IMD BULLETIN WARNING (SEPARATE STATUTORY AUTHORITY) */}
                    <div className="p-2 bg-navy-900/90 border border-navy-800 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>OFFICIAL IMD NOWCAST BULLETIN (SEPARATE AUTHORITY):</span>
                        </span>
                        {district.classification.officialImdAlert ? (
                          <span className="text-orange-400 font-bold">
                            {district.classification.officialImdAlert.severity}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-normal">NO ACTIVE WARNING</span>
                        )}
                      </div>

                      {district.classification.officialImdAlert ? (
                        <div className="text-[9.5px] text-slate-300 font-sans leading-snug">
                          <strong>Headline: </strong>
                          {district.classification.officialImdAlert.headline}
                          <div className="text-[8.5px] text-slate-500 font-mono mt-0.5">
                            Issued: {district.classification.officialImdAlert.issuedAt}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[9px] text-slate-400 font-sans">
                          No active meteorological warning bulletin is currently published by IMD for {district.district}.
                        </p>
                      )}
                    </div>

                    {/* LOCAL INFRASTRUCTURE & HISTORICAL CHOKEPOINTS (STRICT SEPARATION) */}
                    <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wide flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span>REGISTERED DISTRICT INFRASTRUCTURE & VULNERABILITIES:</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                        <div>
                          <span className="text-slate-400">Verified Emergency Facilities:</span>
                          <strong className="text-white block font-mono">
                            {district.localExposure.verifiedEmergencyFacilitiesCount} Facilities Located
                          </strong>
                          <span className="text-[8.5px] text-slate-400">
                            {district.localExposure.facilityTypes.shelters} shelters, {district.localExposure.facilityTypes.hospitals} hospitals, {district.localExposure.facilityTypes.fireStations} fire
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400">Historical Flood Choke Points:</span>
                          {district.localExposure.chennaiHistoricalChokepointsCount !== undefined ? (
                            <strong className="text-amber-400 block font-mono">
                              {district.localExposure.chennaiHistoricalChokepointsCount} Adyar Basin Bottlenecks
                            </strong>
                          ) : (
                            <span className="text-slate-500 block italic">
                              None Registered in District
                            </span>
                          )}
                          <span className="text-[8.5px] text-slate-400">
                            {district.district === 'CHENNAI' ? 'Adyar corridor historical markers' : 'Registry localized to Chennai only'}
                          </span>
                        </div>
                      </div>

                      {/* Non-Inundation Disclaimer */}
                      <div className="text-[8px] text-slate-400 leading-tight pt-1 border-t border-navy-800">
                        {district.localExposure.exposureNotice}
                      </div>
                    </div>

                    {/* Action button to center/fly map to district */}
                    {onSelectDistrict && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => onSelectDistrict(district.district, district.state)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Center Map on {district.district}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SCIENTIFIC & LEGAL BOUNDARIES FOOTER */}
      <footer className="p-3 border-t border-navy-800 bg-navy-950/95 text-[8.5px] text-slate-400 leading-snug flex-shrink-0 space-y-1">
        <div className="flex items-start gap-1.5 text-slate-300">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.2" />
          <div>
            <strong className="text-amber-300">SCIENTIFIC BOUNDARY: </strong>
            Rainfall metrics reflect atmospheric precipitation from Numerical Weather Prediction models. Precipitation depth does NOT equal hydraulic flood depth or inundation.
          </div>
        </div>
        <div className="text-slate-400 pl-5">
          SFINCS 2D hydrodynamic simulation outputs remain strictly quarantined research models and are NOT operational inundation forecasts. Official disaster response must adhere to state disaster management authorities.
        </div>
      </footer>
    </aside>
  );
};
