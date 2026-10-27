import React, { useState } from 'react';
import {
  Compass,
  Sliders,
  ShieldAlert,
  Layers,
  CloudRain,
  AlertTriangle,
  Database,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { TacticalMap } from '../components/map/TacticalMap';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import { AuthContext } from '../context/AuthContext';
import { fetchAdyarSimulation, SimulationResponse, isGeoJSONFeatureCollection } from '../services/research';
import {
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
  isLoading = false,
}) => {
  const auth = React.useContext(AuthContext);
  const user = auth?.user ?? null;
  const token = auth?.token ?? null;
  const isAuthorized = Boolean(user && ['RESEARCHER', 'GOVERNMENT', 'ADMIN'].includes(user.role));

  const [radarOpacity, setRadarOpacity] = useState(80);
  const [showRadar, setShowRadar] = useState(true);

  // Hydrodynamic research simulation state
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationData, setSimulationData] = useState<SimulationResponse | null>(null);

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
      lat: 13.010,
      lon: 80.180,
    });
  };

  const rainfallMm = weather?.precipitationMm ?? 0;
  const riskLevel = riskAssessment?.overallRiskLevel ?? 'GUARDED';
  const riskScore = riskAssessment?.riskScore ?? null;
  const geoRes = alertFeed?.geographicResolution;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Tactical Geospatial Command Center"
        subtitle="MapLibre GL tactical visualization inspired by God's Eye View situational awareness"
        badge={
          <div className="flex items-center gap-2">
            <Badge variant="navy">MAPLIBRE GL JS</Badge>
            <Badge variant="cyan" size="sm">RAINVIEWER RADAR</Badge>
            {geoRes?.resolvedDistrict && (
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[10px] font-mono font-bold">
                DISTRICT: {geoRes.resolvedDistrict}
              </span>
            )}
          </div>
        }
        action={
          <div className="text-right font-mono text-[11px] text-slate-500">
            <div>COORDINATES: <strong className="text-navy-900">{location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E</strong></div>
            <div>STATUS: <strong className="text-slate-700">{isLoading ? 'FETCHING TELEMETRY...' : 'OPERATIONAL SYNC'}</strong></div>
          </div>
        }
      />

      {/* Quick Jump Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-semibold text-slate-500 uppercase mr-1">
            OPERATIONAL SECTORS:
          </span>
          {SECTOR_QUICK_JUMPS.map((sec) => (
            <button
              key={sec.name}
              onClick={() => onSelectLocation(sec)}
              className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors ${
                location.name === sec.name
                  ? 'bg-navy-900 text-white border-navy-900 font-bold shadow-sm'
                  : 'bg-warm-200 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {sec.name.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Click anywhere on map to fix arbitrary target</span>
        </div>
      </div>

      {/* Main Map Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Full Interactive Map (3 cols) */}
        <div className="lg:col-span-3 bg-navy-950 border border-slate-300 rounded overflow-hidden shadow-subtle min-h-[580px] flex flex-col">
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
            className="flex-1 w-full h-full min-h-[580px]"
          />
        </div>

        {/* Tactical Control Sidebar (1 col) */}
        <div className="space-y-4">
          {/* Active Sector Hazard Summary */}
          <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-navy-900">Active Sector Fix</h3>
              </div>
              <Badge variant="navy" size="sm">
                {location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°
              </Badge>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">TARGET:</span>
                <span className="font-semibold text-navy-900 truncate max-w-[150px]" title={location.name}>
                  {location.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">HAZARD TIER:</span>
                <span
                  className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                    riskLevel === 'CRITICAL'
                      ? 'bg-red-100 text-red-800'
                      : riskLevel === 'HIGH'
                      ? 'bg-orange-100 text-orange-800'
                      : riskLevel === 'ELEVATED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {riskLevel} {riskScore !== null ? `(${riskScore}/100)` : ''}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">PRECIP RATE:</span>
                <span className="font-bold text-sky-700">
                  {weather ? `${weather.precipitationMm} ${weather.units.precipitation}` : '--'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">48h ACCUM:</span>
                <span className="text-navy-900 font-semibold">
                  {forecast
                    ? `${(forecast.accumulations.past24hRainfallMm + forecast.accumulations.next24hRainfallMm).toFixed(1)} mm`
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">SOIL MOISTURE:</span>
                <span className="text-slate-800 font-semibold">
                  {weather?.soilMoisture0To7cm !== undefined
                    ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%`
                    : forecast?.soilProfile.moisture0To7cm !== undefined
                    ? `${(forecast.soilProfile.moisture0To7cm * 100).toFixed(1)}%`
                    : 'UNAVAILABLE'}
                </span>
              </div>
            </div>

            {/* Disclaimer in sector card */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5 text-[10px] text-amber-800">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>Indicative screening assessment only — not a calibrated hydraulic flood model.</span>
            </div>
          </div>

          {/* Hydrodynamic Research Simulation Card (Data Trust Quarantined) */}
          <div className="bg-white border-2 border-amber-300 rounded p-4 shadow-subtle">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-navy-900">Hydrodynamic Simulation</h3>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono text-[10px] font-bold rounded border border-amber-300">
                RESEARCH S2
              </span>
            </div>

            {/* Amber Warning Header */}
            <div className="bg-amber-50 border border-amber-300 rounded p-2 mb-3 text-[11px] font-mono text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="leading-snug">
                <div className="font-bold text-[10px] tracking-wide text-amber-800 uppercase">
                  ⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE
                </div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  Quarantined research layer. Does not alter district emergency scores or evacuation directives.
                </div>
              </div>
            </div>

            {!isAuthorized ? (
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-700 font-semibold font-mono text-[11px]">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>ROLE ACCESS QUARANTINE</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                  The Adyar Corridor SFINCS 2D hydrodynamic simulation is restricted to{' '}
                  <strong className="text-navy-900 font-mono">RESEARCHER</strong>,{' '}
                  <strong className="text-navy-900 font-mono">GOVERNMENT</strong>, and{' '}
                  <strong className="text-navy-900 font-mono">ADMIN</strong> roles. Public citizen and responder views are quarantined to prevent operational misinterpretation.
                </p>
                <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200">
                  CURRENT TIER: <strong className="text-slate-700">{user ? `Role [${user.role}] (Restricted)` : 'Unauthenticated'}</strong>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-navy-900">
                    Adyar Corridor (S2 Baseline)
                  </span>
                  <button
                    onClick={() => handleToggleSimulation(!showSimulation)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                      showSimulation
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                        : 'bg-warm-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {showSimulation ? 'ACTIVE' : 'MUTED'}
                  </button>
                </div>

                {simulationLoading && (
                  <div className="p-2 bg-sky-50 border border-sky-200 rounded text-xs text-sky-800 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                    <span>Loading SFINCS hydrodynamic vector contours...</span>
                  </div>
                )}

                {simulationError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 font-mono">
                    {simulationError}
                  </div>
                )}

                {showSimulation && simulationData && ((simulationData.geojson?.features?.length ?? simulationData.contours?.features?.length ?? 0) === 0) && !simulationLoading && !simulationError && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-mono">
                    No inundation contour geometries found in simulation dataset.
                  </div>
                )}

                {/* Depth Band Color Legend */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200">
                  <div className="text-[10px] font-mono font-bold text-slate-600 uppercase">
                    HYDRAULIC DEPTH CLASSIFICATION
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between p-1 rounded bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded bg-[#FEF08A] border border-amber-300 flex-shrink-0" />
                        <span>Shallow Ponding</span>
                      </div>
                      <span className="text-slate-600 font-semibold">0.10 - 0.50 m</span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded bg-[#FB923C] border border-orange-500 flex-shrink-0" />
                        <span>Moderate Depth</span>
                      </div>
                      <span className="text-slate-600 font-semibold">0.50 - 1.50 m</span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded bg-[#DC2626] border border-red-700 flex-shrink-0" />
                        <span>Critical Hazard</span>
                      </div>
                      <span className="text-slate-600 font-semibold">&gt; 1.50 m</span>
                    </div>
                  </div>
                </div>

                {/* Model Metadata Summary */}
                <div className="pt-2 border-t border-slate-200 space-y-1 text-[10px] font-mono text-slate-600">
                  <div className="flex justify-between">
                    <span>SOLVER ENGINE:</span>
                    <strong className="text-slate-800">SFINCS v2.5.0-alpha</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>REACH LENGTH:</span>
                    <strong className="text-slate-800">28.01 km Continuous</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>INUNDATION AREA:</span>
                    <strong className="text-slate-800">8.61 km² (Peak)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>DATA TRUST TIER:</span>
                    <strong className="text-amber-700">EXPERIMENTAL_UNVALIDATED</strong>
                  </div>
                </div>

                {/* Quick focus reach button */}
                <button
                  onClick={handleFocusAdyarReach}
                  className="w-full mt-2 py-1.5 px-3 bg-navy-900 hover:bg-navy-800 text-white font-mono text-xs font-semibold rounded flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  <span>FOCUS ADYAR CORRIDOR</span>
                </button>
              </div>
            )}
          </div>

          {/* Radar Imagery Controls */}
          <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-navy-900">Radar Layer Parameters</h3>
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-500">
                {showRadar ? 'ACTIVE' : 'MUTED'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono text-slate-500 mb-1">
                  <span>RADAR OPACITY:</span>
                  <span className="font-bold text-navy-900">{radarOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={radarOpacity}
                  onChange={(e) => setRadarOpacity(Number(e.target.value))}
                  disabled={!showRadar}
                  className="w-full accent-navy-900 cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 space-y-1">
                <div className="font-mono font-semibold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-blue-600" />
                  <span>Verified Radar Feed</span>
                </div>
                <p className="leading-relaxed text-[10px]">
                  Global RainViewer composite raster tiles synchronized with MapLibre WebGL canvas.
                </p>
              </div>
            </div>
          </div>

          {/* Meteorological Analysis Attribution */}
          <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle text-xs font-mono space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-navy-900 text-[11px] pb-1 border-b border-slate-100">
              <CloudRain className="w-3.5 h-3.5 text-sky-600" />
              <span>DATA PROVENANCE</span>
            </div>
            <div className="text-[11px] space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>RADAR:</span>
                <strong className="text-slate-800">RainViewer API</strong>
              </div>
              <div className="flex justify-between">
                <span>NWP MODEL:</span>
                <strong className="text-slate-800">{forecast?.dataSource.model || 'ECMWF / DWD ICON'}</strong>
              </div>
              <div className="flex justify-between">
                <span>PROVIDER:</span>
                <strong className="text-slate-800">{weather?.sourceAttribution.split(' ')[0] || 'Open-Meteo'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
