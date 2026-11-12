import React, { useState } from 'react';
import {
  Layers,
  ChevronLeft,
  Radio,
  Globe,
  CloudRain,
  Wind,
  Thermometer,
  Gauge,
  Droplets,
  Database,
  Lock,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  Building2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SimulationResponse } from '../../services/research';

export interface LayerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  // Category A: Live Maps
  showRadar: boolean;
  onToggleRadar: (show: boolean) => void;
  radarOpacity: number;
  onChangeRadarOpacity: (opacity: number) => void;
  showSatellite: boolean;
  onToggleSatellite: (show: boolean) => void;

  // Category B: Forecast Maps
  showPrecipLayer: boolean;
  onTogglePrecipLayer: (show: boolean) => void;
  showWindLayer: boolean;
  onToggleWindLayer: (show: boolean) => void;
  showTempLayer?: boolean;
  onToggleTempLayer?: (show: boolean) => void;
  showHumidityLayer?: boolean;
  onToggleHumidityLayer?: (show: boolean) => void;
  showPressureLayer?: boolean;
  onTogglePressureLayer?: (show: boolean) => void;

  // Category C: JATAYU Intelligence
  isAuthorizedForSimulation: boolean;
  userRole?: string | null;
  showSimulation: boolean;
  onToggleSimulation: (enable: boolean) => void;
  simulationLoading: boolean;
  simulationError: string | null;
  simulationData: SimulationResponse | null;
  onFocusAdyarReach: () => void;
  showVulnerabilityPoints?: boolean;
  onToggleVulnerabilityPoints?: (show: boolean) => void;
  showFacilities?: boolean;
  onToggleFacilities?: (show: boolean) => void;

  className?: string;
}

export const LayerSidebar: React.FC<LayerSidebarProps> = ({
  isOpen,
  onClose,
  showRadar,
  onToggleRadar,
  radarOpacity,
  onChangeRadarOpacity,
  showSatellite,
  onToggleSatellite,
  showPrecipLayer,
  onTogglePrecipLayer,
  showWindLayer,
  onToggleWindLayer,
  showTempLayer = false,
  onToggleTempLayer,
  showHumidityLayer = false,
  onToggleHumidityLayer,
  showPressureLayer = false,
  onTogglePressureLayer,
  isAuthorizedForSimulation,
  userRole,
  showSimulation,
  onToggleSimulation,
  simulationLoading,
  simulationError,
  simulationData,
  onFocusAdyarReach,
  showVulnerabilityPoints = false,
  onToggleVulnerabilityPoints,
  showFacilities = false,
  onToggleFacilities,
  className = '',
}) => {
  if (!isOpen) return null;

  const [expandedSection, setExpandedSection] = useState<'A' | 'B' | 'C' | 'ALL'>('ALL');

  const toggleSection = (section: 'A' | 'B' | 'C') => {
    if (expandedSection === section) setExpandedSection('ALL');
    else setExpandedSection(section);
  };

  const isSectionOpen = (section: 'A' | 'B' | 'C') => expandedSection === 'ALL' || expandedSection === section;

  return (
    <aside
      className={`absolute top-16 left-3 z-30 w-72 sm:w-76 max-h-[calc(100vh-140px)] overflow-y-auto bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl p-3 shadow-2xl text-slate-300 font-mono text-xs space-y-2.5 transition-all animate-in fade-in slide-in-from-left duration-200 select-none ${className}`}
      aria-label="Geospatial Layers Sidebar"
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-navy-800">
        <div className="flex items-center gap-1.5 text-white font-bold tracking-wider text-xs">
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span>GEOSPATIAL LAYERS</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-navy-800 transition-colors cursor-pointer"
          title="Close layers sidebar"
          aria-label="Close layers sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SYSTEM A: LIVE MAPS — What is happening now?                             */}
      {/* ========================================================================= */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 overflow-hidden">
        <button
          onClick={() => toggleSection('A')}
          className="w-full px-2.5 py-1.5 bg-blue-900/30 hover:bg-blue-900/40 border-b border-blue-800/40 flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-blue-400 animate-pulse" />
            <div>
              <div className="font-bold text-white text-[11px] tracking-wide">A. LIVE MAPS</div>
              <div className="text-[9px] text-blue-300/80 font-normal">Observed radar & satellite telemetry</div>
            </div>
          </div>
          {isSectionOpen('A') ? <ChevronUp className="w-3.5 h-3.5 text-blue-400" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-400" />}
        </button>

        {isSectionOpen('A') && (
          <div className="p-2 space-y-2">
            {/* Layer A.1: RainViewer Radar Composite */}
            <div className="space-y-1.5 bg-navy-950/70 p-2 rounded-lg border border-navy-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-blue-400" />
                  <span className="font-bold text-white text-[11px]">RainViewer Radar</span>
                </div>
                <button
                  onClick={() => onToggleRadar(!showRadar)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                    showRadar
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                      : 'bg-navy-800 text-slate-500 border-navy-700'
                  }`}
                >
                  {showRadar ? 'VISIBLE' : 'HIDDEN'}
                </button>
              </div>
              <div className="text-[9px] text-slate-400 leading-tight">
                Live composite radar tiles (256x256 EPSG:3857)
              </div>

              {showRadar && (
                <div className="pt-1.5 border-t border-navy-800/80 space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Opacity:</span>
                    <span className="font-bold text-white">{radarOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={radarOpacity}
                    onChange={(e) => onChangeRadarOpacity(Number(e.target.value))}
                    className="w-full accent-blue-500 h-1 bg-navy-800 rounded-lg cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Layer A.2: Satellite Imagery */}
            <div className="space-y-1.5 bg-navy-950/70 p-2 rounded-lg border border-navy-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span className="font-bold text-slate-300 text-[11px]">Satellite IR Imagery</span>
                </div>
                <button
                  onClick={() => onToggleSatellite(!showSatellite)}
                  className="px-1.5 py-0.2 rounded text-[9px] font-bold border bg-navy-800 text-slate-400 border-navy-700 cursor-pointer"
                >
                  {showSatellite ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
              {/* Transparent Status */}
              <div className="p-1.5 bg-amber-950/40 border border-amber-600/40 rounded text-[9px] text-amber-300 space-y-0.5">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span>PROVIDER OFFLINE / AWAITING INTEGRATION</span>
                </div>
                <p className="text-slate-400 leading-tight">
                  INSAT-3D / Himawari IR imagery stream is currently awaiting direct ISRO/JMA API credentials. No simulated satellite frames are rendered.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SYSTEM B: FORECAST MAPS — What is likely to happen?                     */}
      {/* ========================================================================= */}
      <div className="rounded-lg border border-teal-500/30 bg-teal-950/20 overflow-hidden">
        <button
          onClick={() => toggleSection('B')}
          className="w-full px-2.5 py-1.5 bg-teal-900/30 hover:bg-teal-900/40 border-b border-teal-800/40 flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <CloudRain className="w-3 h-3 text-teal-400" />
            <div>
              <div className="font-bold text-white text-[11px] tracking-wide">B. FORECAST MAPS</div>
              <div className="text-[9px] text-teal-300/80 font-normal">NWP models (ECMWF IFS / DWD ICON)</div>
            </div>
          </div>
          {isSectionOpen('B') ? <ChevronUp className="w-3.5 h-3.5 text-teal-400" /> : <ChevronDown className="w-3.5 h-3.5 text-teal-400" />}
        </button>

        {isSectionOpen('B') && (
          <div className="p-2 space-y-1.5">
            {/* Precipitation Rate */}
            <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
              <span className="text-slate-300 flex items-center gap-1.5">
                <CloudRain className="w-3 h-3 text-sky-400" />
                <span>Precipitation Rate (NWP)</span>
              </span>
              <button
                onClick={() => onTogglePrecipLayer(!showPrecipLayer)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                  showPrecipLayer
                    ? 'bg-sky-950/50 text-sky-300 border-sky-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showPrecipLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Wind Vectors */}
            <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Wind className="w-3 h-3 text-teal-400" />
                <span>Surface Wind Vectors</span>
              </span>
              <button
                onClick={() => onToggleWindLayer(!showWindLayer)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                  showWindLayer
                    ? 'bg-teal-950/50 text-teal-300 border-teal-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showWindLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Temperature */}
            <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Thermometer className="w-3 h-3 text-amber-400" />
                <span>2m Air Temperature</span>
              </span>
              <button
                onClick={() => onToggleTempLayer && onToggleTempLayer(!showTempLayer)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                  showTempLayer
                    ? 'bg-amber-950/50 text-amber-300 border-amber-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showTempLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Humidity */}
            <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span>Relative Humidity</span>
              </span>
              <button
                onClick={() => onToggleHumidityLayer && onToggleHumidityLayer(!showHumidityLayer)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                  showHumidityLayer
                    ? 'bg-blue-950/50 text-blue-300 border-blue-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showHumidityLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            {/* Pressure */}
            <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Gauge className="w-3 h-3 text-purple-400" />
                <span>Mean Sea Level Pressure</span>
              </span>
              <button
                onClick={() => onTogglePressureLayer && onTogglePressureLayer(!showPressureLayer)}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                  showPressureLayer
                    ? 'bg-purple-950/50 text-purple-300 border-purple-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showPressureLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SYSTEM C: JATAYU INTELLIGENCE — Vulnerabilities & Potential Impacts       */}
      {/* ========================================================================= */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 overflow-hidden">
        <button
          onClick={() => toggleSection('C')}
          className="w-full px-2.5 py-1.5 bg-amber-900/30 hover:bg-amber-900/40 border-b border-amber-800/40 flex items-center justify-between text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <div>
              <div className="font-bold text-white text-[11px] tracking-wide">C. JATAYU INTELLIGENCE</div>
              <div className="text-[9px] text-amber-300/80 font-normal">Vulnerability, facilities & SFINCS model</div>
            </div>
          </div>
          {isSectionOpen('C') ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />}
        </button>

        {isSectionOpen('C') && (
          <div className="p-2 space-y-2">
            {/* Hydrodynamic SFINCS Card */}
            <div className="space-y-1.5 bg-navy-950/70 p-2 rounded-lg border-2 border-amber-400">
              <div className="flex items-center justify-between pb-1 border-b border-navy-800">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-amber-400" />
                  <h3 className="text-xs font-bold text-white">Hydrodynamic Simulation</h3>
                </div>
                <span className="px-1 py-0.2 bg-amber-950 text-amber-300 font-mono text-[9px] font-bold rounded border border-amber-600">
                  RESEARCH S2
                </span>
              </div>

              {/* Amber Warning Header */}
              <div className="bg-amber-950/80 border border-amber-500/70 rounded p-1.5 text-[9px] font-mono text-amber-200 leading-tight">
                <div className="font-bold">⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE</div>
                <div className="text-slate-400 mt-0.5">Quarantined research layer.</div>
              </div>

              {!isAuthorizedForSimulation ? (
                <div className="bg-navy-900 border border-navy-700 rounded p-2 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold font-mono text-[10px]">
                    <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span>ROLE ACCESS QUARANTINE</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
                    The Adyar Corridor SFINCS 2D hydrodynamic simulation is restricted to RESEARCHER, GOVERNMENT, and ADMIN roles.
                  </p>
                  <div className="text-[9px] font-mono text-slate-500 pt-1 border-t border-navy-800">
                    CURRENT TIER: <strong className="text-slate-400">{userRole ? `Role [${userRole}]` : 'Unauthenticated'}</strong>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5 text-[9px]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">Adyar Corridor (S2 Baseline)</span>
                    <button
                      onClick={() => onToggleSimulation(!showSimulation)}
                      className={`px-2 py-0.2 rounded text-[9px] font-mono font-bold border transition-colors cursor-pointer ${
                        showSimulation
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-warm-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {showSimulation ? 'ACTIVE' : 'MUTED'}
                    </button>
                  </div>

                  {simulationLoading && (
                    <div className="text-sky-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                      <span>Loading hydrodynamic vectors...</span>
                    </div>
                  )}
                  {simulationError && (
                    <div className="text-red-400 font-mono p-1 bg-red-950/60 rounded border border-red-800">
                      {simulationError}
                    </div>
                  )}
                  {showSimulation && simulationData && ((simulationData.geojson?.features?.length ?? simulationData.contours?.features?.length ?? 0) === 0) && !simulationLoading && !simulationError && (
                    <div className="p-1 bg-amber-950/50 border border-amber-600/40 rounded text-amber-300">
                      No inundation contour geometries found in simulation dataset.
                    </div>
                  )}

                  {/* Depth Band Color Legend */}
                  <div className="space-y-0.5 pt-1 border-t border-navy-800">
                    <div className="text-[8px] font-mono font-bold text-slate-400 uppercase">
                      HYDRAULIC DEPTH CLASSIFICATION
                    </div>
                    <div className="grid grid-cols-1 gap-0.5 text-[9px]">
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-navy-900 border border-navy-800">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-[#FEF08A]" />
                          <span>Shallow Ponding</span>
                        </div>
                        <span className="text-slate-400">0.10 - 0.50 m</span>
                      </div>
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-navy-900 border border-navy-800">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-[#FB923C]" />
                          <span>Moderate Depth</span>
                        </div>
                        <span className="text-slate-400">0.50 - 1.50 m</span>
                      </div>
                      <div className="flex items-center justify-between px-1.5 py-0.5 rounded bg-navy-900 border border-navy-800">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-[#DC2626]" />
                          <span>Critical Hazard</span>
                        </div>
                        <span className="text-slate-400">&gt; 1.50 m</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onFocusAdyarReach}
                    className="w-full mt-1 py-1 px-2 bg-navy-800 hover:bg-navy-700 text-amber-300 rounded text-[9px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>FOCUS ADYAR REACH</span>
                  </button>
                </div>
              )}
            </div>

            {/* Additional Intelligence Overlays */}
            <div className="space-y-1 pt-1 border-t border-navy-800/80">
              <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3 text-amber-400" />
                  <span>Flood Vulnerability Points</span>
                </span>
                <button
                  onClick={() => onToggleVulnerabilityPoints && onToggleVulnerabilityPoints(!showVulnerabilityPoints)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                    showVulnerabilityPoints
                      ? 'bg-amber-950/50 text-amber-300 border-amber-500'
                      : 'bg-navy-800 text-slate-500 border-navy-700'
                  }`}
                >
                  {showVulnerabilityPoints ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              <div className="flex items-center justify-between text-[10px] p-1.5 rounded bg-navy-950/60 border border-navy-800/80">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 text-emerald-400" />
                  <span>Emergency Facilities (GCC/EOC)</span>
                </span>
                <button
                  onClick={() => onToggleFacilities && onToggleFacilities(!showFacilities)}
                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                    showFacilities
                      ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500'
                      : 'bg-navy-800 text-slate-500 border-navy-700'
                  }`}
                >
                  {showFacilities ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
