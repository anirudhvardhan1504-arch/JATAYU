import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { OperationalStatusBar } from './OperationalStatusBar';
import { WeatherAtmosphere } from './WeatherAtmosphere';
import { getWeatherMood, isNightAt } from '../../utils/weatherMood';
import { CurrentWeatherObservation, NavigationTab } from '../../types';

interface AppShellProps {
  weather?: CurrentWeatherObservation | null;
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  selectedLocation: { name: string; lat: number; lon: number };
  onSelectLocation: (loc: { name: string; lat: number; lon: number }) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  openRouterConfigured?: boolean;
  onOpenLogin?: () => void;
  onExportSitrep?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  weather,
  activeTab,
  onSelectTab,
  selectedLocation,
  onSelectLocation,
  onRefresh,
  isRefreshing,
  openRouterConfigured,
  onOpenLogin,
  onExportSitrep,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMobileMenuOpen]);

  const [colorTheme, setColorTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('jatayu-color-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const toggleColorTheme = () => setColorTheme(current => current === 'light' ? 'dark' : 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = colorTheme;
    try { localStorage.setItem('jatayu-color-theme', colorTheme); } catch { /* Optional preference storage. */ }
  }, [colorTheme]);

  const [clock, setClock] = useState(() => new Date());
  const [motionEnabled, setMotionEnabled] = useState(() => {
    try { return localStorage.getItem('jatayu-weather-motion') !== 'paused'; } catch { return true; }
  });
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const mood = getWeatherMood(weather, selectedLocation.lat, selectedLocation.lon, clock);
  const toggleMotion = () => setMotionEnabled((current) => {
    try { localStorage.setItem('jatayu-weather-motion', current ? 'paused' : 'playing'); } catch { /* Storage may be unavailable. */ }
    return !current;
  });

  // Operational status bar is displayed on tactical dashboard tabs
  const isOperatorTab = [
    'overview',
    'map',
    'risk',
    'alerts',
    'ai',
    'preparedness',
  ].includes(activeTab);

  return (
    <div data-theme={colorTheme} data-time-of-day={isNightAt(clock, selectedLocation.lat, selectedLocation.lon) ? 'night' : 'day'} data-weather={mood} data-motion={motionEnabled ? 'playing' : 'paused'} className="app-shell flex flex-col h-screen w-full max-w-full overflow-hidden bg-obsidian text-jatayu-primary font-sans">
      <WeatherAtmosphere mood={mood} />
      {/* Top Banner / Operational Status Bar */}
      {isOperatorTab && (
        <OperationalStatusBar
          systemStatus="active"
          openRouterConfigured={openRouterConfigured}
        />
      )}

      {/* Main Body with Sidebar & Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-obsidian/80 z-40 md:hidden backdrop-blur-md"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Left Sidebar (Desktop fixed, Mobile fly-out drawer) */}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:static md:z-auto transition-transform duration-200 transform ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navigation Bar */}
          <Topbar
            colorTheme={colorTheme}
            onToggleColorTheme={toggleColorTheme}
            motionEnabled={motionEnabled}
            onToggleMotion={toggleMotion}
            activeTab={activeTab}
            onSelectTab={onSelectTab}
            selectedLocation={selectedLocation}
            onSelectLocation={onSelectLocation}
            onRefresh={onRefresh}
            isRefreshing={isRefreshing}
            onOpenLogin={onOpenLogin}
            onExportSitrep={onExportSitrep}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />

          {/* Dynamic Scrollable Page Body */}
          <main
            className={`flex-1 ${
              activeTab === 'map' || activeTab === 'command3d'
                ? 'overflow-hidden p-0 relative bg-obsidian'
                : 'page-content overflow-y-auto p-3 sm:p-4 lg:p-5 bg-transparent'
            }`}
          >
            <div
              className={
                activeTab === 'map' || activeTab === 'command3d'
                  ? 'w-full h-full'
                  : 'max-w-[1600px] mx-auto space-y-4'
              }
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
