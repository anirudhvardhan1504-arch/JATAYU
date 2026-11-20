import React from 'react';
import { Home, Cross, Shield, Phone, MapPin, CheckCircle, ArrowRight, Flame } from 'lucide-react';
import { FacilityDetails } from './FacilityDetails';
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
          icon: <Home className="w-3.5 h-3.5 text-emerald-400" />,
          label: t('saferoute.filterShelters'),
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        };
      case 'RELIEF_CAMP':
        return {
          icon: <Home className="w-3.5 h-3.5 text-mint" />,
          label: t('saferoute.filterRelief') || 'Relief Camp',
          badgeClass: 'bg-mint/20 text-mint border-emerald-500/40',
        };
      case 'TRAUMA_CENTRE':
      case 'ORR_TRAUMA_CENTRE':
      case 'AMBULANCE_SERVICE':
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
      className={`p-3.5 rounded-2xl border transition-all ${
        isSelected
          ? 'bg-dark-emerald/70 border-emerald-400 shadow-[0_0_15px_rgba(0,217,154,0.3)] ring-1 ring-emerald-400'
          : 'bg-obsidian/70 border-white/10 hover:border-emerald-500/40 hover:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border flex items-center gap-1 ${cat.badgeClass}`}>
            {cat.icon}
            <span>{cat.label}</span>
          </span>
          {facility.sourceProvenance === 'COMMUNITY_MAPPED' || !['VERIFIED', 'OFFICIALLY_VERIFIED'].includes(facility.verificationStatus) ? (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-0.5">
              <span>{facility.sourceProvenance === 'COMMUNITY_MAPPED' ? t('saferoute.communityMapped') : t('facilities.directoryListing')}</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-0.5 shadow-[0_0_6px_rgba(0,217,154,0.15)]">
              <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
              <span>{t('saferoute.officiallyVerified')}</span>
            </span>
          )}
        </div>

        {facility.distanceKm !== undefined && (
          <span className="text-[11px] font-mono text-emerald-400 font-bold">
            {facility.distanceKm} km
          </span>
        )}
      </div>

      <h5 className="text-xs font-bold text-white mb-1">{facility.name}</h5>

      <div className="space-y-1 text-[11px] text-jatayu-secondary">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">{facility.address}</span>
        </div>
        {facility.phone && (
          <div className="flex items-center gap-1.5 text-jatayu-primary font-mono text-[10px]">
            <Phone className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <a href={`tel:${facility.phone.replace(/[^+\d]/g, '')}`} className="min-h-[44px] inline-flex items-center underline">{facility.phone}</a>
          </div>
        )}
      </div>

      <FacilityDetails facility={facility} />

      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-mono text-amber-400/90 italic">
          {t('saferoute.statusUnknown')}
        </span>
        <button
          type="button"
          onClick={() => onSelectAsDestination(facility)}
          className="min-h-[44px] text-xs font-semibold text-emerald-400 hover:text-mint flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>{t('saferoute.setAsDestination')}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
