import { XMLParser, XMLValidator } from 'fast-xml-parser';
import {
  DisasterAlert,
  AlertSeverity,
  AlertCategory,
  AlertFeedResponse,
  GeographicResolution,
} from '../types/alert.types.js';
import { IndicativeFloodRiskAssessment } from '../types/risk.types.js';
import { RiskService } from './risk.service.js';
import { DistrictBoundaryService } from './district.service.js';

export interface IAlertService {
  getAlerts(
    lat: number,
    lon: number,
    locationName?: string,
    riskAssessment?: IndicativeFloodRiskAssessment | null
  ): Promise<AlertFeedResponse>;
}

// Known regional mapping of major operational centers to states/divisions
// Used strictly as documented geographic context without guessing arbitrary coordinates
export const KNOWN_OPERATIONAL_SECTORS: Record<
  string,
  { state: string; districts: string[]; lat: number; lon: number }
> = {
  'Mumbai Metropolitan Region': {
    state: 'MAHARASHTRA',
    districts: ['MUMBAI', 'MUMBAI SUBURBAN', 'THANE', 'PALGHAR', 'RAIGAD'],
    lat: 19.076,
    lon: 72.8777,
  },
  'Chennai Coastal Basin': {
    state: 'TAMIL NADU',
    districts: ['CHENNAI', 'KANCHEEPURAM', 'TIRUVALLUR', 'CHENGALPATTU'],
    lat: 13.0827,
    lon: 80.2707,
  },
  'Brahmaputra Valley (Guwahati)': {
    state: 'ASSAM',
    districts: ['KAMRUP METROPOLITAN', 'KAMRUP', 'DARRANG'],
    lat: 26.1445,
    lon: 91.7362,
  },
  'Dehradun Hill Catchment': {
    state: 'UTTARAKHAND',
    districts: ['DEHRADUN', 'HARIDWAR', 'TEHRI GARHWAL'],
    lat: 30.3165,
    lon: 78.0322,
  },
  'Kolkata Deltaic Zone': {
    state: 'WEST BENGAL',
    districts: ['KOLKATA', 'NORTH 24 PARGANAS', 'SOUTH 24 PARGANAS', 'HOWRAH'],
    lat: 22.5726,
    lon: 88.3639,
  },
};

/**
 * Classify severity deterministically from official IMD bulletin text.
 * Based on standardized IMD Nowcast meteorological thresholds.
 */
export function classifySeverityFromDescription(desc: string): AlertSeverity {
  const upper = desc.toUpperCase();
  if (
    upper.includes('EXTREMELY HEAVY') ||
    upper.includes('VERY SEVERE') ||
    upper.includes('GALE') ||
    upper.includes('> 70 KMPH') ||
    upper.includes('> 80 KMPH')
  ) {
    return 'EMERGENCY';
  }

  // Check 41 - 61 kmph range before standalone 61 kmph
  if (
    upper.includes('41 - 61 KMPH') ||
    upper.includes('40-60 KMPH') ||
    upper.includes('41-61 KMPH') ||
    upper.includes('MODERATE RAIN') ||
    upper.includes('MODERATE THUNDERSTORM') ||
    upper.includes('LIGHTNING')
  ) {
    return 'WATCH';
  }

  if (
    upper.includes('HEAVY RAIN') ||
    upper.includes('VERY HEAVY') ||
    upper.includes('SQUALL') ||
    upper.includes('61 KMPH') ||
    upper.includes('50-60 KMPH')
  ) {
    return 'WARNING';
  }

  return 'ADVISORY';
}

/**
 * Classify category deterministically from description and category tags.
 */
export function classifyCategoryFromDescription(desc: string, categoryTag?: string): AlertCategory {
  const upper = `${desc} ${categoryTag || ''}`.toUpperCase();
  if (upper.includes('CYCLONE') || upper.includes('CYCLONIC')) return 'CYCLONE';
  if (upper.includes('HEAT') || upper.includes('WARM NIGHT')) return 'HEATWAVE';
  if (upper.includes('FLOOD') || upper.includes('INUNDATION')) return 'FLOOD';

  // Check for wind gusts without precipitation
  const mentionsWind = upper.includes('WIND') || upper.includes('GUSTS') || upper.includes('SQUALL');
  const mentionsRainExclusion = upper.includes('WITHOUT RAIN') || upper.includes('NO RAIN');
  const hasRainfall = /\b(RAIN|PRECIPITATION|DOWNPOUR|SHOWERS)\b/.test(upper);

  if (mentionsWind && (!hasRainfall || mentionsRainExclusion)) {
    return 'WIND';
  }

  return 'RAINFALL';
}

/**
 * Parse an ISO date or Indian standard timezone offset (+5:30) to valid ISO string.
 */
export function parseDateToISO(dateStr?: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();

  // If in format YYYY-MM-DDTHH:mm:ss+5:30 -> standardize to +05:30
  let normalized = trimmed.replace(/\+5:30$/, '+05:30').replace(/\+5:3$/, '+05:30');

  const d = new Date(normalized);
  if (isNaN(d.getTime())) {
    // Try RFC 2822 parsing (e.g., Sat, 10 Oct 2026 06:50:00 )
    const rfc = new Date(trimmed);
    if (!isNaN(rfc.getTime())) {
      return rfc.toISOString();
    }
    return null;
  }
  return d.toISOString();
}

/**
 * Extract recommended operational safety actions based on IMD Nowcast bulletin contents.
 */
export function extractRecommendedActions(desc: string, severity: AlertSeverity): string[] {
  const actions: string[] = [];
  const upper = desc.toUpperCase();

  if (upper.includes('LIGHTNING')) {
    actions.push('Seek immediate safe shelter indoors; avoid open fields, isolated trees, and metal structures.');
  }
  if (upper.includes('WIND') || upper.includes('GUSTS') || upper.includes('SQUALL')) {
    actions.push('Secure loose exterior objects and stay away from fragile structures, billboards, and power lines.');
  }
  if (upper.includes('RAIN') || upper.includes('PRECIPITATION')) {
    actions.push('Exercise caution while commuting; avoid waterlogged roads, low-lying subways, and culverts.');
  }

  if (severity === 'WARNING' || severity === 'EMERGENCY') {
    actions.push('Maintain active liaison with local State/District Disaster Management Authority (DDMA) controls.');
  } else if (actions.length === 0) {
    actions.push('Monitor local meteorological updates and exercise normal weather precautions.');
  }

  return actions;
}

export class AlertService implements IAlertService {
  private feedUrl: string;
  private cacheTTLMs: number;
  private cachedFeed: { fetchedAt: number; alerts: DisasterAlert[] } | null = null;
  private riskService: RiskService;
  private xmlParser: XMLParser;
  private districtBoundaryService: DistrictBoundaryService;

  constructor(
    feedUrl: string = 'https://mausam.imd.gov.in/imd_latest/contents/dist_nowcast_rss.php',
    cacheTTLMs: number = 10 * 60 * 1000 // 10 minutes cache
  ) {
    this.feedUrl = feedUrl;
    this.cacheTTLMs = cacheTTLMs;
    this.riskService = new RiskService();
    this.districtBoundaryService = new DistrictBoundaryService();
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
      cdataPropName: '__cdata',
    });
  }

  /**
   * Expose DistrictBoundaryService for testing or direct lookup.
   */
  public getBoundaryService(): DistrictBoundaryService {
    return this.districtBoundaryService;
  }

  /**
   * Fetch and parse live IMD RSS XML feed with timeout and in-memory cache.
   */
  public async fetchRawIMDAlerts(): Promise<{
    alerts: DisasterAlert[];
    status: 'LIVE_VERIFIED' | 'CACHED' | 'UPSTREAM_FALLBACK';
    fetchedAt: string;
    isStaleCache?: boolean;
  }> {
    const now = Date.now();

    // Use valid in-memory cache if fresh (< TTL)
    if (this.cachedFeed && now - this.cachedFeed.fetchedAt < this.cacheTTLMs) {
      // Exclude bulletins whose effectiveUntil has passed
      const unexpiredAlerts = this.cachedFeed.alerts.filter((a) => {
        const expiry = new Date(a.effectiveUntil).getTime();
        return isNaN(expiry) || expiry >= now;
      });
      return {
        alerts: unexpiredAlerts,
        status: 'CACHED',
        fetchedAt: new Date(this.cachedFeed.fetchedAt).toISOString(),
        isStaleCache: false,
      };
    }

    let xmlText = '';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(this.feedUrl, {
        headers: {
          'User-Agent': 'Jatayu-Disaster-Intelligence/0.1.0',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`IMD RSS upstream HTTP error: ${response.status} ${response.statusText}`);
      }

      xmlText = await response.text();
    } catch (err: any) {
      // If live fetch fails but we have cached feed:
      if (this.cachedFeed) {
        const isExpired = now - this.cachedFeed.fetchedAt >= this.cacheTTLMs;
        const unexpiredAlerts = this.cachedFeed.alerts.filter((a) => {
          const expiry = new Date(a.effectiveUntil).getTime();
          return isNaN(expiry) || expiry >= now;
        });

        if (isExpired) {
          console.warn('Live IMD fetch failed, falling back to expired cached alerts:', err.message);
          return {
            alerts: unexpiredAlerts,
            status: 'UPSTREAM_FALLBACK',
            fetchedAt: new Date(this.cachedFeed.fetchedAt).toISOString(),
            isStaleCache: true,
          };
        } else {
          console.warn('Live IMD fetch failed, using valid cache:', err.message);
          return {
            alerts: unexpiredAlerts,
            status: 'CACHED',
            fetchedAt: new Date(this.cachedFeed.fetchedAt).toISOString(),
            isStaleCache: false,
          };
        }
      }
      console.warn('Live IMD fetch failed and no cache available:', err.message);
      return {
        alerts: [],
        status: 'UPSTREAM_FALLBACK',
        fetchedAt: new Date(now).toISOString(),
        isStaleCache: false,
      };
    }

    const parsedAlerts = this.parseIMDRssXml(xmlText);
    this.cachedFeed = {
      fetchedAt: now,
      alerts: parsedAlerts,
    };

    return {
      alerts: parsedAlerts,
      status: 'LIVE_VERIFIED',
      fetchedAt: new Date(now).toISOString(),
      isStaleCache: false,
    };
  }

  /**
   * Defensive XML parser for IMD RSS 2.0 structure.
   */
  public parseIMDRssXml(xmlText: string): DisasterAlert[] {
    if (!xmlText || typeof xmlText !== 'string' || xmlText.trim().length === 0) {
      return [];
    }

    const validation = XMLValidator.validate(xmlText);
    if (validation !== true) {
      const errDetail = typeof validation === 'object' && validation.err ? validation.err.msg : 'Malformed XML syntax';
      throw new Error(`Failed to parse IMD RSS XML structure: ${errDetail}`);
    }

    let parsed: any;
    try {
      parsed = this.xmlParser.parse(xmlText);
    } catch (err: any) {
      throw new Error(`Failed to parse IMD RSS XML structure: ${err.message}`);
    }

    const channel = parsed?.rss?.channel;
    if (!channel) {
      return [];
    }

    const rawItems = channel.item;
    if (!rawItems) {
      return [];
    }

    const itemsArray = Array.isArray(rawItems) ? rawItems : [rawItems];
    const nowEpoch = Date.now();
    const seenGuids = new Set<string>();
    const validAlerts: DisasterAlert[] = [];

    for (const item of itemsArray) {
      if (!item || typeof item !== 'object') continue;

      // Extract District / Location Title
      const districtTitle = typeof item.title === 'string' ? item.title.trim() : '';
      if (!districtTitle) continue;

      // Stable Identifier
      const guid = typeof item.guid === 'string' ? item.guid.trim() : item['#text'] || '';
      const fallbackId = `IMD-NOWCAST-${districtTitle}-${item.pubDate || ''}`;
      const alertId = guid || fallbackId;

      // Deduplicate
      if (seenGuids.has(alertId)) {
        continue;
      }
      seenGuids.add(alertId);

      // Timestamps
      const rawSent = item.sent || item.pubDate;
      const rawExpiry = item.Expires;

      const issuedAt = parseDateToISO(rawSent) || new Date().toISOString();
      const effectiveUntil = parseDateToISO(rawExpiry);

      // Exclude expired warnings from active results
      if (effectiveUntil) {
        const expiryEpoch = new Date(effectiveUntil).getTime();
        if (!isNaN(expiryEpoch) && expiryEpoch < nowEpoch) {
          continue; // Expired bulletin
        }
      }

      // Extract and clean description
      let desc = '';
      if (typeof item.description === 'string') {
        desc = item.description;
      } else if (item.description?.__cdata) {
        desc = item.description.__cdata;
      } else if (item.description?.['#text']) {
        desc = item.description['#text'];
      }
      desc = desc.replace(/[\r\n]+/g, ' ').trim();

      const severity = classifySeverityFromDescription(desc);
      const category = classifyCategoryFromDescription(desc, item.category);
      const recommendedActions = extractRecommendedActions(desc, severity);

      const bulletinUrl =
        typeof item.link === 'string' && item.link.startsWith('http')
          ? item.link.trim()
          : 'https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php';

      validAlerts.push({
        id: `ALT-IMD-${alertId.slice(0, 16)}`,
        category,
        severity,
        headline: `IMD Nowcast Warning: ${districtTitle} District`,
        description: desc || `Official nowcast warning issued for ${districtTitle}.`,
        issuedAt,
        effectiveUntil: effectiveUntil || new Date(nowEpoch + 3 * 3600 * 1000).toISOString(), // 3h default nowcast window
        affectedArea: {
          name: `${districtTitle} District, India`,
          matchMethod: 'ALL_ACTIVE_FEED',
        },
        recommendedActions,
        sourceType: 'OFFICIAL_FORECAST',
        sourceAgency: 'India Meteorological Department (IMD)',
        officialBulletinUrl: bulletinUrl,
        isOfficialWarning: true,
        status: 'ACTIVE',
        rawIdentifier: guid,
      });
    }

    return validAlerts;
  }

  /**
   * Generate JATAYU Indicative Advisory strictly when risk tier is ELEVATED, HIGH, or CRITICAL.
   * Marked as INDICATIVE_MODEL with isOfficialWarning: false.
   */
  public generateIndicativeAdvisory(
    risk: IndicativeFloodRiskAssessment,
    locationName: string
  ): DisasterAlert | null {
    if (!risk || !risk.overallRiskLevel) {
      return null;
    }

    // Only generate for ELEVATED, HIGH, or CRITICAL
    if (
      risk.overallRiskLevel !== 'ELEVATED' &&
      risk.overallRiskLevel !== 'HIGH' &&
      risk.overallRiskLevel !== 'CRITICAL'
    ) {
      return null;
    }

    // Do not generate if risk assessment data is stale beyond accepted limits
    if (risk.isStale) {
      return null;
    }

    const severityMap: Record<string, AlertSeverity> = {
      CRITICAL: 'EMERGENCY',
      HIGH: 'WARNING',
      ELEVATED: 'WATCH',
    };

    const actions: string[] = [
      'Inspect local stormwater inlets, catch basins, and low-lying transit underpasses.',
      'Review municipal pumping station operational status and standby diesel generator reserves.',
      'Cross-reference official IMD and State Disaster Management Authority (SDMA) bulletins for official directives.',
    ];

    const primaryDriverText =
      risk.explanation.primaryDrivers.length > 0
        ? risk.explanation.primaryDrivers.join(' ')
        : 'Multiple meteorological factors indicate elevated surface runoff potential.';

    return {
      id: `ALT-JATAYU-IND-${risk.overallRiskLevel}-${Math.round(risk.riskScore)}`,
      category: 'FLOOD',
      severity: severityMap[risk.overallRiskLevel] || 'WATCH',
      headline: `JATAYU Indicative Advisory: ${risk.overallRiskLevel} Hazard Index (${risk.riskScore}/100)`,
      description: `${risk.explanation.summary} Primary factors: ${primaryDriverText} Notice: Derived from heuristic multi-factor numerical weather analysis. Not an official evacuation warning or hydraulic flood model.`,
      issuedAt: risk.assessedAt,
      effectiveUntil: new Date(new Date(risk.assessedAt).getTime() + 6 * 3600 * 1000).toISOString(), // 6 hours validity
      affectedArea: {
        name: locationName,
        location: risk.location,
        matchMethod: 'EXACT_DISTRICT',
      },
      recommendedActions: actions,
      sourceType: 'INDICATIVE_MODEL',
      sourceAgency: 'JATAYU Indicative Hydro-Engine (Pre-Validation)',
      isOfficialWarning: false,
      status: 'ACTIVE',
    };
  }

  /**
   * Main service call: returns combined feed with clear separation of official vs indicative vs drill.
   */
  public async getAlerts(
    lat: number,
    lon: number,
    locationName: string = 'Operational Sector',
    providedRisk?: IndicativeFloodRiskAssessment | null
  ): Promise<AlertFeedResponse> {
    let rawAlertsResult: {
      alerts: DisasterAlert[];
      status: 'LIVE_VERIFIED' | 'CACHED' | 'UPSTREAM_FALLBACK';
      fetchedAt: string;
      isStaleCache?: boolean;
    };

    try {
      rawAlertsResult = await this.fetchRawIMDAlerts();
    } catch (err: any) {
      console.warn('IMD alerts fetch failed:', err.message);
      rawAlertsResult = {
        alerts: [],
        status: 'UPSTREAM_FALLBACK',
        fetchedAt: new Date().toISOString(),
        isStaleCache: false,
      };
    }

    const fetchedAt = rawAlertsResult.fetchedAt;

    // Step 1: Spatial point-in-polygon resolution from coordinates (primary authority)
    const spatialResult = this.districtBoundaryService.findDistrictByCoordinates(lat, lon);

    let geographicResolution: GeographicResolution;
    let matchedOfficialAlerts: DisasterAlert[] = [];
    let nationwideAlerts: DisasterAlert[] = [];

    if (spatialResult && spatialResult.matchStatus === 'RESOLVED_DISTRICT') {
      const canonicalDistrict = spatialResult.canonicalDistrict;
      const canonicalState = spatialResult.canonicalState;

      geographicResolution = {
        coordinates: { latitude: lat, longitude: lon },
        resolvedDistrict: canonicalDistrict,
        resolvedState: canonicalState,
        censusCode: spatialResult.censusCode,
        matchStatus: 'RESOLVED_DISTRICT',
        datasetSource: spatialResult.datasetSource,
        vintage: spatialResult.vintage,
        isAmbiguous: spatialResult.isAmbiguous,
        secondaryDistricts: spatialResult.secondaryDistricts,
        coverageNotice: spatialResult.coverageNotice,
      };

      // Filter official IMD bulletins strictly to the resolved district
      for (const alert of rawAlertsResult.alerts) {
        const isPrimaryMatch = this.districtBoundaryService.isBulletinMatch(
          alert.affectedArea.name,
          canonicalDistrict,
          canonicalState
        );
        const isSecondaryMatch =
          !isPrimaryMatch &&
          (spatialResult.secondaryDistricts?.some((sec) =>
            this.districtBoundaryService.isBulletinMatch(alert.affectedArea.name, sec)
          ) ?? false);

        if (isPrimaryMatch) {
          matchedOfficialAlerts.push({
            ...alert,
            districtMatched: true,
            affectedArea: {
              ...alert.affectedArea,
              matchMethod: 'EXACT_DISTRICT',
            },
          });
        } else if (isSecondaryMatch) {
          matchedOfficialAlerts.push({
            ...alert,
            districtMatched: true,
            affectedArea: {
              ...alert.affectedArea,
              matchMethod: 'BORDER_ZONE_SECONDARY',
            },
          });
        } else {
          nationwideAlerts.push({
            ...alert,
            districtMatched: false,
            affectedArea: {
              ...alert.affectedArea,
              matchMethod: 'NOT_LOCATION_MATCHED',
            },
          });
        }
      }
    } else if (spatialResult && spatialResult.matchStatus === 'OFFSHORE_OR_UNRESOLVED') {
      geographicResolution = {
        coordinates: { latitude: lat, longitude: lon },
        resolvedDistrict: null,
        resolvedState: null,
        matchStatus: 'OFFSHORE_OR_UNRESOLVED',
        datasetSource: spatialResult.datasetSource,
        vintage: spatialResult.vintage,
        coverageNotice: spatialResult.coverageNotice,
      };

      // All active bulletins belong to nationwide feed
      nationwideAlerts = rawAlertsResult.alerts.map((alert) => ({
        ...alert,
        districtMatched: false,
        affectedArea: {
          ...alert.affectedArea,
          matchMethod: 'NOT_LOCATION_MATCHED',
        },
      }));
    } else {
      // Degraded / dataset unavailable fallback
      geographicResolution = {
        coordinates: { latitude: lat, longitude: lon },
        resolvedDistrict: null,
        resolvedState: null,
        matchStatus: 'BOUNDARY_DATA_UNAVAILABLE',
        datasetSource: 'DataMeet India Community Maps',
        vintage: '2011 Census',
        coverageNotice: spatialResult?.coverageNotice || 'District boundary dataset offline or unavailable.',
      };

      nationwideAlerts = rawAlertsResult.alerts.map((alert) => ({
        ...alert,
        districtMatched: false,
        affectedArea: {
          ...alert.affectedArea,
          matchMethod: 'NOT_LOCATION_MATCHED',
        },
      }));
    }

    // Generate Indicative Model Advisory if risk assessment is available and elevated
    const indicativeAlerts: DisasterAlert[] = [];
    let risk = providedRisk;
    if (!risk) {
      try {
        risk = await this.riskService.assessRisk(lat, lon, locationName);
      } catch {
        risk = null;
      }
    }

    if (risk) {
      const advisory = this.generateIndicativeAdvisory(risk, locationName);
      if (advisory) {
        indicativeAlerts.push(advisory);
      }
    }

    // Optional synthetic demonstration scenario (clearly segregated as DEMO_DATA)
    const demonstrationScenarios: DisasterAlert[] = [
      {
        id: 'ALT-SIM-DRILL-01',
        category: 'CYCLONE',
        severity: 'EMERGENCY',
        headline: '[DRILL EXERCISE] Synthetic Cyclone Evacuation Simulation',
        description:
          'SYNTHETIC TRAINING DRILL ONLY: Simulated Category 3 cyclonic disturbance making landfall. Exercises civil defense shelter logistics and emergency communication fallback.',
        issuedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        effectiveUntil: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
        affectedArea: {
          name: 'State Disaster Training Corridor',
          matchMethod: 'ALL_ACTIVE_FEED',
        },
        recommendedActions: [
          'Verify satellite radio and HF emergency communications.',
          'Confirm secondary power generator diesel reserves at emergency muster points.',
        ],
        sourceType: 'DEMO_DATA',
        sourceAgency: 'National Disaster Preparedness Exercise (Synthetic Drill)',
        isOfficialWarning: false,
        status: 'ACTIVE',
      },
    ];

    const feedStatus: 'LIVE_VERIFIED' | 'CACHED' | 'EMPTY' | 'UPSTREAM_FALLBACK' =
      rawAlertsResult.status === 'UPSTREAM_FALLBACK'
        ? 'UPSTREAM_FALLBACK'
        : rawAlertsResult.alerts.length === 0
        ? 'EMPTY'
        : rawAlertsResult.status;

    const limitations: string[] = [
      'IMD Nowcast RSS provides short-term (3-hour) convective weather warnings at district resolution.',
      'District resolution is computed server-side via DataMeet India 2011 Census boundaries with point-in-polygon verification.',
      'Nationwide active bulletins are provided for situational context but are explicitly marked as NOT_LOCATION_MATCHED.',
      'Official warnings are never synthesized or fabricated when upstream feeds are empty or unreachable.',
    ];

    if (rawAlertsResult.isStaleCache) {
      limitations.unshift(
        `Upstream IMD service unreachable. Displaying stale cached warning data fetched at ${rawAlertsResult.fetchedAt}; live bulletins could not be verified.`
      );
    }

    return {
      fetchedAt,
      source: 'India Meteorological Department (IMD) Nowcast RSS',
      feedStatus,
      itemCount: matchedOfficialAlerts.length + indicativeAlerts.length,
      geographicResolution,
      officialAlerts: matchedOfficialAlerts,
      nationwideAlerts,
      indicativeAlerts,
      demonstrationScenarios,
      disclaimer:
        'Official meteorological warnings are ingested directly from IMD feeds. JATAYU indicative model advisories are heuristic situational triage estimates and must never be construed as government disaster warnings.',
      limitations,
    };
  }
}
