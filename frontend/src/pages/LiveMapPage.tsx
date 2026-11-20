import '../components/map/earth-workspace.css';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  AlertTriangle,
  Globe,
  Radio,
  MapPin,
  Cloud,
  CloudRain,
  Wind,
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
  EmergencyFacility,
} from '../types';
import { getFloodVulnerabilityPoints, FloodVulnerabilityPoint } from '../services/risk';
import { getEmergencyFacilities } from '../services/route';
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
  { name: 'Hyderabad Metropolitan Region', lat: 17.385, lon: 78.4867, label: 'Hyderabad', code: 'HYD' },
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777, label: 'Mumbai', code: 'MUM' },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707, label: 'Chennai', code: 'CHE' },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362, label: 'Assam', code: 'GHY' },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322, label: 'Dehradun', code: 'DED' },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639, label: 'Kolkata', code: 'CCU' },
];

function getNearestSectorKey(lat: number, lon: number): OperationalSectorKey {
  const sectors: { key: OperationalSectorKey; lat: number; lon: number }[] = [
    { key: 'hyderabad', lat: 17.385, lon: 78.4867 },
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

  // Drawer & Overlay Visibilities
  const [showLayerSidebar, setShowLayerSidebar] = useState(false);
  const [basemap, setBasemap] = useState<'map' | 'satellite'>('satellite');
  const [showBasemapLabels, setShowBasemapLabels] = useState(true);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
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
  const [showDistrictImpactLayer, setShowDistrictImpactLayer] = useState<boolean>(false);
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
  const [showVulnerabilityPoints, setShowVulnerabilityPoints] = useState(true);
  const [vulnerabilityPoints, setVulnerabilityPoints] = useState<FloodVulnerabilityPoint[]>([]);
  const [showFacilities, setShowFacilities] = useState(true);
  const [facilitiesList, setFacilitiesList] = useState<EmergencyFacility[]>([]);

  // Load vulnerability points on mount
  useEffect(() => {
    let isSubscribed = true;
    getFloodVulnerabilityPoints()
      .then((res) => {
        if (isSubscribed && res && res.points) {
          setVulnerabilityPoints(res.points);
        }
      })
      .catch((err) => console.warn('[LiveMapPage] Failed to load vulnerability points:', err));
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Load facilities for active location when enabled
  useEffect(() => {
    let isSubscribed = true;
    if (showFacilities) {
      getEmergencyFacilities(location.lat, location.lon, 'ALL', 35000)
        .then((res) => {
          if (isSubscribed && res && res.facilities) {
            setFacilitiesList(res.facilities);
          }
        })
        .catch((err) => console.warn('[LiveMapPage] Failed to load facilities:', err));
    }
    return () => {
      isSubscribed = false;
    };
  }, [showFacilities, location.lat, location.lon]);

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
    <div className="tactical-workspace relative w-full h-full min-h-0 flex flex-col overflow-hidden bg-obsidian select-none">
      {/* 1. TOP STREAMLINED COMMAND & INTELLIGENCE BAR (RESPONSIVE SINGLE LINE) */}
      <header className="earth-toolbar">
        <div className="earth-place"><Globe size={17}/><div><strong>Weather map</strong><span>{location.name}</span></div></div>
        <div className="earth-basemaps" aria-label="Basemap style"><button aria-pressed={basemap === 'satellite'} onClick={() => setBasemap('satellite')}>Satellite</button><button aria-pressed={basemap === 'map'} onClick={() => setBasemap('map')}>Map</button></div>
        <div className="earth-actions">
          <button aria-label="Toggle map labels" aria-pressed={showBasemapLabels} title="Place labels" onClick={() => setShowBasemapLabels(!showBasemapLabels)}><MapPin size={16}/><span>Labels</span></button>
          {hasActiveAlert && <button className="earth-warning" onClick={() => onSelectTab?.('alerts')} title="View official warnings"><AlertTriangle size={16}/><span>{officialAlerts.length} warning{officialAlerts.length !== 1 ? 's' : ''}</span></button>}
          <button aria-label="Toggle district-level forecast impact intelligence dashboard" aria-pressed={showImpactDashboard} title="District impact" onClick={() => setShowImpactDashboard(!showImpactDashboard)}><FileText size={16}/><span>Impact</span></button>
          <button aria-label="Toggle contextual telemetry panel" aria-pressed={showDetailsPanel} title="Inspect location" onClick={() => setShowDetailsPanel(!showDetailsPanel)}><Compass size={16}/><span>Inspect</span></button>
          {onSelectTab && <button title="Open 3D globe" onClick={() => onSelectTab('command3d')}><Globe size={16}/><span>3D</span></button>}
        </div>
      </header>
      <nav className="earth-toolrail" aria-label="Weather overlays">
        <button aria-label="Toggle Geospatial Layers Sidebar" title="All layers" aria-pressed={showLayerSidebar} onClick={() => setShowLayerSidebar(!showLayerSidebar)}><Layers size={19}/><span>Layers</span></button>
        <span className="earth-rail-divider"/>
        <button aria-label="Toggle radar overlay" title="Observed weather radar" aria-pressed={showRadar} onClick={() => setShowRadar(!showRadar)}><Radio size={18}/><span>Radar</span></button>
        <button aria-label="Toggle satellite clouds overlay" title="Weather satellite imagery (separate from the basemap)" aria-pressed={showSatellite} onClick={() => setShowSatellite(!showSatellite)}><Cloud size={19}/><span>Clouds</span></button>
        <button aria-label="Toggle wind overlay" title="Forecast wind" aria-pressed={showWindLayer} onClick={() => setShowWindLayer(!showWindLayer)}><Wind size={19}/><span>Wind</span></button>
        <button aria-label="Toggle rainfall forecast overlay" title="Forecast rainfall" aria-pressed={showPrecipLayer} onClick={() => setShowPrecipLayer(!showPrecipLayer)}><CloudRain size={19}/><span>Rain</span></button>
      </nav>

      {/* 2. FULL-SCREEN MAPLIBRE CANVAS (MAP IS THE PRIMARY FOCUS) */}
      <main className="w-full h-full relative flex-1">
        <TacticalMap
          center={[location.lon, location.lat]}
          zoom={7}
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
          // Intelligence Overlays (Vulnerabilities & Facilities)
          showVulnerabilityPoints={showVulnerabilityPoints}
          vulnerabilityPoints={vulnerabilityPoints}
          showFacilities={showFacilities}
          facilities={facilitiesList}
          showAlertsLayer={true}
          alerts={alertFeed?.officialAlerts}
          variant="full"
          hideDefaultControls={true}
          basemap={basemap}
          showBasemapLabels={showBasemapLabels}
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
      <div className="map-legend-position absolute bottom-14 right-3 z-20">
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
      <div className="map-timeline-position absolute bottom-2.5 left-3 right-3 z-20 pointer-events-none flex justify-center">
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
            if (sectorKey === 'hyderabad') return j.code === 'HYD';
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
