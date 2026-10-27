import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomePage } from '../pages/HomePage';
import { ClimateResearchPage } from '../pages/ClimateResearchPage';
import { OverviewPage } from '../pages/OverviewPage';
import { SitrepExportModal } from '../components/sitrep/SitrepExportModal';
import { generateTacticalSitrep } from '../utils/sitrepGenerator';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import * as routeServices from '../services/route';
import * as radarServices from '../services/radar';
import * as weatherServices from '../services/weather';
import {
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
  DisasterAlert,
} from '../types';

const mockWeather: CurrentWeatherObservation = {
  location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Central' },
  timestamp: '2026-10-26T12:00:00Z',
  fetchedAt: '2026-10-26T12:01:00Z',
  temperatureC: 28.5,
  apparentTemperatureC: 32.0,
  relativeHumidityPercent: 82,
  precipitationMm: 12.0,
  rainMm: 12.0,
  showersMm: 0,
  windSpeedKmh: 35.0,
  windDirectionDegrees: 80,
  windGustsKmh: 55.0,
  surfacePressureHpa: 1004.0,
  weatherCode: 65,
  weatherDescription: 'Heavy rain',
  soilMoisture0To7cm: 0.44,
  soilMoisture7To28cm: 0.39,
  isStale: false,
  sourceType: 'OBSERVED',
  sourceAttribution: 'Open-Meteo NWP ECMWF IFS',
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

const mockForecast: WeatherForecastResponse = {
  location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Central' },
  elevation: 6,
  generationTimeMs: 12,
  fetchedAt: '2026-10-26T12:01:00Z',
  current: mockWeather,
  accumulations: {
    past24hRainfallMm: 24.5,
    next24hRainfallMm: 68.0,
    next72hRainfallMm: 140.0,
  },
  soilProfile: {
    moisture0To7cm: 0.44,
    moisture7To28cm: 0.39,
    saturationTier: 'HIGH',
    description: 'High root zone saturation',
  },
  hourly: [],
  dataSource: {
    provider: 'Open-Meteo GFS',
    model: 'GFS Global',
    type: 'OFFICIAL_FORECAST',
    note: 'Open-Meteo API',
  },
};

const mockRisk: IndicativeFloodRiskAssessment = {
  location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Central' },
  assessedAt: '2026-10-26T12:01:00Z',
  dataTimestamp: '2026-10-26T12:00:00Z',
  isStale: false,
  overallRiskLevel: 'ELEVATED',
  riskScore: 68,
  dataCompleteness: 'FULL',
  dataConfidence: 'HIGH',
  factors: {
    rainfallIntensity: {
      name: 'Rainfall Intensity',
      score: 70,
      weight: 0.35,
      weightedScore: 24.5,
      observedValue: 12,
      unit: 'mm/h',
      benchmark: 'IMD Rain Benchmark',
      basis: 'AUTHORITATIVE_METEOROLOGY',
      status: 'MEASURED',
      notes: 'Heavy rain',
    },
    rainfallAccumulation: {
      name: 'Antecedent Rainfall',
      score: 68,
      weight: 0.25,
      weightedScore: 17,
      observedValue: 68,
      unit: 'mm',
      benchmark: 'IMD 24h Accumulation',
      basis: 'AUTHORITATIVE_METEOROLOGY',
      status: 'MEASURED',
      notes: '68mm projected in next 24 hours',
    },
    soilSaturation: {
      name: 'Soil Saturation',
      score: 75,
      weight: 0.2,
      weightedScore: 15,
      observedValue: 0.44,
      unit: 'm³/m³',
      benchmark: 'Volumetric Benchmark',
      basis: 'ENGINEERING_ASSUMPTION',
      status: 'MEASURED',
      notes: '44% root-zone volumetric moisture',
    },
    topographicVulnerability: {
      name: 'Topography',
      score: 55,
      weight: 0.2,
      weightedScore: 11,
      observedValue: 6,
      unit: 'm',
      benchmark: 'AMSL Benchmark',
      basis: 'ENGINEERING_ASSUMPTION',
      status: 'MEASURED',
      notes: 'Coastal lowlands',
    },
  },
  metrics: {
    peakIntensity1hMm: 12,
    past24hRainfallMm: 24.5,
    next24hRainfallMm: 68.0,
    next72hRainfallMm: 140.0,
    soilMoistureVolumetricPercent: 44,
    elevationMeters: 6,
  },
  explanation: {
    summary: 'Elevated surface water accumulation risk in low-lying urban sectors.',
    primaryDrivers: ['Antecedent Rainfall', 'Soil Saturation'],
    meteorologicalContext: 'Active convective bands along coastal Tamil Nadu',
    missingInputs: [],
    modelAssumptions: ['Uniform soil infiltration', 'Standard drainage capacity'],
    limitations: ['Not an official evacuation order'],
  },
  disclaimer: {
    isHydraulicallyValidated: false,
    modelType: 'INDICATIVE_RAINFALL_DRIVEN_HEURISTIC',
    statement: 'Indicative screening prototype only.',
    validationStatus: 'UNVALIDATED_PROTOTYPE',
  },
  sourceType: 'INDICATIVE_MODEL',
  sourceAttribution: 'JATAYU Indicative Heuristic Risk Model',
};

const mockAlert: DisasterAlert = {
  id: 'imd-warn-44',
  category: 'RAINFALL',
  severity: 'WARNING',
  headline: 'Orange Warning: Intense rainfall over coastal zone',
  description: 'Heavy to very heavy rainfall expected with localized inundation.',
  issuedAt: '2026-10-26T10:00:00Z',
  effectiveUntil: '2026-10-27T10:00:00Z',
  affectedArea: {
    name: 'Chennai',
    location: { latitude: 13.0827, longitude: 80.2707 },
    matchMethod: 'EXACT_DISTRICT',
  },
  recommendedActions: ['Keep emergency supplies ready', 'Avoid river banks'],
  sourceType: 'OBSERVED',
  sourceAgency: 'IMD Regional Meteorological Centre',
  isOfficialWarning: true,
  status: 'ACTIVE',
};

const mockAlertFeed: AlertFeedResponse = {
  fetchedAt: '2026-10-26T12:01:00Z',
  source: 'IMD Nowcast RSS',
  feedStatus: 'LIVE_VERIFIED',
  itemCount: 1,
  geographicResolution: {
    coordinates: { latitude: 13.0827, longitude: 80.2707 },
    resolvedDistrict: 'Chennai',
    resolvedState: 'Tamil Nadu',
    matchStatus: 'RESOLVED_DISTRICT',
    datasetSource: 'Survey of India',
    vintage: '2024',
  },
  officialAlerts: [mockAlert],
  nationwideAlerts: [],
  indicativeAlerts: [],
  demonstrationScenarios: [],
  disclaimer: 'Official bulletins issued by IMD.',
  limitations: [],
};

describe('Phase 3F: Task 1 — Locality Search on Public Home Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders clearly visible search input directly inside the local conditions area', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={mockForecast}
          alertFeed={mockAlertFeed}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText(/Search city, district, or landmark across India/i);
    expect(input).toBeInTheDocument();
    expect(screen.getByText(/Search Locality, District, or Coordinates/i)).toBeInTheDocument();
  });

  it('debounces place search and updates location when a suggestion is clicked', async () => {
    const onSelectLocation = vi.fn();
    const mockResults = [
      {
        displayName: 'Saidapet Metro, Chennai, Tamil Nadu',
        latitude: 13.0158,
        longitude: 80.2223,
        type: 'railway',
      },
      {
        displayName: 'Cuddalore Town, Tamil Nadu',
        latitude: 11.748,
        longitude: 79.7714,
        type: 'city',
      },
    ];

    vi.spyOn(routeServices, 'searchPlaces').mockResolvedValue(mockResults as any);

    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onSelectLocation={onSelectLocation}
          weather={mockWeather}
          forecast={mockForecast}
          alertFeed={mockAlertFeed}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText(/Search city, district, or landmark across India/i);
    fireEvent.change(input, { target: { value: 'Saidapet' } });

    await waitFor(() => {
      expect(routeServices.searchPlaces).toHaveBeenCalledWith('Saidapet');
    });

    await waitFor(() => {
      expect(screen.getByText('Saidapet Metro, Chennai, Tamil Nadu')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Saidapet Metro, Chennai, Tamil Nadu'));

    expect(onSelectLocation).toHaveBeenCalledWith({
      name: 'Saidapet Metro, Chennai, Tamil Nadu',
      lat: 13.0158,
      lon: 80.2223,
    });
  });

  it('supports direct coordinate entry (e.g. 13.0827, 80.2707) and triggers update on Enter', () => {
    const onSelectLocation = vi.fn();

    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onSelectLocation={onSelectLocation}
          weather={mockWeather}
          forecast={mockForecast}
          alertFeed={mockAlertFeed}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText(/Search city, district, or landmark across India/i);
    fireEvent.change(input, { target: { value: '11.7480, 79.7714' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onSelectLocation).toHaveBeenCalledWith({
      name: 'Coordinates (11.7480°N, 79.7714°E)',
      lat: 11.748,
      lon: 79.7714,
    });
  });

  it('displays search failure gracefully without breaking manual input or throwing unhandled errors', async () => {
    vi.spyOn(routeServices, 'searchPlaces').mockRejectedValue(new Error('Network connection timeout'));

    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={mockForecast}
          alertFeed={mockAlertFeed}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    const input = screen.getByPlaceholderText(/Search city, district, or landmark across India/i);
    fireEvent.change(input, { target: { value: 'Madurai' } });

    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();
    });
  });
});

describe('Phase 3F: Task 2 — Historical Versus Live Radar Clarity in ClimateResearchPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(weatherServices, 'getHistoricalWeather').mockResolvedValue({
      location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Basin' },
      startDate: '2015-11-28',
      endDate: '2015-12-04',
      eventAccumulationMm: 494.2,
      peakDailyRainMm: 345.0,
      peakDate: '2015-12-01',
      daily: {
        time: ['2015-11-28', '2015-11-29', '2015-11-30', '2015-12-01'],
        precipitationSum: [25.0, 42.0, 82.2, 345.0],
        temperatureMax: [29, 28, 27, 26],
        temperatureMin: [24, 23, 23, 22],
      },
      dataSource: 'Copernicus ERA5',
    } as any);

    vi.spyOn(radarServices, 'getLatestRadarInfo').mockResolvedValue({
      host: 'https://tilecache.rainviewer.com',
      latestPath: '/v2/radar/1729958400',
      timestamp: 1729958400,
      tileUrl: 'https://tilecache.rainviewer.com/v2/radar/1729958400/256/{z}/{x}/{y}/2/1_1.png',
      sourceAttribution: 'RainViewer Live Radar Composite',
    });
  });

  it('renders persistent LIVE nowcast badge and explicit historical distinction warning on radar tab', async () => {
    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <ClimateResearchPage
            location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Switch to Doppler Radar tab
    fireEvent.click(screen.getByText('Doppler Radar'));

    // Verify LIVE nowcast badge
    await waitFor(() => {
      expect(screen.getByText('LIVE RADAR NOWCAST (2-HOUR)')).toBeInTheDocument();
    });

    // Verify explicit historical distinction warning
    expect(screen.getByText(/TEMPORAL CLARITY NOTICE — CURRENT LIVE RADAR ONLY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/The Doppler radar mosaic above displays active real-time nowcast observations and does NOT represent historical radar for/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/RainViewer does not maintain a retrospective radar archive for past cyclones/i)
    ).toBeInTheDocument();
  });
});

describe('Phase 3F: Task 3 — Responder Tactical Situation Report (SITREP) Export', () => {
  it('generates structured Markdown SITREP with live telemetry and data trust separation', () => {
    const sitrep = generateTacticalSitrep({
      location: { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 },
      weather: mockWeather,
      forecast: mockForecast,
      riskAssessment: mockRisk,
      alertFeed: mockAlertFeed,
      language: 'en',
      user: { displayName: 'Commander Rao', role: 'RESPONDER' },
    });

    expect(sitrep).toContain('# JATAYU TACTICAL SITUATION REPORT (SITREP)');
    expect(sitrep).toContain('Commander Rao (Role: RESPONDER)');
    expect(sitrep).toContain('**Tactical Sector:** Chennai Central');
    expect(sitrep).toContain('13.0827°N, 80.2707°E');
    expect(sitrep).toContain('Heavy to very heavy rainfall expected with localized inundation');
    expect(sitrep).toContain('Observed Temperature:** 28.5°C');
    expect(sitrep).toContain('Precipitation Rate:** 12 mm/h');
    expect(sitrep).toContain('Root-Zone Soil Moisture (0-7cm):** 44.0%');
    expect(sitrep).toContain('Screening Category:** **ELEVATED**');
    expect(sitrep).toContain('State Emergency Operations Centre (SEOC):** 1070');
    expect(sitrep).toContain('Emergency relief shelter and hospital bed vacancies are strictly UNKNOWN in telemetry');
    expect(sitrep).toContain('Uncalibrated hydrodynamic simulations (SFINCS) are segregated under research protocols and excluded from operational conclusions');
  });

  it('generates unhallucinated offline fallback text when alert feed is unavailable', () => {
    const sitrep = generateTacticalSitrep({
      location: { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 },
      weather: mockWeather,
      forecast: mockForecast,
      riskAssessment: mockRisk,
      alertFeed: null,
      alertsError: 'Upstream 503 Service Unavailable',
      language: 'en',
    });

    expect(sitrep).toContain('OFFICIAL IMD ALERT FEED UNREACHABLE');
    expect(sitrep).toContain('Upstream 503 Service Unavailable');
    expect(sitrep).toContain('Contact State Emergency Operations Centre (1070)');
  });

  it('generates unhallucinated offline fallback text when weather telemetry is unavailable', () => {
    const sitrep = generateTacticalSitrep({
      location: { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 },
      weather: null,
      forecast: null,
      riskAssessment: null,
      alertFeed: mockAlertFeed,
      weatherError: 'Open-Meteo connection reset by peer',
      language: 'en',
    });

    expect(sitrep).toContain('METEOROLOGICAL TELEMETRY OFFLINE');
    expect(sitrep).toContain('Do NOT assume calm conditions when telemetry is offline');
  });

  it('supports full Tamil localization without broken keys or untranslated errors', () => {
    const sitrepTa = generateTacticalSitrep({
      location: { name: 'சென்னை மையம்', lat: 13.0827, lon: 80.2707 },
      weather: mockWeather,
      forecast: mockForecast,
      riskAssessment: mockRisk,
      alertFeed: mockAlertFeed,
      language: 'ta',
      user: { displayName: 'கள அதிகாரி', role: 'RESPONDER' },
    });

    expect(sitrepTa).toContain('# ஜடாயு செயல்பாட்டு சூழ்நிலை அறிக்கை (SITREP)');
    expect(sitrepTa).toContain('செயல்பாட்டு அதிகாரி:** கள அதிகாரி');
    expect(sitrepTa).toContain('களப் பகுதி:** சென்னை மையம்');
    expect(sitrepTa).toContain('அதிகாரப்பூர்வ வானிலை எச்சரிக்கைகள்');
    expect(sitrepTa).toContain('நிகழ்நேர வானிலை தொலைத்தொடர்பு');
    expect(sitrepTa).toContain('strictly UNKNOWN என குறிக்கப்பட்டுள்ளன');
  });

  it('supports full Hindi localization without broken keys or untranslated errors', () => {
    const sitrepHi = generateTacticalSitrep({
      location: { name: 'चेन्नई मध्य', lat: 13.0827, lon: 80.2707 },
      weather: mockWeather,
      forecast: mockForecast,
      riskAssessment: mockRisk,
      alertFeed: mockAlertFeed,
      language: 'hi',
      user: { displayName: 'कमांड अधिकारी', role: 'RESPONDER' },
    });

    expect(sitrepHi).toContain('# जटायु रणनीतिक स्थिति रिपोर्ट (SITREP)');
    expect(sitrepHi).toContain('परिचालन अधिकारी:** कमांड अधिकारी');
    expect(sitrepHi).toContain('रणनीतिक क्षेत्र:** चेन्नई मध्य');
    expect(sitrepHi).toContain('आधिकारिक मौसम चेतावनियाँ');
    expect(sitrepHi).toContain('strictly UNKNOWN है');
  });

  it('renders Export Situation Report button in OverviewPage header and opens modal', () => {
    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <OverviewPage
            location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
            weather={mockWeather}
            forecast={mockForecast}
            riskAssessment={mockRisk}
            alertFeed={mockAlertFeed}
            isLoading={false}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    const exportBtn = screen.getByText('Export Situation Report');
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    expect(screen.getByText('Tactical Situation Report (SITREP)')).toBeInTheDocument();
    expect(screen.getByText('Download Markdown (.md)')).toBeInTheDocument();
    expect(screen.getByText('Print / Save PDF')).toBeInTheDocument();
  });

  it('SitrepExportModal triggers print and markdown download callbacks', () => {
    const onClose = vi.fn();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(
      <LanguageProvider defaultLanguage="en">
        <SitrepExportModal
          isOpen={true}
          onClose={onClose}
          sitrepMarkdown="# TEST SITREP"
          locationName="Chennai Central"
        />
      </LanguageProvider>
    );

    expect(screen.getByText('# TEST SITREP')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Print / Save PDF'));
    expect(printSpy).toHaveBeenCalled();
  });
});
