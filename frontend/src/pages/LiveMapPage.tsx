import React, { useState, useEffect } from 'react';
import {
  Compass,
  ShieldAlert,
  Layers,
  CloudRain,
  AlertTriangle,
  Database,
  Lock,
  ExternalLink,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Info,
  Globe,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { TacticalMap } from '../components/map/TacticalMap';
import { AuthContext } from '../context/AuthContext';
import { fetchAdyarSimulation, SimulationResponse, isGeoJSONFeatureCollection } from '../services/research';
import {
  getRainViewerTimeline,
  RainViewerTimeline,
  RadarAnimationFrame,
} from '../services/radar';
import {
  NavigationTab,
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
} from '../types';

interface LiveMapPageProps {
  location: { name: string; lat: number; lon: number };
  onSelectLocation: (loc: { name: string; lat: number; lon: number }) => void;
  weather?: CurrentWeatherObservation | null;
  forecast?: WeatherForecastResponse | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
  isLoading?: boolean;
  onSelectTab?: (tab: NavigationTab) => void;
}

const SECTOR_QUICK_JUMPS = [
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777, label: 'Mumbai Metro (West Coast)' },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707, label: 'Chennai Coast (Bay of Bengal)' },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362, label: 'Assam Valley (Brahmaputra)' },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322, label: 'Uttarakhand Himalayan Foothills' },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639, label: 'Ganga-Brahmaputra Delta' },
];

export const LiveMapPage: React.FC<LiveMapPageProps> = ({
  location,
  onSelectLocation,
  weather,
  forecast,
  riskAssessment,
  alertFeed,
  isLoading: _isLoading = false,
  onSelectTab,
}) => {
  const auth = React.useContext(AuthContext);
  const user = auth?.user ?? null;
  const token = auth?.token ?? null;
  const isAuthorized = Boolean(user && ['RESEARCHER', 'GOVERNMENT', 'ADMIN'].includes(user.role));
  const hasCesiumPermission = Boolean(auth?.hasPermission?.('command3d:view_globe'));

  // Layer Controls
  const [showLayerSidebar, setShowLayerSidebar] = useState(true);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(80);
  const [showRadar, setShowRadar] = useState(true);
  const [showSatellite, setShowSatellite] = useState(false);
  const [showPrecipLayer, setShowPrecipLayer] = useState(true);
  const [showWindLayer, setShowWindLayer] = useState(false);

  // Radar Timeline Animation State
  const [timeline, setTimeline] = useState<RainViewerTimeline | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(800); // ms per frame

  // Hydrodynamic research simulation state
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);

  // Fetch full RainViewer animation frames
  useEffect(() => {
    let isSubscribed = true;
    getRainViewerTimeline().then((tl) => {
      if (!isSubscribed || !tl) return;
      setTimeline(tl);
      if (tl.radarFrames.length > 0) {
        setActiveFrameIndex(tl.radarFrames.length - 1);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Animation playback timer loop
  useEffect(() => {
    if (!isPlaying || !timeline || timeline.radarFrames.length === 0) return;

    const timer = setInterval(() => {
      setActiveFrameIndex((prevIndex) => {
        const next = prevIndex + 1;
        if (next >= timeline.radarFrames.length) {
          return 0; // loop back to start
        }
        return next;
      });
    }, playbackSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, timeline, playbackSpeed]);

  const activeFrame: RadarAnimationFrame | null =
    timeline && activeFrameIndex >= 0 && activeFrameIndex < timeline.radarFrames.length
      ? timeline.radarFrames[activeFrameIndex]
      : null;

  const handleToggleSimulation = async (enable: boolean) => {
    setShowSimulation(enable);
    if (enable && !simulationData && !simulationLoading) {
      if (!token) {
        setSimulationError('Access restricted: RESEARCHER, GOVERNMENT, or ADMIN authentication required.');
        return;
      }
      setSimulationLoading(true);
      setSimulationError(null);
      try {
        const data = await fetchAdyarSimulation(token);
        const featureCollection = data.geojson ?? data.contours;
        if (!isGeoJSONFeatureCollection(featureCollection)) {
          throw new Error('Malformed simulation response: geojson is not a valid GeoJSON FeatureCollection.');
        }
        setSimulationData(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to retrieve simulation data';
        setSimulationError(message);
      } finally {
        setSimulationLoading(false);
      }
    }
  };

  const handleFocusAdyarReach = () => {
    onSelectLocation({
      name: 'Adyar River Corridor (Chennai)',
      lat: 13.01,
      lon: 80.18,
    });
  };

  const rainfallMm = weather?.precipitationMm ?? 0;
  const riskLevel = riskAssessment?.overallRiskLevel ?? 'GUARDED';
  const riskScore = riskAssessment?.riskScore ?? null;
  const geoRes = alertFeed?.geographicResolution;
  const officialAlerts = alertFeed?.officialAlerts || [];
  const hasActiveAlert = officialAlerts.length > 0;

  return (
    <div className="relative w-full h-[calc(100vh-62px)] min-h-[600px] flex flex-col overflow-hidden bg-navy-950 select-none">
      {/* 1. TOP FLOATING INTELLIGENCE BAR */}
      <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        {/* Left: Quick Jumps & Layer Toggle Button */}
        <div className="pointer-events-auto flex items-center gap-2 flex-wrap bg-navy-900/90 backdrop-blur-md border border-navy-700/80 p-1.5 rounded-xl shadow-lg">
          <div className="px-2 py-1 flex items-center gap-1.5 text-white font-mono font-bold text-xs border-r border-navy-700">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="hidden lg:inline">Tactical Geospatial Command Center</span>
            <span className="lg:hidden">GIS Radar</span>
            {geoRes?.resolvedDistrict && (
              <span className="text-[10px] text-emerald-400 font-normal hidden xl:inline">
                ({geoRes.resolvedDistrict})
              </span>
            )}
          </div>

          <button
            onClick={() => setShowLayerSidebar(!showLayerSidebar)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showLayerSidebar
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-navy-800 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>LAYERS</span>
          </button>

          <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-navy-700">
            <span className="text-[10px] font-mono text-slate-400 uppercase px-1">OPERATIONAL SECTORS:</span>
            {SECTOR_QUICK_JUMPS.map((sec) => (
              <button
                key={sec.name}
                onClick={() => onSelectLocation(sec)}
                className={`px-2 py-1 text-[11px] font-mono rounded transition-colors cursor-pointer ${
                  location.name === sec.name
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-navy-800'
                }`}
              >
                {sec.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Official Warning Entry Point & 3D Globe Launch */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Official Warning Entry Point Banner */}
          {hasActiveAlert ? (
            <button
              onClick={() => onSelectTab && onSelectTab('alerts')}
              className="bg-red-950/90 border border-red-500/80 hover:bg-red-900/90 text-red-200 px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all animate-pulse cursor-pointer"
              title="Click to view full official warnings in Alerts page"
            >
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{officialAlerts.length} ACTIVE WARNING IN SECTOR</span>
            </button>
          ) : (
            <div className="bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">IMD NOWCAST: NO ACTIVE WARNINGS</span>
            </div>
          )}

          {/* Cesium 3D Globe shortcut */}
          {hasCesiumPermission && onSelectTab && (
            <button
              onClick={() => onSelectTab('command3d')}
              className="bg-navy-900/90 hover:bg-navy-800 border border-navy-700 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
              title="Switch to Cesium 3D Global Visualization"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span>CESIUM 3D</span>
            </button>
          )}

          {/* Details Panel Toggle */}
          <button
            onClick={() => setShowDetailsPanel(!showDetailsPanel)}
            className={`p-2 rounded-xl text-xs font-mono border transition-colors cursor-pointer ${
              showDetailsPanel
                ? 'bg-navy-800 border-navy-700 text-amber-400 shadow-md'
                : 'bg-navy-900/90 border-navy-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle contextual details panel"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN MAPLIBRE CANVAS (FILLS ENTIRE VIEWPORT) */}
      <div className="w-full h-full relative">
        <TacticalMap
          center={[location.lon, location.lat]}
          zoom={10}
          locationName={location.name}
          rainfallMm={rainfallMm}
          riskLevel={riskLevel}
          onSelectCoordinates={(coords) =>
            onSelectLocation({
              lat: coords.lat,
              lon: coords.lon,
              name: coords.name || `Target [${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}]`,
            })
          }
          radarOpacity={radarOpacity}
          showRadar={showRadar}
          onToggleRadar={setShowRadar}
          showSimulation={showSimulation}
          simulationGeojson={simulationData?.geojson ?? simulationData?.contours ?? null}
          simulationMeta={simulationData?.metadata ?? null}
          onToggleSimulation={handleToggleSimulation}
          activeRadarTileUrl={activeFrame?.tileUrl ?? null}
          activeRadarTimestamp={activeFrame?.time ?? null}
          className="w-full h-full min-h-full rounded-none border-none"
        />
      </div>

      {/* 3. COLLAPSIBLE FLOATING LAYER CONTROLS (LEFT DRAWER) */}
      {showLayerSidebar && (
        <div className="absolute top-16 left-3 z-20 w-80 max-h-[calc(100vh-180px)] overflow-y-auto bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-2xl p-4 shadow-2xl text-slate-300 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-navy-800">
            <div className="flex items-center gap-2 text-white font-bold tracking-wider">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>GEOSPATIAL LAYERS</span>
            </div>
            <button
              onClick={() => setShowLayerSidebar(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-navy-800 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Layer 1: RainViewer Radar Composite */}
          <div className="space-y-2 bg-navy-950/60 p-3 rounded-xl border border-navy-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-400 animate-pulse" />
                <span className="font-bold text-white">RainViewer Radar</span>
              </div>
              <button
                onClick={() => setShowRadar(!showRadar)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  showRadar
                    ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showRadar ? 'VISIBLE' : 'HIDDEN'}
              </button>
            </div>
            <div className="text-[10px] text-slate-400">
              Live composite radar tiles (256x256 EPSG:3857)
            </div>

            {showRadar && (
              <div className="pt-2 border-t border-navy-800/80 space-y-1.5">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Opacity:</span>
                  <span className="font-bold text-white">{radarOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={radarOpacity}
                  onChange={(e) => setRadarOpacity(Number(e.target.value))}
                  className="w-full accent-blue-500 h-1 bg-navy-800 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Layer 2: Satellite Imagery (Transparently Labeled Honest State) */}
          <div className="space-y-2 bg-navy-950/60 p-3 rounded-xl border border-navy-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-300">Satellite IR Imagery</span>
              </div>
              <button
                onClick={() => setShowSatellite(!showSatellite)}
                className="px-2 py-0.5 rounded text-[10px] font-bold border bg-navy-800 text-slate-400 border-navy-700 cursor-pointer"
              >
                {showSatellite ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
            {/* Honest Provider Status */}
            <div className="p-2 bg-amber-950/40 border border-amber-600/40 rounded text-[10px] text-amber-300 space-y-1">
              <div className="flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span>PROVIDER OFFLINE / AWAITING INTEGRATION</span>
              </div>
              <p className="text-slate-400 leading-tight">
                INSAT-3D / Himawari IR imagery stream is currently awaiting direct ISRO/JMA API credentials. No simulated satellite frames are rendered.
              </p>
            </div>
          </div>

          {/* Layer 3: Forecast Overlays */}
          <div className="space-y-2.5 bg-navy-950/60 p-3 rounded-xl border border-navy-800">
            <div className="font-bold text-white flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-sky-400" />
              <span>Forecast Model Overlays</span>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Precipitation Rate (NWP)</span>
              <button
                onClick={() => setShowPrecipLayer(!showPrecipLayer)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  showPrecipLayer
                    ? 'bg-sky-950/50 text-sky-300 border-sky-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showPrecipLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">Surface Wind Vectors</span>
              <button
                onClick={() => setShowWindLayer(!showWindLayer)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                  showWindLayer
                    ? 'bg-teal-950/50 text-teal-300 border-teal-500'
                    : 'bg-navy-800 text-slate-500 border-navy-700'
                }`}
              >
                {showWindLayer ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Layer 4: SFINCS Hydrodynamic Simulation (Adyar Reach) */}
          <div className="space-y-2 bg-navy-950/60 p-3 rounded-xl border-2 border-amber-400">
            <div className="flex items-center justify-between pb-1 border-b border-navy-800">
              <div className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Hydrodynamic Simulation</h3>
              </div>
              <span className="px-1.5 py-0.5 bg-amber-950 text-amber-300 font-mono text-[10px] font-bold rounded border border-amber-600">
                RESEARCH S2
              </span>
            </div>

            {/* Amber Warning Header */}
            <div className="bg-amber-950/80 border border-amber-500/70 rounded p-2 text-[10px] font-mono text-amber-200">
              <div className="font-bold">⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE</div>
              <div className="text-slate-400 mt-0.5">Quarantined research layer.</div>
            </div>

            {!isAuthorized ? (
              <div className="bg-navy-900 border border-navy-700 rounded p-2.5 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold font-mono text-[11px]">
                  <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>ROLE ACCESS QUARANTINE</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  The Adyar Corridor SFINCS 2D hydrodynamic simulation is restricted to RESEARCHER, GOVERNMENT, and ADMIN roles.
                </p>
                <div className="text-[9px] font-mono text-slate-500 pt-1 border-t border-navy-800">
                  CURRENT TIER: <strong className="text-slate-400">{user ? `Role [${user.role}]` : 'Unauthenticated'}</strong>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">Adyar Corridor (S2 Baseline)</span>
                  <button
                    onClick={() => handleToggleSimulation(!showSimulation)}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
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
                  <div className="p-1.5 bg-amber-950/50 border border-amber-600/40 rounded text-amber-300">
                    No inundation contour geometries found in simulation dataset.
                  </div>
                )}

                {/* Depth Band Color Legend */}
                <div className="space-y-1 pt-1.5 border-t border-navy-800">
                  <div className="text-[9px] font-mono font-bold text-slate-400 uppercase">
                    HYDRAULIC DEPTH CLASSIFICATION
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[10px]">
                    <div className="flex items-center justify-between p-1 rounded bg-navy-900 border border-navy-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-[#FEF08A]" />
                        <span>Shallow Ponding</span>
                      </div>
                      <span className="text-slate-400">0.10 - 0.50 m</span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-navy-900 border border-navy-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-[#FB923C]" />
                        <span>Moderate Depth</span>
                      </div>
                      <span className="text-slate-400">0.50 - 1.50 m</span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-navy-900 border border-navy-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-[#DC2626]" />
                        <span>Critical Hazard</span>
                      </div>
                      <span className="text-slate-400">&gt; 1.50 m</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleFocusAdyarReach}
                  className="w-full mt-1 py-1 px-2 bg-navy-800 hover:bg-navy-700 text-amber-300 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>FOCUS ADYAR REACH</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. CONTEXTUAL DETAILS PANEL (RIGHT FLOATING CARD) */}
      {showDetailsPanel && (
        <div className="absolute top-16 right-3 z-20 w-72 bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-2xl p-4 shadow-2xl text-slate-300 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-navy-800">
            <div className="flex items-center gap-2 text-white font-bold">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Active Sector Fix</span>
            </div>
            <button
              onClick={() => setShowDetailsPanel(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-navy-800 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">LOCATION:</span>
              <strong className="text-white truncate max-w-[140px]" title={location.name}>
                {location.name}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">COORDINATES:</span>
              <strong className="text-slate-200">
                {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">HAZARD TIER:</span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                  riskLevel === 'CRITICAL'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : riskLevel === 'HIGH'
                    ? 'bg-orange-950 text-orange-400 border border-orange-800'
                    : riskLevel === 'ELEVATED'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                }`}
              >
                {riskLevel} {riskScore !== null ? `(${riskScore}/100)` : ''}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">PRECIP RATE:</span>
              <strong className="text-sky-400">{weather ? `${weather.precipitationMm} mm/h` : '--'}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">TEMPERATURE:</span>
              <strong className="text-white">{weather ? `${weather.temperatureC}°C` : '--'}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">WIND & GUSTS:</span>
              <strong className="text-slate-200">
                {weather ? `${weather.windSpeedKmh} / ${weather.windGustsKmh} km/h` : '--'}
              </strong>
            </div>
            <div className="flex justify-between py-1 border-b border-navy-800">
              <span className="text-slate-400">ATM PRESSURE:</span>
              <strong className="text-slate-200">{weather ? `${weather.surfacePressureHpa} hPa` : '--'}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">SOIL MOISTURE:</span>
              <strong className="text-slate-200">
                {weather?.soilMoisture0To7cm !== undefined
                  ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%`
                  : forecast?.soilProfile?.moisture0To7cm !== undefined
                  ? `${(forecast.soilProfile.moisture0To7cm * 100).toFixed(1)}%`
                  : 'UNAVAILABLE'}
              </strong>
            </div>
          </div>

          <div className="pt-2 border-t border-navy-800 flex items-start gap-1.5 text-[10px] text-amber-400 leading-tight">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>Indicative screening assessment only — not a calibrated hydraulic flood model.</span>
          </div>
        </div>
      )}

      {/* 5. RADAR REFLECTIVITY LEGEND (BOTTOM-RIGHT) */}
      <div className="absolute bottom-20 right-3 z-20 bg-navy-900/90 backdrop-blur-md border border-navy-700/80 rounded-xl p-2.5 shadow-lg text-slate-300 font-mono text-[10px] pointer-events-auto">
        <div className="flex items-center justify-between pb-1 mb-1 border-b border-navy-800 text-slate-400 font-semibold">
          <span>RADAR REFLECTIVITY (dBZ)</span>
          <span className="text-sky-400">RainViewer</span>
        </div>
        <div className="w-56 h-3 rounded bg-gradient-to-r from-[#4A90E2] via-[#50E3C2] via-[#F8E71C] via-[#F5A623] to-[#D0021B]" />
        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
          <span>10 dBZ (Light)</span>
          <span>35 (Moderate)</span>
          <span>50 (Heavy)</span>
          <span>65+ (Extreme)</span>
        </div>
      </div>

      {/* 6. BOTTOM FLOATING ANIMATION TIMELINE & CONTROLS */}
      <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex justify-center">
        <div className="pointer-events-auto w-full max-w-3xl bg-navy-900/95 backdrop-blur-md border border-navy-700/90 rounded-2xl p-3 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-200 font-mono text-xs">
          {/* Play/Pause & Step Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!timeline || timeline.radarFrames.length === 0) return;
                setIsPlaying(!isPlaying);
              }}
              className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-colors cursor-pointer"
              title={isPlaying ? 'Pause radar loop' : 'Play radar loop'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (!timeline || timeline.radarFrames.length === 0) return;
                setIsPlaying(false);
                setActiveFrameIndex((prev) => Math.max(0, prev - 1));
              }}
              className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Previous frame"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (!timeline || timeline.radarFrames.length === 0) return;
                setIsPlaying(false);
                setActiveFrameIndex((prev) => Math.min(timeline.radarFrames.length - 1, prev + 1));
              }}
              className="p-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next frame"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {/* Frame timestamp badge */}
            <div className="px-2.5 py-1 rounded-lg bg-navy-950 border border-navy-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-bold text-white text-xs">
                {activeFrame ? activeFrame.label : 'Live Stream'}
              </span>
              <span className="text-[10px] text-amber-400">
                {activeFrame ? activeFrame.relativeTime : ''}
              </span>
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="flex-1 flex items-center gap-3 px-2">
            <span className="text-[10px] text-slate-400 whitespace-nowrap">
              {timeline ? `${timeline.radarFrames.length} Frames` : 'Loading...'}
            </span>
            <input
              type="range"
              min="0"
              max={timeline && timeline.radarFrames.length > 0 ? timeline.radarFrames.length - 1 : 0}
              value={activeFrameIndex >= 0 ? activeFrameIndex : 0}
              onChange={(e) => {
                setIsPlaying(false);
                setActiveFrameIndex(Number(e.target.value));
              }}
              disabled={!timeline || timeline.radarFrames.length === 0}
              className="w-full accent-blue-500 h-1.5 bg-navy-800 rounded-lg cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1.5 text-[10px] self-end sm:self-center">
            <span className="text-slate-400">SPEED:</span>
            {[
              { label: '1x', ms: 800 },
              { label: '2x', ms: 400 },
            ].map((spd) => (
              <button
                key={spd.label}
                onClick={() => setPlaybackSpeed(spd.ms)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  playbackSpeed === spd.ms
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-navy-800 text-slate-400 hover:text-white'
                }`}
              >
                {spd.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
