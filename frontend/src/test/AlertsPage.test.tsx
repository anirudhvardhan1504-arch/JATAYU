import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AlertsPage } from '../pages/AlertsPage';
import { AlertFeedResponse } from '../types';

const mockAlertFeed: AlertFeedResponse = {
  fetchedAt: '2026-10-10T06:50:00Z',
  source: 'India Meteorological Department (IMD) District Nowcast',
  feedStatus: 'LIVE_VERIFIED',
  itemCount: 2,
  geographicResolution: {
    coordinates: { latitude: 19.076, longitude: 72.8777 },
    resolvedDistrict: 'MUMBAI SUBURBAN',
    resolvedState: 'MAHARASHTRA',
    censusCode: '518',
    matchStatus: 'RESOLVED_DISTRICT',
    datasetSource: 'DataMeet India Community Maps (Census 2011 Districts)',
    vintage: '2011 Census of India administrative delimitation',
  },
  officialAlerts: [
    {
      id: 'ALT-IMD-MUM-101',
      category: 'RAINFALL',
      severity: 'WATCH',
      headline: 'IMD Nowcast Warning: MUMBAI SUBURBAN District',
      description: 'Moderate rain: 5-15 mm/hr with lightning activity.',
      issuedAt: '2026-10-10T06:50:00Z',
      effectiveUntil: '2026-10-10T12:00:00Z',
      affectedArea: {
        name: 'MUMBAI SUBURBAN District, India',
        matchMethod: 'EXACT_DISTRICT',
      },
      recommendedActions: ['Seek safe indoor shelter; avoid open ground.'],
      sourceType: 'OFFICIAL_FORECAST',
      sourceAgency: 'India Meteorological Department (IMD)',
      officialBulletinUrl: 'https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php',
      isOfficialWarning: true,
      status: 'ACTIVE',
      districtMatched: true,
    },
  ],
  nationwideAlerts: [
    {
      id: 'ALT-IMD-MUZ-102',
      category: 'RAINFALL',
      severity: 'WARNING',
      headline: 'IMD Nowcast Warning: MUZAFFARPUR District',
      description: 'Heavy rain (> 15 mm/hr) and gusty winds.',
      issuedAt: '2026-10-10T06:50:00Z',
      effectiveUntil: '2026-10-10T12:00:00Z',
      affectedArea: {
        name: 'MUZAFFARPUR District, India',
        matchMethod: 'NOT_LOCATION_MATCHED',
      },
      recommendedActions: ['Monitor local municipal drainage advisories.'],
      sourceType: 'OFFICIAL_FORECAST',
      sourceAgency: 'India Meteorological Department (IMD)',
      officialBulletinUrl: 'https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php',
      isOfficialWarning: true,
      status: 'ACTIVE',
      districtMatched: false,
    },
  ],
  indicativeAlerts: [
    {
      id: 'ALT-JATAYU-IND-MUM-88',
      category: 'FLOOD',
      severity: 'WARNING',
      headline: 'Indicative Risk Advisory: HIGH Hazard Index (78/100)',
      description: 'Heuristic hazard assessment indicates elevated runoff vulnerability. Not an official evacuation warning.',
      issuedAt: '2026-10-10T06:50:00Z',
      effectiveUntil: '2026-10-10T12:50:00Z',
      affectedArea: {
        name: 'Mumbai Metropolitan Region',
        matchMethod: 'EXACT_DISTRICT',
      },
      recommendedActions: ['Monitor local municipal storm drain advisories.'],
      sourceType: 'INDICATIVE_MODEL',
      sourceAgency: 'JATAYU Indicative Hydro-Engine (Heuristic)',
      isOfficialWarning: false,
      status: 'ACTIVE',
    },
  ],
  demonstrationScenarios: [
    {
      id: 'ALT-SIM-DRILL-01',
      category: 'CYCLONE',
      severity: 'EMERGENCY',
      headline: '[DRILL EXERCISE] Synthetic Cyclone Simulation',
      description: 'SYNTHETIC TRAINING SCENARIO ONLY: Category 3 landfall simulation.',
      issuedAt: '2026-10-10T06:50:00Z',
      effectiveUntil: '2026-10-10T18:50:00Z',
      affectedArea: {
        name: 'Coastal Drill Zone',
        matchMethod: 'ALL_ACTIVE_FEED',
      },
      recommendedActions: ['Test emergency radio channels.'],
      sourceType: 'DEMO_DATA',
      sourceAgency: 'Civil Defense Exercise',
      isOfficialWarning: false,
      status: 'ACTIVE',
    },
  ],
  disclaimer: 'Indicative risk advisories are heuristic-driven.',
  limitations: ['District boundaries approximate.'],
};

describe('AlertsPage Component Unit & Segregation Tests', () => {
  const defaultLocation = {
    name: 'Mumbai Metropolitan Region',
    lat: 19.076,
    lon: 72.8777,
  };

  it('renders resolved district in provenance header with local district match', () => {
    render(<AlertsPage location={defaultLocation} alertFeed={mockAlertFeed} />);

    // Resolved district banner
    expect(screen.getByText(/MUMBAI SUBURBAN, MAHARASHTRA/i)).toBeInTheDocument();

    // Official alert headline
    expect(screen.getByText('IMD Nowcast Warning: MUMBAI SUBURBAN District')).toBeInTheDocument();
    expect(screen.getByText('India Meteorological Department (IMD)')).toBeInTheDocument();

    // Link to official IMD bulletin
    const link = screen.getByRole('link', { name: /OFFICIAL BULLETIN/i });
    expect(link).toHaveAttribute('href', 'https://mausam.imd.gov.in/imd_latest/contents/districtwisewarnings.php');
    expect(link).toHaveAttribute('target', '_blank');

    // Local district match badge
    expect(screen.getByText('LOCAL DISTRICT MATCH')).toBeInTheDocument();
  });

  it('switches to Nationwide IMD Feed tab and displays NOT_LOCATION_MATCHED badges', () => {
    render(<AlertsPage location={defaultLocation} alertFeed={mockAlertFeed} />);

    // Click NATIONWIDE IMD FEED tab
    const nationwideTabBtn = screen.getByRole('button', { name: /NATIONWIDE IMD FEED/i });
    fireEvent.click(nationwideTabBtn);

    // Muzaffarpur warning now visible in nationwide feed
    expect(screen.getByText('IMD Nowcast Warning: MUZAFFARPUR District')).toBeInTheDocument();
    expect(screen.getByText('NOT LOCATION MATCHED')).toBeInTheDocument();

    // Local warning not in nationwide tab
    expect(screen.queryByText('IMD Nowcast Warning: MUMBAI SUBURBAN District')).not.toBeInTheDocument();
  });

  it('switches to Indicative Advisories tab and displays model disclaimer', () => {
    render(<AlertsPage location={defaultLocation} alertFeed={mockAlertFeed} />);

    // Click INDICATIVE ADVISORIES tab
    const indicativeTabBtn = screen.getByRole('button', { name: /INDICATIVE ADVISORIES/i });
    fireEvent.click(indicativeTabBtn);

    // Indicative headline visible
    expect(
      screen.getByText('Indicative Risk Advisory: HIGH Hazard Index (78/100)')
    ).toBeInTheDocument();

    // Model disclaimer note visible
    expect(
      screen.getByText(/do not constitute official evacuation orders/i)
    ).toBeInTheDocument();

    // Official IMD alert is not visible on this tab
    expect(screen.queryByText('IMD Nowcast Warning: MUMBAI SUBURBAN District')).not.toBeInTheDocument();
  });

  it('switches to Drill Scenarios tab and displays synthetic disclaimer', () => {
    render(<AlertsPage location={defaultLocation} alertFeed={mockAlertFeed} />);

    // Click DRILL SCENARIOS tab
    const drillTabBtn = screen.getByRole('button', { name: /DRILL SCENARIOS/i });
    fireEvent.click(drillTabBtn);

    expect(screen.getByText('[DRILL EXERCISE] Synthetic Cyclone Simulation')).toBeInTheDocument();
    expect(screen.getByText(/SYNTHETIC TRAINING SCENARIO ONLY/i)).toBeInTheDocument();
  });

  it('renders offshore coverage notice when coordinates are offshore', () => {
    const offshoreFeed: AlertFeedResponse = {
      ...mockAlertFeed,
      geographicResolution: {
        coordinates: { latitude: 19.0, longitude: 70.0 },
        resolvedDistrict: null,
        resolvedState: null,
        matchStatus: 'OFFSHORE_OR_UNRESOLVED',
        datasetSource: 'DataMeet India Community Maps (Census 2011 Districts)',
        vintage: '2011 Census',
        coverageNotice: 'Selected coordinates fall outside covered Indian administrative district polygons.',
      },
      officialAlerts: [],
    };

    render(<AlertsPage location={{ name: 'Arabian Sea', lat: 19.0, lon: 70.0 }} alertFeed={offshoreFeed} />);

    expect(screen.getByText('Geographic Coverage Boundary Notice')).toBeInTheDocument();
    expect(screen.getByText(/outside covered Indian administrative district/i)).toBeInTheDocument();
  });

  it('renders neutral district-specific empty state when resolved district has no active warnings', () => {
    const clearFeed: AlertFeedResponse = {
      ...mockAlertFeed,
      officialAlerts: [],
    };

    render(<AlertsPage location={defaultLocation} alertFeed={clearFeed} />);

    expect(screen.getByText(/No Active Official IMD Bulletins for MUMBAI SUBURBAN/i)).toBeInTheDocument();
    expect(screen.getByText(/No active IMD district nowcasts found for this district at the time of retrieval/i)).toBeInTheDocument();
  });

  // Fix 2: Upstream Outage UI Behavior
  it('Fix 2: renders upstream outage warning banner and unavailable state when feedStatus is UPSTREAM_FALLBACK', () => {
    const fallbackFeed: AlertFeedResponse = {
      ...mockAlertFeed,
      feedStatus: 'UPSTREAM_FALLBACK',
      officialAlerts: [],
      nationwideAlerts: [],
    };

    render(<AlertsPage location={defaultLocation} alertFeed={fallbackFeed} />);

    // Must show outage warning banner
    expect(
      screen.getByText(/Official Meteorological Warning Service Offline \/ Unverified/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Current IMD warning data could not be verified due to an upstream service outage/i)
    ).toBeInTheDocument();

    // Must show unavailable fallback card instead of falsely claiming "No Active Bulletins"
    expect(screen.getByText('Upstream Warning Feed Unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/No Active Official IMD Bulletins for MUMBAI SUBURBAN/i)).not.toBeInTheDocument();
  });

  // Fix 4: Boundary Ambiguity UI Notice
  it('Fix 4: renders boundary ambiguity banner and border zone badge when isAmbiguous is true', () => {
    const ambiguousFeed: AlertFeedResponse = {
      ...mockAlertFeed,
      geographicResolution: {
        ...mockAlertFeed.geographicResolution,
        isAmbiguous: true,
        secondaryDistricts: ['THANE'],
        coverageNotice: 'Selected coordinates lie in boundary overlap or border zone between MUMBAI SUBURBAN and THANE.',
      },
    };

    render(<AlertsPage location={defaultLocation} alertFeed={ambiguousFeed} />);

    expect(screen.getByText('Administrative Boundary Overlap Notice')).toBeInTheDocument();
    expect(screen.getByText(/boundary overlap or border zone between MUMBAI SUBURBAN and THANE/i)).toBeInTheDocument();
    expect(screen.getByText(/BORDER ZONE \(Near: THANE\)/i)).toBeInTheDocument();
  });

  it('Mandate 2: renders BORDER ZONE SECONDARY MATCH badge and explanatory note for secondary matches', () => {
    const secondaryFeed: AlertFeedResponse = {
      ...mockAlertFeed,
      geographicResolution: {
        ...mockAlertFeed.geographicResolution,
        isAmbiguous: true,
        secondaryDistricts: ['THANE'],
      },
      officialAlerts: [
        {
          ...mockAlertFeed.officialAlerts[0],
          id: 'ALT-SEC-THANE-01',
          headline: 'IMD Nowcast Warning: THANE District',
          affectedArea: {
            name: 'THANE District, India',
            matchMethod: 'BORDER_ZONE_SECONDARY',
          },
        },
      ],
    };

    render(<AlertsPage location={defaultLocation} alertFeed={secondaryFeed} />);

    expect(screen.getByText('BORDER ZONE SECONDARY MATCH')).toBeInTheDocument();
    expect(screen.getByText(/Border-Zone Relevance: Advisory issued for adjacent district/i)).toBeInTheDocument();
  });
});
