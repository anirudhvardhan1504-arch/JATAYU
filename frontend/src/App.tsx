import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { RiskAssessmentPage } from './pages/RiskAssessmentPage';
import { AlertsPage } from './pages/AlertsPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { PreparednessPage } from './pages/PreparednessPage';
import { SafeRoutePage } from './pages/SafeRoutePage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { ClimateResearchPage } from './pages/ClimateResearchPage';
import { LoginModal } from './components/auth/LoginModal';
import { Command3DLoading } from './components/command3d/Command3DLoading';
import { AccessDeniedView } from './components/command3d/AccessDeniedView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { generateTacticalSitrep } from './utils/sitrepGenerator';
import { SitrepExportModal } from './components/sitrep/SitrepExportModal';
import { DemoReplayBanner } from './components/layout/DemoReplayBanner';
import {
  NavigationTab,
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AIStatusResponse,
  AlertFeedResponse,
} from './types';
import { getCurrentWeather, getWeatherForecast } from './services/weather';
import { getFloodRiskAssessment } from './services/risk';
import { getAIStatus } from './services/ai';
import { getDisasterAlerts } from './services/alerts';
import { reverseGeocodeLocation } from './services/route';

// Lazy-load Cesium 3D Command Container on-demand so it is completely excluded from the citizen entry bundle
const LazyCommand3DContainer = lazy(() => import('./components/command3d/Command3DContainer'));

export const AppContent: React.FC<{ initialTab?: NavigationTab }> = ({ initialTab = 'home' }) => {
  const { user, hasPermission } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<NavigationTab>(initialTab);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSitrepModalOpen, setIsSitrepModalOpen] = useState(false);

  const [isReplayMode, setIsReplayMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.get('demo') === 'replay' ||
      urlParams.get('replay') === 'true' ||
      sessionStorage.getItem('jatayu_replay_mode') === 'true'
    );
  });

  const [replayScenario, setReplayScenario] = useState<string>(() => {
    if (typeof window === 'undefined') return 'chennai_deluge_2023';
    return sessionStorage.getItem('jatayu_replay_scenario') || 'chennai_deluge_2023';
  });

  const SCENARIO_LOCATIONS: Record<string, { name: string; lat: number; lon: number }> = useMemo(
    () => ({
      chennai_deluge_2023: { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 },
      hyderabad_musi_2020: { name: 'Hyderabad Old City', lat: 17.385, lon: 78.4867 },
      mumbai_monsoon_2023: { name: 'Mumbai Bandra-Kurla Complex', lat: 19.06, lon: 72.8656 },
    }),
    []
  );

  const [selectedLocation, setSelectedLocation] = useState(() => {
    if (typeof window !== 'undefined') {
      const isReplay =
        new URLSearchParams(window.location.search).get('demo') === 'replay' ||
        sessionStorage.getItem('jatayu_replay_mode') === 'true';
      if (isReplay) {
        const scen = sessionStorage.getItem('jatayu_replay_scenario') || 'chennai_deluge_2023';
        return (
          {
            chennai_deluge_2023: { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 },
            hyderabad_musi_2020: { name: 'Hyderabad Old City', lat: 17.385, lon: 78.4867 },
            mumbai_monsoon_2023: { name: 'Mumbai Bandra-Kurla Complex', lat: 19.06, lon: 72.8656 },
          }[scen] || { name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }
        );
      }
    }
    return {
      name: 'Mumbai Metropolitan Region',
      lat: 19.076,
      lon: 72.8777,
    };
  });

  const handleToggleReplay = useCallback(
    (enabled: boolean) => {
      setIsReplayMode(enabled);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('jatayu_replay_mode', String(enabled));
        if (enabled) {
          sessionStorage.setItem('jatayu_replay_scenario', replayScenario);
          const loc = SCENARIO_LOCATIONS[replayScenario] || SCENARIO_LOCATIONS.chennai_deluge_2023;
          setSelectedLocation(loc);
        } else {
          sessionStorage.removeItem('jatayu_replay_mode');
          setSelectedLocation({
            name: 'Mumbai Metropolitan Region',
            lat: 19.076,
            lon: 72.8777,
          });
        }
      }
    },
    [replayScenario, SCENARIO_LOCATIONS]
  );

  const handleScenarioChange = useCallback(
    (newScenario: string) => {
      setReplayScenario(newScenario);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('jatayu_replay_scenario', newScenario);
        const loc = SCENARIO_LOCATIONS[newScenario] || SCENARIO_LOCATIONS.chennai_deluge_2023;
        setSelectedLocation(loc);
      }
    },
    [SCENARIO_LOCATIONS]
  );

  const [weather, setWeather] = useState<CurrentWeatherObservation | null>(null);
  const [forecast, setForecast] = useState<WeatherForecastResponse | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<IndicativeFloodRiskAssessment | null>(null);
  const [alertFeed, setAlertFeed] = useState<AlertFeedResponse | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const requestSeqRef = React.useRef(0);

  const loadData = useCallback(async () => {
    // Validate coordinates
    const { lat, lon, name } = selectedLocation;
    if (
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      isNaN(lat) ||
      isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setWeatherError(`Invalid coordinates: lat=${lat}, lon=${lon}`);
      return;
    }

    const currentSeq = ++requestSeqRef.current;
    setIsLoading(true);
    setAlertsLoading(true);
    setWeatherError(null);
    setAlertsError(null);

    try {
      const [currentRes, forecastRes, riskRes, aiRes, alertsRes] = await Promise.allSettled([
        getCurrentWeather(lat, lon, name),
        getWeatherForecast(lat, lon, name),
        getFloodRiskAssessment(lat, lon, name),
        getAIStatus(),
        getDisasterAlerts(lat, lon, name),
      ]);

      // Guard against stale async responses if user changed location while request was in-flight
      if (currentSeq !== requestSeqRef.current) {
        return;
      }

      if (currentRes.status === 'fulfilled') {
        setWeather(currentRes.value);
      } else {
        setWeather(null);
        setWeatherError(`Failed to fetch live weather: ${currentRes.reason?.message || 'Upstream error'}`);
      }

      if (forecastRes.status === 'fulfilled') {
        setForecast(forecastRes.value);
      } else {
        setForecast(null);
        setWeatherError((prev) =>
          prev
            ? `${prev} | Forecast: ${forecastRes.reason?.message || 'Upstream forecast error'}`
            : `Failed to fetch forecast: ${forecastRes.reason?.message || 'Upstream forecast error'}`
        );
      }

      if (riskRes.status === 'fulfilled') {
        setRiskAssessment(riskRes.value);
      } else {
        setRiskAssessment(null);
      }

      if (alertsRes.status === 'fulfilled') {
        setAlertFeed(alertsRes.value);
      } else {
        setAlertFeed(null);
        setAlertsError(`Failed to fetch alerts: ${alertsRes.reason?.message || 'Upstream alert service error'}`);
      }

      if (aiRes.status === 'fulfilled') {
        setAiStatus(aiRes.value);
      }
    } catch (err: any) {
      if (currentSeq === requestSeqRef.current) {
        console.error('Failed to load operational data:', err);
        setWeatherError(err.message || 'Operational communication error');
      }
    } finally {
      if (currentSeq === requestSeqRef.current) {
        setIsLoading(false);
        setAlertsLoading(false);
      }
    }
  }, [selectedLocation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const name = await reverseGeocodeLocation(pos.coords.latitude, pos.coords.longitude);
            setSelectedLocation({ name, lat: pos.coords.latitude, lon: pos.coords.longitude });
          } catch {
            setSelectedLocation({
              name: `My Location (${pos.coords.latitude.toFixed(4)}°N, ${pos.coords.longitude.toFixed(4)}°E)`,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            });
          }
        },
        (err) => console.warn('Geolocation denied or unavailable:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const sitrepMarkdown = useMemo(() => {
    return generateTacticalSitrep({
      location: selectedLocation,
      weather,
      forecast,
      riskAssessment,
      alertFeed,
      alertsError,
      weatherError,
      language,
      user,
    });
  }, [
    selectedLocation,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    language,
    user,
  ]);

  return (
    <>
      <DemoReplayBanner
        isReplayMode={isReplayMode}
        scenarioId={replayScenario}
        onScenarioChange={handleScenarioChange}
        onToggleReplay={handleToggleReplay}
      />

      <AppShell
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
        onRefresh={loadData}
        isRefreshing={isLoading}
        openRouterConfigured={aiStatus?.configured}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onExportSitrep={() => setIsSitrepModalOpen(true)}
      >
        {activeTab === 'home' && (
          <HomePage
            location={selectedLocation}
            onSelectLocation={setSelectedLocation}
            weather={weather}
            forecast={forecast}
            alertFeed={alertFeed}
            alertsLoading={alertsLoading}
            alertsError={alertsError}
            onSelectTab={setActiveTab}
            onRequestLocation={handleRequestLocation}
          />
        )}

        {(activeTab === 'overview' || activeTab === 'weather') && (
          <OverviewPage
            location={selectedLocation}
            weather={weather}
            forecast={forecast}
            riskAssessment={riskAssessment}
            alertFeed={alertFeed}
            alertsError={alertsError}
            isLoading={isLoading}
            error={weatherError}
            onRetry={loadData}
          />
        )}

        {activeTab === 'map' && (
          <LiveMapPage
            location={selectedLocation}
            onSelectLocation={setSelectedLocation}
            weather={weather}
            forecast={forecast}
            riskAssessment={riskAssessment}
            alertFeed={alertFeed}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'saferoute' && (
          <SafeRoutePage currentSector={selectedLocation} />
        )}

        {activeTab === 'facilities' && (
          <FacilitiesPage
            location={selectedLocation}
            onPlanRouteToFacility={() => setActiveTab('saferoute')}
          />
        )}

        {activeTab === 'research' && (
          <ClimateResearchPage
            location={selectedLocation}
            onLaunch3DGlobe={() => setActiveTab('command3d')}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {activeTab === 'risk' && (
          <RiskAssessmentPage location={selectedLocation} assessment={riskAssessment} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage
            location={selectedLocation}
            alertFeed={alertFeed}
            isLoading={alertsLoading}
            error={alertsError}
            onRetry={loadData}
          />
        )}

        {activeTab === 'ai' && (
          <AIAssistantPage
            location={selectedLocation}
            weather={weather}
            forecast={forecast}
            riskAssessment={riskAssessment}
            alertFeed={alertFeed}
          />
        )}

        {activeTab === 'preparedness' && (
          <PreparednessPage
            location={selectedLocation}
            weather={weather}
            riskAssessment={riskAssessment}
            alertFeed={alertFeed}
          />
        )}

        {activeTab === 'command3d' && (
          hasPermission('command3d:view_globe') ? (
            <Suspense fallback={<Command3DLoading />}>
              <LazyCommand3DContainer
                selectedLocation={selectedLocation}
                onSelectLocation={setSelectedLocation}
                onReturnTo2D={() => setActiveTab('map')}
              />
            </Suspense>
          ) : (
            <AccessDeniedView
              onReturnToMap={() => setActiveTab('map')}
              onOpenLogin={() => setIsLoginModalOpen(true)}
            />
          )
        )}
      </AppShell>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          // If user logs in while viewing an access-denied state, refresh
        }}
      />

      <SitrepExportModal
        isOpen={isSitrepModalOpen}
        onClose={() => setIsSitrepModalOpen(false)}
        sitrepMarkdown={sitrepMarkdown}
        locationName={selectedLocation.name}
      />
    </>
  );
};

export const App: React.FC<{ initialTab?: NavigationTab }> = ({ initialTab = 'home' }) => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent initialTab={initialTab} />
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
