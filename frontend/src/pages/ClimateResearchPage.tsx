import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  CloudRain,
  Radio,
  Calendar,
  Download,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getHistoricalWeather, HistoricalWeatherSeries } from '../services/weather';
import { fetchAdyarSimulation, SimulationResponse } from '../services/research';
import { getLatestRadarInfo, RainViewerRadarInfo } from '../services/radar';

interface ClimateResearchPageProps {
  location: { name: string; lat: number; lon: number };
  onLaunch3DGlobe?: () => void;
  onOpenLogin?: () => void;
}

interface HistoricalPreset {
  id: string;
  name: string;
  date: string;
  startDate: string;
  endDate: string;
  center: { lat: number; lon: number; name: string };
  description: string;
}

const HISTORICAL_PRESETS: HistoricalPreset[] = [
  {
    id: 'michaung2023',
    name: '2023 Cyclone Michaung',
    date: '2023-12-04',
    startDate: '2023-12-01',
    endDate: '2023-12-06',
    center: { lat: 13.0827, lon: 80.2707, name: 'Chennai & South Coastal AP' },
    description: 'Severe cyclonic storm stalling off Coromandel coast delivering >400mm widespread precipitation.',
  },
  {
    id: 'deluge2015',
    name: '2015 Chennai Deluge',
    date: '2015-12-01',
    startDate: '2015-11-28',
    endDate: '2015-12-04',
    center: { lat: 13.0827, lon: 80.2707, name: 'Chennai Metropolitan Region' },
    description: 'Catastrophic monsoon deluge with >490mm single-day rainfall over Adyar/Chembarambakkam basin.',
  },
  {
    id: 'remal2024',
    name: '2024 Cyclone Remal',
    date: '2024-05-26',
    startDate: '2024-05-24',
    endDate: '2024-05-28',
    center: { lat: 22.5726, lon: 88.3639, name: 'Kolkata & Sundarbans Delta' },
    description: 'Severe cyclonic storm making landfall across the northern Bay of Bengal and Bengal delta.',
  },
];

export const ClimateResearchPage: React.FC<ClimateResearchPageProps> = ({
  location,
  onLaunch3DGlobe,
  onOpenLogin,
}) => {
  const { user, token, hasPermission } = useAuth();
  const { t } = useLanguage();

  const [selectedPreset, setSelectedPreset] = useState<HistoricalPreset>(HISTORICAL_PRESETS[0]);
  const [activeTab, setActiveTab] = useState<'historical' | 'satellite' | 'radar'>('historical');
  const [historicalData, setHistoricalData] = useState<HistoricalWeatherSeries | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // SFINCS simulation state for authorized roles
  const [sfincsData, setSfincsData] = useState<SimulationResponse | null>(null);
  const [sfincsLoading, setSfincsLoading] = useState<boolean>(false);
  const [sfincsError, setSfincsError] = useState<string | null>(null);

  // RainViewer radar metadata & temporal state
  const [radarInfo, setRadarInfo] = useState<RainViewerRadarInfo | null>(null);
  const [radarLoading, setRadarLoading] = useState<boolean>(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setRadarLoading(true);
    setRadarError(null);
    getLatestRadarInfo()
      .then((info) => {
        if (isMounted) {
          setRadarInfo(info);
          if (!info) {
            setRadarError(t('research.radarError'));
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setRadarError(err?.message || t('research.radarError'));
        }
      })
      .finally(() => {
        if (isMounted) setRadarLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t]);

  const isResearcher = hasPermission('command3d:view_globe');

  const loadHistoricalSeries = useCallback(async (preset: HistoricalPreset) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await getHistoricalWeather(
        preset.center.lat,
        preset.center.lon,
        preset.startDate,
        preset.endDate,
        preset.center.name
      );
      setHistoricalData(data);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to retrieve historical reanalysis series.');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistoricalSeries(selectedPreset);
  }, [selectedPreset, loadHistoricalSeries]);

  useEffect(() => {
    if (isResearcher && token && !sfincsData) {
      setSfincsLoading(true);
      fetchAdyarSimulation(token)
        .then((data) => setSfincsData(data))
        .catch((err) => setSfincsError(err.message || 'Failed to load SFINCS model'))
        .finally(() => setSfincsLoading(false));
    }
  }, [isResearcher, token, sfincsData]);

  // Format Recharts data
  const chartData = (historicalData?.daily.time || []).map((dateStr, idx) => ({
    date: dateStr,
    precipitation: historicalData?.daily.precipitationSum[idx] || 0,
    tempMax: historicalData?.daily.temperatureMax[idx] || 0,
    tempMin: historicalData?.daily.temperatureMin[idx] || 0,
  }));

  const exportResearchBrief = () => {
    if (!historicalData) return;
    const brief = `# JATAYU CLIMATE RESEARCH BRIEF
Generated: ${new Date().toISOString()}
Target Region: ${selectedPreset.center.name} (${selectedPreset.center.lat}°N, ${selectedPreset.center.lon}°E)
Event: ${selectedPreset.name} (${selectedPreset.startDate} to ${selectedPreset.endDate})
Reanalysis Dataset: Copernicus ERA5 Atmospheric Reanalysis via Open-Meteo Historical Archive

## METEOROLOGICAL METRICS
- Total Event Rainfall Accumulation: ${historicalData.eventAccumulationMm} mm
- Peak Daily Rainfall: ${historicalData.peakDailyRainMm} mm
- Observation Days: ${historicalData.daily.time.length}

## DAILY PRECIPITATION SERIES
${historicalData.daily.time
  .map(
    (d, i) =>
      `- ${d}: ${historicalData.daily.precipitationSum[i]} mm (Max: ${historicalData.daily.temperatureMax[i]}°C, Min: ${historicalData.daily.temperatureMin[i]}°C)`
  )
  .join('\n')}

## DATA PROVENANCE & LIMITATIONS
- Historical atmospheric series are model reanalysis estimates (ECMWF ERA5) at ~25-30 km spatial resolution.
- Reanalysis rainfall is not a direct gauge measurement or flood depth observation.
- Adyar SFINCS hydrodynamic simulation outputs remain designated EXPERIMENTAL_UNVALIDATED.
`;

    const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Jatayu_Research_Brief_${selectedPreset.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // NASA GIBS WMS URL for the event date
  const bbox = `${selectedPreset.center.lon - 4},${selectedPreset.center.lat - 3},${selectedPreset.center.lon + 4},${selectedPreset.center.lat + 3}`;
  const nasaGibsUrl = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&VERSION=1.3.0&FORMAT=image/jpeg&TRANSPARENT=TRUE&WIDTH=800&HEIGHT=500&CRS=EPSG:4326&BBOX=${bbox}&TIME=${selectedPreset.date}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>Atmospheric Reanalysis & Hydrological Modeling</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight mt-1">
            {t('research.pageTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            {t('research.pageSubtitle')} • Current Target: {location.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onLaunch3DGlobe && (
            <button
              onClick={onLaunch3DGlobe}
              className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-xs font-medium flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Launch 3D Earth Globe</span>
            </button>
          )}

          <button
            onClick={exportResearchBrief}
            disabled={!historicalData}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('research.exportBrief')}</span>
          </button>
        </div>
      </div>

      {/* Preset Storm Event Selector */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>Historical Severe Weather Events (Copernicus ERA5)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HISTORICAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                selectedPreset.id === preset.id
                  ? 'bg-indigo-50/70 border-indigo-500 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-navy-900 font-mono">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono text-indigo-600 bg-white px-1.5 py-0.5 rounded border border-indigo-200">
                  {preset.date}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 font-sans">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('historical')}
          className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'historical'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CloudRain className="w-4 h-4" />
          <span>{t('research.tabHistorical')}</span>
        </button>

        <button
          onClick={() => setActiveTab('satellite')}
          className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'satellite'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t('research.tabSatellite')}</span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`pb-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'radar'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>{t('research.tabRadar')}</span>
        </button>
      </div>

      {/* Tab 1: Historical Rainfall Time-Series Chart */}
      {activeTab === 'historical' && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase">
                Event Rainfall Total
              </span>
              <div className="text-2xl font-extrabold text-navy-900 mt-1">
                {historicalData ? `${historicalData.eventAccumulationMm} mm` : '--'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedPreset.startDate} to {selectedPreset.endDate}
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase">
                Peak Daily Rainfall
              </span>
              <div className="text-2xl font-extrabold text-blue-600 mt-1">
                {historicalData ? `${historicalData.peakDailyRainMm} mm` : '--'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Single-day maximum reanalysis value
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-mono font-medium text-slate-500 uppercase">
                Dataset Provenance
              </span>
              <div className="text-xs font-bold text-navy-900 mt-1">
                Copernicus ERA5 Reanalysis
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-sans">
                ECMWF Global Climate Model ~30km resolution
              </div>
            </div>
          </div>

          {/* Chart Card */}
          <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-navy-900">
                  Daily Precipitation & Temperature Accumulation Series
                </h3>
                <p className="text-xs text-slate-500 font-sans">
                  {selectedPreset.center.name} ({selectedPreset.center.lat}°N, {selectedPreset.center.lon}°E)
                </p>
              </div>

              {isLoadingHistory && (
                <div className="text-xs font-mono text-indigo-600 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading ERA5 reanalysis...</span>
                </div>
              )}
            </div>

            {historyError ? (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
                <span>{historyError}</span>
                <button
                  onClick={() => loadHistoricalSeries(selectedPreset)}
                  className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="mm" />
                    <Tooltip
                      formatter={(val: any) => [`${val} mm`, 'Rainfall']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey="precipitation" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Precipitation (mm)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: NASA Satellite Cloud True-Color Composite */}
      {activeTab === 'satellite' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-navy-900">
                NASA GIBS MODIS Terra Daily True-Color Cloud Imagery
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Optical cloud composite for {selectedPreset.date} • Imagery © NASA GIBS / EOSDIS
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded text-[11px] font-mono">
              Sensor: MODIS Terra (Corrected Reflectance)
            </span>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-slate-900 flex items-center justify-center min-h-[350px]">
            <img
              src={nasaGibsUrl}
              alt={`NASA MODIS satellite imagery for ${selectedPreset.name}`}
              className="w-full h-auto max-h-[500px] object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute bottom-3 left-3 bg-navy-950/80 backdrop-blur-sm text-white px-3 py-1.5 rounded text-[11px] font-mono">
              Center: {selectedPreset.center.lat}°N, {selectedPreset.center.lon}°E • {selectedPreset.date}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 font-sans">
            <strong>Scientific Note: </strong> True-color corrected reflectance reflects optical cloud structures and cyclonic vortices. It represents cloud top geometry, not calibrated ground precipitation depth.
          </div>
        </div>
      )}

      {/* Tab 3: RainViewer Doppler Radar */}
      {activeTab === 'radar' && (
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-navy-900 flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>RainViewer Doppler Radar Mosaic</span>
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Ground meteorological radar composite calibrated in dBZ reflectivity
              </p>
            </div>

            {/* Persistent Temporal Status Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{t('research.radarLiveBadge')}</span>
              </span>

              {radarInfo?.timestamp ? (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded text-xs font-mono border border-slate-200">
                  {t('research.radarFrameTime')} <strong className="text-navy-900">{new Date(radarInfo.timestamp * 1000).toUTCString().replace('GMT', 'UTC')}</strong>
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded text-xs font-mono border border-amber-200">
                  {radarLoading ? t('header.sync') : t('research.radarTimeUnavailable')}
                </span>
              )}
            </div>
          </div>

          {/* Temporal Notice Warning Banner for Historical Presets */}
          <div className="p-4 bg-amber-50/90 border-l-4 border-amber-500 rounded-r-lg text-xs space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 font-mono font-bold text-amber-900 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{t('research.radarHistoricalNotice')}</span>
            </div>
            <p className="text-amber-900 leading-relaxed font-sans text-xs">
              {t('research.radarHistoricalDesc')}{' '}
              <strong className="underline decoration-amber-400 font-bold text-navy-900">
                {selectedPreset.name} ({selectedPreset.date})
              </strong>.
            </p>
            <p className="text-amber-800 font-sans text-[11px] leading-relaxed">
              {t('research.radarArchiveUnavailable')}
            </p>
          </div>

          {/* Upstream Radar Service Error if Unreachable */}
          {radarError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{radarError}</span>
            </div>
          )}

          {/* Main Radar Card */}
          <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <Radio className="w-10 h-10 text-blue-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">
              Interactive Doppler Radar Mosaic Active
            </h4>
            <p className="text-xs text-slate-600 max-w-lg mx-auto font-sans leading-relaxed">
              Real-time Doppler radar frames with interactive playback scrubber are rendered in the Tactical Map and 3D Earth Globe. Attribution: {radarInfo?.sourceAttribution || 'RainViewer Weather Radar Composite'}.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              {onLaunch3DGlobe && (
                <button
                  onClick={onLaunch3DGlobe}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white rounded text-xs font-medium cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
                >
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('research.tab3dGlobe')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. SFINCS HYDRODYNAMIC SIMULATION QUARANTINED SECTION */}
      <div className="p-6 bg-slate-900 text-slate-200 rounded-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              TIER 3 RESEARCH
            </span>
            <span className="text-xs font-mono font-bold uppercase text-white">
              Deltares SFINCS Adyar Hydrodynamic Model
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-400">
            STATUS: EXPERIMENTAL_UNVALIDATED
          </span>
        </div>

        {isResearcher ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Authenticated Researcher Access granted ({user?.role}). The SFINCS numerical solver simulates 2D overland flow, channel hypsometry, and inundation contours across the 28 km Adyar River corridor.
            </p>

            {sfincsLoading && (
              <div className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading SFINCS hydrodynamic model data...</span>
              </div>
            )}

            {sfincsError && (
              <div className="p-3 bg-red-950/40 border border-red-800 rounded text-xs text-red-300 font-mono">
                {sfincsError}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded bg-navy-950 border border-navy-800">
                <span className="text-slate-500 text-[10px] block">Reach Length</span>
                <span className="text-white font-bold">28.0 km</span>
              </div>
              <div className="p-3 rounded bg-navy-950 border border-navy-800">
                <span className="text-slate-500 text-[10px] block">Grid Resolution</span>
                <span className="text-white font-bold">30.0 meters</span>
              </div>
              <div className="p-3 rounded bg-navy-950 border border-navy-800">
                <span className="text-slate-500 text-[10px] block">Subgrid Cells</span>
                <span className="text-white font-bold">199,287 cells</span>
              </div>
              <div className="p-3 rounded bg-navy-950 border border-navy-800">
                <span className="text-slate-500 text-[10px] block">Depth Tiers</span>
                <span className="text-amber-400 font-bold">3 Classified</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded text-xs text-amber-300 font-sans">
              <strong>Mandatory Safety Boundary: </strong> SFINCS inundation contours are uncalibrated computational research outputs. They are strictly quarantined from operational rescue dispatch and civilian advisory feeds.
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-navy-950 border border-navy-800 text-xs space-y-3">
            <div className="flex items-center gap-2 text-slate-300 font-sans">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Detailed 2D hydrodynamic simulation layers and solver parameters require authorized researcher evaluation credentials.
              </span>
            </div>
            {onOpenLogin && (
              <button
                onClick={onOpenLogin}
                className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                Sign In as Local Evaluator (qa_commander)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
