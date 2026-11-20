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
import { EvacuationInstructionsPanel } from '../components/route/EvacuationInstructionsPanel';

interface SafeRoutePageProps {
  currentSector: { name: string; lat: number; lon: number };
  initialFacility?: EmergencyFacility | null;
  onFacilityConsumed?: () => void;
}

export const SafeRoutePage: React.FC<SafeRoutePageProps> = ({ currentSector, initialFacility, onFacilityConsumed }) => {
  const { t } = useLanguage();

  const pendingFacility = useRef<EmergencyFacility | null>(null);
  const handledFacility = useRef<EmergencyFacility | null>(null);

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
        setRoutePlan(null);
        const target = pendingFacility.current;
        if (target) {
          pendingFacility.current = null;
          setIsCalculating(true);
          setRouteError(null);
          planSafeRoute({ latitude, longitude, name: fallbackName }, {
            ...target.location, name: target.name, address: target.address,
          }, travelMode).then((plan) => {
            setRoutePlan(plan);
            setSelectedRouteId(plan.recommendedRouteId || plan.routes[0]?.id || null);
          }).catch((error) => {
            setRouteError(error.message || 'Routing provider unavailable. Please retry.');
          }).finally(() => setIsCalculating(false));
        }

        reverseGeocodeLocation(latitude, longitude)
          .then((resolved) => {
            if (resolved) {
              setOriginInput(resolved);
              setOriginCoords((prev) => ({ ...prev, name: resolved }));
            }
          })
          .catch(() => {
            // Keep fallback coordinate name
          });
      },
      (err) => {
        if (retryCount === 0 && (err.code === 2 || err.code === 3)) {
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
        // Optional permission query
      }
    }

    setGeoError(null);
    executeGeolocation(0);
  };

  // A facility action is an explicit request to route from the user's location.
  useEffect(() => {
    if (!initialFacility || handledFacility.current === initialFacility) return;
    handledFacility.current = initialFacility;
    pendingFacility.current = initialFacility;
    setDestinationCoords({ ...initialFacility.location, name: initialFacility.name, address: initialFacility.address });
    setDestinationInput(initialFacility.name);
    setSelectedFacility(initialFacility);
    setRoutePlan(null);
    setRouteError(null);
    onFacilityConsumed?.();
    void handleUseMyLocation();
  }, [initialFacility]);

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
      return;
    }

    setIsSearchingOrigin(true);
    originDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(val);
        setOriginSuggestions(results);
      } catch (err) {
        console.warn('Geocoding search error:', err);
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
      return;
    }

    setIsSearchingDest(true);
    destDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(val);
        setDestSuggestions(results);
      } catch (err) {
        console.warn('Geocoding search error:', err);
      } finally {
        setIsSearchingDest(false);
      }
    }, 300);
  };

  // Select Facility directly as Destination
  const handleSelectFacilityAsDestination = (facility: EmergencyFacility) => {
    setDestinationCoords({
      latitude: facility.location.latitude,
      longitude: facility.location.longitude,
      name: facility.name,
      address: facility.address,
    });
    setDestinationInput(facility.name);
    setSelectedFacility(facility);
  };

  useEffect(() => { setRoutePlan(null); setSelectedRouteId(null); }, [originCoords.latitude, originCoords.longitude, destinationCoords.latitude, destinationCoords.longitude, travelMode]);

  // Route Planning Execution
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
    return f.category === facilityFilter ||
      (facilityFilter === 'TRAUMA_CENTRE' && (f.category === 'ORR_TRAUMA_CENTRE' || !!f.capabilities?.includes('Trauma care'))) ||
      (facilityFilter === 'AMBULANCE_SERVICE' && !!f.capabilities?.includes('Ambulance service')) ||
      (facilityFilter === 'HOSPITAL' && ['TRAUMA_CENTRE','ORR_TRAUMA_CENTRE'].includes(f.category));
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Banner / Disclaimer */}
      <div className="bento-card p-4 text-jatayu-primary shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#00D99A]" />
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              {t('tab.saferoute')}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]">
              {t('badge.saferoute')}
            </span>
          </div>

          <div className="text-[11px] font-mono text-jatayu-muted">
            SECTOR: <span className="text-amber-300 font-semibold">{currentSector.name}</span>
          </div>
        </div>

        <p className="text-xs text-jatayu-secondary leading-relaxed font-sans">
          {t('saferoute.advisoryDisclaimer')}
        </p>
      </div>

      {/* Main Grid: Control & Comparison Sidebars + Map Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Route Inputs & Alternatives (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Input Panel Card */}
          <div className="bento-card p-5 space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-jatayu-primary flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="flex items-center gap-2">
                <Navigation2 className="w-4 h-4 text-emerald-400" />
                ROUTE CONFIGURATION
              </span>
              <span className="text-[10px] text-jatayu-muted font-normal">OSRM + IMD HAZARD ENGINE</span>
            </div>

            {/* Origin Input */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('saferoute.origin')}</span>
                </label>
                {accuracyMeters !== null && (
                  <span className="text-[10px] font-mono text-mint">
                    GPS Accuracy: ±{accuracyMeters}m
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={originInput}
                    onChange={(e) => handleOriginSearch(e.target.value)}
                    placeholder="Type landmark, station, or lat, lon..."
                    className="w-full bg-obsidian border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-jatayu-primary placeholder:text-jatayu-secondary focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40 font-sans transition-all shadow-inner"
                  />
                  {isSearchingOrigin && (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Map Pick Start Button */}
                <button
                  type="button"
                  onClick={() => setPickingMode(pickingMode === 'origin' ? null : 'origin')}
                  className={`px-3 py-2 border rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    pickingMode === 'origin'
                      ? 'bg-amber-400 border-amber-300 text-obsidian font-bold animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-surface-secondary hover:bg-white/10 text-amber-300 border-white/15'
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
                  className="px-3 py-2 bg-surface-secondary hover:bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-subtle"
                  title={t('saferoute.useLocation')}
                >
                  <Compass className={`w-3.5 h-3.5 text-emerald-400 ${isRequestingGeo ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">My Location</span>
                </button>
              </div>

              {/* Geolocation Warning / Error State */}
              {geoError && (
                <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-xl mt-2 text-[11px] text-red-200 space-y-1.5 font-sans backdrop-blur-md">
                  <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-[10px] uppercase">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>GEOLOCATION NOTICE</span>
                  </div>
                  <p>{geoError}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      className="px-2.5 py-1 bg-red-850 hover:bg-red-800 text-white rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                      className="px-2.5 py-1 bg-charcoal hover:bg-white/5 text-amber-300 border border-white/10 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <MapPin className="w-3 h-3 text-amber-400" />
                      <span>PICK ON MAP</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestions dropdown */}
              {originSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-charcoal/95 border border-white/15 rounded-2xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-2xl">
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
                      className="p-2.5 hover:bg-white/5 cursor-pointer text-[11px] text-jatayu-primary border-b border-white/5 last:border-0 font-mono flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{s.displayName}</span>
                      <span className="text-[9px] text-emerald-400 uppercase flex-shrink-0">
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
                className="px-3.5 py-1 bg-charcoal hover:bg-white/5 text-jatayu-secondary hover:text-white border border-white/10 rounded-full text-[10px] font-mono flex items-center gap-1.5 transition-all shadow-subtle cursor-pointer"
                title={t('saferoute.swap')}
              >
                <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                <span>{t('saferoute.swap')}</span>
              </button>
            </div>

            {/* Destination Input */}
            <div className="relative">
              <label className="block text-[11px] font-mono font-semibold text-emerald-400 uppercase tracking-wider mb-1.5">
                {t('saferoute.destination')}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={destinationInput}
                    onChange={(e) => handleDestSearch(e.target.value)}
                    placeholder="Type landmark, hospital, shelter, or city..."
                    className="w-full bg-obsidian/70 border border-white/10 rounded-xl px-3 py-2 text-xs text-jatayu-primary placeholder:text-jatayu-muted focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                  />
                  {isSearchingDest && (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Map Pick Destination Button */}
                <button
                  type="button"
                  onClick={() => setPickingMode(pickingMode === 'destination' ? null : 'destination')}
                  className={`px-2.5 py-2 border rounded-xl text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    pickingMode === 'destination'
                      ? 'bg-amber-500 border-amber-300 text-slate-950 font-bold animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : 'bg-charcoal hover:bg-white/5 text-amber-400 border-white/10'
                  }`}
                  title="Pick destination location on 2D map"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('saferoute.pickOnMap')}</span>
                </button>
              </div>

              {/* Suggestions dropdown */}
              {destSuggestions.length > 0 && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-charcoal/95 border border-white/15 rounded-2xl shadow-2xl max-h-48 overflow-y-auto backdrop-blur-2xl">
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
                      className="p-2.5 hover:bg-white/5 cursor-pointer text-[11px] text-jatayu-primary border-b border-white/5 last:border-0 font-mono flex items-center justify-between"
                    >
                      <span className="truncate pr-2">{s.displayName}</span>
                      <span className="text-[9px] text-emerald-400 uppercase flex-shrink-0">
                        {s.type || 'place'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Nationwide Presets */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-jatayu-muted uppercase tracking-wider mb-1.5">
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
                    className="px-2.5 py-1 bg-obsidian/60 hover:bg-white/5 text-jatayu-secondary hover:text-jatayu-primary border border-white/10 rounded-lg text-[10px] font-mono transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Travel Mode Toggle */}
            <div>
              <label className="block text-[10px] font-mono font-semibold text-jatayu-muted uppercase tracking-wider mb-1">
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
                    className={`py-2 px-2 rounded-xl border text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      travelMode === mode
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(0,217,154,0.2)]'
                        : 'bg-obsidian/70 border-white/10 text-jatayu-secondary hover:text-white hover:bg-white/5'
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
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-mono font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,217,154,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
            <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-200 text-xs space-y-2 font-sans shadow-panel backdrop-blur-md">
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
                  className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded-lg text-[10px] font-mono font-bold uppercase flex items-center gap-1 transition-colors cursor-pointer"
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
              <div className="p-3.5 bento-card text-xs text-jatayu-primary space-y-1">
                <div className="font-mono font-bold text-amber-400 text-[10px] uppercase flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>HAZARD EVALUATION SYNTHESIS</span>
                </div>
                <p className="text-jatayu-secondary font-sans text-xs leading-relaxed">
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
              <div className="p-3 bg-obsidian/70 border border-white/10 rounded-2xl text-[10px] text-jatayu-muted space-y-1 font-mono">
                <div className="font-bold text-jatayu-secondary uppercase flex items-center gap-1">
                  <Info className="w-3 h-3 text-jatayu-muted" />
                  <span>{t('saferoute.limitationsTitle')}</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-jatayu-muted pl-1 font-sans">
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
          <div className="h-[460px] w-full rounded-2xl overflow-hidden border border-white/10 shadow-bento">
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
          <div className="bento-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-jatayu-primary">
                    {t('saferoute.facilitiesTitle')}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                    {facilities.length} found
                  </span>
                </div>
                <p className="text-[10px] text-jatayu-muted font-sans">
                  Live OpenStreetMap & verified civil defense registries within {(facilityRadiusMeters / 1000).toFixed(0)} km
                </p>
              </div>

              {/* Controls: Focal Point & Radius Selector */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Focal Point Toggle */}
                <div className="flex items-center bg-obsidian/70 p-0.5 rounded-xl border border-white/10 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setFacilityFocalPoint('origin')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      facilityFocalPoint === 'origin'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-jatayu-muted hover:text-jatayu-primary'
                    }`}
                  >
                    {t('saferoute.nearOrigin')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFacilityFocalPoint('destination')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      facilityFocalPoint === 'destination'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-jatayu-muted hover:text-jatayu-primary'
                    }`}
                  >
                    {t('saferoute.nearDestination')}
                  </button>
                </div>

                {/* Radius Dropdown */}
                <select
                  value={facilityRadiusMeters}
                  onChange={(e) => setFacilityRadiusMeters(Number(e.target.value))}
                  className="bg-charcoal border border-white/10 rounded-xl px-2.5 py-1 text-[10px] font-mono text-jatayu-primary focus:outline-none focus:border-emerald-500"
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
                  className="p-1.5 bg-charcoal hover:bg-white/5 border border-white/10 rounded-xl text-jatayu-secondary hover:text-jatayu-primary transition-colors cursor-pointer"
                  title={t('saferoute.refreshFacilities')}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFacilities ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Category Filter Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 bg-obsidian/70 p-1 rounded-xl border border-white/10 text-[10px] font-mono">
                {[
                  { id: 'ALL' as const, label: t('saferoute.filterAll') },
                  { id: 'SHELTER' as const, label: t('saferoute.filterShelters') },
                  { id: 'HOSPITAL' as const, label: t('saferoute.filterHospitals') },
                  { id: 'TRAUMA_CENTRE' as const, label: t('facilities.filterTrauma') },
                  { id: 'AMBULANCE_SERVICE' as const, label: t('facilities.filterAmbulance') },
                  { id: 'FIRE_STATION' as const, label: t('saferoute.filterFire') },
                  { id: 'EMERGENCY_OPS' as const, label: t('saferoute.filterOps') },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setFacilityFilter(id)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      facilityFilter === id
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-jatayu-muted hover:text-jatayu-primary'
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
                <div className="col-span-2 p-6 text-center text-xs text-jatayu-muted font-mono">
                  {isLoadingFacilities
                    ? 'Discovering emergency facilities within radius...'
                    : 'No emergency facilities matched the selected category and search radius.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multilingual Intelligent Evacuation Instructions & Guidance Protocol */}
      <EvacuationInstructionsPanel
        locality={originCoords.name || destinationCoords.name || currentSector.name}
        disasterType="FLOOD"
        severity={routePlan?.routes.some((r) => r.riskTier === 'CRITICAL') ? 'CRITICAL' : 'HIGH'}
        nearbyFacilities={facilities}
      />
    </div>
  );
};
