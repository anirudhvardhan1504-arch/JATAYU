import React, { useState, useMemo } from 'react';
import {
  CloudRain,
  Wind,
  Gauge,
  Droplets,
  Clock,
  Compass,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Info,
  Layers,
  Sun,
  Cloud,
  CloudLightning,
  CloudDrizzle,
  CloudSnow,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  NavigationTab,
  CurrentWeatherObservation,
  WeatherForecastResponse,
  AlertFeedResponse,
} from '../types';
import { Badge } from '../components/common/Badge';
import { Luxury3DIcon } from '../components/common/Luxury3DIcon';

interface ForecastPageProps {
  location: { name: string; lat: number; lon: number };
  onSelectLocation?: (loc: { name: string; lat: number; lon: number }) => void;
  weather: CurrentWeatherObservation | null;
  forecast: WeatherForecastResponse | null;
  alertFeed?: AlertFeedResponse | null;
  isLoading?: boolean;
  error?: string | null;
  onSelectTab: (tab: NavigationTab) => void;
  onRetry?: () => void;
}

const PRESET_SECTORS = [
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362 },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639 },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322 },
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.209 },
  { name: 'Bengaluru Urban', lat: 12.9716, lon: 77.5946 },
];

function getWeatherIcon(code: number, rainMm = 0) {
  if (code >= 95) return <CloudLightning className="w-6 h-6 text-amber-500" />;
  if (code >= 71) return <CloudSnow className="w-6 h-6 text-sky-300" />;
  if (code >= 61 || rainMm > 2) return <CloudRain className="w-6 h-6 text-blue-500" />;
  if (code >= 51 || rainMm > 0) return <CloudDrizzle className="w-6 h-6 text-sky-400" />;
  if (code >= 1 && code <= 3) return <Cloud className="w-6 h-6 text-slate-400" />;
  return <Sun className="w-6 h-6 text-amber-400" />;
}

export const ForecastPage: React.FC<ForecastPageProps> = ({
  location,
  onSelectLocation,
  weather,
  forecast,
  alertFeed,
  isLoading: _isLoading = false,
  error = null,
  onSelectTab,
  onRetry,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'temp' | 'precip' | 'wind'>('temp');
  const [selectedHourlyRange, setSelectedHourlyRange] = useState<24 | 48>(24);

  const officialAlerts = alertFeed?.officialAlerts || [];

  // Aggregate daily forecast from hourly data points
  const dailyForecast = useMemo(() => {
    if (!forecast?.hourly || forecast.hourly.length === 0) return [];

    const grouped: Record<
      string,
      {
        date: string;
        dayName: string;
        temps: number[];
        rainTotal: number;
        maxPrecipProb: number;
        windMax: number;
        weatherCodes: number[];
      }
    > = {};

    forecast.hourly.forEach((h) => {
      const d = new Date(h.time);
      const dateKey = d.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        const isToday = new Date().toISOString().split('T')[0] === dateKey;
        const dayName = isToday
          ? 'Today'
          : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        grouped[dateKey] = {
          date: dateKey,
          dayName,
          temps: [],
          rainTotal: 0,
          maxPrecipProb: 0,
          windMax: 0,
          weatherCodes: [],
        };
      }
      grouped[dateKey].temps.push(h.temperatureC);
      grouped[dateKey].rainTotal += h.precipitationMm || 0;
      grouped[dateKey].maxPrecipProb = Math.max(
        grouped[dateKey].maxPrecipProb,
        h.precipitationProbabilityPercent || 0
      );
      grouped[dateKey].windMax = Math.max(grouped[dateKey].windMax, h.windSpeedKmh || 0);
    });

    return Object.values(grouped).map((day) => {
      const minTemp = day.temps.length ? Math.min(...day.temps) : 0;
      const maxTemp = day.temps.length ? Math.max(...day.temps) : 0;
      return {
        ...day,
        minTemp: Math.round(minTemp),
        maxTemp: Math.round(maxTemp),
        rainTotal: parseFloat(day.rainTotal.toFixed(1)),
      };
    });
  }, [forecast]);

  // Hourly chart data
  const chartData = useMemo(() => {
    if (!forecast?.hourly) return [];
    return forecast.hourly.slice(0, selectedHourlyRange).map((h) => {
      const d = new Date(h.time);
      return {
        time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullTime: d.toLocaleTimeString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
        temperature: h.temperatureC,
        rainMm: h.precipitationMm,
        rainProb: h.precipitationProbabilityPercent,
        windSpeed: h.windSpeedKmh,
        windGusts: h.windGustsKmh,
        humidity: h.relativeHumidityPercent,
        pressure: h.surfacePressureHpa,
      };
    });
  }, [forecast, selectedHourlyRange]);

  const hourlyStrip = useMemo(() => {
    if (!forecast?.hourly) return [];
    return forecast.hourly.slice(0, 24);
  }, [forecast]);

  return (
    <div className="forecast-workspace space-y-5 pb-6 font-sans">
      {/* Top Header & Context Bar */}
      <div className="bento-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>Weather & outlook</span>
            <Badge variant="cyan" size="sm">Numerical forecast</Badge>
          </div>
          <h1 className="text-2xl font-bold text-jatayu-primary mt-1.5 flex items-center gap-2 flex-wrap">
            <span>{location.name}</span>
            <span className="text-xs font-mono font-normal text-emerald-300 px-2.5 py-0.5 bg-dark-emerald/70 rounded-lg border border-emerald-500/30">
              {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
            </span>
            {forecast?.elevation !== undefined && forecast.elevation !== null && (
              <span className="text-xs font-mono font-normal text-jatayu-secondary px-2.5 py-0.5 bg-charcoal/80 rounded-lg border border-white/10">
                Alt: {forecast.elevation}m
              </span>
            )}
          </h1>
          <p className="text-xs text-jatayu-secondary mt-1 max-w-2xl leading-relaxed">
            Hourly numerical forecasts and model-derived current conditions from Open-Meteo.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          <button
            onClick={() => onSelectTab('map')}
            className="px-4 py-2 bg-charcoal/90 hover:bg-white/10 text-jatayu-primary text-xs font-medium rounded-xl border border-white/15 shadow-subtle flex items-center gap-2 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Open Weather Map</span>
          </button>
          <button
            onClick={() => onSelectTab('alerts')}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium rounded-xl shadow-subtle flex items-center gap-2 transition-all cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{alertFeed?.feedStatus === 'LIVE_VERIFIED' ? `Official alerts (${officialAlerts.length})` : 'Warning feed unavailable'}</span>
          </button>
        </div>
      </div>

      {/* Preset Sector Quick Selectors */}
      <div className="bento-card p-3.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-mono font-semibold text-emerald-400/90 uppercase whitespace-nowrap pl-1 tracking-wider">
          REGIONAL HUBS:
        </span>
        <div className="flex items-center gap-2 flex-nowrap">
          {PRESET_SECTORS.map((s) => (
            <button
              key={s.name}
              onClick={() => onSelectLocation && onSelectLocation(s)}
              className={`px-3 py-1 text-xs font-mono rounded-xl border transition-all whitespace-nowrap cursor-pointer ${
                location.name === s.name
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold shadow-[0_0_12px_rgba(0,217,154,0.25)]'
                  : 'bg-charcoal/80 text-jatayu-secondary border-white/10 hover:border-emerald-500/30 hover:text-jatayu-primary'
              }`}
            >
              {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium transition-colors cursor-pointer"
            >
              Retry Telemetry
            </button>
          )}
        </div>
      )}

      {/* 1. CURRENT CONDITIONS HERO & METRICS GRID */}
      <div className="forecast-current-grid grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Observation Hero Card */}
        <div className="forecast-current-card bento-card p-6 relative overflow-hidden bg-gradient-to-br from-charcoal via-dark-emerald/40 to-charcoal border border-emerald-500/30 flex flex-col justify-between shadow-panel">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>CURRENT CONDITIONS</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-300/80 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30">
                {weather?.timestamp
                  ? new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Live'}
              </span>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div>
                <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white font-mono">
                  {weather ? `${weather.temperatureC}°` : '--°'}
                </div>
                <div className="text-sm font-medium text-jatayu-secondary mt-1">
                  Feels like {weather ? `${weather.apparentTemperatureC}°C` : '--'}
                </div>
              </div>
              <div className="filter drop-shadow-[0_8px_20px_rgba(0,217,154,0.3)]">
                <Luxury3DIcon type={(weather?.precipitationMm || 0) > 2 ? 'weather-storm' : 'weather-sun-cloud'} size={68} />
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="text-base font-bold text-mint capitalize">
                {weather?.weatherDescription || 'Atmospheric observation active'}
              </div>
              <div className="text-xs text-jatayu-secondary mt-1 font-sans">
                Attribution: {weather?.sourceAttribution || 'Open-Meteo High-Res IFS'}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-jatayu-secondary">
            <span>BAROMETRIC STATE</span>
            <span className="text-emerald-300 font-bold">
              {weather?.surfacePressureHpa ? `${weather.surfacePressureHpa} hPa` : 'N/A'}
            </span>
          </div>
        </div>

        {/* Detailed Metrics Grid (2 cols) */}
        <div className="forecast-metric-grid lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Rain Rate */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-cyan-400" />
                <span>Precipitation</span>
              </span>
              <span className="text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded-md font-mono font-bold">
                Rate
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {weather ? `${weather.precipitationMm} mm/h` : '--'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              Past 24h: <strong className="text-white font-mono">{forecast ? `${forecast.accumulations.past24hRainfallMm} mm` : '--'}</strong>
            </div>
          </div>

          {/* 24h & 72h Rain Accumulations */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>24h Expected</span>
              </span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-mono font-bold">
                NWP
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {forecast ? `${forecast.accumulations.next24hRainfallMm} mm` : '--'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              Next 72h: <strong className="text-white font-mono">{forecast ? `${forecast.accumulations.next72hRainfallMm} mm` : '--'}</strong>
            </div>
          </div>

          {/* Wind Speed & Gusts */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-teal-400" />
                <span>Wind & Gusts</span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {weather ? `${weather.windSpeedKmh} km/h` : '--'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              Gusts: <strong className="text-white font-mono">{weather ? `${weather.windGustsKmh} km/h` : '--'}</strong> (Dir: {weather ? `${weather.windDirectionDegrees}°` : '--'})
            </div>
          </div>

          {/* Relative Humidity */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-sky-400" />
                <span>Humidity</span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {weather ? `${weather.relativeHumidityPercent}%` : '--'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              Relative humidity
            </div>
          </div>

          {/* Surface Pressure */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-amber-400" />
                <span>Pressure</span>
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {weather ? `${weather.surfacePressureHpa} hPa` : '--'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              At local elevation
            </div>
          </div>

          {/* Soil Moisture */}
          <div className="bento-card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-secondary uppercase">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Soil Moisture</span>
              </span>
              <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-mono font-bold">
                {forecast?.soilProfile.saturationTier || 'UNKNOWN'}
              </span>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-jatayu-primary font-mono">
              {weather?.soilMoisture0To7cm !== undefined
                ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%`
                : forecast?.soilProfile.moisture0To7cm !== undefined
                ? `${(forecast.soilProfile.moisture0To7cm * 100).toFixed(1)}%`
                : 'N/A'}
            </div>
            <div className="mt-1 text-xs text-jatayu-secondary">
              Depth: 0–7cm topsoil layer
            </div>
          </div>
        </div>
      </div>

      {/* 2. HOURLY FORECAST STRIP (24 Hours) */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-jatayu-primary uppercase font-mono tracking-wider">
              Hourly outlook
            </h2>
          </div>
          <span className="text-xs font-mono text-jatayu-muted">
            Scroll horizontally for all hours
          </span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {hourlyStrip.map((h, idx) => {
            const dateObj = new Date(h.time);
            const hourLabel = idx === 0 ? 'Now' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={h.time}
                className="flex-shrink-0 w-24 p-3 rounded-xl bg-charcoal/80 border border-white/10 text-center flex flex-col items-center justify-between space-y-2 hover:border-emerald-500/40 hover:bg-white/5 transition-all shadow-xs"
              >
                <span className="text-xs font-mono font-semibold text-jatayu-secondary">{hourLabel}</span>
                <div className="my-1">{getWeatherIcon(0, h.precipitationMm)}</div>
                <div className="text-base font-extrabold text-jatayu-primary font-mono">
                  {Math.round(h.temperatureC)}°
                </div>
                {/* Rain probability bar */}
                <div className="w-full space-y-0.5">
                  <div className="flex justify-between text-[10px] font-mono text-cyan-300 font-semibold">
                    <span>Rain</span>
                    <span>{h.precipitationProbabilityPercent}%</span>
                  </div>
                  <div className="w-full bg-obsidian rounded-full h-1 overflow-hidden border border-white/5">
                    <div
                      className="bg-cyan-400 h-1 rounded-full"
                      style={{ width: `${Math.min(100, h.precipitationProbabilityPercent)}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-jatayu-muted">
                  {h.windSpeedKmh} km/h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. WEATHER TREND CHARTS (RECHARTS) */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/10 gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-jatayu-primary uppercase font-mono tracking-wider">
              Weather trends
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Chart variable tabs */}
            <div className="flex items-center bg-charcoal/90 border border-white/10 p-0.5 rounded-xl text-xs font-mono">
              <button
                onClick={() => setActiveChartTab('temp')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeChartTab === 'temp' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs' : 'text-jatayu-secondary hover:text-white'
                }`}
              >
                Temperature (°C)
              </button>
              <button
                onClick={() => setActiveChartTab('precip')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeChartTab === 'precip' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs' : 'text-jatayu-secondary hover:text-white'
                }`}
              >
                Precipitation (mm)
              </button>
              <button
                onClick={() => setActiveChartTab('wind')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  activeChartTab === 'wind' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs' : 'text-jatayu-secondary hover:text-white'
                }`}
              >
                Wind (km/h)
              </button>
            </div>

            {/* Range selector */}
            <div className="flex items-center bg-charcoal/90 border border-white/10 p-0.5 rounded-xl text-xs font-mono">
              <button
                onClick={() => setSelectedHourlyRange(24)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedHourlyRange === 24 ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40' : 'text-jatayu-secondary hover:text-white'
                }`}
              >
                24h
              </button>
              <button
                onClick={() => setSelectedHourlyRange(48)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedHourlyRange === 48 ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40' : 'text-jatayu-secondary hover:text-white'
                }`}
              >
                48h
              </button>
            </div>
          </div>
        </div>

        {/* Chart Stage */}
        <div className="h-64 sm:h-72 w-full pt-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-jatayu-muted">
              No forecast hourly telemetry available.
            </div>
          ) : activeChartTab === 'temp' ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#647D8A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#647D8A' }} unit="°" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, color: '#304C5C', fontSize: 12 }}
                  formatter={(value: any) => [`${value}°C`, 'Temperature']}
                  labelFormatter={(l, items) => items[0]?.payload?.fullTime || l}
                />
                <Area type="monotone" dataKey="temperature" stroke="#578A9F" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : activeChartTab === 'precip' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#647D8A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#647D8A' }} unit="mm" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, color: '#304C5C', fontSize: 12 }}
                  formatter={(val: any, name: string): [string, string] => [
                    name === 'rainMm' ? `${val} mm` : `${val}%`,
                    name === 'rainMm' ? 'Precipitation' : 'Probability',
                  ]}
                  labelFormatter={(l, items) => items[0]?.payload?.fullTime || l}
                />
                <Bar dataKey="rainMm" fill="#83AABD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#647D8A' }} />
                <YAxis tick={{ fontSize: 11, fill: '#647D8A' }} unit="km/h" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 12, color: '#304C5C', fontSize: 12 }}
                  formatter={(val: any, name: string): [string, string] => [`${val} km/h`, name === 'windSpeed' ? 'Sustained Wind' : 'Wind Gusts']}
                  labelFormatter={(l, items) => items[0]?.payload?.fullTime || l}
                />
                <Line type="monotone" dataKey="windSpeed" stroke="#337F79" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="windGusts" stroke="#B28B55" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#B5C5BF' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 4. DAILY 7-DAY EXTENDED FORECAST SECTION */}
      <div className="bento-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-jatayu-primary uppercase font-mono tracking-wider">
              Multi-day outlook
            </h2>
          </div>
          <span className="text-xs font-mono text-jatayu-muted">
            Available forecast hours grouped by day · partial days included
          </span>
        </div>

        <div className="divide-y divide-white/5">
          {dailyForecast.map((day) => (
            <div
              key={day.date}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/5 px-3 rounded-xl transition-all"
            >
              {/* Day & Date */}
              <div className="w-36 flex-shrink-0">
                <div className="font-bold text-jatayu-primary">{day.dayName}</div>
                <div className="text-[11px] font-mono text-jatayu-muted">{day.date}</div>
              </div>

              {/* Rain Chance & Icon */}
              <div className="flex items-center gap-3 w-40 flex-shrink-0">
                {getWeatherIcon(0, day.rainTotal)}
                <div>
                  <div className="font-medium text-jatayu-primary">
                    {day.rainTotal > 10 ? 'Heavy Rain' : day.rainTotal > 2 ? 'Showers' : 'Partly Cloudy'}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                    {day.maxPrecipProb}% chance • {day.rainTotal} mm
                  </div>
                </div>
              </div>

              {/* Temperature Bar Visual */}
              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <span className="w-8 text-right font-mono font-medium text-jatayu-secondary">
                  {day.minTemp}°
                </span>
                <div className="flex-1 bg-obsidian/80 border border-white/5 rounded-full h-2 relative overflow-hidden">
                  <div
                    className="absolute h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400"
                    style={{
                      left: '15%',
                      right: '15%',
                    }}
                  />
                </div>
                <span className="w-8 font-mono font-bold text-jatayu-primary">
                  {day.maxTemp}°
                </span>
              </div>

              {/* Peak Wind */}
              <div className="w-24 text-right font-mono text-jatayu-secondary flex-shrink-0 hidden sm:block">
                <span>Peak {Math.round(day.windMax)} km/h</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. DATA PROVENANCE & TRANSPARENCY CARD */}
      <div className="bento-card p-5 text-xs space-y-2 text-jatayu-secondary border-white/10 bg-charcoal/60">
        <div className="flex items-center justify-between font-mono text-[11px] uppercase">
          <span className="flex items-center gap-1.5 font-bold text-jatayu-primary">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Sources & freshness</span>
          </span>
          <span className="text-emerald-400 font-bold">Open-Meteo</span>
        </div>
        <p className="leading-relaxed font-sans text-jatayu-secondary">
          Model-derived conditions and forecasts are supplied by Open-Meteo using automatic model selection. They are separate from official warnings and direct station measurements. Check source times before making decisions.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-jatayu-muted pt-2 border-t border-white/10">
          <div>REQUEST PROCESSING: <strong className="text-jatayu-primary">{forecast?.generationTimeMs || 15} ms</strong></div>
          <div>FETCHED AT: <strong className="text-jatayu-primary">{forecast?.fetchedAt ? new Date(forecast.fetchedAt).toLocaleTimeString() : 'Current session'}</strong></div>
          <div>DATA TRUST TIER: <strong className="text-emerald-300 font-bold">NUMERICAL_FORECAST</strong></div>
        </div>
      </div>
    </div>
  );
};
