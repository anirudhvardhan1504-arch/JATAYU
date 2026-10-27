import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  RefreshCw,
  LogOut,
  Search,
  Compass,
  Shield,
  Menu,
  Navigation2,
  Building2,
  Globe,
  CloudRain,
  Home,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { NavigationTab, GeocodingResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { searchPlaces, reverseGeocodeLocation } from '../../services/route';

interface TopbarProps {
  activeTab: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  selectedLocation: { name: string; lat: number; lon: number };
  onSelectLocation: (loc: { name: string; lat: number; lon: number }) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenLogin?: () => void;
  onExportSitrep?: () => void;
  onToggleMobileMenu?: () => void;
}

const PRESET_LOCATIONS = [
  { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 },
  { name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 },
  { name: 'Brahmaputra Valley (Guwahati)', lat: 26.1445, lon: 91.7362 },
  { name: 'Kolkata Deltaic Zone', lat: 22.5726, lon: 88.3639 },
  { name: 'Dehradun Hill Catchment', lat: 30.3165, lon: 78.0322 },
];

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  onSelectTab,
  selectedLocation,
  onSelectLocation,
  onRefresh,
  isRefreshing = false,
  onOpenLogin,
  onExportSitrep,
  onToggleMobileMenu,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced geocoding search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(searchQuery);
        setSearchResults(results.slice(0, 6));
        setIsDropdownOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle explicit "Use My Location" GPS action
  const handleUseMyLocation = async () => {
    if (!navigator.geolocation) {
      setGeoNotice('Geolocation is not supported by your browser.');
      setTimeout(() => setGeoNotice(null), 4000);
      return;
    }

    setGeoLoading(true);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const resolvedName = await reverseGeocodeLocation(latitude, longitude);
          onSelectLocation({
            name: resolvedName,
            lat: latitude,
            lon: longitude,
          });
        } catch {
          onSelectLocation({
            name: `My Location (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`,
            lat: latitude,
            lon: longitude,
          });
        } finally {
          setGeoLoading(false);
        }
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGeoNotice('Location permission was denied. Please select from presets or search.');
        } else {
          setGeoNotice('Location request timed out. Please enter an address manually.');
        }
        setTimeout(() => setGeoNotice(null), 5000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSelectPlace = (place: GeocodingResult) => {
    onSelectLocation({
      name: place.displayName,
      lat: place.latitude,
      lon: place.longitude,
    });
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const isOperatorTab = [
    'overview',
    'map',
    'risk',
    'alerts',
    'ai',
    'preparedness',
    'command3d',
  ].includes(activeTab);

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 shadow-subtle">
      {/* Left: Mobile Toggle & Brand/Context */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 md:hidden"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm text-navy-900 font-mono tracking-wider">
              {t('brand.name')}
            </span>
            <span className="text-[10px] text-slate-400 font-sans hidden lg:inline">
              • AI Disaster Intelligence
            </span>
          </div>
        </div>

        {isOperatorTab && (
          <span className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-2 hidden md:inline">
            {t('topbar.consolePrefix')} / {activeTab}
          </span>
        )}

        {/* Public Quick Navigation Links (Desktop) */}
        {onSelectTab && (
          <nav className="hidden md:flex items-center gap-1 ml-2">
            {[
              { id: 'home' as NavigationTab, label: t('nav.home'), icon: <Home className="w-3.5 h-3.5" /> },
              { id: 'weather' as NavigationTab, label: t('nav.weatherWarnings'), icon: <CloudRain className="w-3.5 h-3.5" /> },
              { id: 'saferoute' as NavigationTab, label: t('nav.saferoute'), icon: <Navigation2 className="w-3.5 h-3.5" /> },
              { id: 'facilities' as NavigationTab, label: t('nav.facilities'), icon: <Building2 className="w-3.5 h-3.5" /> },
              { id: 'research' as NavigationTab, label: t('nav.climateResearch'), icon: <Globe className="w-3.5 h-3.5" /> },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-navy-900 hover:bg-slate-50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Center: Universal Location Search & GPS */}
      <div className="flex items-center gap-2 flex-1 max-w-md min-w-[200px]" ref={searchRef}>
        <div className="relative flex-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setIsDropdownOpen(true);
              }}
              placeholder={t('home.searchPlaceholder')}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-navy-900 focus:outline-none focus:border-blue-500 focus:bg-white font-sans placeholder:text-slate-400"
            />
            {isSearching && (
              <RefreshCw className="w-3 h-3 text-blue-500 animate-spin absolute right-2.5 top-2.5" />
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
              <div className="p-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider px-2 border-b border-slate-100">
                Search Results
              </div>
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.latitude}-${result.longitude}-${idx}`}
                  onClick={() => handleSelectPlace(result)}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-start gap-2 border-b border-slate-50 last:border-none transition-colors cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-navy-900 truncate">
                      {result.displayName}
                    </p>
                    <span className="text-[10px] font-mono text-slate-500">
                      {result.latitude.toFixed(4)}°N, {result.longitude.toFixed(4)}°E
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GPS "Use My Location" Action */}
        <button
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 transition-colors flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-50"
          title={t('home.useLocationBtn')}
          aria-label={t('home.useLocationBtn')}
        >
          <Compass className={`w-4 h-4 text-blue-600 ${geoLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* Preset Selector Dropdown */}
        <select
          value={selectedLocation.name}
          onChange={(e) => {
            const match = PRESET_LOCATIONS.find((loc) => loc.name === e.target.value);
            if (match) onSelectLocation(match);
          }}
          className="bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded px-2 py-1.5 text-xs text-navy-900 font-medium cursor-pointer outline-none max-w-[130px] sm:max-w-[160px] truncate"
          title="Select Target Disaster Sector"
        >
          {PRESET_LOCATIONS.map((loc) => (
            <option key={loc.name} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Language Selector, Response Console Toggle, Login */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Selector */}
        <LanguageSelector />

        {/* Export Situation Report on Operator Console */}
        {isOperatorTab && onExportSitrep && (
          <button
            onClick={onExportSitrep}
            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/40 rounded transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow-2xs"
            title={t('sitrep.exportBtn')}
          >
            <FileText className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">{t('sitrep.exportBtn')}</span>
          </button>
        )}

        {/* Refresh Action */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title={t('topbar.refresh')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('topbar.refresh')}</span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        {/* Response Console Button / Role Badge */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-navy-900 border border-navy-800 rounded text-xs text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-semibold text-slate-200 hidden sm:inline">
              {user.displayName || user.username}
            </span>
            <span className="text-[9px] font-mono px-1 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded uppercase font-bold">
              {user.role}
            </span>
            <button
              onClick={logout}
              className="ml-1 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 text-[11px] font-mono uppercase"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
              <span>{t('topbar.logout')}</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              if (onOpenLogin) {
                onOpenLogin();
              } else if (onSelectTab && !isOperatorTab) {
                onSelectTab('overview');
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-amber-400 text-xs font-mono font-bold rounded border border-navy-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            title="Access Authorized Response & Researcher Tools"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('topbar.commandSignIn')}</span>
          </button>
        )}
      </div>

      {/* Geolocation feedback notification banner */}
      {geoNotice && (
        <div className="absolute top-full left-4 right-4 mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs flex items-center justify-between z-50 shadow-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{geoNotice}</span>
          </div>
          <button onClick={() => setGeoNotice(null)} className="text-amber-700 font-bold ml-2">
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
