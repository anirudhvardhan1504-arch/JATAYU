import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Navigation2,
  Car,
  Footprints,
  Bike,
  AlertTriangle,
  Compass,
  Loader2,
  ShieldCheck,
  Info,
  MapPin,
  ArrowUpDown,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import {
  LocationPoint,
  TravelMode,
  RoutePlanResponse,
  EmergencyFacility,
  GeocodingResult,
  FacilityCategory,
} from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  planSafeRoute,
  searchPlaces,
  getEmergencyFacilities,
  reverseGeocodeLocation,
} from '../services/route';
import { SafeRouteMap } from '../components/route/SafeRouteMap';
import { RouteComparisonCard } from '../components/route/RouteComparisonCard';
import { FacilityCard } from '../components/route/FacilityCard';

interface SafeRoutePageProps {
  currentSector: { name: string; lat: number; lon: number };
}

export const SafeRoutePage: React.FC<SafeRoutePageProps> = ({ currentSector }) => {
  const { t } = useLanguage();

  // Inputs
  const [originInput, setOriginInput] = useState('Chennai Central');
  const [originCoords, setOriginCoords] = useState<LocationPoint>({
    latitude: 13.0827,
    longitude: 80.2755,
    name: 'Puratchi Thalaivar Dr. M.G. Ramachandran Central Railway Station',
  });

  const [destinationInput, setDestinationInput] = useState('Saidapet');
  const [destinationCoords, setDestinationCoords] = useState<LocationPoint>({
    latitude: 13.021,
    longitude: 80.223,
    name: 'Saidapet Metro / Arterial Junction, Chennai',
  });

  const [travelMode, setTravelMode] = useState<TravelMode>('driving');

  // Debounced geocoding search state
  const [originSuggestions, setOriginSuggestions] = useState<GeocodingResult[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GeocodingResult[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const originDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const destDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Route Plan State
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Emergency Facilities State
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [facilityFilter, setFacilityFilter] = useState<'ALL' | FacilityCategory>('ALL');
  const [selectedFacility, setSelectedFacility] = useState<EmergencyFacility | null>(null);
  const [facilityRadiusMeters, setFacilityRadiusMeters] = useState<number>(5000);
  const [facilityFocalPoint, setFacilityFocalPoint] = useState<'origin' | 'destination'>('origin');
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(false);

  // Geolocation Opt-in state
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isRequestingGeo, setIsRequestingGeo] = useState(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);

  // Map click-to-pick state
  const [pickingMode, setPickingMode] = useState<'origin' | 'destination' | null>(null);

  // Quick Nationwide Presets
  const QUICK_PRESETS = [
    {
      label: 'Chennai Corridor',
      orig: { lat: 13.0827, lon: 80.2755, name: 'Puratchi Thalaivar Dr. M.G.R. Central Station, Chennai' },
      dest: { lat: 13.0210, lon: 80.2230, name: 'Saidapet Metro, Chennai' },
    },
    {
      label: 'Mumbai Western',
      orig: { lat: 18.9400, lon: 72.8353, name: 'CSMT Mumbai' },
      dest: { lat: 19.0596, lon: 72.8295, name: 'Bandra West, Mumbai' },
    },
    {
      label: 'Delhi AIIMS',
      orig: { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, New Delhi' },
      dest: { lat: 28.5672, lon: 77.2100, name: 'AIIMS New Delhi' },
    },
    {
      label: 'Bengaluru Tech',
      orig: { lat: 12.9716, lon: 77.5946, name: 'Majestic City Station, Bengaluru' },
      dest: { lat: 12.9698, lon: 77.7499, name: 'Whitefield, Bengaluru' },
    },
    {
      label: 'Delhi → Jaipur',
      orig: { lat: 28.6139, lon: 77.2090, name: 'Connaught Place, New Delhi' },
      dest: { lat: 26.9124, lon: 75.7873, name: 'Jaipur Junction, Rajasthan' },
    },
    {
      label: 'Chennai → Bengaluru',
      orig: { lat: 13.0827, lon: 80.2755, name: 'Chennai Central' },
      dest: { lat: 12.9716, lon: 77.5946, name: 'Majestic Station, Bengaluru' },
    },
  ];

  // Dynamic nearby facility loading
  const focalCoords = facilityFocalPoint === 'origin' ? originCoords : destinationCoords;

  const loadFacilities = useCallback(async () => {
    setIsLoadingFacilities(true);
    try {
      const res = await getEmergencyFacilities(
        focalCoords.latitude,
        focalCoords.longitude,
        facilityFilter === 'ALL' ? undefined : facilityFilter,
        facilityRadiusMeters
      );
      setFacilities(res.facilities);
    } catch (err) {
      console.warn('[SafeRoutePage] Failed to fetch facilities:', err);
    } finally {
      setIsLoadingFacilities(false);
    }
  }, [focalCoords.latitude, focalCoords.longitude, facilityFilter, facilityRadiusMeters]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // Robust Geolocation Workflow with Secure-Context validation & finite retry
  const executeGeolocation = (retryCount = 0) => {
    setIsRequestingGeo(true);

    const options = {
      enableHighAccuracy: retryCount === 0,
      timeout: retryCount === 0 ? 8000 : 12000,
      maximumAge: 30000,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsRequestingGeo(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setAccuracyMeters(accuracy ? Math.round(accuracy) : null);
        const fallbackName = `Current Location (${latitude.toFixed(4)}°N, ${longitude.toFixed(4)}°E)`;
        setOriginCoords({ latitude, longitude, name: fallbackName });
        setOriginInput(fallbackName);
        setGeoError(null);

        reverseGeocodeLocation(latitude, longitude)
          .then((resolved) => {
            if (resolved) {
              setOriginInput(resolved);
              setOriginCoords((prev) => ({ ...prev, name: resolved }));
            }
          })
          .catch(() => {
            // Keep fallback coordinate name, coordinates intact
          });
      },
      (err) => {
        if (retryCount === 0 && (err.code === 2 || err.code === 3)) {
          // Retry once with standard accuracy
          executeGeolocation(1);
          return;
        }
        setIsRequestingGeo(false);
        setAccuracyMeters(null);
        if (err.code === 1) {
          setGeoError('Browser location access was denied. Please enter an address manually.');
        } else if (err.code === 3) {
          setGeoError('GPS location request timed out. Please retry or click "Pick on Map".');
        } else {
          setGeoError('Unable to retrieve location. Please type an address.');
        }
      },
      options
    );
  };

  const handleUseMyLocation = async () => {
    const isTestEnv = typeof process !== 'undefined' && (process.env as any)?.NODE_ENV === 'test';
    const isSecure =
      isTestEnv ||
      (typeof window !== 'undefined' &&
        (window.isSecureContext ||
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'));

    if (!isSecure) {
      setGeoError(
        t('saferoute.geoInsecure') ||
          'Browser geolocation requires a secure context (HTTPS or localhost). Please click "Pick on Map" or search.'
      );
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (perm.state === 'denied') {
          setGeoError(
            t('saferoute.geoDenied') ||
              'Browser location access was denied. Please enable permissions or click "Pick on Map".'
          );
          return;
        }
      } catch {
        // Permissions query optional support
      }
    }

    setGeoError(null);
    executeGeolocation(0);
  };

  // Swap Origin and Destination
  const handleSwapLocations = () => {
    const tempInput = originInput;
    const tempCoords = originCoords;
    setOriginInput(destinationInput);
    setOriginCoords(destinationCoords);
    setDestinationInput(tempInput);
    setDestinationCoords(tempCoords);
  };

  // Map click-to-pick handler
  const handleMapPick = (coords: { lat: number; lon: number }, mode: 'origin' | 'destination') => {
    setPickingMode(null);
    const fallbackName = `Selected Map Location (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})`;
    if (mode === 'origin') {
      setOriginCoords({ latitude: coords.lat, longitude: coords.lon, name: fallbackName });
      setOriginInput(fallbackName);
      setGeoError(null);
      reverseGeocodeLocation(coords.lat, coords.lon).then((resolved) => {
        if (resolved) {
          setOriginInput(resolved);
          setOriginCoords((prev) => ({ ...prev, name: resolved }));
        }
      });
    } else {
      setDestinationCoords({ latitude: coords.lat, longitude: coords.lon, name: fallbackName });
      setDestinationInput(fallbackName);
      reverseGeocodeLocation(coords.lat, coords.lon).then((resolved) => {
        if (resolved) {
          setDestinationInput(resolved);
          setDestinationCoords((prev) => ({ ...prev, name: resolved }));
        }
      });
    }
  };

  // Debounced Search Origin
  const handleOriginSearch = (val: string) => {
    setOriginInput(val);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (val.trim().length < 2) {
      setOriginSuggestions([]);
      setIsSearchingOrigin(false);
      return;
    }
    setIsSearchingOrigin(true);
    originDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(val);
        setOriginSuggestions(results);
      } catch {
        setOriginSuggestions([]);
      } finally {
        setIsSearchingOrigin(false);
      }
    }, 300);
  };

  // Debounced Search Destination
  const handleDestSearch = (val: string) => {
    setDestinationInput(val);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    if (val.trim().length < 2) {
      setDestSuggestions([]);
      setIsSearchingDest(false);
      return;
    }
    setIsSearchingDest(true);
    destDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(val);
        setDestSuggestions(results);
      } catch {
        setDestSuggestions([]);
      } finally {
        setIsSearchingDest(false);
      }
    }, 300);
  };

  // Select Facility as Destination
  const handleSelectFacilityAsDestination = (fac: EmergencyFacility) => {
    setDestinationCoords({
      latitude: fac.location.latitude,
      longitude: fac.location.longitude,
      name: fac.name,
      address: fac.address,
    });
    setDestinationInput(fac.name);
    setSelectedFacility(fac);
  };

  // Calculate Safe Route
  const handleCalculateRoute = useCallback(async () => {
    setIsCalculating(true);
    setRouteError(null);

    try {
      const plan = await planSafeRoute(originCoords, destinationCoords, travelMode);
      setRoutePlan(plan);
      setSelectedRouteId(plan.recommendedRouteId || plan.routes[0]?.id || null);
    } catch (err: any) {
      setRoutePlan(null);
      setRouteError(
        err.message || 'Routing provider unavailable. Verify network connectivity or check coordinates.'
      );
    } finally {
      setIsCalculating(false);
    }
  }, [originCoords, destinationCoords, travelMode]);

  const filteredFacilities = facilities.filter((f) => {
    if (facilityFilter === 'ALL') return true;
    return f.category === facilityFilter;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Disclaimer */}
      <div className="bg-navy-900 border border-navy-800 rounded-lg p-4 shadow-sm text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              {t('tab.saferoute')}
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/40">
              {t('badge.saferoute')}
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            SECTOR: <span className="text-amber-300 font-semibold">{currentSector.name}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-sans">
          {t('saferoute.advisoryDisclaimer')}
        </p>
      </div>

      {/* Main Grid: Control & Comparison Sidebars + Map Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Route Inputs & Alternatives (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Input Panel Card */}
          <div className="bg-navy-900 border border-navy-800 rounded-lg p-4 shadow-sm space-y-3.5">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>ROUTE CONFIGURATION</span>
              <span className="text-[10px] text-slate-500 font-normal">OSRM + IMD HAZARD ENGINE</span>
            </div>

            {/* Origin Input */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  {t('saferoute.origin')}
                </label>
                {accuracyMeters !== null && (
                  <span className="text-[9px] font-mono text-emerald-400">
                    GPS Accuracy: ±{accuracyMeters}m
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => handleOriginSearch(e.target.value)}
                    placeholder="Type landmark, station, or lat, lon..."
                    className="w-full bg-navy-950 border border-navy-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  {isSearchingOrigin && (
                    <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Map Pick Start Button */}
                <button
                  type="button"
                  onClick={() => setPickingMode(pickingMode === 'origin' ? null : 'origin')}
                  className={`px-2 py-1.5 border rounded text-[11px] font-mono flex items-center gap-1 transition-colors ${
                    pickingMode === 'origin'
                      ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold animate-pulse'
                      : 'bg-navy-800 hover:bg-navy-700 text-amber-400 border-navy-700'
                  }`}
                  title="Pick start location on 2D map"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('saferoute.pickOnMap')}</span>
                </button>

                {/* Use Location Button */}
                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isRequestingGeo}
                  className="px-2 py-1.5 bg-navy-800 hover:bg-navy-700 text-sky-400 border border-navy-700 rounded text-[11px] font-mono flex items-center gap-1 transition-colors disabled:opacity-50"
                  title={t('saferoute.useLocation')}
                >
                  <Compass className={`w-3.5 h-3.5 ${isRequestingGeo ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">My Location</span>
                </button>
              </div>

              {/* Geolocation Warning / Error State */}
              {geoError && (
                <div className="p-2.5 bg-red-950/70 border border-red-800/80 rounded mt-2 text-[11px] text-red-300 space-y-1.5 font-sans">
                  <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-[10px] uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>GEOLOCATION NOTICE</span>
                  </div>
                  <p>{geoError}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      className="px-2 py-0.5 bg-red-900 hover:bg-red-800 text-white rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>RETRY GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPickingMode('origin');
                        setGeoError(null);
                      }}
                      className="px-2 py-0.5 bg-navy-800 hover:bg-navy-700 text-amber-300 border border-navy-700 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>PICK ON MAP</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestions dropdown */}
              {originSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-950 border border-navy-700 rounded-md shadow-xl max-h-48 overflow-y-auto">
                  {originSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setOriginCoords({
                          latitude: s.latitude,
                          longitude: s.longitude,
                          name: s.displayName,
                        });
                        setOriginInput(s.displayName);
                        setOriginSuggestions([]);
                      }}
                      className="p-2 hover:bg-navy-800 cursor-pointer text-[11px] text-slate-300 border-b border-navy-900 last:border-0 font-mono flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{s.displayName}</span>
                      <span className="text-[9px] text-slate-500 uppercase flex-shrink-0">
                        {s.type || 'place'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="px-3 py-1 bg-navy-950 hover:bg-navy-800 text-slate-400 hover:text-white border border-navy-700 rounded-full text-[10px] font-mono flex items-center gap-1.5 transition-colors shadow"
                title={t('saferoute.swap')}
              >
                <ArrowUpDown className="w-3 h-3 text-sky-400" />
                <span>{t('saferoute.swap')}</span>
              </button>
            </div>

            {/* Destination Input */}
            <div className="relative">
              <label className="block text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {t('saferoute.destination')}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={destinationInput}
                    onChange={(e) => handleDestSearch(e.target.value)}
                    placeholder="Type landmark, hospital, shelter, or city..."
                    className="w-full bg-navy-950 border border-navy-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  {isSearchingDest && (
                    <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Map Pick Destination Button */}
                <button
                  type="button"
                  onClick={() => setPickingMode(pickingMode === 'destination' ? null : 'destination')}
                  className={`px-2 py-1.5 border rounded text-[11px] font-mono flex items-center gap-1 transition-colors ${
                    pickingMode === 'destination'
                      ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold animate-pulse'
                      : 'bg-navy-800 hover:bg-navy-700 text-amber-400 border-navy-700'
                  }`}
                  title="Pick destination location on 2D map"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('saferoute.pickOnMap')}</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              {destSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-navy-950 border border-navy-700 rounded-md shadow-xl max-h-48 overflow-y-auto">
                  {destSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setDestinationCoords({
                          latitude: s.latitude,
                          longitude: s.longitude,
                          name: s.displayName,
                        });
                        setDestinationInput(s.displayName);
                        setDestSuggestions([]);
                      }}
                      className="p-2 hover:bg-navy-800 cursor-pointer text-[11px] text-slate-300 border-b border-navy-900 last:border-0 font-mono flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{s.displayName}</span>
                      <span className="text-[9px] text-slate-500 uppercase flex-shrink-0">
                        {s.type || 'place'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Nationwide Presets */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {t('saferoute.presets')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setOriginCoords({ latitude: p.orig.lat, longitude: p.orig.lon, name: p.orig.name });
                      setOriginInput(p.orig.name);
                      setDestinationCoords({ latitude: p.dest.lat, longitude: p.dest.lon, name: p.dest.name });
                      setDestinationInput(p.dest.name);
                    }}
                    className="px-2 py-0.5 bg-navy-950 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-700 rounded text-[10px] font-mono transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Mode Toggle */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1">
                TRAVEL MODE
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: 'driving' as TravelMode, label: t('saferoute.modeDriving'), icon: <Car className="w-3.5 h-3.5" /> },
                  { mode: 'walking' as TravelMode, label: t('saferoute.modeWalking'), icon: <Footprints className="w-3.5 h-3.5" /> },
                  { mode: 'cycling' as TravelMode, label: t('saferoute.modeCycling'), icon: <Bike className="w-3.5 h-3.5" /> },
                ].map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={`py-1.5 px-2 rounded border text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      travelMode === mode
                        ? 'bg-sky-600 border-sky-400 text-white'
                        : 'bg-navy-950 border-navy-700 text-slate-400 hover:text-white hover:bg-navy-800'
                    }`}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Calculate Button */}
            <button
              onClick={handleCalculateRoute}
              disabled={isCalculating}
              className="w-full py-2 px-4 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded font-mono font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('saferoute.calculating')}</span>
                </>
              ) : (
                <>
                  <Navigation2 className="w-4 h-4" />
                  <span>{t('saferoute.calculate')}</span>
                </>
              )}
            </button>
          </div>

          {/* Route Calculation Error */}
          {routeError && (
            <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs space-y-2 font-sans">
              <div className="font-mono font-bold text-red-400 flex items-center gap-1.5 uppercase text-[11px]">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>ROUTING ERROR</span>
              </div>
              <p>{routeError}</p>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-red-400/80 font-mono">
                  Provider: Open Source Routing Machine (OSRM)
                </p>
                <button
                  type="button"
                  onClick={handleCalculateRoute}
                  className="px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('saferoute.retry')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Route Comparison Panel */}
          {routePlan && routePlan.routes.length > 0 && (
            <div className="space-y-3">
              {/* Comparison Summary Banner */}
              <div className="p-3 bg-navy-900 border border-navy-800 rounded-lg text-xs text-slate-300 space-y-1">
                <div className="font-mono font-bold text-amber-400 text-[10px] uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>HAZARD EVALUATION SYNTHESIS</span>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">
                  {routePlan.comparisonSummary}
                </p>
              </div>

              {/* Route Alternatives List */}
              <div className="space-y-2.5">
                {routePlan.routes.map((route) => (
                  <RouteComparisonCard
                    key={route.id}
                    route={route}
                    isSelected={route.id === selectedRouteId}
                    onSelect={() => setSelectedRouteId(route.id)}
                    origin={originCoords}
                    destination={destinationCoords}
                    travelMode={travelMode}
                  />
                ))}
              </div>

              {/* Data Limits Caveats */}
              <div className="p-3 bg-navy-950 border border-navy-800 rounded-lg text-[10px] text-slate-400 space-y-1 font-mono">
                <div className="font-bold text-slate-300 uppercase flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  <span>{t('saferoute.limitationsTitle')}</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1 font-sans">
                  {routePlan.knownLimitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Map Visualization & Nearby Verified Facilities (7 cols) */}
        <div className="lg:col-span-7 space-y-4 flex flex-col">
          {/* Map Container */}
          <div className="h-[460px] w-full rounded-lg overflow-hidden border border-navy-800 shadow-md">
            <SafeRouteMap
              center={[currentSector.lon, currentSector.lat]}
              origin={originCoords}
              destination={destinationCoords}
              routes={routePlan?.routes || []}
              selectedRouteId={selectedRouteId}
              onSelectRoute={(id) => setSelectedRouteId(id)}
              facilities={facilities}
              selectedFacility={selectedFacility}
              onSelectFacility={(fac) => setSelectedFacility(fac)}
              onSetDestination={handleSelectFacilityAsDestination}
              pickingMode={pickingMode}
              onMapPick={handleMapPick}
              onCancelPick={() => setPickingMode(null)}
            />
          </div>

          {/* Dynamic Emergency Facilities Discovery Directory */}
          <div className="bg-navy-900 border border-navy-800 rounded-lg p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-800 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                    {t('saferoute.facilitiesTitle')}
                  </h4>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800/60">
                    {facilities.length} found
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  Live OpenStreetMap & verified civil defense registries within {(facilityRadiusMeters / 1000).toFixed(0)} km
                </p>
              </div>

              {/* Controls: Focal Point & Radius Selector */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Focal Point Toggle */}
                <div className="flex items-center bg-navy-950 p-0.5 rounded border border-navy-800 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setFacilityFocalPoint('origin')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      facilityFocalPoint === 'origin'
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('saferoute.nearOrigin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacilityFocalPoint('destination')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      facilityFocalPoint === 'destination'
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t('saferoute.nearDestination')}
                  </button>
                </div>

                {/* Radius Dropdown */}
                <select
                  value={facilityRadiusMeters}
                  onChange={(e) => setFacilityRadiusMeters(Number(e.target.value))}
                  className="bg-navy-950 border border-navy-800 rounded px-2 py-1 text-[10px] font-mono text-slate-300 focus:outline-none focus:border-sky-500"
                >
                  <option value={5000}>Radius: 5 km</option>
                  <option value={10000}>Radius: 10 km</option>
                  <option value={25000}>Radius: 25 km</option>
                  <option value={50000}>Radius: 50 km</option>
                </select>

                {/* Refresh Facilities Button */}
                <button
                  type="button"
                  onClick={loadFacilities}
                  disabled={isLoadingFacilities}
                  className="p-1 bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded text-slate-400 hover:text-white transition-colors"
                  title={t('saferoute.refreshFacilities')}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFacilities ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 bg-navy-950 p-0.5 rounded border border-navy-800 text-[10px] font-mono">
                {[
                  { id: 'ALL' as const, label: t('saferoute.filterAll') },
                  { id: 'SHELTER' as const, label: t('saferoute.filterShelters') },
                  { id: 'HOSPITAL' as const, label: t('saferoute.filterHospitals') },
                  { id: 'FIRE_STATION' as const, label: t('saferoute.filterFire') },
                  { id: 'EMERGENCY_OPS' as const, label: t('saferoute.filterOps') },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setFacilityFilter(id)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      facilityFilter === id
                        ? 'bg-sky-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="text-[9px] font-mono text-amber-400/90 italic">
                {t('saferoute.statusUnknown')}
              </div>
            </div>

            {/* Facilities Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {filteredFacilities.length > 0 ? (
                filteredFacilities.map((fac) => (
                  <FacilityCard
                    key={fac.id}
                    facility={fac}
                    isSelected={selectedFacility?.id === fac.id}
                    onSelectAsDestination={handleSelectFacilityAsDestination}
                  />
                ))
              ) : (
                <div className="col-span-2 p-6 text-center text-xs text-slate-500 font-mono">
                  {isLoadingFacilities
                    ? 'Discovering emergency facilities within radius...'
                    : 'No emergency facilities matched the selected category and search radius.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
