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
    <header className="bg-charcoal/80 backdrop-blur-xl border-b border-white/10 px-2 sm:px-4 py-2 sticky top-0 z-30 select-none shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      {/* Primary Row */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-3">
        {/* Left: Mobile Toggle & Brand/Context */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-xl hover:bg-white/5 text-jatayu-secondary md:hidden cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-jatayu-primary font-mono tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D99A]"></span>
                {t('brand.name')}
              </span>
              <span className="text-[10px] text-jatayu-muted font-sans hidden 2xl:inline">
                • AI Disaster Intelligence
              </span>
            </div>
          </div>

          {isOperatorTab && (
            <span className="text-xs font-mono text-emerald-400/90 border-l border-white/10 pl-2 hidden lg:inline flex-shrink-0">
              {t('topbar.consolePrefix')} / {activeTab}
            </span>
          )}

          {/* Public Quick Navigation Links */}
          {!isOperatorTab && onSelectTab && (
            <nav className="hidden 2xl:flex items-center gap-1.5 ml-2 flex-shrink-0">
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
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === item.id
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-[0_0_12px_rgba(0,217,154,0.2)]'
                      : 'text-jatayu-secondary hover:text-jatayu-primary hover:bg-white/5'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}
        </div>

        {/* Center: Universal Location Search & Sector Preset */}
        <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 flex-1 max-w-xs sm:max-w-sm md:max-w-md min-w-0 mx-1 sm:mx-2" ref={searchRef}>
          <div className="relative flex-1 min-w-[90px] sm:min-w-[120px]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setIsDropdownOpen(true);
                }}
                placeholder={t('home.searchPlaceholder')}
                className="w-full pl-9 pr-7 py-1.5 text-xs bg-obsidian/70 border border-white/10 rounded-xl text-jatayu-primary focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 font-sans placeholder:text-jatayu-muted truncate transition-all"
              />
              {isSearching && (
                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin absolute right-2.5 top-2.5" />
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {isDropdownOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-charcoal/95 border border-white/15 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 max-h-60 overflow-y-auto">
                <div className="p-2 text-[10px] font-mono text-emerald-400/80 uppercase tracking-wider px-3 border-b border-white/10">
                  Search Results
                </div>
                {searchResults.map((result, idx) => (
                  <button
                    key={`${result.latitude}-${result.longitude}-${idx}`}
                    onClick={() => handleSelectPlace(result)}
                    className="w-full px-3 py-2.5 text-left hover:bg-white/5 flex items-start gap-2.5 border-b border-white/5 last:border-none transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-jatayu-primary truncate">
                        {result.displayName}
                      </p>
                      <span className="text-[10px] font-mono text-jatayu-muted">
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
            className="p-1.5 bg-dark-emerald/50 hover:bg-dark-emerald text-emerald-400 rounded-xl border border-emerald-500/40 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer disabled:opacity-50 shadow-[0_0_10px_rgba(0,217,154,0.15)]"
            title={t('home.useLocationBtn')}
            aria-label={t('home.useLocationBtn')}
          >
            <Compass className={`w-4 h-4 text-emerald-400 ${geoLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* Preset Selector Dropdown */}
          <select
            value={selectedLocation.name}
            onChange={(e) => {
              const match = PRESET_LOCATIONS.find((loc) => loc.name === e.target.value);
              if (match) onSelectLocation(match);
            }}
            className="bg-dark-emerald/40 hover:bg-dark-emerald/60 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-xs text-emerald-200 font-medium cursor-pointer outline-none w-[120px] sm:w-[135px] lg:w-[150px] truncate flex-shrink-0 transition-colors"
            title="Select Target Disaster Sector"
          >
            {PRESET_LOCATIONS.map((loc) => (
              <option key={loc.name} value={loc.name} className="bg-charcoal text-jatayu-primary">
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Language Selector, Export SITREP, Refresh, Login */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-nowrap">
          {/* Language Selector */}
          <LanguageSelector className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs rounded-xl bg-obsidian/70 border-white/10 text-jatayu-primary" />

          {/* Export Situation Report on Operator Console */}
          {isOperatorTab && onExportSitrep && (
            <button
              onClick={onExportSitrep}
              className="p-1 sm:px-2.5 sm:py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold shadow-[0_0_10px_rgba(245,158,11,0.15)] whitespace-nowrap flex-shrink-0"
              title={t('sitrep.exportBtn')}
            >
              <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="hidden 2xl:inline">{t('sitrep.exportBtn')}</span>
              <span className="hidden sm:inline 2xl:hidden">SITREP</span>
            </button>
          )}

          {/* Refresh Action */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 sm:px-2.5 sm:py-1 bg-obsidian/60 border border-white/10 hover:bg-white/5 text-jatayu-secondary hover:text-jatayu-primary rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs font-medium whitespace-nowrap flex-shrink-0"
              title={t('topbar.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden 2xl:inline">{t('topbar.refresh')}</span>
            </button>
          )}

          <div className="h-4 w-px bg-white/10 hidden sm:block flex-shrink-0" />

          {/* Response Console Button / Role Badge */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 bg-dark-emerald/50 border border-emerald-500/40 rounded-xl text-xs text-white flex-shrink-0 whitespace-nowrap shadow-[0_0_12px_rgba(0,217,154,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 shadow-[0_0_6px_#00D99A]" />
              <span className="font-mono text-[10px] font-semibold text-emerald-200 hidden md:inline truncate max-w-[100px]">
                {user.displayName || user.username}
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-full uppercase font-bold flex-shrink-0">
                {user.role}
              </span>
              <button
                onClick={logout}
                className="ml-1 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 text-[11px] font-mono uppercase cursor-pointer flex-shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-3 h-3 flex-shrink-0" />
                <span className="hidden md:inline">{t('topbar.logout')}</span>
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-dark-emerald/60 hover:bg-dark-emerald text-emerald-300 text-xs font-mono font-bold rounded-xl border border-emerald-500/40 transition-all shadow-[0_0_15px_rgba(0,217,154,0.2)] cursor-pointer whitespace-nowrap flex-shrink-0"
              title="Access Authorized Response & Researcher Tools"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="hidden sm:inline">{t('topbar.commandSignIn')}</span>
              <span className="sm:hidden text-[10px]">LOGIN</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Dedicated Compact Mobile Location Search & Sector Presets */}
      <div className="flex sm:hidden items-center gap-1.5 mt-2 pt-2 border-t border-white/10 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setIsDropdownOpen(true);
            }}
            placeholder={t('home.searchPlaceholder')}
            className="w-full pl-7 pr-2 py-1 text-[11px] bg-obsidian/70 border border-white/10 rounded-xl text-jatayu-primary focus:outline-none focus:border-emerald-500 font-sans truncate"
          />
        </div>
        <button
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className="p-1.5 bg-dark-emerald/50 hover:bg-dark-emerald text-emerald-400 rounded-xl border border-emerald-500/40 flex-shrink-0"
          title={t('home.useLocationBtn')}
        >
          <Compass className={`w-3.5 h-3.5 text-emerald-400 ${geoLoading ? 'animate-spin' : ''}`} />
        </button>
        <select
          value={selectedLocation.name}
          onChange={(e) => {
            const match = PRESET_LOCATIONS.find((loc) => loc.name === e.target.value);
            if (match) onSelectLocation(match);
          }}
          className="bg-charcoal border border-white/10 rounded-xl px-2 py-1 text-[11px] text-jatayu-primary font-medium outline-none max-w-[120px] truncate flex-shrink-0"
        >
          {PRESET_LOCATIONS.map((loc) => (
            <option key={loc.name} value={loc.name} className="bg-charcoal text-jatayu-primary">
              {loc.name.split(' ')[0]}
            </option>
          ))}
        </select>
      </div>

      {/* Geolocation feedback notification banner */}
      {geoNotice && (
        <div className="absolute top-full left-4 right-4 mt-2 p-2.5 bg-amber-950/90 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center justify-between z-50 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{geoNotice}</span>
          </div>
          <button onClick={() => setGeoNotice(null)} className="text-amber-400 font-bold ml-2">
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
