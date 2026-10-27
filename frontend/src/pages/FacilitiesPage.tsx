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
} from 'lucide-react';
import { EmergencyFacility, FacilityCategory } from '../types';
import { getEmergencyFacilities } from '../services/route';
import { useLanguage } from '../context/LanguageContext';

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

  const getCategoryIcon = (category: FacilityCategory) => {
    switch (category) {
      case 'HOSPITAL':
        return <Cross className="w-4 h-4 text-red-500" />;
      case 'SHELTER':
      case 'RELIEF_CAMP':
        return <Home className="w-4 h-4 text-blue-500" />;
      case 'EMERGENCY_OPS':
      case 'FIRE_STATION':
      default:
        return <Shield className="w-4 h-4 text-amber-500" />;
    }
  };

  const getCategoryLabel = (category: FacilityCategory) => {
    switch (category) {
      case 'HOSPITAL':
        return t('facilities.filterHospitals');
      case 'SHELTER':
      case 'RELIEF_CAMP':
        return t('facilities.filterShelters');
      case 'EMERGENCY_OPS':
      case 'FIRE_STATION':
      default:
        return t('facilities.filterOps');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Emergency Civil Defense Registry</span>
          </div>
          <h1 className="text-2xl font-bold text-navy-900 tracking-tight mt-1">
            {t('facilities.pageTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-sans">
            {t('facilities.pageSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-md border border-slate-200 text-xs text-slate-700">
            <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="font-medium truncate max-w-[200px]">{location.name}</span>
          </div>
          <button
            onClick={loadFacilities}
            disabled={isLoading}
            className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-md border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh facilities list"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mandatory Availability Disclaimer */}
      <div className="p-4 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-950 text-xs flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold font-mono uppercase tracking-wider text-[11px] text-amber-900">
            Operational Availability Disclaimer
          </span>
          <p className="text-amber-900 leading-relaxed font-sans">
            {t('facilities.disclaimer')}
          </p>
        </div>
      </div>

      {/* Controls: Search, Category Filters, Radius */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search facility name or address..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-sans"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'ALL', label: t('facilities.filterAll') },
            { id: 'HOSPITAL', label: t('facilities.filterHospitals') },
            { id: 'SHELTER', label: t('facilities.filterShelters') },
            { id: 'EMERGENCY_OPS', label: t('facilities.filterOps') },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Radius Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-600 self-end md:self-center">
          <span className="font-mono text-[11px] uppercase">Radius:</span>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseInt(e.target.value, 10))}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-800 font-medium cursor-pointer outline-none"
          >
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </select>
        </div>
      </div>

      {/* Facilities Count & Status */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
        <span>Found {filteredList.length} emergency facilities near {location.name}</span>
        {isLoading && <span className="text-blue-600">Querying registry...</span>}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadFacilities}
            className="px-2.5 py-1 bg-red-600 text-white rounded text-[11px] font-medium hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredList.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Facilities Found In Range</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-sans">
            No verified civil defense facilities matched the current category or search radius. Try increasing the search radius to 50 km or 100 km.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchFilter('');
              setRadiusKm(50);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md cursor-pointer"
          >
            Expand Search to 50 km
          </button>
        </div>
      )}

      {/* Facility Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map((f) => (
          <div
            key={f.id}
            className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                    {getCategoryIcon(f.category)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-semibold text-slate-500">
                      {getCategoryLabel(f.category)}
                    </span>
                    <h3 className="text-sm font-bold text-navy-900 leading-snug">
                      {f.name}
                    </h3>
                  </div>
                </div>
                {f.distanceKm !== undefined && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-bold text-[11px] whitespace-nowrap">
                    {f.distanceKm} km
                  </span>
                )}
              </div>

              {/* Address */}
              {f.address && (
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 font-sans">
                  {f.address}
                </p>
              )}

              {/* Provenance & Verification Badge */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  f.verificationStatus === 'OFFICIALLY_VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {f.verificationStatus === 'OFFICIALLY_VERIFIED' ? 'OFFICIALLY VERIFIED' : 'COMMUNITY MAPPED'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  VACANCY: UNKNOWN
                </span>
              </div>

              {/* Phone */}
              {f.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono pt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <a href={`tel:${f.phone}`} className="hover:text-blue-600 font-semibold">
                    {f.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Actions: Google Maps Directions & SafeRoute */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${f.location.latitude},${f.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-1.5 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>

              {onPlanRouteToFacility && (
                <button
                  onClick={() => onPlanRouteToFacility(f)}
                  className="flex-1 py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Navigation2 className="w-3 h-3 text-sky-200" />
                  <span>SafeRoute</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
