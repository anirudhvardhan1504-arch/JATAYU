import React from 'react';
import {
  Clock,
  Navigation,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { EvaluatedRoute, LocationPoint, TravelMode } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getGoogleMapsDirectionsUrl } from '../../services/route';

interface RouteComparisonCardProps {
  route: EvaluatedRoute;
  isSelected: boolean;
  onSelect: () => void;
  origin: LocationPoint;
  destination: LocationPoint;
  travelMode: TravelMode;
}

export const RouteComparisonCard: React.FC<RouteComparisonCardProps> = ({
  route,
  isSelected,
  onSelect,
  origin,
  destination,
  travelMode,
}) => {
  const { t } = useLanguage();

  const googleMapsUrl = getGoogleMapsDirectionsUrl(origin, destination, travelMode);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'ELEVATED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? 'bg-navy-900 border-[#0284C7] shadow-lg ring-1 ring-[#0284C7]'
          : 'bg-navy-950/70 border-navy-800 hover:border-navy-700 hover:bg-navy-900/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                route.isPrimary
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              {route.isPrimary ? t('saferoute.primaryRoute') : t('saferoute.alternativeRoute')}
            </span>
            <h4 className="text-sm font-bold text-white font-mono">{route.name}</h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">{route.summary}</p>
        </div>

        {/* Hazard Score */}
        <div className="text-right flex-shrink-0">
          <span
            className={`inline-block px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded border ${getTierColor(
              route.riskTier
            )}`}
          >
            {route.riskTier} ({route.riskScore}/100)
          </span>
          <div className="text-[9px] font-mono text-slate-500 mt-0.5">
            {t('saferoute.riskScore')}
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 gap-2 my-3 p-2 bg-navy-950/80 rounded border border-navy-800/80 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-sky-400" />
          <span>
            {route.distanceKm} km{' '}
            {route.additionalDistanceKm !== undefined && (
              <span className="text-[10px] text-amber-400 font-sans">
                (+{route.additionalDistanceKm} km)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>
            {route.durationMinutes} min{' '}
            {route.additionalDurationMinutes !== undefined && (
              <span className="text-[10px] text-amber-400 font-sans">
                ({route.additionalDurationMinutes >= 0 ? '+' : ''}
                {route.additionalDurationMinutes} min)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Hazards Avoided (for alternative routes) */}
      {route.hazardsAvoidedAgainstPrimary && route.hazardsAvoidedAgainstPrimary.length > 0 && (
        <div className="mb-3 p-2 bg-emerald-950/40 border border-emerald-800/60 rounded text-[11px] text-emerald-300 space-y-1">
          <div className="font-bold font-mono text-[10px] flex items-center gap-1.5 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            {t('saferoute.hazardsAvoided')}
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-emerald-200/90 text-[10px] pl-1 font-sans">
            {route.hazardsAvoidedAgainstPrimary.map((ha, idx) => (
              <li key={idx}>{ha}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Hazards */}
      {route.hazards.length > 0 ? (
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {t('saferoute.hazardsIdentified')} ({route.hazards.length})
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {route.hazards.map((hazard) => (
              <div
                key={hazard.id}
                className="p-2 bg-navy-950 border border-navy-800 rounded text-[11px] space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-200">{hazard.title}</span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded uppercase font-semibold ${
                      hazard.severity === 'HIGH' || hazard.severity === 'CRITICAL'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {hazard.severity}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  {hazard.description}
                </p>
                <div className="text-[9px] font-mono text-slate-500">
                  Source: {hazard.dataSource}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-3 p-2 bg-navy-950/60 border border-navy-800 rounded text-[11px] text-slate-400 flex items-center gap-1.5 font-sans">
          <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span>No critical terrain choke points detected along this alignment.</span>
        </div>
      )}

      {/* Suitability Assessment */}
      <div className="p-2 bg-slate-900/60 rounded border border-navy-800 text-[11px] text-slate-300 mb-3 font-sans">
        <span className="font-bold text-slate-200 font-mono text-[10px] uppercase block mb-0.5">
          {t('saferoute.suitability')}
        </span>
        {route.suitabilityReason}
      </div>

      {/* Google Maps External Handoff Button */}
      <div className="pt-2 border-t border-navy-800 flex items-center justify-between gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 bg-navy-800 hover:bg-navy-700 text-sky-400 hover:text-sky-300 border border-navy-700 rounded text-xs font-mono font-medium transition-colors"
          title={t('saferoute.googleMapsNotice')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>{t('saferoute.openGoogleMaps')}</span>
        </a>
      </div>
    </div>
  );
};
