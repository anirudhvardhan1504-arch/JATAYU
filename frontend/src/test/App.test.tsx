import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn(() => ({
        addControl: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        remove: vi.fn(),
        flyTo: vi.fn(),
        addSource: vi.fn(),
        addLayer: vi.fn(),
        getSource: vi.fn(),
        getLayer: vi.fn(),
        setPaintProperty: vi.fn(),
        setLayoutProperty: vi.fn(),
        isStyleLoaded: vi.fn(() => true),
      })),
      NavigationControl: vi.fn(),
      Marker: vi.fn(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        setPopup: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        getPopup: vi.fn(() => ({
          setHTML: vi.fn(),
        })),
      })),
      Popup: vi.fn(() => ({
        setHTML: vi.fn().mockReturnThis(),
      })),
    },
  };
});

const mockCurrentObservation = {
  location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
  timestamp: '2026-10-09T15:00',
  fetchedAt: '2026-10-09T15:02:00.000Z',
  temperatureC: 28.5,
  apparentTemperatureC: 32.1,
  relativeHumidityPercent: 82,
  precipitationMm: 12.0,
  rainMm: 12.0,
  showersMm: 0,
  windSpeedKmh: 24.0,
  windDirectionDegrees: 180,
  windGustsKmh: 35.0,
  surfacePressureHpa: 1004.0,
  weatherCode: 63,
  weatherDescription: 'Moderate rain',
  soilMoisture0To7cm: 0.35,
  soilMoisture7To28cm: 0.30,
  isStale: false,
  sourceType: 'OBSERVED',
  sourceAttribution: 'Open-Meteo Live NWP Analysis (ECMWF IFS / DWD ICON)',
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
};

const mockForecastResponse = {
  location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
  elevation: 14,
  generationTimeMs: 15,
  fetchedAt: '2026-10-09T15:02:00.000Z',
  current: mockCurrentObservation,
  hourly: [
    {
      time: '2026-10-09T15:00',
      temperatureC: 28.5,
      relativeHumidityPercent: 82,
      precipitationMm: 12.0,
      precipitationProbabilityPercent: 85,
      rainMm: 12.0,
      showersMm: 0,
      windSpeedKmh: 24.0,
      windDirectionDegrees: 180,
      windGustsKmh: 35.0,
      surfacePressureHpa: 1004.0,
      soilMoistureDepth0To7cm: 0.35,
    },
  ],
  accumulations: {
    past24hRainfallMm: 30.5,
    next24hRainfallMm: 65.0,
    next72hRainfallMm: 140.0,
  },
  soilProfile: {
    moisture0To7cm: 0.35,
    moisture7To28cm: 0.30,
    saturationTier: 'HIGH',
    description: 'High soil moisture.',
  },
  dataSource: {
    provider: 'Open-Meteo Forecast Engine',
    model: 'ECMWF IFS / GFS Seamless Ensemble',
    type: 'OFFICIAL_FORECAST',
    note: 'Mock forecast',
  },
};

describe('JATAYU App Component Scaffolding & Live Telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders brand identity and command center layout', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/ai/status')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              configured: false,
              provider: 'OpenRouter',
              model: 'anthropic/claude-3.5-sonnet:beta',
              message: 'Scaffolding Ready',
            }),
        });
      }
      if (url.includes('/api/weather/current')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCurrentObservation),
        });
      }
      if (url.includes('/api/weather/forecast')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockForecastResponse),
        });
      }
      if (url.includes('/api/risk/assessment')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai Metropolitan Region' },
              assessedAt: '2026-10-09T15:02:00.000Z',
              dataTimestamp: '2026-10-09T15:00',
              isStale: false,
              riskScore: 68,
              overallRiskLevel: 'ELEVATED',
              dataCompleteness: 'FULL',
              dataConfidence: 'HIGH',
              sourceType: 'INDICATIVE_MODEL',
              factors: {
                rainfallIntensity: {
                  name: 'Instantaneous Rainfall Intensity',
                  score: 60,
                  weight: 0.35,
                  observedValue: 12.0,
                  unit: 'mm/h',
                  benchmark: 'IMD Heavy Rainfall threshold (>15 mm/h)',
                  status: 'AVAILABLE',
                  basis: 'REGIONAL_METEOROLOGICAL_BENCHMARK',
                  notes: 'Moderate-to-heavy rain intensity.',
                },
                antecedentRainfall: {
                  name: 'Antecedent & Projected Rainfall Accumulation',
                  score: 65,
                  weight: 0.25,
                  observedValue: 95.5,
                  unit: 'mm',
                  benchmark: 'IMD 24h Heavy Rainfall threshold (>64.5 mm)',
                  status: 'AVAILABLE',
                  basis: 'REGIONAL_METEOROLOGICAL_BENCHMARK',
                  notes: 'Significant precipitation volume.',
                },
                soilSaturation: {
                  name: 'Root-Zone Soil Moisture Saturation',
                  score: 75,
                  weight: 0.25,
                  observedValue: 0.35,
                  unit: 'm³/m³',
                  benchmark: 'Upper root-zone saturation threshold (>0.38 m³/m³)',
                  status: 'AVAILABLE',
                  basis: 'ENGINEERING_ASSUMPTION',
                  notes: 'High root-zone saturation.',
                },
                topographicVulnerability: {
                  name: 'Lowland & Coastal Inundation Vulnerability',
                  score: 70,
                  weight: 0.15,
                  observedValue: 14,
                  unit: 'm',
                  benchmark: 'Coastal plain / low-elevation threshold (<20m ASL)',
                  status: 'AVAILABLE',
                  basis: 'ENGINEERING_ASSUMPTION',
                  notes: 'Low elevation coastal sector.',
                },
              },
              explanation: {
                summary: 'Elevated indicative flood hazard index of 68/100.',
                primaryDrivers: ['High root-zone moisture', 'Heavy cumulative rain'],
                meteorologicalContext: 'Moderate rain with saturated ground.',
                missingInputs: [],
                modelAssumptions: ['Deterministic linear interpolation'],
                limitations: ['Indicative assessment only — not a validated hydraulic flood model.'],
              },
              metrics: {
                currentRainfallRateMm: 12.0,
                peakIntensity1hMm: 12.0,
                past24hRainfallMm: 30.5,
                next24hRainfallMm: 65.0,
                next72hRainfallMm: 140.0,
                soilMoistureVolumetricPercent: 0.35,
                elevationMeters: 14,
              },
              disclaimer: {
                statement: 'Indicative assessment only — not a validated hydraulic flood model.',
                modelType: 'Heuristic Multi-Factor Rainfall Index',
                validationStatus: 'EXPERIMENTAL_UNVALIDATED',
              },
            }),
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    render(<App initialTab="overview" />);
    expect(screen.getAllByText('JATAYU').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Disaster Intelligence & Response')).toBeInTheDocument();
    expect(screen.getByText('JATAYU DISASTER NETWORK')).toBeInTheDocument();

    // Verify audited live telemetry rendered with units
    await waitFor(() => {
      expect(screen.getByText('Precipitation Rate')).toBeInTheDocument();
      expect(screen.getByText('Wind Velocity & Gusts')).toBeInTheDocument();
      expect(screen.getByText('Root-Zone Soil Moisture (0-7cm)')).toBeInTheDocument();
      expect(screen.getByText('35.0%')).toBeInTheDocument(); // volumetric soil moisture %
    });
  });

  it('displays operational error banner when live weather fetch fails without fabricating data', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/weather/current')) {
        return Promise.resolve({
          ok: false,
          status: 502,
          text: () => Promise.resolve(JSON.stringify({ error: 'Open-Meteo gateway timeout', code: 'UPSTREAM_ERROR' })),
        });
      }
      if (url.includes('/api/weather/forecast')) {
        return Promise.resolve({
          ok: false,
          status: 502,
          text: () => Promise.resolve(JSON.stringify({ error: 'Forecast service unreachable', code: 'UPSTREAM_ERROR' })),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ configured: false, provider: 'OpenRouter', model: 'claude', message: '' }),
      });
    });

    render(<App initialTab="overview" />);

    await waitFor(() => {
      expect(screen.getByText('LIVE METEOROLOGICAL TELEMETRY UNAVAILABLE')).toBeInTheDocument();
      expect(screen.getByText('RETRY FEED')).toBeInTheDocument();
    });
  });
});
