import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Cross,
  Home,
  Shield,
  ExternalLink,
  Navigation2,
  RefreshCw,
  AlertCircle,
  Search,
  Map as MapIcon,
  List,
  PhoneCall,
} from 'lucide-react';
import { EmergencyFacility, FacilityCategory } from '../types';
import { getEmergencyFacilities } from '../services/route';
import { useLanguage } from '../context/LanguageContext';
import { TacticalMap } from '../components/map/TacticalMap';

interface FacilitiesPageProps {
  location: { name: string; lat: number; lon: number };
  onPlanRouteToFacility?: (facility: EmergencyFacility) => void;
}

export const FacilitiesPage: React.FC<FacilitiesPageProps> = ({
  location,
  onPlanRouteToFacility,
}) => {
  const { t } = useLanguage();
  const [facilities, setFacilities] = useState<EmergencyFacility[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const loadFacilities = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getEmergencyFacilities(
        location.lat,
        location.lon,
        selectedCategory === 'ALL' ? undefined : selectedCategory,
        radiusKm * 1000
      );
      setFacilities(res.facilities || []);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve emergency facilities.');
    } finally {
      setIsLoading(false);
    }
  }, [location.lat, location.lon, selectedCategory, radiusKm]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const filteredList = facilities.filter((f) => {
    if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      (f.address && f.address.toLowerCase().includes(q)) ||
      (f.district && f.district.toLowerCase().includes(q))
    );
  });

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const getCategoryIcon = (category: FacilityCategory) => {
    switch (category) {
      case 'HOSPITAL':
      case 'TRAUMA_CENTRE':
      case 'ORR_TRAUMA_CENTRE':
      case 'AMBULANCE_SERVICE':
        return <Cross className="w-4 h-4 text-red-400" />;
      case 'SHELTER':
      case 'RELIEF_CAMP':
      case 'GOVT_SCHOOL_SHELTER':
        return <Home className="w-4 h-4 text-emerald-400" />;
      case 'EMERGENCY_OPS':
      case 'FIRE_STATION':
      default:
        return <Shield className="w-4 h-4 text-amber-400" />;
    }
  };

  const getCategoryLabel = (category: FacilityCategory) => {
    switch (category) {
      case 'HOSPITAL':
        return t('facilities.filterHospitals');
      case 'TRAUMA_CENTRE':
      case 'ORR_TRAUMA_CENTRE':
        return 'Trauma Center';
      case 'AMBULANCE_SERVICE':
        return 'Ambulance Unit';
      case 'SHELTER':
      case 'RELIEF_CAMP':
        return t('facilities.filterShelters');
      case 'GOVT_SCHOOL_SHELTER':
        return 'Govt School Shelter';
      case 'EMERGENCY_OPS':
      case 'FIRE_STATION':
      default:
        return t('facilities.filterOps');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400/90">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Emergency Civil Defense Registry</span>
          </div>
          <h1 className="text-2xl font-bold text-jatayu-primary tracking-tight mt-1 font-sans">
            {t('facilities.pageTitle')}
          </h1>
          <p className="text-xs text-jatayu-secondary mt-0.5 font-sans">
            {t('facilities.pageSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-obsidian/70 p-1 rounded-xl border border-white/10 text-xs shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(0,217,154,0.2)] font-semibold'
                  : 'text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(0,217,154,0.2)] font-semibold'
                  : 'text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-2 bg-charcoal/80 rounded-xl border border-white/10 text-xs text-jatayu-primary font-mono">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-medium truncate max-w-[200px]">{location.name}</span>
          </div>
          <button
            onClick={loadFacilities}
            disabled={isLoading}
            className="p-2 bg-charcoal/80 hover:bg-white/5 text-jatayu-secondary hover:text-jatayu-primary rounded-xl border border-white/10 transition-colors disabled:opacity-50 cursor-pointer shadow-subtle"
            title="Refresh facilities list"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Helplines Quick Access Directory */}
      <div className="bento-card p-3.5 border-emerald-500/30 shadow-[0_0_20px_rgba(0,217,154,0.1)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
            EMERGENCY HELPLINES:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <a href="tel:112" className="px-2.5 py-1 rounded-xl bg-red-950/80 text-red-200 border border-red-500/50 hover:bg-red-900 transition-colors shadow-[0_0_8px_rgba(239,68,68,0.2)]">
            112 <span className="text-[10px] text-red-300 font-sans">(National)</span>
          </a>
          <a href="tel:108" className="px-2.5 py-1 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-500/50 hover:bg-rose-900 transition-colors shadow-[0_0_8px_rgba(244,63,94,0.2)]">
            108 <span className="text-[10px] text-rose-300 font-sans">(Ambulance)</span>
          </a>
          <a href="tel:1070" className="px-2.5 py-1 rounded-xl bg-cyan-950/80 text-cyan-200 border border-cyan-500/50 hover:bg-cyan-900 transition-colors shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            1070 <span className="text-[10px] text-cyan-300 font-sans">(SEOC)</span>
          </a>
          <a href="tel:1077" className="px-2.5 py-1 rounded-xl bg-sky-950/80 text-sky-200 border border-sky-500/50 hover:bg-sky-900 transition-colors">
            1077 <span className="text-[10px] text-sky-300 font-sans">(DEOC)</span>
          </a>
          <a href="tel:1913" className="px-2.5 py-1 rounded-xl bg-amber-950/80 text-amber-200 border border-amber-500/50 hover:bg-amber-900 transition-colors shadow-[0_0_8px_rgba(245,158,11,0.2)]">
            1913 / 1916 <span className="text-[10px] text-amber-300 font-sans">(Flood Control)</span>
          </a>
          <a href="tel:1078" className="px-2.5 py-1 rounded-xl bg-emerald-950/80 text-emerald-200 border border-emerald-500/50 hover:bg-emerald-900 transition-colors shadow-[0_0_8px_rgba(0,217,154,0.2)]">
            1078 <span className="text-[10px] text-emerald-300 font-sans">(NDRF HQ)</span>
          </a>
        </div>
      </div>

      {/* Mandatory Availability Disclaimer */}
      <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 backdrop-blur-md shadow-panel">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold font-mono uppercase tracking-wider text-[11px] text-amber-300">
            Operational Availability Disclaimer
          </span>
          <p className="text-amber-200/90 leading-relaxed font-sans">
            {t('facilities.disclaimer')}
          </p>
        </div>
      </div>

      {/* Controls: Search, Category Filters, Radius */}
      <div className="bento-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-jatayu-muted absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search facility name or address..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-obsidian/70 border border-white/10 rounded-xl text-jatayu-primary focus:outline-none focus:border-emerald-500 font-sans placeholder:text-jatayu-muted transition-colors"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { id: 'ALL', label: t('facilities.filterAll') },
            { id: 'HOSPITAL', label: t('facilities.filterHospitals') },
            { id: 'SHELTER', label: t('facilities.filterShelters') },
            { id: 'EMERGENCY_OPS', label: t('facilities.filterOps') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(0,217,154,0.2)] font-semibold'
                  : 'bg-charcoal border border-white/10 hover:bg-white/5 text-jatayu-secondary hover:text-jatayu-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Radius Selector */}
        <div className="flex items-center gap-2 text-xs text-jatayu-secondary self-end md:self-center">
          <span className="font-mono text-[11px] uppercase">Radius:</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
            className="bg-charcoal border border-white/10 rounded-xl px-2.5 py-1 text-xs text-jatayu-primary font-medium cursor-pointer outline-none"
          >
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </div>
      </div>

      {/* Facilities Count & Status */}
      <div className="flex items-center justify-between text-xs font-mono text-jatayu-muted px-1">
        <span>Found {filteredList.length} emergency facilities near {location.name}</span>
        {isLoading && <span className="text-emerald-400">Querying registry...</span>}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center justify-between gap-3 shadow-panel">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadFacilities}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredList.length === 0 && (
        <div className="p-12 text-center bento-card space-y-3">
          <Building2 className="w-10 h-10 text-jatayu-muted mx-auto" />
          <h4 className="text-sm font-bold text-jatayu-primary">No Facilities Found In Range</h4>
          <p className="text-xs text-jatayu-secondary max-w-md mx-auto font-sans">
            No verified civil defense facilities matched the current category or search radius. Try increasing the search radius to 50 km or 100 km.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchFilter('');
              setRadiusKm(50);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl cursor-pointer shadow-[0_0_15px_rgba(0,217,154,0.3)] transition-all"
          >
            Expand Search to 50 km
          </button>
        </div>
      )}

      {/* Facility Display: Map vs Grid */}
      {viewMode === 'map' ? (
        <div className="h-[520px] w-full rounded-2xl overflow-hidden border border-white/10 shadow-bento relative">
          <TacticalMap
            center={[location.lon, location.lat]}
            zoom={12}
            locationName={location.name}
            showFacilities={true}
            facilities={filteredList}
            variant="full"
            hideDefaultControls={false}
            className="w-full h-full"
          />
        </div>
      ) : (
        /* Facility Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((f) => (
            <div
              key={f.id}
              className="p-5 bento-card flex flex-col justify-between space-y-4 group hover:border-emerald-500/40"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-dark-emerald/70 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(0,217,154,0.15)]">
                      {getCategoryIcon(f.category)}
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase font-semibold text-emerald-400">
                        {getCategoryLabel(f.category)}
                      </span>
                      <h3 className="text-sm font-bold text-jatayu-primary leading-snug group-hover:text-white transition-colors">
                        {f.name}
                      </h3>
                    </div>
                  </div>
                  {f.distanceKm !== undefined && (
                    <span className="px-2.5 py-0.5 bg-dark-emerald/60 text-mint border border-emerald-500/40 rounded-full font-mono font-bold text-[11px] whitespace-nowrap shadow-[0_0_8px_rgba(66,245,176,0.15)]">
                      {f.distanceKm} km
                    </span>
                  )}
                </div>

                {/* Address */}
                {f.address && (
                  <p className="text-xs text-jatayu-secondary leading-relaxed line-clamp-2 font-sans">
                    {f.address}
                  </p>
                )}

                {/* Authority & Last Verified if present */}
                {(f.responsibleAuthority || f.lastVerified) && (
                  <div className="text-[10px] font-mono text-jatayu-muted flex flex-wrap gap-x-2 pt-0.5">
                    {f.responsibleAuthority && <span>Auth: {f.responsibleAuthority}</span>}
                    {f.lastVerified && <span>Verified: {f.lastVerified}</span>}
                  </div>
                )}

                {/* Provenance & Verification Badge */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    f.verificationStatus === 'OFFICIALLY_VERIFIED' || f.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]'
                      : f.verificationStatus === 'PENDING_VERIFICATION'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-charcoal text-slate-400 border-white/10'
                  }`}>
                    {f.verificationStatus === 'OFFICIALLY_VERIFIED' || f.verificationStatus === 'VERIFIED'
                      ? 'OFFICIALLY VERIFIED'
                      : f.verificationStatus === 'PENDING_VERIFICATION'
                      ? 'PENDING VERIFICATION'
                      : 'COMMUNITY MAPPED'}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40">
                    VACANCY: UNKNOWN
                  </span>
                  {f.capacity && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                      Cap: {f.capacity}
                    </span>
                  )}
                </div>

                {/* Phone */}
                {f.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-jatayu-secondary font-mono pt-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <a href={`tel:${f.phone}`} className="hover:text-mint font-semibold">
                      {f.phone}
                    </a>
                  </div>
                )}
              </div>

              {/* Actions: Google Maps Directions & SafeRoute */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${f.location.latitude},${f.location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 px-2.5 bg-obsidian/60 hover:bg-white/5 text-jatayu-secondary hover:text-white border border-white/10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3 text-jatayu-muted" />
                </a>

                {onPlanRouteToFacility && (
                  <button
                    onClick={() => onPlanRouteToFacility(f)}
                    className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,217,154,0.25)]"
                  >
                    <Navigation2 className="w-3 h-3 text-white" />
                    <span>SafeRoute</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
