import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import {
  ForecastImpactResponse,
  getForecastImpact,
  IMD_RAINFALL_STYLES,
  SPATIAL_DENSITY_CONFIG,
} from '../../services/forecast-impact';
import { ForecastGridMode, OperationalSectorKey } from '../../services/forecast';

export interface ForecastImpactDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  activeSectorKey?: OperationalSectorKey;
  onSelectSector?: (sector: OperationalSectorKey) => void;
  onSelectDistrict?: (district: string, state: string) => void;
  className?: string;
}

const SECTOR_OPTIONS: { key: OperationalSectorKey; label: string; code: string }[] = [
  { key: 'chennai', label: 'Chennai Basin', code: 'CHE' },
  { key: 'mumbai', label: 'Mumbai Metro', code: 'MUM' },
  { key: 'kolkata', label: 'Kolkata Delta', code: 'CCU' },
  { key: 'dehradun', label: 'Dehradun Hills', code: 'DED' },
  { key: 'guwahati', label: 'Guwahati Valley', code: 'GHY' },
];

export const ForecastImpactDashboard: React.FC<ForecastImpactDashboardProps> = ({
  isOpen,
  onClose,
  activeSectorKey = 'chennai',
  onSelectSector,
  onSelectDistrict,
  className = '',
}) => {
  const [mode, setMode] = useState<ForecastGridMode>('sector');
  const [selectedSector, setSelectedSector] = useState<OperationalSectorKey>(activeSectorKey);
  const [impactData, setImpactData] = useState<ForecastImpactResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (activeSectorKey) {
      setSelectedSector(activeSectorKey);
    }
  }, [activeSectorKey]);

  // Fetch forecast impact intelligence
  const loadImpactData = useCallback(
    async (refresh: boolean = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getForecastImpact(mode, mode === 'sector' ? selectedSector : undefined, refresh);
        setImpactData(data);
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

  // Filter districts by query and IMD category
  const filteredDistricts = useMemo(() => {
    if (!impactData?.districts) return [];
    return impactData.districts.filter((d) => {
      const distName = d.district || (d as any).districtName || '';
      const stateName = d.state || '';
      const matchesSearch =
        distName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stateName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategoryFilter === 'ALL' || d.classification?.imdRainfallCategory === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [impactData, searchQuery, selectedCategoryFilter]);

  if (!isOpen) return null;

  const metadata = impactData?.metadata;
  const summary = impactData?.summary;

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 w-full sm:w-[540px] md:w-[600px] lg:w-[680px] bg-navy-950/98 backdrop-blur-xl border-l border-navy-700/80 shadow-2xl flex flex-col font-mono text-slate-300 select-none animate-in slide-in-from-right duration-200 ${className}`}
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
                <span className="px-1.5 py-0.2 bg-teal-950 text-teal-300 text-[9px] rounded border border-teal-700">
                  NWP 72H
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-sans">
                District-level precipitation accumulation & infrastructure co-location assessment
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
        {/* A. MODEL PROVENANCE & RESOLUTION METADATA CARD */}
        {metadata && (
          <div className="p-3 bg-navy-900/80 border border-navy-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-navy-800">
              <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                <Radio className="w-3.5 h-3.5 text-teal-400" />
                <span>NWP MODEL ASSIMILATION & PROVENANCE</span>
              </div>
              <span className="px-1.5 py-0.2 bg-teal-950 text-teal-300 text-[9px] rounded border border-teal-800 font-bold">
                {metadata.runCycle} CYCLE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-slate-500 block">MODEL / SOURCE:</span>
                <strong className="text-slate-200 font-mono">{metadata.model}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">UPSTREAM PROVIDER:</span>
                <strong className="text-slate-200 font-mono">{metadata.provider}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">NATIVE MODEL RESOLUTION:</span>
                <span className="text-teal-300 font-mono">{metadata.nativeResolution}</span>
              </div>
              <div>
                <span className="text-slate-500 block">GRID SAMPLING RESOLUTION:</span>
                <span className="text-cyan-300 font-mono">{metadata.gridSamplingResolution}</span>
              </div>
              <div>
                <span className="text-slate-500 block">INITIALIZATION TIME:</span>
                <span className="text-slate-300 font-mono">{metadata.initializationTime}</span>
              </div>
              <div>
                <span className="text-slate-500 block">VALID FORECAST WINDOW:</span>
                <span className="text-slate-300 font-mono">
                  {metadata.validStartTime} → {metadata.validEndTime}
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
          </div>
        )}

        {/* B. KPI SUMMARY TILES */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">EVALUATED</div>
              <div className="text-base font-bold text-white mt-0.5">{summary.districtsEvaluated}</div>
              <div className="text-[8.5px] text-slate-500">Districts in Domain</div>
            </div>

            <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider">SUFFICIENT COVERAGE</div>
              <div className="text-base font-bold text-emerald-400 mt-0.5">
                {summary.districtsWithSufficientCoverage}
              </div>
              <div className="text-[8.5px] text-slate-500">Defensible Spacing</div>
            </div>

            <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
              <div className="text-[9px] text-amber-400/90 uppercase tracking-wider">HEAVY OR ABOVE</div>
              <div className="text-base font-bold text-amber-400 mt-0.5">
                {summary.districtsInHeavyOrAbove}
              </div>
              <div className="text-[8.5px] text-slate-500">&ge; 64.5 mm (24h)</div>
            </div>

            <div className="p-2 bg-navy-900/60 border border-navy-800 rounded-lg">
              <div className="text-[9px] text-red-400/90 uppercase tracking-wider">SEVERE / EXTREME</div>
              <div className="text-base font-bold text-red-400 mt-0.5">
                {summary.districtsInVeryHeavyOrAbove}
              </div>
              <div className="text-[8.5px] text-slate-500">&ge; 115.5 mm (24h)</div>
            </div>
          </div>
        )}

        {/* C. SEARCH AND CATEGORY FILTER BAR */}
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

          <div className="flex items-center gap-1.5 flex-shrink-0 overflow-x-auto pb-0.5">
            <span className="text-[9px] text-slate-500 uppercase">IMD:</span>
            {['ALL', 'EXTREMELY_HEAVY_RAIN', 'VERY_HEAVY_RAIN', 'HEAVY_RAIN', 'MODERATE_RAIN', 'LIGHT_RAIN'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategoryFilter === cat
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-navy-900 text-slate-400 border-navy-800 hover:text-white'
                  }`}
                >
                  {cat === 'ALL'
                    ? 'ALL'
                    : cat.replace('_RAIN', '').replace('EXTREMELY_', 'EXTREME ').replace('VERY_', 'V. ')}
                </button>
              )
            )}
          </div>
        </div>

        {/* D. DISTRICT IMPACT LIST */}
        <div className="space-y-2">
          {isLoading && !impactData && (
            <div className="p-6 text-center text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
              <div className="text-xs font-mono">Synthesizing district-level rainfall metrics...</div>
            </div>
          )}

          {!isLoading && filteredDistricts.length === 0 && (
            <div className="p-6 bg-navy-900/40 border border-navy-800 rounded-xl text-center text-slate-400 space-y-1">
              <FileText className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">No districts match active filters</div>
              <p className="text-[10px] text-slate-500">
                Adjust search query, reset category filters, or switch operational sector.
              </p>
            </div>
          )}

          {filteredDistricts.map((district) => {
            const isExpanded = expandedDistrictId === district.district;
            const imdStyle = IMD_RAINFALL_STYLES[district.classification.imdRainfallCategory];
            const densityStyle = SPATIAL_DENSITY_CONFIG[district.coverage.spatialDensity];
            const isSingleNode = district.coverage.spatialDensity === 'SINGLE_NODE_LOCALIZED';
            const isCentroidFallback = district.coverage.spatialDensity === 'CENTROID_PROXIMITY_ONLY';
            const isUnrepresented = district.coverage.status === 'INSUFFICIENT_DATA';

            return (
              <div
                key={district.district}
                className={`border rounded-xl transition-all overflow-hidden ${
                  isExpanded ? 'bg-navy-900/95 border-blue-500/60 shadow-lg' : 'bg-navy-900/60 border-navy-800 hover:border-navy-700'
                }`}
              >
                {/* District Card Header */}
                <div
                  onClick={() => setExpandedDistrictId(isExpanded ? null : district.district)}
                  className="p-3 cursor-pointer flex items-start justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-white text-xs tracking-wide">
                        {district.district}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({district.state})
                      </span>
                      {district.censusCode && (
                        <span className="text-[8.5px] px-1 py-0.2 bg-navy-950 text-slate-400 rounded border border-navy-800">
                          Census: {district.censusCode}
                        </span>
                      )}
                    </div>

                    {/* Coverage & Density Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                      <span className={`px-1.5 py-0.2 rounded border font-medium ${densityStyle.badge}`}>
                        {densityStyle.shortLabel} ({district.coverage.nodeCount} node{district.coverage.nodeCount === 1 ? '' : 's'})
                      </span>

                      {/* Official IMD Bulletin Warning Pill (Separated) */}
                      {district.classification.officialImdAlert && (
                        <span className="px-1.5 py-0.2 rounded border bg-orange-950 text-orange-300 border-orange-500 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5 text-orange-400 flex-shrink-0" />
                          <span>IMD NOWCAST: {district.classification.officialImdAlert.severity}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 24h Rainfall Value & IMD Category Badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] text-slate-400">24h:</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {district.metrics.futureAccum24hMm !== null ? `${district.metrics.futureAccum24hMm.toFixed(1)} mm` : '--'}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${imdStyle.badge}`}>
                      {imdStyle.label}
                    </span>
                  </div>
                </div>

                {/* Single Node Caution Banner (Item 1 & Item 3 Requirements) */}
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
                      <strong>Proximity Estimate:</strong> District contains 0 interior nodes; sampled from nearest NWP node within {district.coverage.meanDistanceKm} km of polygon centroid.
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
                    {/* 1. Prospective Accumulations Timeline */}
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

                    {/* 2. Meteorological Extrema */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-navy-900/60 p-2 rounded-lg border border-navy-800">
                      <div>
                        <span className="text-slate-400 flex items-center gap-1">
                          <CloudRain className="w-3 h-3 text-sky-400" />
                          <span>PEAK RAIN RATE:</span>
                        </span>
                        <div className="font-bold text-white font-mono mt-0.5">
                          {district.metrics.peakHourlyRateMmH !== null
                            ? `${district.metrics.peakHourlyRateMmH} mm/h (${district.metrics.peakHourlyRateCategory})`
                            : '--'}
                        </div>
                        {district.metrics.peakHourlyTimeUtc && (
                          <div className="text-[8.5px] text-slate-400">
                            Valid at: {district.metrics.peakHourlyTimeUtc}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 flex items-center gap-1">
                          <Wind className="w-3 h-3 text-teal-400" />
                          <span>PEAK 10M GUST:</span>
                        </span>
                        <div className="font-bold text-white font-mono mt-0.5">
                          {district.metrics.maxWindGustKmh !== null
                            ? `${district.metrics.maxWindGustKmh} km/h`
                            : '--'}
                        </div>
                        <div className="text-[8.5px] text-slate-400">10m AGL wind vector extrema</div>
                      </div>
                    </div>

                    {/* 3. Official IMD Bulletin Warning (Distinct Section) */}
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

                    {/* 4. Local Infrastructure & Historical Chokepoints (Strict Separation) */}
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

                    {/* Action button to fly to district */}
                    {onSelectDistrict && (
                      <div className="pt-1 flex justify-end">
                        <button
                          onClick={() => onSelectDistrict(district.district, district.state)}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
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
