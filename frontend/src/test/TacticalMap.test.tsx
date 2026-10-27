import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TacticalMap } from '../components/map/TacticalMap';
import { LiveMapPage } from '../pages/LiveMapPage';
import { AuthContext, AuthContextValue } from '../context/AuthContext';
import * as radarService from '../services/radar';
import * as researchService from '../services/research';

// Mock MapLibre GL
const mockFlyTo = vi.fn();
const mockAddSource = vi.fn();
const mockAddLayer = vi.fn();
const mockSetPaintProperty = vi.fn();
const mockSetLayoutProperty = vi.fn();
const mockGetSource = vi.fn();
const mockGetLayer = vi.fn();
const mockRemove = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn();
const mockIsStyleLoaded = vi.fn(() => true);

const addedSources: Record<string, any> = {};
const addedLayers: Record<string, any> = {};

const mockMarker = {
  setLngLat: vi.fn().mockReturnThis(),
  setPopup: vi.fn().mockReturnThis(),
  addTo: vi.fn().mockReturnThis(),
  getPopup: vi.fn(() => ({
    setHTML: vi.fn(),
  })),
};

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn(() => ({
        addControl: vi.fn(),
        on: mockOn,
        once: mockOnce,
        remove: mockRemove,
        flyTo: mockFlyTo,
        addSource: mockAddSource,
        addLayer: mockAddLayer,
        getSource: mockGetSource,
        getLayer: mockGetLayer,
        setPaintProperty: mockSetPaintProperty,
        setLayoutProperty: mockSetLayoutProperty,
        isStyleLoaded: mockIsStyleLoaded,
      })),
      NavigationControl: vi.fn(),
      Marker: vi.fn(() => mockMarker),
      Popup: vi.fn(() => ({
        setHTML: vi.fn().mockReturnThis(),
      })),
    },
  };
});

describe('TacticalMap Component Unit & Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(addedSources).forEach((k) => delete addedSources[k]);
    Object.keys(addedLayers).forEach((k) => delete addedLayers[k]);

    mockAddSource.mockImplementation((id: string, def: any) => {
      addedSources[id] = { setData: vi.fn(), ...def };
    });
    mockGetSource.mockImplementation((id: string) => addedSources[id]);
    mockAddLayer.mockImplementation((layer: any) => {
      addedLayers[layer.id] = layer;
    });
    mockGetLayer.mockImplementation((id: string) => addedLayers[id]);
  });

  it('initializes MapLibre instance, navigation control, and center marker', async () => {
    vi.spyOn(radarService, 'getLatestRadarInfo').mockResolvedValue({
      host: 'https://tilecache.rainviewer.com',
      latestPath: '/v2/radar/test1234',
      timestamp: 1791563400,
      tileUrl: 'https://tilecache.rainviewer.com/v2/radar/test1234/256/{z}/{x}/{y}/2/1_1.png',
      sourceAttribution: 'RainViewer Radar Composite',
    });

    render(
      <TacticalMap
        center={[72.8777, 19.076]}
        locationName="Mumbai Metropolitan Region"
        rainfallMm={14.5}
        riskLevel="ELEVATED"
      />
    );

    // Verify HUD elements
    expect(screen.getByText('Mumbai Metropolitan Region')).toBeInTheDocument();
    expect(screen.getByText('19.076°N, 72.878°E')).toBeInTheDocument();
    expect(screen.getByText('14.5 mm/h')).toBeInTheDocument();
    expect(screen.getByText('ELEVATED')).toBeInTheDocument();
    expect(screen.getByText('RADAR OVERLAY')).toBeInTheDocument();
  });

  it('triggers onSelectCoordinates when clicking on map', () => {
    const onSelectCoordinates = vi.fn();

    // Capture the click handler registered on map
    let clickHandler: ((e: any) => void) | null = null;
    mockOn.mockImplementation((event: string, handler: any) => {
      if (event === 'click') {
        clickHandler = handler;
      }
    });

    render(
      <TacticalMap
        center={[72.8777, 19.076]}
        locationName="Mumbai Target"
        onSelectCoordinates={onSelectCoordinates}
      />
    );

    expect(clickHandler).not.toBeNull();
    // Simulate user clicking on coordinates (lat: 28.6139, lng: 77.2090)
    clickHandler!({
      lngLat: { lat: 28.6139, lng: 77.209 },
    });

    expect(onSelectCoordinates).toHaveBeenCalledTimes(1);
    expect(onSelectCoordinates).toHaveBeenCalledWith({
      lat: 28.6139,
      lon: 77.209,
      name: 'Sector Fix [28.6139°N, 77.209°E]',
    });
  });

  it('re-centers map when clicking the RECENTER control button', () => {
    const onSelectCoordinates = vi.fn();
    render(
      <TacticalMap
        center={[80.2707, 13.0827]}
        locationName="Chennai Coast"
        initialCenter={[72.8777, 19.076]}
        onSelectCoordinates={onSelectCoordinates}
      />
    );

    const recenterBtn = screen.getByRole('button', { name: /RECENTER/i });
    fireEvent.click(recenterBtn);

    expect(mockFlyTo).toHaveBeenCalledWith({
      center: [72.8777, 19.076],
      zoom: 10,
    });
    expect(onSelectCoordinates).toHaveBeenCalledWith({
      lat: 19.076,
      lon: 72.8777,
      name: 'Mumbai Metropolitan Region',
    });
  });

  it('handles radar service failure gracefully and displays offline state without crashing', async () => {
    vi.spyOn(radarService, 'getLatestRadarInfo').mockResolvedValue(null);

    render(
      <TacticalMap
        center={[72.8777, 19.076]}
        locationName="Mumbai Operational Sector"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Global radar feed offline or unreachable')).toBeInTheDocument();
    });
  });
});

describe('LiveMapPage Integration Tests', () => {
  const mockLocation = { name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 };
  const mockGeoLocation = { name: 'Mumbai Metropolitan Region', latitude: 19.076, longitude: 72.8777 };

  it('renders LiveMapPage with full telemetry props and sector controls', () => {
    const onSelectLocation = vi.fn();

    render(
      <LiveMapPage
        location={mockLocation}
        onSelectLocation={onSelectLocation}
        weather={{
          location: mockGeoLocation,
          timestamp: '2026-10-09T15:00',
          fetchedAt: '2026-10-09T15:02:00.000Z',
          temperatureC: 28.0,
          apparentTemperatureC: 32.0,
          relativeHumidityPercent: 80,
          precipitationMm: 16.5,
          rainMm: 16.5,
          showersMm: 0,
          windSpeedKmh: 20,
          windDirectionDegrees: 180,
          windGustsKmh: 30,
          surfacePressureHpa: 1005,
          weatherCode: 63,
          weatherDescription: 'Moderate rain',
          soilMoisture0To7cm: 0.36,
          isStale: false,
          sourceType: 'OBSERVED',
          sourceAttribution: 'Open-Meteo',
          units: {
            temperature: '°C',
            relativeHumidity: '%',
            precipitation: 'mm/h',
            rain: 'mm/h',
            showers: 'mm/h',
            windSpeed: 'km/h',
            windDirection: '°',
            windGusts: 'km/h',
            surfacePressure: 'hPa',
            soilMoisture: 'm³/m³',
          },
        }}
        riskAssessment={{
          location: mockGeoLocation,
          assessedAt: '2026-10-09T15:02:00.000Z',
          dataTimestamp: '2026-10-09T15:00',
          isStale: false,
          riskScore: 72,
          overallRiskLevel: 'HIGH',
          dataCompleteness: 'FULL',
          dataConfidence: 'HIGH',
          factors: {} as any,
          metrics: {} as any,
          explanation: {} as any,
          disclaimer: {} as any,
          sourceType: 'INDICATIVE_MODEL',
          sourceAttribution: 'JATAYU',
        }}
      />
    );

    expect(screen.getByText('Tactical Geospatial Command Center')).toBeInTheDocument();
    expect(screen.getByText('Active Sector Fix')).toBeInTheDocument();
    expect(screen.getByText('HIGH (72/100)')).toBeInTheDocument();
    expect(screen.getAllByText(/16\.5 mm\/h/i).length).toBeGreaterThan(0);
    expect(screen.getByText('36.0%')).toBeInTheDocument(); // soil moisture %
    expect(screen.getByText(/Indicative screening assessment only/i)).toBeInTheDocument();
    // Verify Hydrodynamic Simulation Card & Warning Banner exist
    expect(screen.getByText('Hydrodynamic Simulation')).toBeInTheDocument();
    expect(screen.getByText('RESEARCH S2')).toBeInTheDocument();
    expect(screen.getByText(/ROLE ACCESS QUARANTINE/i)).toBeInTheDocument();
    expect(screen.getByText(/⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE/i)).toBeInTheDocument();
  });

  it('renders simulation banner and registers MapLibre GeoJSON layer when showSimulation is enabled', () => {
    const mockGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { depth_band: 'critical', min_depth_m: 1.5, max_depth_m: 4.2 },
          geometry: { type: 'Polygon', coordinates: [[[80.1, 13.0], [80.2, 13.0], [80.2, 13.1], [80.1, 13.1], [80.1, 13.0]]] },
        },
      ],
    };

    render(
      <TacticalMap
        center={[80.18, 13.01]}
        locationName="Adyar River Corridor"
        showSimulation={true}
        simulationGeojson={mockGeojson}
        simulationMeta={{ total_inundated_area_km2: 8.61 }}
      />
    );

    expect(screen.getByText(/⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE/i)).toBeInTheDocument();
    expect(screen.getByText(/Adyar SFINCS S2/i)).toBeInTheDocument();
    expect(screen.getByText(/Extent: 8.61 km²/i)).toBeInTheDocument();
  });

  it('correctly consumes geojson response property from research API and passes valid FeatureCollection to map', async () => {
    const mockGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { depth_band: 'critical', min_depth_m: 1.5, max_depth_m: 4.2 },
          geometry: { type: 'Polygon', coordinates: [[[80.1, 13.0], [80.2, 13.0], [80.2, 13.1], [80.1, 13.1], [80.1, 13.0]]] },
        },
      ],
    };

    const fetchSpy = vi.spyOn(researchService, 'fetchAdyarSimulation').mockResolvedValue({
      data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
      trust_badge: '⚠️ EXPERIMENTAL SIMULATION — NOT VALIDATED FOR OFFICIAL CIVIL DEFENSE',
      disclaimer: 'EXPERIMENTAL RESEARCH OUTPUT',
      metadata: { reach_length_km: 28.01 },
      geojson: mockGeojson,
    });

    const mockAuthValue: AuthContextValue = {
      user: { id: 'usr_res', username: 'qa_commander', displayName: 'QA Commander', role: 'RESEARCHER', roleVersion: 1 },
      token: 'valid-researcher-jwt-token',
      permissions: ['research:view_simulations'],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
      invalidateSession: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LiveMapPage
          location={mockLocation}
          onSelectLocation={vi.fn()}
        />
      </AuthContext.Provider>
    );

    // Initial state: toggle button shows MUTED
    const toggleButton = screen.getByRole('button', { name: 'MUTED' });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('valid-researcher-jwt-token');
    });

    // Verify map received the geojson FeatureCollection
    await waitFor(() => {
      expect(mockAddSource).toHaveBeenCalledWith(
        'adyar-simulation-source',
        expect.objectContaining({
          type: 'geojson',
          data: mockGeojson,
        })
      );
    });

    // Toggle button should now show ACTIVE
    expect(screen.getByRole('button', { name: 'ACTIVE' })).toBeInTheDocument();
  });

  it('repeated toggles of simulation do not duplicate map sources or layers', async () => {
    const mockGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { depth_band: 'shallow', min_depth_m: 0.1, max_depth_m: 0.5 },
          geometry: { type: 'Polygon', coordinates: [[[80.1, 13.0], [80.2, 13.0], [80.2, 13.1], [80.1, 13.1], [80.1, 13.0]]] },
        },
      ],
    };

    vi.spyOn(researchService, 'fetchAdyarSimulation').mockResolvedValue({
      data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
      metadata: { reach_length_km: 28.01 },
      geojson: mockGeojson,
    });

    const mockAuthValue: AuthContextValue = {
      user: { id: 'usr_res', username: 'qa_commander', displayName: 'QA Commander', role: 'RESEARCHER', roleVersion: 1 },
      token: 'valid-researcher-jwt-token',
      permissions: ['research:view_simulations'],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
      invalidateSession: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LiveMapPage
          location={mockLocation}
          onSelectLocation={vi.fn()}
        />
      </AuthContext.Provider>
    );

    // Toggle ON
    const muteBtn = screen.getByRole('button', { name: 'MUTED' });
    fireEvent.click(muteBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ACTIVE' })).toBeInTheDocument();
    });

    const sourceCallsCount = mockAddSource.mock.calls.filter(
      (c) => c[0] === 'adyar-simulation-source'
    ).length;
    expect(sourceCallsCount).toBe(1);

    // Toggle OFF
    const activeBtn = screen.getByRole('button', { name: 'ACTIVE' });
    fireEvent.click(activeBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'MUTED' })).toBeInTheDocument();
    });
    expect(mockSetLayoutProperty).toHaveBeenCalledWith('adyar-simulation-fill', 'visibility', 'none');

    // Toggle ON again
    const reMuteBtn = screen.getByRole('button', { name: 'MUTED' });
    fireEvent.click(reMuteBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ACTIVE' })).toBeInTheDocument();
    });
    expect(mockSetLayoutProperty).toHaveBeenCalledWith('adyar-simulation-fill', 'visibility', 'visible');

    // Source must not have been duplicated
    const secondSourceCallsCount = mockAddSource.mock.calls.filter(
      (c) => c[0] === 'adyar-simulation-source'
    ).length;
    expect(secondSourceCallsCount).toBe(1);
  });

  it('handles malformed geojson payload gracefully with clear non-crashing error state', async () => {
    vi.spyOn(researchService, 'fetchAdyarSimulation').mockResolvedValue({
      data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
      metadata: {},
      geojson: { type: 'NotAFeatureCollection', invalid: true } as any,
    });

    const mockAuthValue: AuthContextValue = {
      user: { id: 'usr_res', username: 'qa_commander', displayName: 'QA Commander', role: 'RESEARCHER', roleVersion: 1 },
      token: 'valid-researcher-jwt-token',
      permissions: ['research:view_simulations'],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
      invalidateSession: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LiveMapPage
          location={mockLocation}
          onSelectLocation={vi.fn()}
        />
      </AuthContext.Provider>
    );

    const toggleBtn = screen.getByRole('button', { name: 'MUTED' });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Malformed simulation response: geojson is not a valid GeoJSON FeatureCollection/i)).toBeInTheDocument();
    });
  });

  it('handles empty geojson features array without crashing and displays empty notice', async () => {
    const emptyGeojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    vi.spyOn(researchService, 'fetchAdyarSimulation').mockResolvedValue({
      data_trust_tier: 'EXPERIMENTAL_UNVALIDATED',
      metadata: { reach_length_km: 28.01 },
      geojson: emptyGeojson,
    });

    const mockAuthValue: AuthContextValue = {
      user: { id: 'usr_res', username: 'qa_commander', displayName: 'QA Commander', role: 'RESEARCHER', roleVersion: 1 },
      token: 'valid-researcher-jwt-token',
      permissions: ['research:view_simulations'],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
      invalidateSession: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={mockAuthValue}>
        <LiveMapPage
          location={mockLocation}
          onSelectLocation={vi.fn()}
        />
      </AuthContext.Provider>
    );

    const toggleBtn = screen.getByRole('button', { name: 'MUTED' });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getByText(/No inundation contour geometries found in simulation dataset/i)).toBeInTheDocument();
    });
  });

  it('prevents unauthenticated or citizen users from querying the simulation API', () => {
    const fetchSpy = vi.spyOn(researchService, 'fetchAdyarSimulation');

    const citizenAuthValue: AuthContextValue = {
      user: { id: 'usr_cit', username: 'citizen_john', displayName: 'John Citizen', role: 'CITIZEN', roleVersion: 1 },
      token: 'citizen-jwt-token',
      permissions: [],
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(false),
      hasRole: vi.fn().mockReturnValue(false),
      invalidateSession: vi.fn(),
      clearError: vi.fn(),
    };

    render(
      <AuthContext.Provider value={citizenAuthValue}>
        <LiveMapPage
          location={mockLocation}
          onSelectLocation={vi.fn()}
        />
      </AuthContext.Provider>
    );

    expect(screen.getByText(/ROLE ACCESS QUARANTINE/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'MUTED' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ACTIVE' })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
