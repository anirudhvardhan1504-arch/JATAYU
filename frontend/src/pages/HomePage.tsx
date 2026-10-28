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
      <section className="bg-gradient-to-r from-navy-950 via-navy-900 to-slate-900 rounded-2xl border border-navy-800 p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-mono font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>{t('brand.name')} DISASTER INTELLIGENCE PLATFORM</span>
              <span className="text-slate-400">• v0.1</span>
            </div>

            {/* Ingestion status badge */}
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold">
                ECMWF IFS • IMD NOWCAST CONNECTED
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white font-sans">
              Understand the weather. Know the risks. Plan your next step.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-3xl font-sans leading-relaxed">
              JATAYU provides indicative situational screening and aggregates official alerts from authoritative meteorological agencies to support early awareness and civilian preparedness.
            </p>
          </div>

          {/* Quick Route Nav Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onSelectTab('map')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-sky-200" />
              <span>Weather Map</span>
            </button>
            <button
              onClick={() => onSelectTab('weather')}
              className="px-4 py-2 bg-navy-800/90 hover:bg-navy-700 text-white border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <CloudRain className="w-3.5 h-3.5 text-blue-400" />
              <span>Forecasts</span>
            </button>
            <button
              onClick={() => onSelectTab('alerts')}
              className="px-4 py-2 bg-navy-800/90 hover:bg-navy-700 text-white border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Alerts</span>
            </button>
            <button
              onClick={() => onSelectTab('ai')}
              className="px-4 py-2 bg-navy-800/90 hover:bg-navy-700 text-white border border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <BotMessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ask JATAYU</span>
            </button>
          </div>
        </div>

        {/* Ambient subtle glow */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* 2. PROMINENT LOCATION SEARCH & LOCAL CONDITIONS */}
      <section id="local-conditions-panel" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-blue-600">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('home.localConditionsTitle')}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900 mt-1 flex items-center gap-2 flex-wrap">
              <span>{location.name}</span>
              <span className="text-xs font-mono font-normal text-slate-500 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handleGpsClick}
              disabled={geoLoading}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Use current device GPS location"
            >
              <Compass className={`w-3.5 h-3.5 text-blue-600 ${geoLoading ? 'animate-spin' : ''}`} />
              <span>{geoLoading ? t('header.sync') : t('home.useLocationBtn')}</span>
            </button>
          </div>
        </div>

        {/* GPS Alert Notice if Denied */}
        {geoNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start justify-between gap-2 shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{geoNotice}</p>
            </div>
            <button onClick={() => setGeoNotice(null)} className="text-amber-700 hover:text-amber-900 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Prominent Locality Search Bar */}
        <div ref={searchContainerRef} className="relative">
          <label htmlFor="home-locality-search" className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-blue-600" />
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
              className="w-full px-4 py-3 pl-10 pr-10 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-navy-900 placeholder:text-slate-400 font-sans shadow-xs transition-all"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {isSearching ? <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> : <Search className="w-4 h-4" />}
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={t('home.searchClear')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {isSearching && (
                <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>{t('home.searching')}</span>
                </div>
              )}
              {!isSearching && searchError && (
                <div className="p-3 text-xs text-red-600 bg-red-50 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
              {!isSearching && !searchError && hasSearched && searchResults.length === 0 && (
                <div className="p-3 text-xs text-slate-600 bg-slate-50">
                  <p className="font-medium text-slate-800">{t('home.noResultsFound')}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{t('home.searchHelp')}</p>
                </div>
              )}
              {!isSearching && searchResults.length > 0 && (
                <ul className="divide-y divide-slate-100" role="listbox">
                  {searchResults.map((result, idx) => (
                    <li key={`${result.displayName}-${result.latitude}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleSelectResult(result)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 transition-colors flex items-center justify-between gap-3 text-xs group cursor-pointer"
                        role="option"
                        aria-selected="false"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <MapPin className="w-4 h-4 text-blue-600 group-hover:text-blue-700 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-semibold text-navy-900 group-hover:text-blue-900 truncate">
                              {result.displayName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
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
          <span className="text-slate-400 uppercase mr-1 whitespace-nowrap">SECTORS:</span>
          {PRESET_LOCATIONS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onSelectLocation && onSelectLocation(preset)}
              className={`px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                location.name === preset.name
                  ? 'bg-blue-600 text-white border-blue-600 font-bold'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* 3. CURRENT WEATHER SUMMARY HERO & METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Main Temp Card */}
          <div className="md:col-span-1 bg-gradient-to-br from-navy-900 to-slate-900 text-white rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1 text-amber-400 font-bold uppercase">
                <Thermometer className="w-3.5 h-3.5" />
                <span>{t('home.temp')}</span>
              </span>
              <span>{weather ? new Date(weather.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</span>
            </div>
            <div className="my-2">
              <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono tracking-tight">
                {weather ? `${weather.temperatureC}°C` : '--'}
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {weather ? `Feels like ${weather.apparentTemperatureC}°C` : 'Telemetry loading'}
              </div>
            </div>
            <div className="text-xs font-semibold text-sky-300 truncate">
              {weather?.weatherDescription || 'Atmospheric analysis'}
            </div>
          </div>

          {/* Metric 2: Precipitation Rate */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-blue-500" />
                <span>{t('home.rainRate')}</span>
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">RATE</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 font-mono my-1">
              {weather ? `${weather.precipitationMm} mm/h` : '--'}
            </div>
            <div className="text-xs text-slate-500 truncate">
              {weather ? weather.weatherDescription : 'NWP observation'}
            </div>
          </div>

          {/* Metric 3: Wind & Gusts */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wind className="w-4 h-4 text-teal-600" />
                <span>{t('home.wind')}</span>
              </span>
              <span className="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded font-bold">WIND</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 font-mono my-1">
              {weather ? `${weather.windSpeedKmh} km/h` : '--'}
            </div>
            <div className="text-xs text-slate-500">
              {weather ? `Gusts: ${weather.windGustsKmh} km/h` : 'Anemometer'}
            </div>
          </div>

          {/* Metric 4: Expected 24h Rain */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>{t('home.expectedRain24h')}</span>
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-bold">24H</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-navy-900 font-mono my-1">
              {forecast ? `${forecast.accumulations.next24hRainfallMm} mm` : '--'}
            </div>
            <div className="text-xs text-slate-500">
              {forecast ? `Past 24h: ${forecast.accumulations.past24hRainfallMm} mm` : 'Forecast model'}
            </div>
          </div>
        </div>

        {/* 4. HOURLY FORECAST STRIP */}
        {hourlyStrip.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase text-slate-500">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>24-Hour Hourly Forecast</span>
              </span>
              <button
                onClick={() => onSelectTab('weather')}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer font-bold lowercase text-xs"
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
                    className="flex-shrink-0 w-20 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center flex flex-col items-center space-y-1.5"
                  >
                    <span className="text-[11px] font-mono font-semibold text-slate-600">{label}</span>
                    <div>{getWeatherIcon(0, h.precipitationMm)}</div>
                    <span className="text-sm font-bold text-navy-900 font-mono">{Math.round(h.temperatureC)}°</span>
                    <span className="text-[10px] font-mono text-blue-600 font-semibold">{h.precipitationProbabilityPercent}% rain</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. WEATHER TREND CHARTS (REAL DATA RECHARTS) */}
        {trendChartData.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                <span>24-Hour Trend Trajectory</span>
              </span>

              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-mono">
                <button
                  onClick={() => setActiveChartTab('temp')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    activeChartTab === 'temp' ? 'bg-white font-bold text-navy-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Temp Curve
                </button>
                <button
                  onClick={() => setActiveChartTab('rain')}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                    activeChartTab === 'rain' ? 'bg-white font-bold text-navy-900 shadow-xs' : 'text-slate-600'
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
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="°" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A1128', borderColor: '#1E293B', borderRadius: 8, color: '#fff', fontSize: 11 }}
                      formatter={(v: any) => [`${v}°C`, 'Temperature']}
                    />
                    <Area type="monotone" dataKey="temp" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#homeTempGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="mm" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A1128', borderColor: '#1E293B', borderRadius: 8, color: '#fff', fontSize: 11 }}
                      formatter={(v: any) => [`${v} mm`, 'Rain Amount']}
                    />
                    <Bar dataKey="rain" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* 6. DAILY 7-DAY FORECAST SECTION */}
        {dailyForecast.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Multi-Day Weather Outlook</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {dailyForecast.map((d) => (
                <div
                  key={d.date}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-between space-y-1.5"
                >
                  <span className="text-xs font-bold text-navy-900">{d.dayName}</span>
                  <div className="my-1">{getWeatherIcon(0, d.rainTotal)}</div>
                  <div className="text-xs font-mono">
                    <span className="font-bold text-navy-900">{d.maxTemp}°</span>{' '}
                    <span className="text-slate-400">{d.minTemp}°</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-600 font-semibold">{d.maxRainProb}% rain</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. OFFICIAL WARNING STATUS BLOCK — 4 HONEST STATES */}
        <div className="pt-2 border-t border-slate-100">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {t('home.warningTitle')}
          </div>

          {/* State 1: Active Official Warning */}
          {hasActiveOfficialAlert && (
            <div className="space-y-3">
              {officialAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-200 text-amber-900 font-mono font-bold text-xs uppercase rounded">
                          {alert.severity}
                        </span>
                        <span className="text-xs font-mono text-amber-800">
                          {alert.sourceAgency}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-amber-950 mt-1">
                        {alert.headline}
                      </h4>
                      <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                        {alert.description}
                      </p>
                      {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                        <div className="mt-2 text-xs font-medium text-amber-950">
                          <strong>Actions: </strong> {alert.recommendedActions.join(' • ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectTab('alerts')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer"
                  >
                    View Alert Details
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* State 2: Checked Feed — No Active Warning Found */}
          {isFeedCheckedEmpty && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  {t('home.noActiveWarning')}
                </h4>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed font-sans">
                  {t('home.noActiveWarningNote')}
                </p>
                <div className="text-[10px] font-mono text-emerald-700 mt-1">
                  Source: India Meteorological Department (IMD) Nowcast RSS • Checked at {alertFeed ? new Date(alertFeed.fetchedAt).toLocaleTimeString() : 'just now'}
                </div>
              </div>
            </div>
          )}

          {/* State 3: Warning Feed Temporarily Unavailable or Error */}
          {alertsError && (
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-start gap-3">
              <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {t('home.feedUnavailable')}
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-sans">
                  {t('home.feedUnavailableNote')}
                </p>
              </div>
            </div>
          )}

          {/* State 4: Loading Feed */}
          {alertsLoading && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span>Querying official IMD meteorological warning feed...</span>
            </div>
          )}
        </div>

        {/* Recommended Action / Precautions */}
        <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <span className="font-semibold text-xs font-mono uppercase text-blue-900 tracking-wider">
                {t('home.recommendedAction')}:
              </span>
              <p className="text-xs text-blue-900 mt-0.5 font-sans">
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
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer"
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
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CloudRain className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-navy-900 text-sm">{t('home.card1Title')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                {t('home.card1Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-blue-600 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card1Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: Find a Safer Route */}
          <div
            onClick={() => onSelectTab('saferoute')}
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Navigation2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-navy-900 text-sm">{t('home.card2Title')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                {t('home.card2Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-emerald-600 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card2Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: Nearby Emergency Help */}
          <div
            onClick={() => onSelectTab('facilities')}
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-navy-900 text-sm">{t('home.card3Title')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                {t('home.card3Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-indigo-600 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card3Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: Climate & Research Observatory */}
          <div
            onClick={() => onSelectTab('research')}
            className="bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-navy-900 text-sm">{t('home.card4Title')}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                {t('home.card4Desc')}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-amber-600 group-hover:translate-x-1 transition-transform">
              <span>{t('home.card4Action')}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </section>

      {/* 9. AUTHORITATIVE INGESTION & DATA TRUST PILLARS */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-navy-900">Authoritative Ingestion</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Direct upstream feeds from the India Meteorological Department (IMD) and verified ECMWF / DWD NWP numerical atmospheric models.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-navy-900">Transparent Hazard Screening</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Clear distinction between officially declared warnings, indicative heuristic screening, and unvalidated experimental research simulations.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-navy-900">Actionable Public Guidance</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              Real-time shelter triage, verified emergency facility routing, and chokepoint bypass calculations designed for civilian safety.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <span>
            Data Trust Architecture: Official alerts, indicative heuristics, and experimental research simulations are strictly segregated to prevent operational misinterpretation.
          </span>
        </div>
      </section>
    </div>
  );
};
