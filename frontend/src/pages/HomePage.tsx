import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  CloudRain,
  Navigation2,
  Building2,
  Globe2,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
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
} from 'lucide-react';
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

  const scrollToConditions = () => {
    const el = document.getElementById('local-conditions-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-12 pb-12">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-slate-900 text-white p-8 md:p-12 shadow-xl border border-navy-700">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium">
            <Compass className="w-3.5 h-3.5" />
            <span>{t('brand.name')} — {t('brand.tagline')}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            {t('home.heroTitle')}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-sans">
            {t('home.heroSubtitle')}
          </p>

          {/* Primary / Secondary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={scrollToConditions}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <MapPin className="w-4 h-4 text-sky-200" />
              <span>{t('home.btnCheckArea')}</span>
            </button>

            <button
              onClick={() => onSelectTab('saferoute')}
              className="px-5 py-2.5 bg-navy-700/80 hover:bg-navy-600 text-white border border-slate-600/70 font-medium text-sm rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Navigation2 className="w-4 h-4 text-amber-400" />
              <span>{t('home.btnSafeRoute')}</span>
            </button>

            <button
              onClick={() => onSelectTab('research')}
              className="px-4 py-2.5 text-slate-300 hover:text-white font-medium text-sm rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>{t('home.btnResearch')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Safety Disclaimer */}
          <div className="pt-2 border-t border-navy-700/60 text-xs text-slate-400 flex items-start gap-2 max-w-2xl font-sans">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{t('home.heroDisclaimer')}</span>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute right-1/4 bottom-0 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
      </section>

      {/* 2. LOCAL CONDITIONS & OFFICIAL WARNINGS PANEL */}
      <section id="local-conditions-panel" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('home.localConditionsTitle')}</span>
            </div>
            <h2 className="text-xl font-bold text-navy-900 mt-1 flex items-center gap-2 flex-wrap">
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
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-md border border-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Use current device GPS location"
            >
              <Compass className={`w-3.5 h-3.5 text-blue-600 ${geoLoading ? 'animate-spin' : ''}`} />
              <span>{geoLoading ? t('header.sync') : t('home.useLocationBtn')}</span>
            </button>
          </div>
        </div>

        {/* GPS Status Notice if Denied/Unavailable */}
        {geoNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start justify-between gap-2 shadow-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{geoNotice}</p>
            </div>
            <button
              onClick={() => setGeoNotice(null)}
              className="text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Prominent Locality Search Input & Suggestions */}
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
              className="w-full px-3.5 py-2.5 pl-10 pr-10 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-navy-900 placeholder:text-slate-400 font-sans shadow-xs transition-all"
            />
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {isSearching ? (
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <Search className="w-4 h-4" />
              )}
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

          {/* Search Dropdown: Loading, No Results, Error, or Suggestions */}
          {isDropdownOpen && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto">
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
                        {result.type && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 flex-shrink-0">
                            {result.type}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Weather Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-red-500" />
              <span>{t('home.temp')}</span>
            </div>
            <div className="text-2xl font-extrabold text-navy-900 mt-1">
              {weather ? `${weather.temperatureC}°C` : '--'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {weather ? `Feels like ${weather.apparentTemperatureC}°C` : 'Telemetry loading'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-blue-500" />
              <span>{t('home.rainRate')}</span>
            </div>
            <div className="text-2xl font-extrabold text-navy-900 mt-1">
              {weather ? `${weather.precipitationMm} mm/h` : '--'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">
              {weather ? weather.weatherDescription : 'NWP observation'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-teal-600" />
              <span>{t('home.wind')}</span>
            </div>
            <div className="text-2xl font-extrabold text-navy-900 mt-1">
              {weather ? `${weather.windSpeedKmh} km/h` : '--'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {weather ? `Gusts: ${weather.windGustsKmh} km/h` : 'Anemometer'}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-mono font-medium text-slate-500 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t('home.expectedRain24h')}</span>
            </div>
            <div className="text-2xl font-extrabold text-navy-900 mt-1">
              {forecast ? `${forecast.accumulations.next24hRainfallMm} mm` : '--'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {forecast ? `Past 24h: ${forecast.accumulations.past24hRainfallMm} mm` : 'Forecast model'}
            </div>
          </div>
        </div>

        {/* Official Warning Status Block — 4 Honest States */}
        <div className="pt-2">
          <div className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500 mb-2">
            {t('home.warningTitle')}
          </div>

          {/* State 1: Active Official Warning */}
          {hasActiveOfficialAlert && (
            <div className="space-y-3">
              {officialAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-lg bg-amber-50 border-2 border-amber-400 text-amber-950 flex flex-col sm:flex-row items-start justify-between gap-4"
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
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
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
            <div className="p-4 rounded-lg bg-slate-100 border border-slate-300 text-slate-800 flex items-start gap-3">
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
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Querying official IMD meteorological warning feed...</span>
            </div>
          )}
        </div>

        {/* Recommended Action / Precautions */}
        <div className="p-4 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer"
          >
            {t('home.card2Action')}
          </button>
        </div>
      </section>

      {/* 3. FOUR PROMINENT ACTION CARDS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-navy-900 tracking-tight">
              Disaster Response & Meteorological Services
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Select an action below to access real-time tools, evacuation routing, and research models.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Weather & Warnings */}
          <div
            onClick={() => onSelectTab('weather')}
            className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <CloudRain className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-navy-900 group-hover:text-blue-600 transition-colors">
                {t('home.card1Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {t('home.card1Desc')}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-blue-600">
              <span>{t('home.card1Action')}</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: SafeRoute */}
          <div
            onClick={() => onSelectTab('saferoute')}
            className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Navigation2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-navy-900 group-hover:text-amber-600 transition-colors">
                {t('home.card2Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {t('home.card2Desc')}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-amber-600">
              <span>{t('home.card2Action')}</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Emergency Facilities */}
          <div
            onClick={() => onSelectTab('facilities')}
            className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-navy-900 group-hover:text-teal-600 transition-colors">
                {t('home.card3Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {t('home.card3Desc')}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-teal-600">
              <span>{t('home.card3Action')}</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Climate & Research */}
          <div
            onClick={() => onSelectTab('research')}
            className="group p-5 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Globe2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-navy-900 group-hover:text-indigo-600 transition-colors">
                {t('home.card4Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                {t('home.card4Desc')}
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-indigo-600">
              <span>{t('home.card4Action')}</span>
              <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </section>

      {/* 4. HOW JATAYU HELPS / DATA INTEGRITY PILLARS */}
      <section className="bg-slate-50 rounded-xl border border-slate-200 p-8 space-y-6">
        <div>
          <h3 className="text-xl font-bold text-navy-900 tracking-tight">
            {t('home.howTitle')}
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            {t('home.howSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs font-mono">
              01
            </div>
            <h4 className="text-sm font-bold text-navy-900">
              {t('home.pillar1Title')}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {t('home.pillar1Desc')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center font-bold text-xs font-mono">
              02
            </div>
            <h4 className="text-sm font-bold text-navy-900">
              {t('home.pillar2Title')}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {t('home.pillar2Desc')}
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-8 h-8 rounded bg-teal-100 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-xs font-mono">
              03
            </div>
            <h4 className="text-sm font-bold text-navy-900">
              {t('home.pillar3Title')}
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              {t('home.pillar3Desc')}
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 font-sans">
          <strong>Data Trust Architecture: </strong> {t('home.trustTierNote')}
        </div>
      </section>
    </div>
  );
};
