import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SafeRoutePage } from '../pages/SafeRoutePage';
import { FacilityCard } from '../components/route/FacilityCard';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import { getGoogleMapsDirectionsUrl } from '../services/route';
import { RoutePlanResponse, EmergencyFacilitiesResponse } from '../types';

// Mock maplibre-gl to avoid WebGL errors in test environment
vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn(() => ({
        on: vi.fn(),
        once: vi.fn(),
        remove: vi.fn(),
        addControl: vi.fn(),
        easeTo: vi.fn(),
        fitBounds: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
        getLayer: vi.fn(() => false),
        getSource: vi.fn(() => false),
        addLayer: vi.fn(),
        addSource: vi.fn(),
        removeLayer: vi.fn(),
        removeSource: vi.fn(),
      })),
      NavigationControl: vi.fn(),
      Marker: vi.fn(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        setPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      Popup: vi.fn(() => ({
        setHTML: vi.fn().mockReturnThis(),
        setDOMContent: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      LngLatBounds: vi.fn(() => ({
        extend: vi.fn(),
        isEmpty: vi.fn(() => false),
      })),
    },
  };
});

describe('JATAYU SafeRoute Component & Navigation Suite', () => {
  const mockFacilities: EmergencyFacilitiesResponse = {
    facilities: [
      {
        id: 'fac_gcc_saidapet_01',
        name: 'GCC Community Relief Center (Saidapet)',
        category: 'SHELTER',
        location: { latitude: 13.0182, longitude: 80.2245 },
        address: "Jeany's Road, Saidapet, Chennai",
        phone: '044-24351234',
        source: 'Greater Chennai Corporation (GCC)',
        verificationStatus: 'OFFICIALLY_VERIFIED',
        currentAvailability: 'UNKNOWN',
        distanceKm: 0.8,
      },
      {
        id: 'fac_hosp_rggh_01',
        name: 'Rajiv Gandhi Government General Hospital (RGGGH)',
        category: 'HOSPITAL',
        location: { latitude: 13.0818, longitude: 80.2785 },
        address: 'EVR Periyar Salai, Park Town, Chennai',
        phone: '044-25305000',
        source: 'Department of Health, Govt of Tamil Nadu',
        verificationStatus: 'OFFICIALLY_VERIFIED',
        currentAvailability: 'UNKNOWN',
        distanceKm: 7.2,
      },
    ],
    count: 2,
    sourceAttribution: 'Greater Chennai Corporation (GCC)',
    disclaimer: 'Facility availability UNKNOWN',
  };

  const mockRoutePlan: RoutePlanResponse = {
    origin: { latitude: 13.0827, longitude: 80.2755, name: 'Chennai Central' },
    destination: { latitude: 13.021, longitude: 80.223, name: 'Saidapet' },
    travelMode: 'driving',
    calculatedAt: '2026-10-26T15:00:00.000Z',
    routingProvider: 'Open Source Routing Machine (OSRM)',
    comparisonSummary: 'Evaluated 2 route options. Alternative route reduces exposure to known low-lying flood choke points.',
    recommendedRouteId: 'route-1',
    dataFreshness: {
      weather: '2026-10-26T14:45:00.000Z',
      alerts: '2026-10-26T14:50:00.000Z',
      evaluatedAt: '2026-10-26T15:00:00.000Z',
    },
    knownLimitations: [
      'Real-time municipal street-level flood depth sensors are not currently connected.',
      'Advisory screening only; localized ponding may occur.',
    ],
    disclaimer: 'Advisory assessment only. Always comply with civil defense directives.',
    routes: [
      {
        id: 'route-0',
        name: 'Primary Route (9.2 km)',
        isPrimary: true,
        distanceMeters: 9200,
        distanceKm: 9.2,
        durationSeconds: 1260,
        durationMinutes: 21,
        geometry: {
          type: 'LineString',
          coordinates: [
            [80.2755, 13.0827],
            [80.2227, 13.0204],
            [80.223, 13.021],
          ],
        },
        riskScore: 65,
        riskTier: 'HIGH',
        summary: 'via Anna Salai arterial corridor',
        suitabilityReason: 'Shortest estimated travel path; crosses Saidapet bridge bottleneck.',
        uncertaintyNotes: ['Real-time depth sensors unavailable'],
        hazards: [
          {
            id: 'hazard_1',
            type: 'RIVER_BASIN_CROSSING',
            severity: 'HIGH',
            title: 'Saidapet Maraimalai Adigal Bridge Bottleneck',
            description: 'Critical bridge abutment with high backwater surcharge vulnerability.',
            coordinate: [80.2227, 13.0204],
            dataSource: 'Chennai Historical Inundation Registry',
            sourceProvenance: 'HISTORICAL_VULNERABILITY',
            lastUpdated: '2026-10-26T15:00:00.000Z',
          },
        ],
      },
      {
        id: 'route-1',
        name: 'Alternative Route 1 (10.4 km)',
        isPrimary: false,
        distanceMeters: 10400,
        distanceKm: 10.4,
        durationSeconds: 1440,
        durationMinutes: 24,
        geometry: {
          type: 'LineString',
          coordinates: [
            [80.2755, 13.0827],
            [80.24, 13.06],
            [80.223, 13.021],
          ],
        },
        riskScore: 25,
        riskTier: 'ELEVATED',
        summary: 'via Inner Ring Road elevated bypass',
        suitabilityReason: 'Bypasses Saidapet bridge bottleneck with +1.2 km additional travel.',
        uncertaintyNotes: ['Real-time depth sensors unavailable'],
        additionalDistanceKm: 1.2,
        additionalDurationMinutes: 3,
        hazardsAvoidedAgainstPrimary: ['Avoids: Saidapet Maraimalai Adigal Bridge Bottleneck'],
        hazards: [],
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    // Default mock fetch for facilities
    vi.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/route/facilities')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockFacilities,
        } as any;
      }
      if (urlStr.includes('/api/route/plan')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockRoutePlan,
        } as any;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders SafeRoute page with configuration inputs and advisory disclaimer', async () => {
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    expect(screen.getByText('ROUTE CONFIGURATION')).toBeInTheDocument();
    expect(screen.getByText('Starting Point')).toBeInTheDocument();
    expect(screen.getByText('Destination / Evacuation Center')).toBeInTheDocument();
    expect(screen.getByText('Calculate Safe Routes')).toBeInTheDocument();
    expect(screen.getByText('Advisory assessment only.', { exact: false })).toBeInTheDocument();
  });

  it('2. Toggles travel modes accurately (driving, walking, cycling)', async () => {
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    const walkingBtn = screen.getByText('Walking');
    fireEvent.click(walkingBtn);

    const cyclingBtn = screen.getByText('Cycling');
    fireEvent.click(cyclingBtn);

    const drivingBtn = screen.getByText('Driving');
    fireEvent.click(drivingBtn);
  });

  it('3. Renders verified emergency facilities and allows category filtering', async () => {
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('GCC Community Relief Center (Saidapet)')).toBeInTheDocument();
      expect(screen.getByText('Rajiv Gandhi Government General Hospital (RGGGH)')).toBeInTheDocument();
    });

    // Filter by Shelters (target the filter button)
    const shelterFilterBtn = screen.getByRole('button', { name: 'Evacuation Shelters' });
    fireEvent.click(shelterFilterBtn);

    expect(screen.getByText('GCC Community Relief Center (Saidapet)')).toBeInTheDocument();
    expect(screen.queryByText('Rajiv Gandhi Government General Hospital (RGGGH)')).not.toBeInTheDocument();
  });

  it('4. Selecting a facility populates destination input and coordinates', async () => {
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('GCC Community Relief Center (Saidapet)')).toBeInTheDocument();
    });

    const routeToFacilityBtns = screen.getAllByText('Route to this Facility');
    fireEvent.click(routeToFacilityBtns[0]);

    // Destination input should now contain the facility name
    const destInput = screen.getByDisplayValue('GCC Community Relief Center (Saidapet)');
    expect(destInput).toBeInTheDocument();
  });

  it('5. Evaluates safe routes and displays hazard bottlenecks, comparisons, and avoided hazards', async () => {
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    const calcBtn = screen.getByText('Calculate Safe Routes');
    fireEvent.click(calcBtn);

    await waitFor(() => {
      expect(screen.getByText('HAZARD EVALUATION SYNTHESIS')).toBeInTheDocument();
      expect(screen.getByText('Primary Route (9.2 km)')).toBeInTheDocument();
      expect(screen.getByText('Alternative Route 1 (10.4 km)')).toBeInTheDocument();
    });

    // Verify bottleneck identified
    expect(screen.getByText('Saidapet Maraimalai Adigal Bridge Bottleneck')).toBeInTheDocument();

    // Verify hazard avoided highlighted in alternative
    expect(screen.getByText('Avoids: Saidapet Maraimalai Adigal Bridge Bottleneck')).toBeInTheDocument();
    expect(screen.getByText('(+1.2 km)')).toBeInTheDocument();

    // Verify Google Maps handoff action exists
    const googleMapsBtns = screen.getAllByText('Open in Google Maps');
    expect(googleMapsBtns.length).toBeGreaterThan(0);
  });

  it('6. Handles geolocation permission rejection gracefully without crashing', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) => {
        error({ code: 1, message: 'User denied Geolocation' });
      }),
    };
    // @ts-ignore
    global.navigator.geolocation = mockGeolocation;

    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    const locationBtn = screen.getByText('My Location');
    fireEvent.click(locationBtn);

    await waitFor(() => {
      expect(
        screen.getByText('Browser location access was denied. Please enter an address manually.')
      ).toBeInTheDocument();
    });
  });

  it('7. Generates correct Google Maps directions URL with travel mode encoding', () => {
    const origin = { latitude: 13.0827, longitude: 80.2755 };
    const destination = { latitude: 13.021, longitude: 80.223 };

    const drivingUrl = getGoogleMapsDirectionsUrl(origin, destination, 'driving');
    expect(drivingUrl).toContain('origin=13.082700%2C80.275500');
    expect(drivingUrl).toContain('destination=13.021000%2C80.223000');
    expect(drivingUrl).toContain('travelmode=driving');

    const cyclingUrl = getGoogleMapsDirectionsUrl(origin, destination, 'cycling');
    expect(cyclingUrl).toContain('travelmode=bicycling');

    const walkingUrl = getGoogleMapsDirectionsUrl(origin, destination, 'walking');
    expect(walkingUrl).toContain('travelmode=walking');
  });

  it('8. Renders SafeRoute localized in Tamil (ta) and Hindi (hi)', async () => {
    // Set Tamil in localStorage
    localStorage.setItem('jatayu_preferred_language', 'ta');

    const renderTamil = render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    expect(screen.getByText('தொடக்கப் புள்ளி')).toBeInTheDocument();
    expect(screen.getByText('பாதுகாப்பான பாதைகளைக் கணக்கிடுங்கள்')).toBeInTheDocument();
    expect(screen.getByText('வாகனம்')).toBeInTheDocument();

    renderTamil.unmount();

    // Switch to Hindi
    localStorage.setItem('jatayu_preferred_language', 'hi');

    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    expect(screen.getByText('प्रारंभिक बिंदु')).toBeInTheDocument();
    expect(screen.getByText('सुरक्षित मार्गों का मूल्यांकन करें')).toBeInTheDocument();
    expect(screen.getByText('ड्राइविंग')).toBeInTheDocument();
  });

  it('9. Renders facility radius controls and focal point selector', async () => {
    localStorage.setItem('jatayu_preferred_language', 'en');
    render(
      <LanguageProvider>
        <AuthProvider>
          <SafeRoutePage currentSector={{ name: 'Chennai Coastal Basin', lat: 13.0827, lon: 80.2707 }} />
        </AuthProvider>
      </LanguageProvider>
    );

    expect(screen.getByText('Near Start')).toBeInTheDocument();
    expect(screen.getByText('Near Destination')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Radius: 5 km')).toBeInTheDocument();
  });

  it('10. Renders community-mapped provenance badge and strict UNKNOWN availability disclaimer', () => {
    const mockFacility: any = {
      id: 'osm_123',
      name: 'Delhi Community Emergency Center',
      category: 'HOSPITAL',
      location: { latitude: 28.6139, longitude: 77.2090 },
      address: 'Central Delhi',
      source: 'OpenStreetMap Overpass Community Registry',
      sourceProvenance: 'COMMUNITY_MAPPED',
      verificationStatus: 'GENERAL_DIRECTORY',
      currentAvailability: 'UNKNOWN',
      distanceKm: 2.5,
    };

    render(
      <LanguageProvider>
        <FacilityCard facility={mockFacility} onSelectAsDestination={vi.fn()} />
      </LanguageProvider>
    );

    expect(screen.getByText('COMMUNITY MAPPED (OSM)')).toBeInTheDocument();
    expect(screen.getByText('Delhi Community Emergency Center')).toBeInTheDocument();
    expect(screen.getByText(/Availability: Verification required on arrival/i)).toBeInTheDocument();
  });
});
