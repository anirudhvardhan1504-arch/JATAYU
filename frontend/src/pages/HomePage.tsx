import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  CloudRain,
  Navigation2,
  Building2,
  Globe2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Thermometer,
  Wind,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Info,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Layers,
  Calendar,
  Sun,
  Cloud,
  CloudLightning,
  CloudDrizzle,
  BotMessageSquare,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  NavigationTab,
  CurrentWeatherObservation,
  WeatherForecastResponse,
  AlertFeedResponse,
  GeocodingResult,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import { searchPlaces, reverseGeocodeLocation } from '../services/route';
import { Luxury3DIcon } from '../components/common/Luxury3DIcon';

interface HomePageProps {
  location: { name: string; lat: number; lon: number };
  onSelectLocation?: (loc: { name: string; lat: number; lon: number }) => void;
  weather: CurrentWeatherObservation | null;
  forecast: WeatherForecastResponse | null;
  alertFeed: AlertFeedResponse | null;
  alertsLoading: boolean;
  alertsError: string | null;
  onSelectTab: (tab: NavigationTab) => void;
  onRequestLocation?: () => void;
}

const PRESET_LOCATIONS = [
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777, label: 'Mumbai' },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707, label: 'Chennai' },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362, label: 'Guwahati' },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639, label: 'Kolkata' },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322, label: 'Dehradun' },
  { name: 'Delhi NCR', lat: 28.6139, lon: 77.209, label: 'Delhi' },
  { name: 'Bengaluru Urban', lat: 12.9716, lon: 77.5946, label: 'Bengaluru' },
];

function getWeatherIcon(code: number, rainMm = 0) {
  if (code >= 95) return <CloudLightning className="w-5 h-5 text-amber-500" />;
  if (code >= 61 || rainMm > 2) return <CloudRain className="w-5 h-5 text-blue-500" />;
  if (code >= 51 || rainMm > 0) return <CloudDrizzle className="w-5 h-5 text-sky-400" />;
  if (code >= 1 && code <= 3) return <Cloud className="w-5 h-5 text-slate-400" />;
  return <Sun className="w-5 h-5 text-amber-400" />;
}

export const HomePage: React.FC<HomePageProps> = ({
  location,
  onSelectLocation,
  weather,
  forecast,
  alertFeed,
  alertsLoading,
  alertsError,
  onSelectTab,
  onRequestLocation,
}) => {
  const { t } = useLanguage();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<'temp' | 'rain'>('temp');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const officialAlerts = alertFeed?.officialAlerts || [];
  const hasActiveOfficialAlert = officialAlerts.length > 0;
  const isFeedCheckedEmpty = !alertsLoading && !alertsError && alertFeed && officialAlerts.length === 0;

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchPlaces(trimmed);
        setSearchResults(results.slice(0, 8));
        setHasSearched(true);
        setIsDropdownOpen(true);
      } catch (err: any) {
        setSearchError(err?.message || t('home.searchFailed'));
        setSearchResults([]);
        setHasSearched(true);
        setIsDropdownOpen(true);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, t]);

  const handleSelectResult = (result: GeocodingResult) => {
    if (onSelectLocation) {
      onSelectLocation({
        name: result.displayName,
        lat: result.latitude,
        lon: result.longitude,
      });
    }
    setSearchQuery('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setHasSearched(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      const coordMatch = trimmed.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          if (onSelectLocation) {
            onSelectLocation({
              name: `Coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
              lat,
              lon,
            });
          }
          setSearchQuery('');
          setIsDropdownOpen(false);
          return;
        }
      }
      if (searchResults.length > 0) {
        handleSelectResult(searchResults[0]);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleGpsClick = () => {
    if (onRequestLocation) {
      onRequestLocation();
      return;
    }

    if (!navigator.geolocation) {
      setGeoNotice(t('home.geoUnavailableNotice'));
      setTimeout(() => setGeoNotice(null), 5000);
      return;
    }

    setGeoLoading(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const resolvedName = await reverseGeocodeLocation(latitude, longitude);
          if (onSelectLocation) {
            onSelectLocation({
              name: resolvedName,
              lat: latitude,
              lon: longitude,
            });
          }
        } catch {
          if (onSelectLocation) {
            onSelectLocation({
              name: `My Location (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`,
              lat: latitude,
              lon: longitude,
            });
          }
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoNotice(t('home.geoDeniedNotice'));
        } else if (err.code === err.TIMEOUT) {
          setGeoNotice(t('home.geoTimeoutNotice'));
        } else {
          setGeoNotice(t('home.geoUnavailableNotice'));
        }
        setTimeout(() => setGeoNotice(null), 6000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // 24h Hourly Strip
  const hourlyStrip = useMemo(() => {
    if (!forecast?.hourly) return [];
    return forecast.hourly.slice(0, 24);
  }, [forecast]);

  // Aggregate 7-Day Daily Forecast
  const dailyForecast = useMemo(() => {
    if (!forecast?.hourly || forecast.hourly.length === 0) return [];

    const grouped: Record<
      string,
      {
        date: string;
        dayName: string;
        temps: number[];
        rainTotal: number;
        maxRainProb: number;
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
          maxRainProb: 0,
        };
      }
      grouped[dateKey].temps.push(h.temperatureC);
      grouped[dateKey].rainTotal += h.precipitationMm || 0;
      grouped[dateKey].maxRainProb = Math.max(
        grouped[dateKey].maxRainProb,
        h.precipitationProbabilityPercent || 0
      );
    });

    return Object.values(grouped).map((day) => ({
      ...day,
      minTemp: Math.round(Math.min(...day.temps)),
      maxTemp: Math.round(Math.max(...day.temps)),
      rainTotal: parseFloat(day.rainTotal.toFixed(1)),
    }));
  }, [forecast]);

  // Chart data for 24 hours
  const trendChartData = useMemo(() => {
    if (!forecast?.hourly) return [];
    return forecast.hourly.slice(0, 24).map((h) => ({
      time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: h.temperatureC,
      rain: h.precipitationMm,
      prob: h.precipitationProbabilityPercent,
    }));
  }, [forecast]);

  return (
    <div className="space-y-8 pb-12">
      {/* 1. POLISHED JATAYU WEATHER-INTELLIGENCE HEADER & SUB-NAV */}
      <section className="bento-card p-6 md:p-8 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-[0_0_12px_rgba(0,217,154,0.15)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#00D99A]" />
              <span>{t('brand.name')} DISASTER INTELLIGENCE PLATFORM</span>
              <span className="text-slate-400">• v0.1</span>
            </div>

            {/* Ingestion status badge */}
            <div className="flex items-center gap-2 text-xs font-mono text-jatayu-secondary">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold shadow-[0_0_8px_rgba(0,217,154,0.15)]">
                ECMWF IFS • IMD NOWCAST CONNECTED
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white font-sans">
              Understand the weather. Know the risks. Plan your next step.
            </h1>
            <p className="text-sm sm:text-base text-jatayu-secondary mt-2 max-w-3xl font-sans leading-relaxed">
              JATAYU provides indicative situational screening and aggregates official alerts from authoritative meteorological agencies to support early awareness and civilian preparedness.
            </p>
          </div>

          {/* Quick Route Nav Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onSelectTab('map')}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs rounded-xl shadow-[0_0_12px_rgba(0,217,154,0.2)] flex items-center gap-2 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Weather Map</span>
            </button>
            <button
              onClick={() => onSelectTab('weather')}
              className="px-4 py-2 bg-obsidian/80 hover:bg-white/5 text-jatayu-primary border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
              <span>Forecasts</span>
            </button>
            <button
              onClick={() => onSelectTab('alerts')}
              className="px-4 py-2 bg-obsidian/80 hover:bg-white/5 text-jatayu-primary border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Alerts</span>
            </button>
            <button
              onClick={() => onSelectTab('ai')}
              className="px-4 py-2 bg-obsidian/80 hover:bg-white/5 text-jatayu-primary border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <BotMessageSquare className="w-3.5 h-3.5 text-mint" />
              <span>Ask JATAYU</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* 2. PROMINENT LOCATION SEARCH & LOCAL CONDITIONS */}
      <section id="local-conditions-panel" className="bento-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('home.localConditionsTitle')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1 flex items-center gap-2 flex-wrap">
              <span>{location.name}</span>
              <span className="text-xs font-mono font-normal text-emerald-300 px-2 py-0.5 bg-obsidian/80 rounded-full border border-white/10">
                {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleGpsClick}
              disabled={geoLoading}
              className="px-3.5 py-1.5 bg-obsidian/80 hover:bg-white/5 text-emerald-300 text-xs font-mono rounded-xl border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Use current device GPS location"
            >
              <Compass className={`w-3.5 h-3.5 text-emerald-400 ${geoLoading ? 'animate-spin' : ''}`} />
              <span>{geoLoading ? t('header.sync') : t('home.useLocationBtn')}</span>
            </button>
          </div>
        </div>

        {/* GPS Alert Notice if Denied */}
        {geoNotice && (
          <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-xs text-amber-200 flex items-start justify-between gap-2 shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{geoNotice}</p>
            </div>
            <button onClick={() => setGeoNotice(null)} className="text-amber-400 hover:text-amber-300 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Prominent Locality Search Bar */}
        <div ref={searchContainerRef} className="relative">
          <label htmlFor="home-locality-search" className="block text-xs font-semibold text-jatayu-secondary mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('home.searchLabel')}</span>
          </label>
          <div className="relative">
            <input
              id="home-locality-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0 || (hasSearched && searchQuery.trim().length >= 2)) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('home.searchPlaceholder')}
              className="w-full px-4 py-3 pl-10 pr-10 text-sm bg-obsidian/80 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500 text-jatayu-primary placeholder:text-jatayu-muted font-sans shadow-xs transition-all"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-jatayu-muted">
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" /> : <Search className="w-4 h-4" />}
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsDropdownOpen(false);
                  setHasSearched(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-jatayu-muted hover:text-jatayu-primary cursor-pointer"
                title={t('home.searchClear')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-charcoal/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden max-h-72 overflow-y-auto">
              {isSearching && (
                <div className="p-3 text-xs text-jatayu-secondary flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>{t('home.searching')}</span>
                </div>
              )}
              {!isSearching && searchError && (
                <div className="p-3 text-xs text-red-400 bg-red-950/40 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
              {!isSearching && !searchError && hasSearched && searchResults.length === 0 && (
                <div className="p-3 text-xs text-jatayu-secondary bg-obsidian/60">
                  <p className="font-medium text-white">{t('home.noResultsFound')}</p>
                  <p className="text-[11px] text-jatayu-muted mt-1">{t('home.searchHelp')}</p>
                </div>
              )}
              {!isSearching && searchResults.length > 0 && (
                <ul className="divide-y divide-white/5" role="listbox">
                  {searchResults.map((result, idx) => (
                    <li key={`${result.displayName}-${result.latitude}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-white/5 transition-colors flex items-center justify-between gap-3 text-xs group cursor-pointer"
                        role="option"
                        aria-selected="false"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <MapPin className="w-4 h-4 text-emerald-400 group-hover:text-mint flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-semibold text-jatayu-primary group-hover:text-mint truncate">
                              {result.displayName}
                            </div>
                            <div className="text-[11px] font-mono text-jatayu-muted mt-0.5">
                              {result.latitude.toFixed(4)}°N, {result.longitude.toFixed(4)}°E
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Quick Location Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-emerald-400/90 font-bold uppercase mr-1 whitespace-nowrap tracking-wider">SECTORS:</span>
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onSelectLocation && onSelectLocation(preset)}
              className={`px-3 py-1 rounded-xl border transition-all whitespace-nowrap cursor-pointer ${
                location.name === preset.name
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)] font-bold'
                  : 'bg-obsidian/80 text-jatayu-secondary border-white/10 hover:border-white/20'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* 3. CURRENT WEATHER SUMMARY HERO & METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Main Temp Card */}
          <div className="md:col-span-1 bg-gradient-to-br from-charcoal to-dark-emerald/50 border border-white/10 text-white rounded-2xl p-5 shadow-panel relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-jatayu-muted">
              <span className="flex items-center gap-1 text-amber-400 font-bold uppercase">
                <Thermometer className="w-3.5 h-3.5" />
                <span>{t('home.temp')}</span>
              </span>
              <span>{weather ? new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
            </div>
            <div className="my-2 flex items-center justify-between">
              <div>
                <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono tracking-tight text-gradient-emerald">
                  {weather ? `${weather.temperatureC}°C` : '--'}
                </div>
                <div className="text-xs text-jatayu-secondary mt-1">
                  {weather ? `Feels like ${weather.apparentTemperatureC}°C` : 'Telemetry loading'}
                </div>
              </div>
              <Luxury3DIcon type={(weather?.precipitationMm || 0) > 2 ? 'weather-storm' : 'weather-sun-cloud'} size={56} />
            </div>
            <div className="text-xs font-semibold text-mint truncate">
              {weather?.weatherDescription || 'Atmospheric analysis'}
            </div>
          </div>

          {/* Metric 2: Precipitation Rate */}
          <div className="p-4 rounded-2xl bg-obsidian/70 border border-white/10 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
            <div className="text-[11px] font-mono font-medium text-jatayu-secondary uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-emerald-400" />
                <span>{t('home.rainRate')}</span>
              </span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">RATE</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono my-1">
              {weather ? `${weather.precipitationMm} mm/h` : '--'}
            </div>
            <div className="text-xs text-jatayu-muted truncate">
              {weather ? weather.weatherDescription : 'NWP observation'}
            </div>
          </div>

          {/* Metric 3: Wind & Gusts */}
          <div className="p-4 rounded-2xl bg-obsidian/70 border border-white/10 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
            <div className="text-[11px] font-mono font-medium text-jatayu-secondary uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-mint" />
                <span>{t('home.wind')}</span>
              </span>
              <span className="text-[10px] bg-mint/20 text-mint border border-mint/30 px-1.5 py-0.2 rounded font-bold">WIND</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono my-1">
              {weather ? `${weather.windSpeedKmh} km/h` : '--'}
            </div>
            <div className="text-xs text-jatayu-muted">
              {weather ? `Gusts: ${weather.windGustsKmh} km/h` : 'Anemometer'}
            </div>
          </div>

          {/* Metric 4: Expected 24h Rain */}
          <div className="p-4 rounded-2xl bg-obsidian/70 border border-white/10 flex flex-col justify-between hover:border-emerald-500/30 transition-all">
            <div className="text-[11px] font-mono font-medium text-jatayu-secondary uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{t('home.expectedRain24h')}</span>
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">24H</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono my-1">
              {forecast ? `${forecast.accumulations.next24hRainfallMm} mm` : '--'}
            </div>
            <div className="text-xs text-jatayu-muted">
              {forecast ? `Past 24h: ${forecast.accumulations.past24hRainfallMm} mm` : 'Forecast model'}
            </div>
          </div>
        </div>

        {/* 4. HOURLY FORECAST STRIP */}
        {hourlyStrip.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase text-jatayu-secondary">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>24-Hour Hourly Forecast</span>
              </span>
              <button
                onClick={() => onSelectTab('weather')}
                className="text-emerald-400 hover:text-mint flex items-center gap-1 cursor-pointer font-bold lowercase text-xs"
              >
                <span>view full forecast</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {hourlyStrip.map((h, idx) => {
                const dateObj = new Date(h.time);
                const label = idx === 0 ? 'Now' : dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={h.time}
                    className="flex-shrink-0 w-20 p-2.5 rounded-2xl bg-obsidian/70 border border-white/10 text-center flex flex-col items-center space-y-1.5 hover:border-emerald-500/40 transition-colors"
                  >
                    <span className="text-[11px] font-mono font-semibold text-jatayu-secondary">{label}</span>
                    <div>{getWeatherIcon(0, h.precipitationMm)}</div>
                    <span className="text-sm font-bold text-white font-mono">{Math.round(h.temperatureC)}°</span>
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold">{h.precipitationProbabilityPercent}% rain</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. WEATHER TREND CHARTS (REAL DATA RECHARTS) */}
        {trendChartData.length > 0 && (
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase text-jatayu-secondary flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>24-Hour Trend Trajectory</span>
              </span>

              <div className="flex items-center bg-obsidian/70 p-0.5 rounded-xl border border-white/10 text-xs font-mono">
                <button
                  onClick={() => setActiveChartTab('temp')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'temp' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-[0_0_8px_rgba(0,217,154,0.2)]' : 'text-jatayu-muted'
                  }`}
                >
                  Temp Curve
                </button>
                <button
                  onClick={() => setActiveChartTab('rain')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    activeChartTab === 'rain' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-[0_0_8px_rgba(0,217,154,0.2)]' : 'text-jatayu-muted'
                  }`}
                >
                  Precipitation
                </button>
              </div>
            </div>

            <div className="h-44 w-full">
              {activeChartTab === 'temp' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="homeTempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D99A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00D99A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#A7B8B2' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#A7B8B2' }} unit="°" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#101817', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: '#F0F7F4', fontSize: 11 }}
                      formatter={(v: any) => [`${v}°C`, 'Temperature']}
                    />
                    <Area type="monotone" dataKey="temp" stroke="#00D99A" strokeWidth={2} fillOpacity={1} fill="url(#homeTempGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#A7B8B2' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#A7B8B2' }} unit="mm" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#101817', borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: '#F0F7F4', fontSize: 11 }}
                      formatter={(v: any) => [`${v} mm`, 'Rain Amount']}
                    />
                    <Bar dataKey="rain" fill="#00D99A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* 6. DAILY 7-DAY FORECAST SECTION */}
        {dailyForecast.length > 0 && (
          <div className="pt-2 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase text-jatayu-secondary">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Multi-Day Weather Outlook</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {dailyForecast.map((d) => (
                <div
                  key={d.date}
                  className="p-3 rounded-2xl bg-obsidian/70 border border-white/10 text-center flex flex-col items-center justify-between space-y-1.5 hover:border-emerald-500/30 transition-colors"
                >
                  <span className="text-xs font-bold text-white">{d.dayName}</span>
                  <div className="my-1">{getWeatherIcon(0, d.rainTotal)}</div>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-white">{d.maxTemp}°</span>{' '}
                    <span className="text-jatayu-muted">{d.minTemp}°</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">{d.maxRainProb}% rain</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. OFFICIAL WARNING STATUS BLOCK — 4 HONEST STATES */}
        <div className="pt-2 border-t border-white/10">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-jatayu-secondary mb-2">
            {t('home.warningTitle')}
          </div>

          {/* State 1: Active Official Warning */}
          {hasActiveOfficialAlert && (
            <div className="space-y-3">
              {officialAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-amber-100 flex flex-col sm:flex-row items-start justify-between gap-4 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 font-mono font-bold text-xs uppercase rounded-full border border-amber-500/40">
                          {alert.severity}
                        </span>
                        <span className="text-xs font-mono text-amber-300">
                          {alert.sourceAgency}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-1">
                        {alert.headline}
                      </h4>
                      <p className="text-xs text-amber-200 mt-1 leading-relaxed">
                        {alert.description}
                      </p>
                      {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                        <div className="mt-2 text-xs font-medium text-amber-100">
                          <strong>Actions: </strong> {alert.recommendedActions.join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectTab('alerts')}
                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap self-start sm:self-center cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  >
                    View Alert Details
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* State 2: Checked Feed — No Active Warning Found */}
          {isFeedCheckedEmpty && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-100 flex items-start gap-3 shadow-[0_0_15px_rgba(0,217,154,0.1)]">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-300">
                  {t('home.noActiveWarning')}
                </h4>
                <p className="text-xs text-emerald-200 mt-0.5 leading-relaxed font-sans">
                  {t('home.noActiveWarningNote')}
                </p>
                <div className="text-[10px] font-mono text-emerald-400 mt-1">
                  Source: India Meteorological Department (IMD) Nowcast RSS • Checked at {alertFeed ? new Date(alertFeed.fetchedAt).toLocaleTimeString() : 'just now'}
                </div>
              </div>
            </div>
          )}

          {/* State 3: Warning Feed Temporarily Unavailable or Error */}
          {alertsError && (
            <div className="p-4 rounded-2xl bg-obsidian/70 border border-white/10 text-jatayu-secondary flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-white">
                  {t('home.feedUnavailable')}
                </h4>
                <p className="text-xs text-jatayu-secondary mt-0.5 leading-relaxed font-sans">
                  {t('home.feedUnavailableNote')}
                </p>
              </div>
            </div>
          )}

          {/* State 4: Loading Feed */}
          {alertsLoading && (
            <div className="p-4 rounded-2xl bg-obsidian/70 border border-white/10 text-jatayu-secondary text-xs font-mono flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span>Querying official IMD meteorological warning feed...</span>
            </div>
          )}
        </div>

        {/* Recommended Action / Precautions */}
        <div className="p-4 rounded-2xl bg-dark-emerald/50 border border-emerald-500/30 text-jatayu-primary flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,217,154,0.15)]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-semibold text-xs font-mono uppercase text-emerald-300 tracking-wider">
                {t('home.recommendedAction')}:
              </span>
              <p className="text-xs text-jatayu-secondary mt-0.5 font-sans">
                {hasActiveOfficialAlert
                  ? 'Active weather warnings in effect. Avoid waterlogging chokepoints and review verified shelters.'
                  : (forecast?.accumulations.next24hRainfallMm || 0) > 40
                  ? 'Elevated rainfall predicted over next 24 hours. Check SafeRoute for flood chokepoint avoidances.'
                  : 'Normal weather conditions. If planning transit, verify your route with SafeRoute navigation.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSelectTab('saferoute')}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-mint text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap self-start sm:self-center cursor-pointer shadow-[0_0_10px_rgba(0,217,154,0.3)]"
          >
            {t('home.card2Action')}
          </button>
        </div>
      </section>

      {/* 8. FOUR CORE ACTION CARDS */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Weather & Warnings */}
          <div
            onClick={() => onSelectTab('weather')}
            className="bento-card p-5 hover:border-emerald-500/50 hover:shadow-glow-emerald transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-[0_0_10px_rgba(0,217,154,0.15)]">
                <CloudRain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">{t('home.card1Title')}</h3>
              <p className="text-xs text-jatayu-secondary mt-1 leading-relaxed font-sans">
                {t('home.card1Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono font-medium text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card1Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Find a Safer Route */}
          <div
            onClick={() => onSelectTab('saferoute')}
            className="bento-card p-5 hover:border-emerald-500/50 hover:shadow-glow-emerald transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-[0_0_10px_rgba(0,217,154,0.15)]">
                <Navigation2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">{t('home.card2Title')}</h3>
              <p className="text-xs text-jatayu-secondary mt-1 leading-relaxed font-sans">
                {t('home.card2Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono font-medium text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card2Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Nearby Emergency Help */}
          <div
            onClick={() => onSelectTab('facilities')}
            className="bento-card p-5 hover:border-emerald-500/50 hover:shadow-glow-emerald transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-[0_0_10px_rgba(0,217,154,0.15)]">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">{t('home.card3Title')}</h3>
              <p className="text-xs text-jatayu-secondary mt-1 leading-relaxed font-sans">
                {t('home.card3Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono font-medium text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card3Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Climate & Research Observatory */}
          <div
            onClick={() => onSelectTab('research')}
            className="bento-card p-5 hover:border-emerald-500/50 hover:shadow-glow-emerald transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-sm">{t('home.card4Title')}</h3>
              <p className="text-xs text-jatayu-secondary mt-1 leading-relaxed font-sans">
                {t('home.card4Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono font-medium text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card4Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* 9. AUTHORITATIVE INGESTION & DATA TRUST PILLARS */}
      <section className="bento-card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white">Authoritative Ingestion</h4>
            <p className="text-xs text-jatayu-secondary leading-relaxed font-sans">
              Direct upstream feeds from the India Meteorological Department (IMD) and verified ECMWF / DWD NWP numerical atmospheric models.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white">Transparent Hazard Screening</h4>
            <p className="text-xs text-jatayu-secondary leading-relaxed font-sans">
              Clear distinction between officially declared warnings, indicative heuristic screening, and unvalidated experimental research simulations.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white">Actionable Public Guidance</h4>
            <p className="text-xs text-jatayu-secondary leading-relaxed font-sans">
              Real-time shelter triage, verified emergency facility routing, and chokepoint bypass calculations designed for civilian safety.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 text-xs text-jatayu-muted font-mono flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>
            Data Trust Architecture: Official alerts, indicative heuristics, and experimental research simulations are strictly segregated to prevent operational misinterpretation.
          </span>
        </div>
      </section>
    </div>
  );
};
