import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { Command3DView } from '../components/command3d/Command3DView';
import { Command3DLoading } from '../components/command3d/Command3DLoading';

// Mocks for Cesium
const mockDestroy = vi.fn();
const mockRemoveAll = vi.fn();
const mockAddImageryProvider = vi.fn();
const mockSetView = vi.fn();
const mockFlyTo = vi.fn();

let shouldViewerThrow = false;

vi.mock('cesium', () => {
  return {
    Viewer: vi.fn().mockImplementation(() => {
      if (shouldViewerThrow) {
        throw new Error('WebGL2 context creation failed (GPU unsupported)');
      }
      return {
        destroy: mockDestroy,
        isDestroyed: vi.fn(() => false),
        imageryLayers: {
          removeAll: mockRemoveAll,
          addImageryProvider: mockAddImageryProvider,
        },
        camera: {
          setView: mockSetView,
          flyTo: mockFlyTo,
        },
      };
    }),
    UrlTemplateImageryProvider: vi.fn(),
    Credit: vi.fn(),
    Cartesian3: {
      fromDegrees: vi.fn((lon, lat, height) => ({ lon, lat, height })),
    },
    Math: {
      toRadians: vi.fn((deg) => (deg * Math.PI) / 180),
    },
    Ion: {
      defaultAccessToken: '',
    },
    Terrain: {
      fromWorldTerrain: vi.fn(),
    },
    EllipsoidTerrainProvider: vi.fn(),
  };
});

describe('4. Cesium 3D Command Module Lifecycle & WebGL Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shouldViewerThrow = false;

    // Mock successful backend sectors and globe context
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/command/sectors')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            sectors: [
              {
                id: 'SEC-MUM-01',
                name: 'Mumbai Metropolitan Region',
                label: 'Mumbai Metro (West Coast)',
                coordinates: { lat: 19.076, lon: 72.8777 },
                status: 'ACTIVE_MONITORING',
                tacticalZone: 'WESTERN_COASTAL',
                coverage: 'Urban Coastal & Catchment',
                provenance: 'DataMeet Census 2011 & IMD Regional Meteorological Centre Mumbai',
              },
              {
                id: 'SEC-CHE-02',
                name: 'Chennai Coastal Basin',
                label: 'Chennai Coast (Bay of Bengal)',
                coordinates: { lat: 13.0827, lon: 80.2707 },
                status: 'ACTIVE_MONITORING',
                tacticalZone: 'EASTERN_LITTORAL',
                coverage: 'Coromandel Coastal Lowlands',
                provenance: 'DataMeet Census 2011 & IMD Regional Meteorological Centre Chennai',
              },
            ],
            count: 2,
            telemetryTimestamp: '2026-10-25T00:00:00Z',
          }),
        });
      }
      if (url.includes('/api/command/globe-context')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            authorized: true,
            session: {
              subject: 'u1',
              role: 'RESEARCHER',
              terrainProvider: 'CesiumWorldTerrain',
              supportedImagery: ['ESRI_WORLD_IMAGERY', 'CARTO_DARK'],
              disclaimer: 'Indicative 3D Command Environment - Cesium authorization active',
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  it('renders Command3DLoading suspense state correctly', () => {
    render(<Command3DLoading />);
    expect(screen.getByText('Loading 3D Command Module')).toBeInTheDocument();
    expect(screen.getByText(/Asynchronously mounting Cesium 3D geospatial engine/i)).toBeInTheDocument();
  });

  it('initializes Cesium with default ESRI satellite imagery and required attribution', async () => {
    const onReturnTo2D = vi.fn();

    render(
      <AuthProvider>
        <Command3DView
          selectedLocation={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
          onReturnTo2D={onReturnTo2D}
        />
      </AuthProvider>
    );

    expect(screen.getByText(/GOD’S EYE VIEW — CESIUM 3D COMMAND GLOBE/i)).toBeInTheDocument();
    expect(screen.getByText('ESRI SATELLITE')).toBeInTheDocument();
    expect(screen.getByText('CARTO DARK')).toBeInTheDocument();

    // Required attribution
    expect(screen.getByText(/Tiles © Esri — Source: Esri/i)).toBeInTheDocument();

    // Verify initial imagery addition
    expect(mockAddImageryProvider).toHaveBeenCalledTimes(1);
    expect(mockSetView).toHaveBeenCalledTimes(1);
  });

  it('switches imagery provider when user clicks CARTO DARK', async () => {
    render(
      <AuthProvider>
        <Command3DView
          selectedLocation={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
          onReturnTo2D={vi.fn()}
        />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('CARTO DARK'));

    // Removal of prior layers and addition of Carto Dark provider
    expect(mockRemoveAll).toHaveBeenCalled();
    expect(mockAddImageryProvider).toHaveBeenCalledTimes(2);
  });

  it('destroys Cesium viewer on unmount to prevent WebGL leaks and resource contention', () => {
    const { unmount } = render(
      <AuthProvider>
        <Command3DView
          selectedLocation={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
          onReturnTo2D={vi.fn()}
        />
      </AuthProvider>
    );

    expect(mockDestroy).not.toHaveBeenCalled();

    unmount();

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  it('handles WebGL initialization failures gracefully with fallback error card and return action', () => {
    shouldViewerThrow = true;
    const onReturnTo2D = vi.fn();

    render(
      <AuthProvider>
        <Command3DView
          selectedLocation={{ name: 'Mumbai Metropolitan Region', lat: 19.076, lon: 72.8777 }}
          onReturnTo2D={onReturnTo2D}
        />
      </AuthProvider>
    );

    expect(screen.getByText('3D WebGL Initialization Failed')).toBeInTheDocument();
    expect(screen.getByText(/WebGL2 context creation failed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('RETURN TO 2D MAPLIBRE CONSOLE'));
    expect(onReturnTo2D).toHaveBeenCalledTimes(1);
  });
});
