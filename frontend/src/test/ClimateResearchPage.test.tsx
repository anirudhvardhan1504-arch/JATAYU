import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClimateResearchPage } from '../pages/ClimateResearchPage';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
import * as weatherService from '../services/weather';

const mockHistoricalWeather: weatherService.HistoricalWeatherSeries = {
  location: { latitude: 13.0827, longitude: 80.2707, name: 'Chennai Coastal Sector' },
  startDate: '2015-11-28',
  endDate: '2015-12-04',
  daily: {
    time: ['2015-11-28', '2015-11-29', '2015-11-30', '2015-12-01', '2015-12-02'],
    precipitationSum: [24.2, 45.0, 85.6, 345.0, 120.4],
    temperatureMax: [28.5, 27.2, 26.0, 24.8, 26.5],
    temperatureMin: [22.0, 21.5, 20.8, 20.1, 21.0],
  },
  eventAccumulationMm: 620.2,
  peakDailyRainMm: 345,
  dataSource: 'Copernicus ERA5 Land Reanalysis via Open-Meteo Historical Archive',
};

describe('JATAYU Phase 3A — ClimateResearchPage Accessible 2D Workspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    }
  });

  it('renders historical disaster presets and loads reanalysis data on preset click', async () => {
    vi.spyOn(weatherService, 'getHistoricalWeather').mockResolvedValue(mockHistoricalWeather);

    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <ClimateResearchPage
            location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
            onLaunch3DGlobe={vi.fn()}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Check that historical preset buttons exist
    expect(screen.getByText(/2015 Chennai Deluge/i)).toBeInTheDocument();
    expect(screen.getByText(/2023 Cyclone Michaung/i)).toBeInTheDocument();
    expect(screen.getByText(/2024 Cyclone Remal/i)).toBeInTheDocument();

    // Click 2015 Chennai Deluge preset
    fireEvent.click(screen.getByText(/2015 Chennai Deluge/i));

    await waitFor(() => {
      expect(screen.getByText('620.2 mm')).toBeInTheDocument();
      expect(screen.getByText('345 mm')).toBeInTheDocument();
    });

    // Verify ERA5 dataset attribution rendered
    expect(screen.getByText(/Copernicus ERA5 Reanalysis/i)).toBeInTheDocument();
  });

  it('renders NASA GIBS satellite cloud layer controls and attribution', async () => {
    vi.spyOn(weatherService, 'getHistoricalWeather').mockResolvedValue(mockHistoricalWeather);

    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <ClimateResearchPage
            location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
            onLaunch3DGlobe={vi.fn()}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Switch to Satellite tab
    fireEvent.click(screen.getByText('NASA Satellite Clouds'));

    expect(screen.getByText(/NASA GIBS MODIS Terra/i)).toBeInTheDocument();
    expect(screen.getByText(/NASA GIBS \/ EOSDIS/i)).toBeInTheDocument();
  });

  it('enforces RBAC gate on SFINCS Hydrodynamic Simulation with clear Tier 3 quarantine explanation', async () => {
    vi.spyOn(weatherService, 'getHistoricalWeather').mockResolvedValue(mockHistoricalWeather);

    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <ClimateResearchPage
            location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
            onLaunch3DGlobe={vi.fn()}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Notice quarantined experimental status
    expect(screen.getByText('STATUS: EXPERIMENTAL_UNVALIDATED')).toBeInTheDocument();
    expect(screen.getByText('Deltares SFINCS Adyar Hydrodynamic Model')).toBeInTheDocument();
    expect(screen.getByText(/Detailed 2D hydrodynamic simulation layers and solver parameters require authorized researcher evaluation credentials/i)).toBeInTheDocument();
  });

  it('exports structured markdown research brief when clicking Export Research Brief', async () => {
    vi.spyOn(weatherService, 'getHistoricalWeather').mockResolvedValue(mockHistoricalWeather);
    const createObjectURLSpy = vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');

    render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="en">
          <ClimateResearchPage
            location={{ name: 'Chennai Coastal Sector', lat: 13.0827, lon: 80.2707 }}
            onLaunch3DGlobe={vi.fn()}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Load data
    fireEvent.click(screen.getByText(/2015 Chennai Deluge/i));
    await waitFor(() => {
      expect(screen.getByText('620.2 mm')).toBeInTheDocument();
    });

    const exportBtn = screen.getByText(/Export Research Brief/i);
    fireEvent.click(exportBtn);

    expect(createObjectURLSpy).toHaveBeenCalled();
  });
});
