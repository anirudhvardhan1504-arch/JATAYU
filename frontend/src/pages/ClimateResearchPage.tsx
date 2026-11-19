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
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>Atmospheric Reanalysis & Hydrological Modeling</span>
          </div>
          <h1 className="text-2xl font-bold text-jatayu-primary tracking-tight mt-1 font-sans">
            {t('research.pageTitle')}
          </h1>
          <p className="text-xs text-jatayu-secondary mt-0.5 font-sans">
            {t('research.pageSubtitle')} • Current Target: {location.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onLaunch3DGlobe && (
            <button
              onClick={onLaunch3DGlobe}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center gap-2 shadow-[0_0_12px_rgba(0,217,154,0.3)] transition-colors cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Launch 3D Earth Globe</span>
            </button>
          )}

          <button
            onClick={exportResearchBrief}
            disabled={!historicalData}
            className="px-3.5 py-2 bg-surface-secondary hover:bg-white/10 text-jatayu-primary border border-white/10 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('research.exportBrief')}</span>
          </button>
        </div>
      </div>

      {/* Preset Storm Event Selector */}
      <div className="bento-card p-5 space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-jatayu-secondary flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Historical Severe Weather Events (Copernicus ERA5)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {HISTORICAL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedPreset.id === preset.id
                  ? 'bg-emerald-950/50 border-emerald-400 shadow-glow-emerald'
                  : 'bg-surface-secondary/80 hover:bg-surface-secondary border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-jatayu-primary">
                  {preset.name}
                </span>
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40">
                  {preset.date}
                </span>
              </div>
              <p className="text-xs text-jatayu-secondary mt-1.5 line-clamp-2 font-sans">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('historical')}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'historical'
              ? 'border-emerald-400 text-jatayu-accent font-bold'
              : 'border-transparent text-jatayu-muted hover:text-jatayu-primary'
          }`}
        >
          <CloudRain className="w-4 h-4" />
          <span>{t('research.tabHistorical')}</span>
        </button>

        <button
          onClick={() => setActiveTab('satellite')}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'satellite'
              ? 'border-emerald-400 text-jatayu-accent font-bold'
              : 'border-transparent text-jatayu-muted hover:text-jatayu-primary'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>{t('research.tabSatellite')}</span>
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'radar'
              ? 'border-emerald-400 text-jatayu-accent font-bold'
              : 'border-transparent text-jatayu-muted hover:text-jatayu-primary'
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
            <div className="bento-card p-5">
              <span className="text-[11px] font-medium text-jatayu-muted uppercase tracking-wider">
                Event Rainfall Total
              </span>
              <div className="text-2xl font-extrabold text-jatayu-primary mt-1 font-mono">
                {historicalData ? `${historicalData.eventAccumulationMm} mm` : '--'}
              </div>
              <div className="text-xs text-jatayu-secondary mt-0.5">
                {selectedPreset.startDate} to {selectedPreset.endDate}
              </div>
            </div>

            <div className="bento-card p-5">
              <span className="text-[11px] font-medium text-jatayu-muted uppercase tracking-wider">
                Peak Daily Rainfall
              </span>
              <div className="text-2xl font-extrabold text-jatayu-accent mt-1 font-mono">
                {historicalData ? `${historicalData.peakDailyRainMm} mm` : '--'}
              </div>
              <div className="text-xs text-jatayu-secondary mt-0.5">
                Single-day maximum reanalysis value
              </div>
            </div>

            <div className="bento-card p-5">
              <span className="text-[11px] font-medium text-jatayu-muted uppercase tracking-wider">
                Dataset Provenance
              </span>
              <div className="text-sm font-bold text-jatayu-primary mt-1">
                Copernicus ERA5 Reanalysis
              </div>
              <div className="text-xs text-jatayu-secondary mt-0.5 font-sans">
                ECMWF Global Climate Model ~30km resolution
              </div>
            </div>
          </div>

          {/* Chart Card */}
          <div className="bento-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-jatayu-primary">
                  Daily Precipitation & Temperature Accumulation Series
                </h3>
                <p className="text-xs text-jatayu-secondary font-sans">
                  {selectedPreset.center.name} ({selectedPreset.center.lat}°N, {selectedPreset.center.lon}°E)
                </p>
              </div>

              {isLoadingHistory && (
                <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading ERA5 reanalysis...</span>
                </div>
              )}
            </div>

            {historyError ? (
              <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center justify-between">
                <span>{historyError}</span>
                <button
                  onClick={() => loadHistoricalSeries(selectedPreset)}
                  className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-500 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#B5C5BF' }} stroke="rgba(255,255,255,0.15)" />
                    <YAxis tick={{ fontSize: 11, fill: '#B5C5BF' }} unit="mm" stroke="rgba(255,255,255,0.15)" />
                    <Tooltip
                      formatter={(val: any) => [`${val} mm`, 'Rainfall']}
                      contentStyle={{ backgroundColor: '#101A17', borderColor: 'rgba(255,255,255,0.15)', color: '#F0F7F4', borderRadius: '12px', fontSize: '11px' }}
                    />
                    <Bar dataKey="precipitation" fill="#42F5B0" radius={[4, 4, 0, 0]} name="Precipitation (mm)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: NASA Satellite Cloud True-Color Composite */}
      {activeTab === 'satellite' && (
        <div className="bento-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-jatayu-primary">
                NASA GIBS MODIS Terra Daily True-Color Cloud Imagery
              </h3>
              <p className="text-xs text-jatayu-secondary font-sans">
                Optical cloud composite for {selectedPreset.date} • Imagery © NASA GIBS / EOSDIS
              </p>
            </div>
            <span className="px-2.5 py-1 bg-surface-secondary text-jatayu-secondary border border-white/10 rounded-lg text-xs font-mono">
              Sensor: MODIS Terra (Corrected Reflectance)
            </span>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-white/10 bg-obsidian flex items-center justify-center min-h-[350px]">
            <img
              src={nasaGibsUrl}
              alt={`NASA MODIS satellite imagery for ${selectedPreset.name}`}
              className="w-full h-auto max-h-[500px] object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute bottom-3 left-3 bg-obsidian/85 backdrop-blur-md text-jatayu-primary border border-white/10 px-3 py-1.5 rounded-lg text-xs font-mono">
              Center: {selectedPreset.center.lat}°N, {selectedPreset.center.lon}°E • {selectedPreset.date}
            </div>
          </div>

          <div className="p-3.5 bg-surface-secondary border border-white/10 rounded-xl text-xs text-jatayu-secondary font-sans">
            <strong className="text-jatayu-primary">Scientific Note: </strong> True-color corrected reflectance reflects optical cloud structures and cyclonic vortices. It represents cloud top geometry, not calibrated ground precipitation depth.
          </div>
        </div>
      )}

      {/* Tab 3: RainViewer Doppler Radar */}
      {activeTab === 'radar' && (
        <div className="bento-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-jatayu-primary flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>RainViewer Doppler Radar Mosaic</span>
              </h3>
              <p className="text-xs text-jatayu-secondary font-sans">
                Ground meteorological radar composite calibrated in dBZ reflectivity
              </p>
            </div>

            {/* Persistent Temporal Status Badge */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t('research.radarLiveBadge')}</span>
              </span>

              {radarInfo?.timestamp ? (
                <span className="px-2.5 py-1 bg-surface-secondary text-jatayu-secondary rounded-lg text-xs font-mono border border-white/10">
                  {t('research.radarFrameTime')} <strong className="text-jatayu-primary">{new Date(radarInfo.timestamp * 1000).toUTCString().replace('GMT', 'UTC')}</strong>
                </span>
              ) : (
                <span className="px-2.5 py-1 bg-amber-950/60 text-amber-300 rounded-lg text-xs font-mono border border-amber-500/40">
                  {radarLoading ? t('header.sync') : t('research.radarTimeUnavailable')}
                </span>
              )}
            </div>
          </div>

          {/* Temporal Notice Warning Banner for Historical Presets */}
          <div className="p-4 bg-amber-950/30 border-l-4 border-amber-400 rounded-r-xl text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-mono font-bold text-amber-300 uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{t('research.radarHistoricalNotice')}</span>
            </div>
            <p className="text-amber-200/90 leading-relaxed font-sans text-xs">
              {t('research.radarHistoricalDesc')}{' '}
              <strong className="underline decoration-amber-400 font-bold text-white">
                {selectedPreset.name} ({selectedPreset.date})
              </strong>.
            </p>
            <p className="text-amber-300/80 font-sans text-[11px] leading-relaxed">
              {t('research.radarArchiveUnavailable')}
            </p>
          </div>

          {/* Upstream Radar Service Error if Unreachable */}
          {radarError && (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{radarError}</span>
            </div>
          )}

          {/* Main Radar Card */}
          <div className="p-8 text-center bg-surface-secondary rounded-2xl border border-white/10 space-y-3">
            <Radio className="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-jatayu-primary">
              Interactive Doppler Radar Mosaic Active
            </h4>
            <p className="text-xs text-jatayu-secondary max-w-lg mx-auto font-sans leading-relaxed">
              Real-time Doppler radar frames with interactive playback scrubber are rendered in the Tactical Map and 3D Earth Globe. Attribution: {radarInfo?.sourceAttribution || 'RainViewer Weather Radar Composite'}.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              {onLaunch3DGlobe && (
                <button
                  onClick={onLaunch3DGlobe}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-semibold rounded-xl text-xs cursor-pointer shadow-glow-emerald transition-colors flex items-center gap-1.5"
                >
                  <Globe className="w-4 h-4 text-obsidian" />
                  <span>{t('research.tab3dGlobe')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. SFINCS HYDRODYNAMIC SIMULATION QUARANTINED SECTION */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              TIER 3 RESEARCH
            </span>
            <span className="text-xs font-mono font-bold uppercase text-jatayu-primary">
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
              <div className="p-3 rounded-xl bg-obsidian/70 border border-white/10">
                <span className="text-jatayu-secondary text-[10px] block">Reach Length</span>
                <span className="text-white font-bold">28.0 km</span>
              </div>
              <div className="p-3 rounded-xl bg-obsidian/70 border border-white/10">
                <span className="text-jatayu-secondary text-[10px] block">Grid Resolution</span>
                <span className="text-white font-bold">30.0 meters</span>
              </div>
              <div className="p-3 rounded-xl bg-obsidian/70 border border-white/10">
                <span className="text-jatayu-secondary text-[10px] block">Subgrid Cells</span>
                <span className="text-white font-bold">199,287 cells</span>
              </div>
              <div className="p-3 rounded-xl bg-obsidian/70 border border-white/10">
                <span className="text-jatayu-secondary text-[10px] block">Depth Tiers</span>
                <span className="text-amber-400 font-bold">3 Classified</span>
              </div>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs text-amber-200 font-sans">
              <strong>Mandatory Safety Boundary: </strong> SFINCS inundation contours are uncalibrated computational research outputs. They are strictly quarantined from operational rescue dispatch and civilian advisory feeds.
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-obsidian/70 border border-white/10 text-xs space-y-3">
            <div className="flex items-center gap-2 text-jatayu-secondary font-sans">
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
