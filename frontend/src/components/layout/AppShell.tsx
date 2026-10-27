import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { OperationalStatusBar } from './OperationalStatusBar';
import { NavigationTab } from '../../types';

interface AppShellProps {
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

  // Operational status bar is only displayed on advanced operator console tabs
  const isOperatorTab = [
    'overview',
    'map',
    'risk',
    'alerts',
    'ai',
    'preparedness',
    'command3d',
  ].includes(activeTab);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-warm-100 text-slate-900 font-sans">
      {/* Top Banner / Operational Status Bar (Restrained: only on operator tabs) */}
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
            className="fixed inset-0 bg-navy-950/60 z-40 md:hidden backdrop-blur-xs"
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
          />
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navigation Bar */}
          <Topbar
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
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-warm-100">
            <div className="max-w-7xl mx-auto space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};
