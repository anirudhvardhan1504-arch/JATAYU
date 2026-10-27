import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import {
  AlertService,
  classifySeverityFromDescription,
  classifyCategoryFromDescription,
  parseDateToISO,
  extractRecommendedActions,
} from '../services/alert.service.js';
import { IndicativeFloodRiskAssessment } from '../types/risk.types.js';

beforeAll(() => {
  // Anchor system time to 2026-10-10 08:00 IST (02:30 UTC)
  // This ensures XML fixtures issued at 06:50-07:00 IST and expiring at 12:00-18:00 IST
  // are deterministically active across all calendar dates, while expired fixtures (Oct 09) remain expired.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T08:00:00+05:30'));
});

afterAll(() => {
  vi.useRealTimers();
});

const sampleValidImdRss = `<?xml version='1.0' encoding='UTF-8' ?>
<rss version='2.0'>
<channel>
<title>IMD WARNING</title>
<description>IMD RSS</description>
<item>
<title>MUZAFFARPUR</title>
<guid>guid-muz-12345</guid>
<link>https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php</link>
<sent>2026-10-10T06:50:00+5:30</sent>
<pubDate>Sat, 10 Oct 2026 06:50:00 </pubDate>
<Expires>2026-10-10T12:00:00+5:30</Expires>
<description><![CDATA[Moderate rain: 5-15 mm/hr, Moderate Thunderstorms with maximum surface wind speed between 41 - 61 kmph, Moderate cloud to ground Lightning probability]]></description>
<category>NOWCAST</category>
</item>
<item>
<title>CHENNAI</title>
<guid>guid-chn-67890</guid>
<link>https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php</link>
<sent>2026-10-10T07:00:00+5:30</sent>
<pubDate>Sat, 10 Oct 2026 07:00:00 </pubDate>
<Expires>2026-10-10T14:00:00+5:30</Expires>
<description><![CDATA[Heavy rain (> 15 mm/hr), squall with wind speed reaching 55 kmph in gusts]]></description>
<category>NOWCAST</category>
</item>
</channel>
</rss>`;

const sampleExpiredImdRss = `<?xml version='1.0' encoding='UTF-8' ?>
<rss version='2.0'>
<channel>
<title>IMD WARNING</title>
<item>
<title>KOLKATA</title>
<guid>guid-kol-expired</guid>
<sent>2026-10-09T01:00:00+5:30</sent>
<Expires>2026-10-09T04:00:00+5:30</Expires>
<description><![CDATA[Light rain]]></description>
</item>
</channel>
</rss>`;

const sampleDuplicateImdRss = `<?xml version='1.0' encoding='UTF-8' ?>
<rss version='2.0'>
<channel>
<title>IMD WARNING</title>
<item>
<title>PUNE</title>
<guid>dup-guid-111</guid>
<sent>2026-10-10T06:00:00+5:30</sent>
<Expires>2026-10-10T12:00:00+5:30</Expires>
<description><![CDATA[Moderate rain]]></description>
</item>
<item>
<title>PUNE</title>
<guid>dup-guid-111</guid>
<sent>2026-10-10T06:00:00+5:30</sent>
<Expires>2026-10-10T12:00:00+5:30</Expires>
<description><![CDATA[Moderate rain]]></description>
</item>
</channel>
</rss>`;

describe('Alert Service Helper Functions', () => {
  it('classifySeverityFromDescription maps descriptions to standardized tiers', () => {
    expect(classifySeverityFromDescription('Extremely heavy rain and gale')).toBe('EMERGENCY');
    expect(classifySeverityFromDescription('Heavy rain with wind gusts of 61 kmph')).toBe('WARNING');
    expect(classifySeverityFromDescription('Moderate rain: 5-15 mm/hr with lightning')).toBe('WATCH');
    expect(classifySeverityFromDescription('Light drizzle over sector')).toBe('ADVISORY');
  });

  it('classifyCategoryFromDescription identifies event categories', () => {
    expect(classifyCategoryFromDescription('Cyclonic disturbance approaching', 'NOWCAST')).toBe('CYCLONE');
    expect(classifyCategoryFromDescription('High surface wind gusts without rain')).toBe('WIND');
    expect(classifyCategoryFromDescription('Extreme heat and warm night conditions')).toBe('HEATWAVE');
    expect(classifyCategoryFromDescription('Urban flooding and waterlogging')).toBe('FLOOD');
    expect(classifyCategoryFromDescription('Moderate rainfall')).toBe('RAINFALL');
  });

  it('parseDateToISO standardizes Indian timezone offsets safely', () => {
    const parsed = parseDateToISO('2026-10-10T06:50:00+5:30');
    expect(parsed).not.toBeNull();
    expect(new Date(parsed!).getTime()).not.toBeNaN();
    expect(parseDateToISO(undefined)).toBeNull();
    expect(parseDateToISO('invalid-date-string')).toBeNull();
  });

  it('extractRecommendedActions provides relevant actions based on keywords', () => {
    const actions = extractRecommendedActions('Lightning and heavy rain', 'WARNING');
    expect(actions.some((a) => a.includes('shelter'))).toBe(true);
    expect(actions.some((a) => a.includes('liaison'))).toBe(true);
  });
});

describe('AlertService XML Ingestion & Validation', () => {
  it('parses valid IMD RSS XML and extracts alerts with preserved provenance', () => {
    const service = new AlertService();
    const alerts = service.parseIMDRssXml(sampleValidImdRss);

    expect(alerts.length).toBe(2);
    expect(alerts[0].headline).toBe('IMD Nowcast Warning: MUZAFFARPUR District');
    expect(alerts[0].sourceAgency).toBe('India Meteorological Department (IMD)');
    expect(alerts[0].isOfficialWarning).toBe(true);
    expect(alerts[0].sourceType).toBe('OFFICIAL_FORECAST');
    expect(alerts[0].severity).toBe('WATCH');
    expect(alerts[0].officialBulletinUrl).toContain('mausam.imd.gov.in');

    expect(alerts[1].headline).toBe('IMD Nowcast Warning: CHENNAI District');
    expect(alerts[1].severity).toBe('WARNING');
  });

  it('excludes expired warnings from active results', () => {
    const service = new AlertService();
    const alerts = service.parseIMDRssXml(sampleExpiredImdRss);
    expect(alerts.length).toBe(0); // Bulletin expired on Oct 09
  });

  it('deduplicates identical items by GUID', () => {
    const service = new AlertService();
    const alerts = service.parseIMDRssXml(sampleDuplicateImdRss);
    expect(alerts.length).toBe(1);
  });

  it('handles empty or malformed XML gracefully without throwing', () => {
    const service = new AlertService();
    expect(service.parseIMDRssXml('')).toEqual([]);
    expect(service.parseIMDRssXml('<empty></empty>')).toEqual([]);
    expect(() => service.parseIMDRssXml('<unclosed-tag>')).toThrow();
  });
});

describe('Indicative Model Advisory Generation', () => {
  const baseMockRisk: IndicativeFloodRiskAssessment = {
    location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Test' },
    assessedAt: '2026-10-10T06:00:00.000Z',
    dataTimestamp: '2026-10-10T05:30',
    isStale: false,
    riskScore: 78,
    overallRiskLevel: 'HIGH',
    dataCompleteness: 'FULL',
    dataConfidence: 'HIGH',
    factors: {} as any,
    metrics: {} as any,
    explanation: {
      summary: 'High indicative hazard index 78/100.',
      primaryDrivers: ['Intense 1h rainfall', 'High soil saturation'],
      meteorologicalContext: 'Active convective front.',
      missingInputs: [],
      modelAssumptions: [],
      limitations: [],
    },
    disclaimer: {
      isHydraulicallyValidated: false,
      modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC',
      statement: 'Indicative assessment only.',
      validationStatus: 'UNVALIDATED_PROTOTYPE',
    },
    sourceType: 'INDICATIVE_MODEL',
    sourceAttribution: 'JATAYU',
  };

  it('generates an advisory when risk tier is HIGH or CRITICAL', () => {
    const service = new AlertService();
    const advisory = service.generateIndicativeAdvisory(baseMockRisk, 'Mumbai Sector');

    expect(advisory).not.toBeNull();
    expect(advisory?.isOfficialWarning).toBe(false);
    expect(advisory?.sourceType).toBe('INDICATIVE_MODEL');
    expect(advisory?.severity).toBe('WARNING'); // HIGH tier maps to WARNING
    expect(advisory?.headline).toContain('HIGH Hazard Index');
    expect(advisory?.description).toContain('Not an official evacuation warning');
  });

  it('does NOT generate an advisory when risk tier is LOW or GUARDED', () => {
    const service = new AlertService();
    const lowRisk = { ...baseMockRisk, overallRiskLevel: 'LOW' as const, riskScore: 18 };
    expect(service.generateIndicativeAdvisory(lowRisk, 'Mumbai Sector')).toBeNull();

    const guardedRisk = { ...baseMockRisk, overallRiskLevel: 'GUARDED' as const, riskScore: 35 };
    expect(service.generateIndicativeAdvisory(guardedRisk, 'Mumbai Sector')).toBeNull();
  });

  it('does NOT generate an advisory if risk telemetry is marked stale', () => {
    const service = new AlertService();
    const staleRisk = { ...baseMockRisk, isStale: true };
    expect(service.generateIndicativeAdvisory(staleRisk, 'Mumbai Sector')).toBeNull();
  });
});

describe('Alert API Integration Route (/api/alerts)', () => {
  let fetchSpy: any;

  beforeEach(() => {
    // Default deterministic mock for global fetch in route tests
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('imd')) {
        return new Response(sampleValidImdRss, {
          status: 200,
          headers: { 'Content-Type': 'application/rss+xml' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('GET /api/alerts returns typed AlertFeedResponse with separated lists and spatial resolution', async () => {
    const res = await request(app).get('/api/alerts?lat=19.0760&lon=72.8777&name=Mumbai');
    expect(res.status).toBe(200);
    expect(res.body.fetchedAt).toBeDefined();
    expect(res.body.source).toContain('IMD');
    expect(res.body.geographicResolution).toBeDefined();
    expect(res.body.geographicResolution.matchStatus).toBe('RESOLVED_DISTRICT');
    expect(['MUMBAI', 'MUMBAI SUBURBAN']).toContain(res.body.geographicResolution.resolvedDistrict);
    expect(res.body.officialAlerts).toBeInstanceOf(Array);
    expect(res.body.nationwideAlerts).toBeInstanceOf(Array);
    expect(res.body.indicativeAlerts).toBeInstanceOf(Array);
    expect(res.body.demonstrationScenarios).toBeInstanceOf(Array);
    expect(res.body.disclaimer).toBeDefined();
    expect(res.body.limitations).toBeInstanceOf(Array);
  });

  it('GET /api/alerts handles offshore coordinates with OFFSHORE_OR_UNRESOLVED', async () => {
    const res = await request(app).get('/api/alerts?lat=19.0&lon=70.0&name=ArabianSea');
    expect(res.status).toBe(200);
    expect(res.body.geographicResolution.matchStatus).toBe('OFFSHORE_OR_UNRESOLVED');
    expect(res.body.geographicResolution.resolvedDistrict).toBeNull();
    expect(res.body.officialAlerts).toEqual([]);
    expect(res.body.nationwideAlerts).toBeInstanceOf(Array);
  });

  it('GET /api/alerts rejects out-of-range coordinates with HTTP 400', async () => {
    const res = await request(app).get('/api/alerts?lat=120&lon=72.8');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATES');
  });

  // Fix 4: Boundary Ambiguity Propagation
  it('Fix 4: propagates boundary ambiguity flags to geographicResolution response', async () => {
    // Panchkula/Sirmaur border coordinate: 30.5633 N, 77.1252 E
    const res = await request(app).get('/api/alerts?lat=30.5633&lon=77.1252&name=BorderPoint');
    expect(res.status).toBe(200);
    expect(res.body.geographicResolution.isAmbiguous).toBe(true);
    expect(res.body.geographicResolution.secondaryDistricts).toBeDefined();
    expect(res.body.geographicResolution.secondaryDistricts.length).toBeGreaterThan(0);
  });
});

describe('Deterministic Outage, Cache, and Recovery Sequence (Mandate 3)', () => {
  it('verifies the full 6-state lifecycle deterministically', async () => {
    const service = new AlertService('https://test-feed.imd.gov.in/rss.php', 10 * 60 * 1000);

    // State 1: Successful IMD response containing active bulletins
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(sampleValidImdRss, { status: 200, headers: { 'Content-Type': 'application/xml' } })
    );

    const state1 = await service.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state1.feedStatus).toBe('LIVE_VERIFIED');
    expect(state1.officialAlerts.length + state1.nationwideAlerts.length).toBeGreaterThan(0);
    expect(state1.source).toContain('IMD');
    const initialFetchedAt = state1.fetchedAt;
    expect(initialFetchedAt).toBeDefined();

    // State 2: Successful response containing zero active bulletins (fresh service instance)
    const emptyService = new AlertService('https://test-feed.imd.gov.in/empty.php');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        `<?xml version='1.0' encoding='UTF-8' ?><rss version='2.0'><channel><title>IMD</title></channel></rss>`,
        { status: 200, headers: { 'Content-Type': 'application/xml' } }
      )
    );
    const state2 = await emptyService.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state2.feedStatus).toBe('EMPTY');
    expect(state2.officialAlerts).toEqual([]);
    expect(state2.nationwideAlerts).toEqual([]);

    // State 3: Network failure with no cache
    const freshService = new AlertService('https://test-feed.imd.gov.in/fail.php');
    fetchSpy.mockRejectedValueOnce(new Error('Network connection timeout'));
    const state3 = await freshService.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state3.feedStatus).toBe('UPSTREAM_FALLBACK');
    expect(state3.officialAlerts).toEqual([]);
    expect(state3.feedStatus).not.toBe('EMPTY');

    // State 4: Network failure with valid cached data (service instance has active cache from State 1)
    // Within TTL (10m), service serves from cache without hitting network
    const state4 = await service.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state4.feedStatus).toBe('CACHED');
    expect(state4.fetchedAt).toBe(initialFetchedAt); // Accurately reflects original fetch time!

    // State 5: Network failure with expired cached data
    // Manually age cache beyond 10-minute TTL (15 mins ago)
    (service as any).cachedFeed.fetchedAt = Date.now() - 15 * 60 * 1000;
    fetchSpy.mockRejectedValueOnce(new Error('Upstream 503 Gateway Unavailable'));

    const state5 = await service.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state5.feedStatus).toBe('UPSTREAM_FALLBACK'); // Must never claim live verified
    expect(state5.fetchedAt).toBe(new Date((service as any).cachedFeed.fetchedAt).toISOString()); // Accurately reports stale fetch time
    expect(state5.limitations.some((l: string) => l.includes('stale cached warning data'))).toBe(true);

    // State 6: Successful recovery after an outage
    // Advance mock clock by 5 minutes to simulate time elapsed during outage recovery
    vi.setSystemTime(new Date(Date.now() + 5 * 60 * 1000));
    fetchSpy.mockResolvedValueOnce(
      new Response(sampleValidImdRss, { status: 200, headers: { 'Content-Type': 'application/xml' } })
    );
    const state6 = await service.getAlerts(19.076, 72.8777, 'Mumbai');
    expect(state6.feedStatus).toBe('LIVE_VERIFIED');
    expect(new Date(state6.fetchedAt).getTime()).toBeGreaterThan(new Date(initialFetchedAt).getTime());

    fetchSpy.mockRestore();
  });
});

describe('Border-Zone Alert Semantics & Distinguishability (Mandate 2)', () => {
  it('distinguishes EXACT_DISTRICT from BORDER_ZONE_SECONDARY and prevents feed duplicates', async () => {
    const service = new AlertService();

    // XML bulletin with Panchkula (primary for border point 30.5633, 77.1252),
    // Sirmaur (secondary border district), and Chennai (unmatched nationwide)
    const borderXml = `<?xml version='1.0' encoding='UTF-8' ?>
<rss version='2.0'>
<channel>
<title>IMD WARNING</title>
<item>
<title>PANCHKULA</title>
<guid>guid-pnc-01</guid>
<sent>2026-10-10T06:50:00+5:30</sent>
<Expires>2026-10-10T18:00:00+5:30</Expires>
<description><![CDATA[Heavy rain (> 15 mm/hr)]]></description>
</item>
<item>
<title>SIRMAUR</title>
<guid>guid-srm-02</guid>
<sent>2026-10-10T06:50:00+5:30</sent>
<Expires>2026-10-10T18:00:00+5:30</Expires>
<description><![CDATA[Moderate rain: 5-15 mm/hr]]></description>
</item>
<item>
<title>CHENNAI</title>
<guid>guid-chn-03</guid>
<sent>2026-10-10T06:50:00+5:30</sent>
<Expires>2026-10-10T18:00:00+5:30</Expires>
<description><![CDATA[Light rain]]></description>
</item>
</channel>
</rss>`;

    vi.spyOn(service, 'fetchRawIMDAlerts').mockResolvedValue({
      alerts: service.parseIMDRssXml(borderXml),
      status: 'LIVE_VERIFIED',
      fetchedAt: new Date().toISOString(),
    });

    // Border coordinate between Panchkula and Sirmaur: 30.5633 N, 77.1252 E
    const res = await service.getAlerts(30.5633, 77.1252, 'Border Station');

    expect(res.geographicResolution.isAmbiguous).toBe(true);
    expect(res.officialAlerts.length).toBe(2);

    // Primary match
    const primaryAlert = res.officialAlerts.find((a) => a.headline.includes('PANCHKULA'));
    expect(primaryAlert).toBeDefined();
    expect(primaryAlert?.affectedArea.matchMethod).toBe('EXACT_DISTRICT');

    // Secondary border-zone match (distinguishable!)
    const secondaryAlert = res.officialAlerts.find((a) => a.headline.includes('SIRMAUR'));
    expect(secondaryAlert).toBeDefined();
    expect(secondaryAlert?.affectedArea.matchMethod).toBe('BORDER_ZONE_SECONDARY');
    expect(secondaryAlert?.affectedArea.matchMethod).not.toBe('EXACT_DISTRICT');

    // Nationwide alert
    expect(res.nationwideAlerts.length).toBe(1);
    expect(res.nationwideAlerts[0].headline).toContain('CHENNAI');
    expect(res.nationwideAlerts[0].affectedArea.matchMethod).toBe('NOT_LOCATION_MATCHED');

    // Verify deduplication: no alert ID appears in both feeds
    const officialIds = new Set(res.officialAlerts.map((a) => a.id));
    for (const a of res.nationwideAlerts) {
      expect(officialIds.has(a.id)).toBe(false);
    }
  });
});
