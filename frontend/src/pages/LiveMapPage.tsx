import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  AlertTriangle,
  Globe,
  Radio,
  CheckCircle2,
  Compass,
  FileText,
} from 'lucide-react';
import { TacticalMap } from '../components/map/TacticalMap';
import { LayerSidebar } from '../components/map/LayerSidebar';
import { MapTimeline } from '../components/map/MapTimeline';
import { TelemetryDrawer } from '../components/map/TelemetryDrawer';
import { WeatherLegend } from '../components/map/WeatherLegend';
import { ForecastImpactDashboard } from '../components/map/ForecastImpactDashboard';
import { ForecastImpactResponse, getForecastImpact } from '../services/forecast-impact';
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
import {
  SatelliteMode,
  LiveSatelliteChannel,
  HDSatelliteProduct,
  SatelliteProductKey,
  SatelliteTimeline,
  SatelliteAnimationFrame,
  generateSatelliteTimeline,
  getSatelliteTileUrl,
  getLatestCompletedCompositeDate,
  SATELLITE_PRODUCTS,
} from '../services/satellite';
import {
  ForecastProductType,
  ForecastGridResponse,
  OperationalSectorKey,
  getForecastGrid,
} from '../services/forecast';

export interface LiveMapPageProps {
  location: { name: string; lat: number; lon: number };
  onSelectLocation: (loc: { name: string; lat: number; lon: number }) => void;
  weather?: CurrentWeatherObservation | null;
  forecast?: WeatherForecastResponse | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
  isLoading?: boolean;
  onSelectTab?: (tab: NavigationTab) => void;
}

export const SECTOR_QUICK_JUMPS = [
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777, label: 'Mumbai', code: 'MUM' },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707, label: 'Chennai', code: 'CHE' },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362, label: 'Assam', code: 'GHY' },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322, label: 'Dehradun', code: 'DED' },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639, label: 'Kolkata', code: 'CCU' },
];

function getNearestSectorKey(lat: number, lon: number): OperationalSectorKey {
  const sectors: { key: OperationalSectorKey; lat: number; lon: number }[] = [
    { key: 'mumbai', lat: 19.076, lon: 72.8777 },
    { key: 'chennai', lat: 13.0827, lon: 80.2707 },
    { key: 'guwahati', lat: 26.1445, lon: 91.7362 },
    { key: 'dehradun', lat: 30.3165, lon: 78.0322 },
    { key: 'kolkata', lat: 22.5726, lon: 88.3639 },
  ];
  let closest = sectors[0];
  let minDist = Infinity;
  for (const s of sectors) {
    const d = Math.hypot(lat - s.lat, lon - s.lon);
    if (d < minDist) {
      minDist = d;
      closest = s;
    }
  }
  return closest.key;
}

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

  // Drawer & Overlay Visibilities
  const [showLayerSidebar, setShowLayerSidebar] = useState(true);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [showImpactDashboard, setShowImpactDashboard] = useState(false);

  // Category A: Live Maps State
  const [showRadar, setShowRadar] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(80);
  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(75);
  const [satelliteMode, setSatelliteMode] = useState<SatelliteMode>('live');
  const [satelliteChannel, setSatelliteChannel] = useState<LiveSatelliteChannel>('ir');
  const [hdProduct, setHdProduct] = useState<HDSatelliteProduct>('viirs');

  const activeSatelliteProductKey: SatelliteProductKey =
    satelliteMode === 'live' ? satelliteChannel : hdProduct;

  // Category B: Forecast Maps State & Unified 72h Timeline
  const [showPrecipLayer, setShowPrecipLayer] = useState(true);
  const [showWindLayer, setShowWindLayer] = useState(false);
  const [showTempLayer, setShowTempLayer] = useState(false);
  const [showHumidityLayer, setShowHumidityLayer] = useState(false);
  const [showPressureLayer, setShowPressureLayer] = useState(false);

  const [forecastGridData, setForecastGridData] = useState<ForecastGridResponse | null>(null);
  const [forecastTimestepIndex, setForecastTimestepIndex] = useState<number>(0);
  const [isForecastPlaying, setIsForecastPlaying] = useState<boolean>(false);
  const [forecastPlaybackSpeed, setForecastPlaybackSpeed] = useState<number>(800);
  const [timelineMode, setTimelineMode] = useState<'live' | 'forecast'>('live');
  const [forecastOpacity, setForecastOpacity] = useState<number>(80);
  const [pressureContourInterval, setPressureContourInterval] = useState<2 | 4>(4);
  const [windParticleDensity, setWindParticleDensity] = useState<'light' | 'standard' | 'dense'>('standard');
  const [windSpeedMultiplier, setWindSpeedMultiplier] = useState<number>(1.0);

  // Phase 3D-2B: District Forecast Impact Layer & Selection
  const [showDistrictImpactLayer, setShowDistrictImpactLayer] = useState<boolean>(true);
  const [districtImpactOpacity, setDistrictImpactOpacity] = useState<number>(65);
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);
  const [districtImpactResponse, setDistrictImpactResponse] = useState<ForecastImpactResponse | null>(null);

  const handleImpactDataLoaded = useCallback((data: ForecastImpactResponse) => {
    setDistrictImpactResponse(data);
  }, []);

  // Ingest genuine NWP forecast grid & impact intelligence whenever operational sector changes
  useEffect(() => {
    let isSubscribed = true;
    setSelectedDistrictName(null);
    const sectorKey = getNearestSectorKey(location.lat, location.lon);

    getForecastGrid('sector', sectorKey)
      .then((grid) => {
        if (!isSubscribed || !grid) return;
        setForecastGridData(grid);
      })
      .catch((err) => {
        console.warn('[LiveMapPage] Failed to fetch forecast grid:', err);
      });

    getForecastImpact('sector', sectorKey)
      .then((impact) => {
        if (!isSubscribed || !impact) return;
        setDistrictImpactResponse(impact);
      })
      .catch((err) => {
        console.warn('[LiveMapPage] Failed to fetch forecast impact:', err);
      });

    return () => {
      isSubscribed = false;
    };
  }, [location.lat, location.lon]);

  // Unified Forecast Timeline Playback Timer
  useEffect(() => {
    if (!isForecastPlaying || !forecastGridData) return;
    const totalSteps = forecastGridData.nodes?.[0]?.hourly?.length || 72;
    const timer = setInterval(() => {
      setForecastTimestepIndex((prev) => (prev + 1) % totalSteps);
    }, forecastPlaybackSpeed);
    return () => clearInterval(timer);
  }, [isForecastPlaying, forecastGridData, forecastPlaybackSpeed]);

  // Determine active forecast scalar product
  const activeForecastProduct: ForecastProductType = useMemo(() => {
    if (showTempLayer) return 'temperature';
    if (showHumidityLayer) return 'humidity';
    if (showPressureLayer && !showPrecipLayer) return 'pressure';
    return 'precipitation';
  }, [showTempLayer, showHumidityLayer, showPressureLayer, showPrecipLayer]);

  const isAnyForecastScalarActive = Boolean(
    showPrecipLayer || showTempLayer || showHumidityLayer || (showPressureLayer && !showPrecipLayer)
  );

  const hasActiveForecastLayer = Boolean(
    isAnyForecastScalarActive || showPressureLayer || showWindLayer
  );

  // Category C: JATAYU Intelligence State
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);
  const [showVulnerabilityPoints, setShowVulnerabilityPoints] = useState(false);
  const [showFacilities, setShowFacilities] = useState(false);

  // Radar Timeline Animation State
  const [timeline, setTimeline] = useState<RainViewerTimeline | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(800); // ms per frame

  // Phase 2C: Satellite Timeline Animation State (Independent loop & driver)
  const [satelliteTimeline, setSatelliteTimeline] = useState<SatelliteTimeline | null>(null);
  const [activeSatFrameIndex, setActiveSatFrameIndex] = useState<number>(-1);
  const [isSatPlaying, setIsSatPlaying] = useState(false);
  const [satPlaybackSpeed, setSatPlaybackSpeed] = useState<number>(800); // ms per frame
  const [activeTimelineDriver, setActiveTimelineDriver] = useState<'satellite' | 'radar'>('satellite');

  // Fetch verified RainViewer animation timeline
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

  // Initialize and update satellite timeline when product changes
  useEffect(() => {
    const satTl = generateSatelliteTimeline(activeSatelliteProductKey);
    setSatelliteTimeline(satTl);
    if (satTl.frames.length > 0) {
      setActiveSatFrameIndex(satTl.frames.length - 1);
    }
    if (satelliteMode === 'hd') {
      setIsSatPlaying(false);
    }
  }, [activeSatelliteProductKey, satelliteMode]);

  // Radar playback timer loop
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

  // Satellite playback timer loop (Smooth double-buffered frame progression)
  useEffect(() => {
    if (!isSatPlaying || !satelliteTimeline || satelliteTimeline.frames.length <= 1) return;

    const timer = setInterval(() => {
      setActiveSatFrameIndex((prevIndex) => {
        const next = prevIndex + 1;
        if (next >= satelliteTimeline.frames.length) {
          return 0; // loop back to start
        }
        return next;
      });
    }, satPlaybackSpeed);

    return () => clearInterval(timer);
  }, [isSatPlaying, satelliteTimeline, satPlaybackSpeed]);

  const activeFrame: RadarAnimationFrame | null =
    timeline && activeFrameIndex >= 0 && activeFrameIndex < timeline.radarFrames.length
      ? timeline.radarFrames[activeFrameIndex]
      : null;

  const activeSatFrame: SatelliteAnimationFrame | null =
    satelliteTimeline && activeSatFrameIndex >= 0 && activeSatFrameIndex < satelliteTimeline.frames.length
      ? satelliteTimeline.frames[activeSatFrameIndex]
      : null;

  const activeSatTileUrl = activeSatFrame
    ? activeSatFrame.tileUrl
    : getSatelliteTileUrl(activeSatelliteProductKey);

  // Preload next frame for flicker-free double buffering
  const nextSatFrameIndex =
    satelliteTimeline && satelliteTimeline.frames.length > 1
      ? (activeSatFrameIndex + 1) % satelliteTimeline.frames.length
      : -1;

  const preloadSatTileUrl =
    nextSatFrameIndex >= 0 && satelliteTimeline
      ? satelliteTimeline.frames[nextSatFrameIndex].tileUrl
      : null;

  // Toggle SFINCS hydrodynamic simulation with strict RBAC gate
  const handleToggleSimulation = useCallback(
    async (enable: boolean) => {
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
    },
    [token, simulationData, simulationLoading]
  );

  const handleFocusAdyarReach = useCallback(() => {
    onSelectLocation({
      name: 'Adyar River Corridor (Chennai)',
      lat: 13.01,
      lon: 80.18,
    });
  }, [onSelectLocation]);

  const rainfallMm = weather?.precipitationMm ?? 0;
  const riskLevel = riskAssessment?.overallRiskLevel ?? 'GUARDED';
  const geoRes = alertFeed?.geographicResolution;
  const officialAlerts = alertFeed?.officialAlerts || [];
  const hasActiveAlert = officialAlerts.length > 0;

  // Derive active forecast legend layer
  const activeForecastLegend = useMemo<'precipitation' | 'wind' | 'temperature' | 'humidity' | 'pressure' | null>(() => {
    if (showPrecipLayer) return 'precipitation';
    if (showWindLayer) return 'wind';
    if (showTempLayer) return 'temperature';
    if (showHumidityLayer) return 'humidity';
    if (showPressureLayer) return 'pressure';
    return null;
  }, [showPrecipLayer, showWindLayer, showTempLayer, showHumidityLayer, showPressureLayer]);

  return (
    <div className="relative w-full h-[calc(100vh-58px)] min-h-[580px] flex flex-col overflow-hidden bg-navy-950 select-none">
      {/* 1. TOP STREAMLINED COMMAND & INTELLIGENCE BAR (RESPONSIVE SINGLE LINE) */}
      <header className="absolute top-2.5 left-2.5 right-2.5 z-30 pointer-events-none flex flex-row items-center justify-between gap-2 flex-nowrap">
        {/* Left: Branding, Layers Toggle, and Sector Quick Jumps */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-nowrap bg-navy-900/95 backdrop-blur-md border border-navy-700/80 p-1 rounded-xl shadow-lg flex-shrink-0">
          <div className="px-2 py-0.5 flex items-center gap-1.5 text-white font-mono font-bold text-xs border-r border-navy-700/80">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse flex-shrink-0" />
            <span className="hidden xl:inline">Tactical Geospatial Command Center</span>
            <span className="xl:hidden hidden sm:inline">Tactical Command</span>
            <span className="sm:hidden">GIS</span>
            {geoRes?.resolvedDistrict && (
              <span className="text-[10px] text-emerald-400 font-normal hidden 2xl:inline">
                ({geoRes.resolvedDistrict})
              </span>
            )}
          </div>

          {/* Collapsible Layers Sidebar Toggle */}
          <button
            onClick={() => setShowLayerSidebar(!showLayerSidebar)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 ${
              showLayerSidebar
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-navy-800 text-slate-300 hover:text-white'
            }`}
            title="Toggle Geospatial Layers Sidebar"
            aria-label="Toggle Geospatial Layers Sidebar"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">LAYERS</span>
          </button>

          {/* Operational Sector Segmented Control */}
          <div className="flex items-center gap-0.5 pl-1 border-l border-navy-700/80 flex-shrink-0">
            <span className="text-[9px] font-mono text-slate-400 uppercase px-1 hidden lg:inline">SECTORS:</span>
            {SECTOR_QUICK_JUMPS.map((sec) => (
              <button
                key={sec.name}
                onClick={() => onSelectLocation(sec)}
                className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                  location.name === sec.name
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-navy-800'
                }`}
                title={sec.name}
              >
                <span className="hidden md:inline">{sec.label}</span>
                <span className="md:hidden">{sec.code}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Warnings, Cesium 3D Shortcut, and Telemetry Toggle */}
        <div className="pointer-events-auto flex items-center gap-1.5 flex-nowrap flex-shrink-0">
          {/* Official Warning Entry Point Banner */}
          {hasActiveAlert ? (
            <button
              onClick={() => onSelectTab && onSelectTab('alerts')}
              className="bg-red-950/90 border border-red-500/80 hover:bg-red-900/90 text-red-200 px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg transition-all animate-pulse cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Click to view full official warnings in Alerts page"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="hidden sm:inline">{officialAlerts.length} ACTIVE WARNING</span>
              <span className="sm:hidden">{officialAlerts.length} ALERTS</span>
            </button>
          ) : (
            <div className="bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 px-2.5 py-1 rounded-xl text-xs font-mono flex items-center gap-1.5 shadow-md hidden lg:flex flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[10px] whitespace-nowrap">IMD NOWCAST: NO ACTIVE WARNINGS</span>
            </div>
          )}

          {/* Cesium 3D Globe Shortcut */}
          {hasCesiumPermission && onSelectTab && (
            <button
              onClick={() => onSelectTab('command3d')}
              className="bg-navy-900/90 hover:bg-navy-800 border border-navy-700 text-amber-300 px-2.5 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Switch to Cesium 3D Global Visualization"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="hidden sm:inline">CESIUM 3D</span>
            </button>
          )}

          {/* Forecast Impact Intelligence Dashboard Toggle */}
          <button
            onClick={() => setShowImpactDashboard(!showImpactDashboard)}
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer flex-shrink-0 ${
              showImpactDashboard
                ? 'bg-teal-900/80 border-teal-500 text-teal-300 shadow-md ring-1 ring-teal-500/50'
                : 'bg-navy-900/90 border-navy-700 text-slate-300 hover:text-teal-300'
            }`}
            title="Toggle district-level forecast impact intelligence dashboard"
            aria-label="Toggle district-level forecast impact intelligence dashboard"
          >
            <FileText className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="hidden sm:inline">IMPACT ANALYSIS</span>
          </button>

          {/* Telemetry Details Panel Toggle */}
          <button
            onClick={() => setShowDetailsPanel(!showDetailsPanel)}
            className={`px-2.5 py-1 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer flex-shrink-0 ${
              showDetailsPanel
                ? 'bg-navy-800 border-navy-700 text-amber-400 shadow-md'
                : 'bg-navy-900/90 border-navy-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle contextual telemetry panel"
            aria-label="Toggle contextual telemetry panel"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="hidden sm:inline">TELEMETRY</span>
          </button>
        </div>
      </header>

      {/* 2. FULL-SCREEN MAPLIBRE CANVAS (MAP IS THE PRIMARY FOCUS) */}
      <main className="w-full h-full relative flex-1">
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
          satelliteOpacity={satelliteOpacity}
          showSatellite={showSatellite}
          onToggleSatellite={setShowSatellite}
          satelliteProductKey={activeSatelliteProductKey}
          activeSatelliteTileUrl={activeSatTileUrl}
          preloadSatelliteTileUrl={preloadSatTileUrl}
          activeSatelliteTimestamp={activeSatFrame?.time ?? null}
          showSimulation={showSimulation}
          simulationGeojson={simulationData?.geojson ?? simulationData?.contours ?? null}
          simulationMeta={simulationData?.metadata ?? null}
          onToggleSimulation={handleToggleSimulation}
          activeRadarTileUrl={activeFrame?.tileUrl ?? null}
          activeRadarTimestamp={activeFrame?.time ?? null}
          // Forecast Props (Phase 3C Unified Integration)
          showForecast={isAnyForecastScalarActive}
          forecastProduct={activeForecastProduct}
          forecastTimestepIndex={forecastTimestepIndex}
          forecastOpacity={forecastOpacity}
          forecastGridData={forecastGridData}
          onToggleForecast={setShowPrecipLayer}
          showPressureContours={showPressureLayer}
          pressureContourInterval={pressureContourInterval}
          onTogglePressureContours={setShowPressureLayer}
          showWindParticles={showWindLayer}
          windParticleDensity={windParticleDensity}
          windSpeedMultiplier={windSpeedMultiplier}
          isWindPlaying={true}
          onToggleWindParticles={setShowWindLayer}
          onChangeWindSpeedMultiplier={setWindSpeedMultiplier}
          onChangeWindParticleDensity={setWindParticleDensity}
          // Phase 3D-2B District Forecast Impact Integration
          showDistrictImpact={showDistrictImpactLayer}
          districtImpactResponse={districtImpactResponse}
          selectedImpactDistrict={selectedDistrictName}
          districtImpactOpacity={districtImpactOpacity}
          onSelectImpactDistrict={(districtName) => {
            setSelectedDistrictName(districtName);
            setShowImpactDashboard(true);
          }}
          variant="full"
          hideDefaultControls={true}
          className="w-full h-full min-h-full rounded-none border-none"
        />
      </main>

      {/* 3. MODULAR LEFT LAYER SIDEBAR (THREE INTELLIGENCE SYSTEMS) */}
      <LayerSidebar
        isOpen={showLayerSidebar}
        onClose={() => setShowLayerSidebar(false)}
        showRadar={showRadar}
        onToggleRadar={setShowRadar}
        radarOpacity={radarOpacity}
        onChangeRadarOpacity={setRadarOpacity}
        showSatellite={showSatellite}
        onToggleSatellite={setShowSatellite}
        satelliteOpacity={satelliteOpacity}
        onChangeSatelliteOpacity={setSatelliteOpacity}
        satelliteMode={satelliteMode}
        onChangeSatelliteMode={setSatelliteMode}
        satelliteChannel={satelliteChannel}
        onChangeSatelliteChannel={setSatelliteChannel}
        hdProduct={hdProduct}
        onChangeHDProduct={setHdProduct}
        activeSectorName={location.name}
        showPrecipLayer={showPrecipLayer}
        onTogglePrecipLayer={setShowPrecipLayer}
        showWindLayer={showWindLayer}
        onToggleWindLayer={setShowWindLayer}
        showTempLayer={showTempLayer}
        onToggleTempLayer={setShowTempLayer}
        showHumidityLayer={showHumidityLayer}
        onToggleHumidityLayer={setShowHumidityLayer}
        showPressureLayer={showPressureLayer}
        onTogglePressureLayer={setShowPressureLayer}
        // Phase 3C Forecast additions
        forecastGrid={forecastGridData}
        forecastTimestepIndex={forecastTimestepIndex}
        forecastOpacity={forecastOpacity}
        onChangeForecastOpacity={setForecastOpacity}
        pressureContourInterval={pressureContourInterval}
        onChangePressureContourInterval={setPressureContourInterval}
        windParticleDensity={windParticleDensity}
        onChangeWindParticleDensity={setWindParticleDensity}
        onOpenForecastImpact={() => setShowImpactDashboard(true)}
        // Phase 3D-2B District Forecast Impact additions
        showDistrictImpactLayer={showDistrictImpactLayer}
        onToggleDistrictImpactLayer={setShowDistrictImpactLayer}
        districtImpactOpacity={districtImpactOpacity}
        onChangeDistrictImpactOpacity={setDistrictImpactOpacity}
        isAuthorizedForSimulation={isAuthorized}
        userRole={user?.role}
        showSimulation={showSimulation}
        onToggleSimulation={handleToggleSimulation}
        simulationLoading={simulationLoading}
        simulationError={simulationError}
        simulationData={simulationData}
        onFocusAdyarReach={handleFocusAdyarReach}
        showVulnerabilityPoints={showVulnerabilityPoints}
        onToggleVulnerabilityPoints={setShowVulnerabilityPoints}
        showFacilities={showFacilities}
        onToggleFacilities={setShowFacilities}
      />

      {/* 4. MODULAR CONTEXTUAL TELEMETRY DRAWER (RIGHT PANEL) */}
      <TelemetryDrawer
        location={location}
        weather={weather}
        forecast={forecast}
        riskAssessment={riskAssessment}
        isOpen={showDetailsPanel}
        onClose={() => setShowDetailsPanel(false)}
      />

      {/* 5. DYNAMIC CONTEXTUAL LEGEND (BOTTOM-RIGHT, NEVER OVERLAPS TIMELINE) */}
      <div className="absolute bottom-14 right-3 z-20">
        <WeatherLegend
          showRadar={showRadar}
          showSatellite={showSatellite}
          satelliteProductKey={activeSatelliteProductKey}
          showSimulation={showSimulation}
          activeForecastLayer={activeForecastLegend}
          showDistrictImpact={showDistrictImpactLayer}
          isNationalMode={districtImpactResponse?.metadata?.mode === 'national'}
        />
      </div>

      {/* 6. MODULAR BOTTOM TIMELINE & PLAYBACK CONTROLS (COMPACT PILL) */}
      <div className="absolute bottom-2.5 left-3 right-3 z-20 pointer-events-none flex justify-center">
        <MapTimeline
          timeline={timeline}
          activeFrameIndex={activeFrameIndex}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onTogglePlay={() => {
            if (!timeline || timeline.radarFrames.length === 0) return;
            setIsPlaying(!isPlaying);
          }}
          onStepBack={() => {
            if (!timeline || timeline.radarFrames.length === 0) return;
            setIsPlaying(false);
            setActiveFrameIndex((prev) => Math.max(0, prev - 1));
          }}
          onStepForward={() => {
            if (!timeline || timeline.radarFrames.length === 0) return;
            setIsPlaying(false);
            setActiveFrameIndex((prev) => Math.min(timeline.radarFrames.length - 1, prev + 1));
          }}
          onSeek={(idx) => {
            setIsPlaying(false);
            setActiveFrameIndex(idx);
          }}
          onChangeSpeed={setPlaybackSpeed}

          satelliteTimeline={satelliteTimeline}
          activeSatelliteFrameIndex={activeSatFrameIndex}
          isSatellitePlaying={isSatPlaying}
          satellitePlaybackSpeed={satPlaybackSpeed}
          activeDriver={activeTimelineDriver}
          onChangeDriver={setActiveTimelineDriver}
          onToggleSatellitePlay={() => {
            if (!satelliteTimeline || satelliteTimeline.frames.length <= 1) return;
            setIsSatPlaying(!isSatPlaying);
          }}
          onStepBackSatellite={() => {
            if (!satelliteTimeline || satelliteTimeline.frames.length <= 1) return;
            setIsSatPlaying(false);
            setActiveSatFrameIndex((prev) => Math.max(0, prev - 1));
          }}
          onStepForwardSatellite={() => {
            if (!satelliteTimeline || satelliteTimeline.frames.length <= 1) return;
            setIsSatPlaying(false);
            setActiveSatFrameIndex((prev) => Math.min(satelliteTimeline.frames.length - 1, prev + 1));
          }}
          onSeekSatellite={(idx) => {
            setIsSatPlaying(false);
            setActiveSatFrameIndex(idx);
          }}
          onChangeSatelliteSpeed={setSatPlaybackSpeed}
          isHDMode={satelliteMode === 'hd'}
          hdProductName={SATELLITE_PRODUCTS[activeSatelliteProductKey]?.shortLabel}
          hdCompositeDate={getLatestCompletedCompositeDate()}
          showRadar={showRadar}
          showSatellite={showSatellite}

          // Phase 3C Unified Forecast Timeline additions
          forecastGrid={forecastGridData}
          activeForecastTimestepIndex={forecastTimestepIndex}
          isForecastPlaying={isForecastPlaying}
          forecastPlaybackSpeed={forecastPlaybackSpeed}
          onToggleForecastPlay={() => {
            setIsForecastPlaying(!isForecastPlaying);
          }}
          onStepBackForecast={() => {
            setIsForecastPlaying(false);
            setForecastTimestepIndex((prev) => Math.max(0, prev - 1));
          }}
          onStepForwardForecast={() => {
            setIsForecastPlaying(false);
            const maxIdx = (forecastGridData?.nodes?.[0]?.hourly?.length || 72) - 1;
            setForecastTimestepIndex((prev) => Math.min(maxIdx, prev + 1));
          }}
          onSeekForecast={(idx) => {
            setIsForecastPlaying(false);
            setForecastTimestepIndex(idx);
          }}
          onChangeForecastSpeed={setForecastPlaybackSpeed}
          timelineMode={timelineMode}
          onChangeTimelineMode={setTimelineMode}
          hasActiveForecastLayer={hasActiveForecastLayer}
        />
      </div>

      {/* 7. FORECAST IMPACT INTELLIGENCE DASHBOARD (DRAWER) */}
      <ForecastImpactDashboard
        isOpen={showImpactDashboard}
        onClose={() => setShowImpactDashboard(false)}
        activeSectorKey={getNearestSectorKey(location.lat, location.lon)}
        selectedDistrict={selectedDistrictName}
        onDataLoaded={handleImpactDataLoaded}
        onSelectSector={(sectorKey) => {
          setSelectedDistrictName(null);
          const jump = SECTOR_QUICK_JUMPS.find((j) => {
            if (sectorKey === 'mumbai') return j.code === 'MUM';
            if (sectorKey === 'chennai') return j.code === 'CHE';
            if (sectorKey === 'guwahati') return j.code === 'GHY';
            if (sectorKey === 'dehradun') return j.code === 'DED';
            if (sectorKey === 'kolkata') return j.code === 'CCU';
            return false;
          });
          if (jump) {
            onSelectLocation({ name: jump.name, lat: jump.lat, lon: jump.lon });
          }
        }}
        onSelectDistrict={(districtName) => {
          setSelectedDistrictName(districtName);
        }}
      />
    </div>
  );
};
