import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Info,
  Layers,
  Compass,
  MapPin,
  Globe,
} from 'lucide-react';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import {
  DisasterAlert,
  AlertFeedResponse,
  AlertSeverity,
} from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AlertsPageProps {
  location: { name: string; lat: number; lon: number };
  alertFeed?: AlertFeedResponse | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  location,
  alertFeed,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'OFFICIAL' | 'NATIONWIDE' | 'INDICATIVE' | 'DEMO'>('OFFICIAL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlertSeverity>('ALL');

  const officialAlerts = alertFeed?.officialAlerts ?? [];
  const nationwideAlerts = alertFeed?.nationwideAlerts ?? [];
  const indicativeAlerts = alertFeed?.indicativeAlerts ?? [];
  const demoAlerts = alertFeed?.demonstrationScenarios ?? [];
  const geoRes = alertFeed?.geographicResolution;

  // Determine active alert subset
  let currentList: DisasterAlert[] = [];
  if (activeTab === 'OFFICIAL') currentList = officialAlerts;
  else if (activeTab === 'NATIONWIDE') currentList = nationwideAlerts;
  else if (activeTab === 'INDICATIVE') currentList = indicativeAlerts;
  else currentList = demoAlerts;

  const filteredAlerts = currentList.filter((a) => {
    if (severityFilter === 'ALL') return true;
    return a.severity === severityFilter;
  });

  const severityBadgeClass: Record<AlertSeverity, string> = {
    EMERGENCY: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold shadow-[0_0_10px_rgba(239,68,68,0.25)]',
    WARNING: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]',
    WATCH: 'bg-blue-500/20 text-blue-300 border-blue-500/40 font-semibold shadow-[0_0_8px_rgba(59,130,246,0.2)]',
    ADVISORY: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-normal',
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('alerts.activeBulletins')}
        subtitle={t('alerts.subtitle')}
        action={
          onRetry && (
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-mono bg-obsidian/80 hover:bg-white/5 border border-white/10 rounded-xl text-emerald-300 flex items-center gap-1.5 shadow-subtle disabled:opacity-50 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('alerts.refresh')}</span>
            </button>
          )
        }
      />

      {/* Provenance & Geographic Resolution Banner */}
      <div className="bento-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase text-jatayu-muted font-semibold">
              {t('alerts.resolvedRegion')}
            </span>
            {geoRes?.matchStatus === 'RESOLVED_DISTRICT' ? (
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>{geoRes.resolvedDistrict}, {geoRes.resolvedState}</span>
              </span>
            ) : geoRes?.matchStatus === 'OFFSHORE_OR_UNRESOLVED' ? (
              <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span>Offshore / Non-Polygon Sector</span>
              </span>
            ) : (
              <span className="text-sm font-bold text-white">{location.name}</span>
            )}
            <span className="text-xs font-mono text-jatayu-muted">
              ({location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-jatayu-secondary font-mono">
            <span>
              BOUNDARY SOURCE:{' '}
              <strong className="text-white">
                {geoRes?.datasetSource || 'DataMeet India 2011 Census'}
              </strong>
            </span>
            <span>•</span>
            <span>
              MATCH STATUS:{' '}
              <span
                className={`font-semibold ${
                  geoRes?.matchStatus === 'RESOLVED_DISTRICT'
                    ? 'text-emerald-400'
                    : geoRes?.matchStatus === 'OFFSHORE_OR_UNRESOLVED'
                    ? 'text-amber-400'
                    : 'text-jatayu-secondary'
                }`}
              >
                {geoRes?.matchStatus || 'RESOLVED'}
              </span>
            </span>
            <span>•</span>
            <span>
              FEED STATUS:{' '}
              <span
                className={`font-semibold ${
                  alertFeed?.feedStatus === 'LIVE_VERIFIED'
                    ? 'text-emerald-400'
                    : alertFeed?.feedStatus === 'CACHED'
                    ? 'text-sky-400'
                    : alertFeed?.feedStatus === 'UPSTREAM_FALLBACK'
                    ? 'text-amber-400'
                    : 'text-jatayu-secondary'
                }`}
              >
                {alertFeed?.feedStatus || 'UNKNOWN'}
              </span>
            </span>
            {geoRes?.isAmbiguous && geoRes.secondaryDistricts && geoRes.secondaryDistricts.length > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-400 font-semibold">
                  BORDER ZONE (Near: {geoRes.secondaryDistricts.join(', ')})
                </span>
              </>
            )}
            {alertFeed?.fetchedAt && (
              <>
                <span>•</span>
                <span>FETCHED: {new Date(alertFeed.fetchedAt).toLocaleTimeString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Tier Count Pills */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-obsidian/70 border border-white/10 rounded-xl text-center">
            <div className="text-[10px] font-mono uppercase text-jatayu-muted">DISTRICT MATCH</div>
            <div className="text-sm font-mono font-bold text-white">{officialAlerts.length}</div>
          </div>
          <div className="px-3 py-1.5 bg-obsidian/70 border border-white/10 rounded-xl text-center">
            <div className="text-[10px] font-mono uppercase text-jatayu-muted">NATIONWIDE</div>
            <div className="text-sm font-mono font-bold text-blue-400">{nationwideAlerts.length}</div>
          </div>
          <div className="px-3 py-1.5 bg-obsidian/70 border border-white/10 rounded-xl text-center">
            <div className="text-[10px] font-mono uppercase text-jatayu-muted">INDICATIVE</div>
            <div className="text-sm font-mono font-bold text-amber-400">{indicativeAlerts.length}</div>
          </div>
        </div>
      </div>

      {/* Offshore / Unresolved Notice Banner */}
      {geoRes?.matchStatus === 'OFFSHORE_OR_UNRESOLVED' && geoRes.coverageNotice && (
        <div className="bento-card p-4 text-xs text-amber-200 border-amber-500/30 flex items-start gap-3">
          <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold mb-1 text-white">Geographic Coverage Boundary Notice</strong>
            <p className="text-jatayu-secondary">{geoRes.coverageNotice}</p>
          </div>
        </div>
      )}

      {/* Boundary Ambiguity Notice Banner */}
      {geoRes?.isAmbiguous && (
        <div className="bento-card p-4 text-xs text-amber-200 border-amber-500/30 flex items-start gap-3">
          <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold mb-1 text-white">Administrative Boundary Overlap Notice</strong>
            <p className="text-jatayu-secondary">
              {geoRes.coverageNotice ||
                `Coordinates lie on a shared border or overlap zone between ${geoRes.resolvedDistrict} and ${geoRes.secondaryDistricts?.join(', ')}.`}
            </p>
          </div>
        </div>
      )}

      {/* Upstream Outage Warning Banner */}
      {alertFeed?.feedStatus === 'UPSTREAM_FALLBACK' && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-3 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block text-sm font-bold text-white mb-1">
              Official Meteorological Warning Service Offline / Unverified
            </strong>
            <p className="leading-relaxed text-amber-100">
              Current IMD warning data could not be verified due to an upstream service outage. Official warnings are unverified at this hour.
              This is not a confirmation that conditions are clear. Response teams must consult direct State Disaster Management Authority (SDMA) and district control room communications.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/50 text-xs text-red-200 flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-semibold mb-1 text-white">Upstream Warning Ingestion Issue</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        {/* Source Segregation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-obsidian/70 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveTab('OFFICIAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'OFFICIAL'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(0,217,154,0.2)]'
                : 'text-jatayu-secondary hover:text-white border border-transparent'
            }`}
          >
            {t('alerts.tabLocal')} ({officialAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('NATIONWIDE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'NATIONWIDE'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                : 'text-jatayu-secondary hover:text-white border border-transparent'
            }`}
          >
            {t('alerts.tabNationwide')} ({nationwideAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('INDICATIVE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'INDICATIVE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                : 'text-jatayu-secondary hover:text-white border border-transparent'
            }`}
          >
            {t('alerts.tabIndicative')} ({indicativeAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('DEMO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
              activeTab === 'DEMO'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                : 'text-jatayu-secondary hover:text-white border border-transparent'
            }`}
          >
            {t('alerts.tabDrills')} ({demoAlerts.length})
          </button>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-jatayu-muted">SEVERITY:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="text-xs font-mono bg-obsidian/80 border border-white/10 rounded-xl px-3 py-1.5 text-jatayu-primary focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="ALL">ALL SEVERITIES</option>
            <option value="EMERGENCY">EMERGENCY</option>
            <option value="WARNING">WARNING</option>
            <option value="WATCH">WATCH</option>
            <option value="ADVISORY">ADVISORY</option>
          </select>
        </div>
      </div>

      {/* Methodology & Legal Notice */}
      {activeTab === 'OFFICIAL' && (
        <div className="bento-card p-3.5 text-xs text-jatayu-primary flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white">Locally Matched IMD District Nowcasts: </span>
            Bulletins issued for <strong className="text-emerald-300">{geoRes?.resolvedDistrict || location.name}</strong> (primary match) or adjacent border-zone districts (secondary match) based on server-side point-in-polygon verification.
            Official advisories take legal precedence over algorithmic risk estimates.
          </div>
        </div>
      )}

      {activeTab === 'NATIONWIDE' && (
        <div className="bento-card p-3.5 text-xs text-jatayu-primary flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white">Nationwide Active IMD Nowcasts (Other Districts): </span>
            The bulletins in this tab apply to other administrative districts across India and <strong>are not claimed to apply to your selected location</strong>.
            Surfaced strictly for broader regional situational awareness.
          </div>
        </div>
      )}

      {activeTab === 'INDICATIVE' && (
        <div className="bento-card p-3.5 text-xs text-jatayu-primary flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white">Indicative Algorithmic Advisories: </span>
            Generated automatically when JATAYU rainfall & soil saturation heuristics detect Elevated, High, or Critical hazard.
            These are mathematical indicators and <strong>do not constitute official evacuation orders</strong>.
          </div>
        </div>
      )}

      {activeTab === 'DEMO' && (
        <div className="bento-card p-3.5 text-xs text-jatayu-primary flex items-start gap-2.5">
          <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold text-white">Demonstration & Training Scenarios: </span>
            Synthetic stress-testing scenarios provided for operational table-top exercises. Marked explicitly as non-operational drills.
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="bento-card p-12 text-center">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto mb-3" />
          <div className="text-sm font-medium text-white">Synchronizing Warning Feeds...</div>
          <div className="text-xs font-mono text-jatayu-muted mt-1">Connecting to IMD District Nowcast RSS</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredAlerts.length === 0 && (
        alertFeed?.feedStatus === 'UPSTREAM_FALLBACK' && (activeTab === 'OFFICIAL' || activeTab === 'NATIONWIDE') ? (
          <div className="bento-card p-12 text-center border-amber-500/30 space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-sm font-bold text-amber-300">
              Upstream Warning Feed Unavailable
            </div>
            <p className="text-xs text-jatayu-secondary max-w-md mx-auto">
              Unable to retrieve live IMD warning bulletins at this time due to upstream service outage. Telemetry and indicative model risk remain active, but official warnings cannot be verified.
            </p>
          </div>
        ) : (
          <div className="bento-card p-12 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white">
              {activeTab === 'OFFICIAL'
                ? `No Active Official IMD Bulletins for ${geoRes?.resolvedDistrict || location.name}`
                : activeTab === 'NATIONWIDE'
                ? 'No Active Nationwide Bulletins'
                : activeTab === 'INDICATIVE'
                ? 'No Indicative Risk Advisories Triggered'
                : 'No Active Drill Scenarios'}
            </div>
            <p className="text-xs text-jatayu-secondary max-w-md mx-auto">
              {activeTab === 'OFFICIAL'
                ? `No active IMD district nowcasts found for this district at the time of retrieval. Refer to the Nationwide IMD Feed tab for active weather bulletins in other districts.`
                : activeTab === 'NATIONWIDE'
                ? 'No active nowcast bulletins published by IMD across India at this hour.'
                : activeTab === 'INDICATIVE'
                ? 'Current rainfall accumulation and soil saturation indicators remain within guarded baseline thresholds.'
                : 'No synthetic training exercises are currently scheduled.'}
            </p>
            {activeTab === 'OFFICIAL' && (
              <p className="text-[11px] font-mono text-jatayu-muted max-w-md mx-auto pt-1">
                Notice: The absence of an active IMD bulletin indicates no current nowcast warning has been issued, but is not a conclusive guarantee of safety against unmonitored localized hazards. Always monitor local ground conditions.
              </p>
            )}
          </div>
        )
      )}

      {/* Alert Feed Cards */}
      {!isLoading && (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bento-card p-5 flex flex-col justify-between transition-all ${
                alert.isOfficialWarning
                  ? 'hover:border-emerald-500/40 hover:shadow-glow-emerald'
                  : 'hover:border-amber-500/40'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-xs font-mono px-2.5 py-0.5 rounded-full border uppercase ${
                        severityBadgeClass[alert.severity]
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="font-mono text-xs font-semibold text-emerald-300">
                      {alert.category}
                    </span>
                    <span className="font-mono text-[11px] text-jatayu-muted">ID: {alert.id}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.affectedArea.matchMethod === 'NOT_LOCATION_MATCHED' && (
                      <span className="px-2 py-0.5 bg-obsidian/80 text-jatayu-muted border border-white/10 rounded-full text-[10px] font-mono font-bold uppercase">
                        NOT LOCATION MATCHED
                      </span>
                    )}
                    {alert.affectedArea.matchMethod === 'EXACT_DISTRICT' && (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-mono font-bold uppercase shadow-[0_0_8px_rgba(0,217,154,0.2)]">
                        LOCAL DISTRICT MATCH
                      </span>
                    )}
                    {alert.affectedArea.matchMethod === 'BORDER_ZONE_SECONDARY' && (
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-[10px] font-mono font-bold uppercase">
                        BORDER ZONE SECONDARY MATCH
                      </span>
                    )}
                    <Badge sourceType={alert.sourceType} size="sm" />
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-white">{alert.headline}</h3>
                </div>

                <p className="text-xs text-jatayu-secondary leading-relaxed mb-4">{alert.description}</p>

                {alert.affectedArea.matchMethod === 'BORDER_ZONE_SECONDARY' && (
                  <div className="mb-3 px-3 py-1.5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl text-[11px] text-indigo-200 font-mono">
                    ⚠️ Border-Zone Relevance: Advisory issued for adjacent district ({alert.affectedArea.name}). Relevant due to administrative boundary overlap with {geoRes?.resolvedDistrict || 'selected location'}, but is not an exact primary-district match.
                  </div>
                )}

                {/* Geographic & Scope Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 text-xs font-mono bg-obsidian/70 border border-white/10 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5 text-jatayu-secondary">
                    <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>AFFECTED AREA: </span>
                    <strong className="text-white truncate">{alert.affectedArea.name}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-jatayu-secondary">
                    <span>MATCHING SCOPE: </span>
                    <span className="px-1.5 py-0.5 bg-obsidian border border-white/10 rounded text-[10px] text-emerald-300">
                      {alert.affectedArea.matchMethod || 'GENERAL_FEED'}
                    </span>
                  </div>
                </div>

                {/* Recommended Operational Actions */}
                {alert.recommendedActions && alert.recommendedActions.length > 0 && (
                  <div className="p-3.5 bg-obsidian/70 border border-white/10 rounded-xl mb-3">
                    <div className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Operational Checklist & Precautions</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-jatayu-secondary">
                      {alert.recommendedActions.map((action: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="font-mono text-emerald-400">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-jatayu-muted">
                <div className="flex items-center gap-2">
                  <span>AGENCY: </span>
                  <strong className="text-white">{alert.sourceAgency}</strong>
                  {alert.officialBulletinUrl && (
                    <a
                      href={alert.officialBulletinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-mint underline ml-2 transition-colors cursor-pointer"
                    >
                      <span>OFFICIAL BULLETIN</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <span>ISSUED: </span>
                    <span className="text-jatayu-secondary">
                      {new Date(alert.issuedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <span>•</span>
                  <div>
                    <span>VALID UNTIL: </span>
                    <strong className="text-white">
                      {new Date(alert.effectiveUntil).toLocaleTimeString()}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Limitations and Operational Footnote */}
      <div className="bento-card p-4 text-xs text-jatayu-secondary space-y-2">
        <div className="font-bold text-white flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          <span>Operational Provenance & Boundary Limitations</span>
        </div>
        <p className="leading-relaxed">
          The India Meteorological Department (IMD) District Nowcast RSS publishes active convective and severe weather bulletins across monitored districts.
          JATAYU matches coordinates to administrative districts server-side using DataMeet 2011 Census spatial boundaries.
          Bulletins not matching the containing district are segregated under the Nationwide IMD Feed tab and explicitly labeled NOT LOCATION MATCHED.
        </p>
      </div>
    </div>
  );
};
