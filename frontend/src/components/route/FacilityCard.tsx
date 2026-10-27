import React from 'react';
import { Home, Cross, Shield, Phone, MapPin, CheckCircle, ArrowRight, Flame } from 'lucide-react';
import { EmergencyFacility } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface FacilityCardProps {
  facility: EmergencyFacility;
  onSelectAsDestination: (facility: EmergencyFacility) => void;
  isSelected?: boolean;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({
  facility,
  onSelectAsDestination,
  isSelected = false,
}) => {
  const { t } = useLanguage();

  const getCategoryDetails = () => {
    switch (facility.category) {
      case 'SHELTER':
        return {
          icon: <Home className="w-3.5 h-3.5 text-blue-400" />,
          label: t('saferoute.filterShelters'),
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
        };
      case 'RELIEF_CAMP':
        return {
          icon: <Home className="w-3.5 h-3.5 text-sky-400" />,
          label: t('saferoute.filterRelief') || 'Relief Camp',
          badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        };
      case 'HOSPITAL':
        return {
          icon: <Cross className="w-3.5 h-3.5 text-red-400" />,
          label: t('saferoute.filterHospitals'),
          badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
        };
      case 'FIRE_STATION':
        return {
          icon: <Flame className="w-3.5 h-3.5 text-orange-400" />,
          label: t('saferoute.filterFire') || 'Fire & Rescue',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        };
      case 'EMERGENCY_OPS':
      default:
        return {
          icon: <Shield className="w-3.5 h-3.5 text-amber-400" />,
          label: t('saferoute.filterOps'),
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        };
    }
  };

  const cat = getCategoryDetails();

  return (
    <div
      className={`p-3.5 rounded-lg border transition-all ${
        isSelected
          ? 'bg-navy-900 border-[#0284C7] ring-1 ring-[#0284C7]'
          : 'bg-navy-950/70 border-navy-800 hover:border-navy-700 hover:bg-navy-900/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border flex items-center gap-1 ${cat.badgeClass}`}>
            {cat.icon}
            <span>{cat.label}</span>
          </span>
          {facility.sourceProvenance === 'COMMUNITY_MAPPED' ? (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-0.5">
              <span>{t('saferoute.communityMapped')}</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5">
              <CheckCircle className="w-2.5 h-2.5" />
              <span>{t('saferoute.officiallyVerified')}</span>
            </span>
          )}
        </div>

        {facility.distanceKm !== undefined && (
          <span className="text-[11px] font-mono text-slate-400">
            {facility.distanceKm} km
          </span>
        )}
      </div>

      <h5 className="text-xs font-bold text-white mb-1">{facility.name}</h5>

      <div className="space-y-1 text-[11px] text-slate-400">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">{facility.address}</span>
        </div>
        {facility.phone && (
          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[10px]">
            <Phone className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span>{facility.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-navy-800/80 flex items-center justify-between gap-2">
        <span className="text-[9px] font-mono text-amber-400/90 italic">
          {t('saferoute.statusUnknown')}
        </span>

        <button
          onClick={() => onSelectAsDestination(facility)}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded text-[10px] font-mono font-bold transition-colors shadow-sm"
        >
          <span>{t('saferoute.setAsDestination')}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
