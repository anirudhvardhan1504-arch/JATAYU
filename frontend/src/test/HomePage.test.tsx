import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HomePage } from '../pages/HomePage';
import { LanguageProvider } from '../context/LanguageContext';
import { AlertFeedResponse, CurrentWeatherObservation, DisasterAlert } from '../types';

const mockWeather: CurrentWeatherObservation = {
  location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Coastal Sector' },
  timestamp: '2026-10-26T12:00:00Z',
  fetchedAt: '2026-10-26T12:01:00Z',
  temperatureC: 30.5,
  apparentTemperatureC: 36.2,
  relativeHumidityPercent: 78,
  precipitationMm: 14.5,
  rainMm: 14.5,
  showersMm: 0,
  windSpeedKmh: 45.0,
  windDirectionDegrees: 70,
  windGustsKmh: 65.0,
  surfacePressureHpa: 1002.0,
  weatherCode: 65,
  weatherDescription: 'Heavy rain',
  soilMoisture0To7cm: 0.42,
  soilMoisture7To28cm: 0.38,
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

const mockDisasterAlert: DisasterAlert = {
  id: 'imd-alert-1',
  category: 'RAINFALL',
  severity: 'WARNING',
  headline: 'Red Alert: Inundation risk in low-lying coastal areas',
  description: 'Extremely heavy rainfall expected over coastal Tamil Nadu due to cyclonic circulation.',
  issuedAt: '2026-10-26T06:00:00Z',
  effectiveUntil: '2026-10-27T06:00:00Z',
  affectedArea: {
    name: 'Chennai District',
    location: { latitude: 13.0827, longitude: 80.2707 },
    matchMethod: 'EXACT_DISTRICT',
  },
  recommendedActions: ['Avoid non-essential travel', 'Stay away from coastal areas'],
  sourceType: 'OBSERVED',
  sourceAgency: 'IMD Chennai Regional Meteorological Centre',
  isOfficialWarning: true,
  status: 'ACTIVE',
};

const mockAlertFeedWithActiveAlert: AlertFeedResponse = {
  fetchedAt: '2026-10-26T12:01:00Z',
  source: 'IMD CAP Feed',
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
  officialAlerts: [mockDisasterAlert],
  nationwideAlerts: [],
  indicativeAlerts: [],
  demonstrationScenarios: [],
  disclaimer: 'Official government alerts.',
  limitations: [],
};

const mockAlertFeedClean: AlertFeedResponse = {
  fetchedAt: '2026-10-26T12:01:00Z',
  source: 'IMD CAP Feed',
  feedStatus: 'LIVE_VERIFIED',
  itemCount: 0,
  geographicResolution: {
    coordinates: { latitude: 13.0827, longitude: 80.2707 },
    resolvedDistrict: 'Chennai',
    resolvedState: 'Tamil Nadu',
    matchStatus: 'RESOLVED_DISTRICT',
    datasetSource: 'Survey of India',
    vintage: '2024',
  },
  officialAlerts: [],
  nationwideAlerts: [],
  indicativeAlerts: [],
  demonstrationScenarios: [],
  disclaimer: 'Official government alerts.',
  limitations: [],
};

describe('JATAYU Phase 3A — HomePage Public First Component', () => {
  it('renders hero banner with headline and mandatory non-guarantee safety notice', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={mockAlertFeedClean}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    // Headline and subheadline
    expect(
      screen.getByText('Understand the weather. Know the risks. Plan your next step.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/JATAYU provides indicative situational screening and aggregates official alerts/i)
    ).toBeInTheDocument();

    // Four core action cards rendered
    expect(screen.getByText('Weather & Warnings')).toBeInTheDocument();
    expect(screen.getAllByText('Find a Safer Route').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Nearby Emergency Help')).toBeInTheDocument();
    expect(screen.getByText('Climate & Research Observatory')).toBeInTheDocument();
  });

  it('renders State 1: Active official alert when alerts exist in feed', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={mockAlertFeedWithActiveAlert}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Red Alert: Inundation risk in low-lying coastal areas')).toBeInTheDocument();
    expect(screen.getByText(/IMD Chennai Regional Meteorological Centre/i)).toBeInTheDocument();
  });

  it('renders State 2: Checked feed with NO active alerts and transparent caveat', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={mockAlertFeedClean}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('No Active IMD Warning Found')).toBeInTheDocument();
    expect(
      screen.getByText(/No active meteorological warnings found in the official IMD feed for this district/i)
    ).toBeInTheDocument();
  });

  it('renders State 3: Feed unavailable when alert feed is null or error', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={null}
          alertsLoading={false}
          alertsError="Upstream IMD server timed out"
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('Warning Feed Temporarily Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText(/Could not connect to the upstream meteorological warning feed/i)
    ).toBeInTheDocument();
  });

  it('navigates to corresponding tabs when action cards are clicked', () => {
    const onSelectTab = vi.fn();
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={mockAlertFeedClean}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={onSelectTab}
        />
      </LanguageProvider>
    );

    fireEvent.click(screen.getAllByText('Find a Safer Route')[0]);
    expect(onSelectTab).toHaveBeenCalledWith('saferoute');

    fireEvent.click(screen.getByText('Nearby Emergency Help'));
    expect(onSelectTab).toHaveBeenCalledWith('facilities');

    fireEvent.click(screen.getByText('Climate & Research Observatory'));
    expect(onSelectTab).toHaveBeenCalledWith('research');
  });

  it('renders verified 3-pillar breakdown and data trust tier boundaries', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HomePage
          location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
          weather={mockWeather}
          forecast={null}
          alertFeed={mockAlertFeedClean}
          alertsLoading={false}
          alertsError={null}
          onSelectTab={vi.fn()}
        />
      </LanguageProvider>
    );

    // 3 Pillars
    expect(screen.getByText('Authoritative Ingestion')).toBeInTheDocument();
    expect(screen.getByText('Transparent Hazard Screening')).toBeInTheDocument();
    expect(screen.getByText('Actionable Public Guidance')).toBeInTheDocument();

    // Trust Tiers note
    expect(screen.getByText(/Data Trust Architecture:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Official alerts, indicative heuristics, and experimental research simulations are strictly segregated/i)
    ).toBeInTheDocument();
  });
});
