import React from 'react';
import {
  Home,
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  BellRing,
  BotMessageSquare,
  ShieldCheck,
  Compass,
  Globe,
  Navigation2,
  Building2,
  CloudRain,
  Shield,
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onCloseMobile,
}) => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const { t } = useLanguage();

  const handleSelect = (tab: NavigationTab) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const publicNavItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'home',
      label: t('nav.home'),
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: 'weather',
      label: t('nav.weatherWarnings'),
      icon: <CloudRain className="w-4 h-4" />,
      badge: t('badge.live'),
    },
    {
      id: 'saferoute',
      label: t('nav.saferoute'),
      icon: <Navigation2 className="w-4 h-4" />,
      badge: t('badge.saferoute'),
    },
    {
      id: 'facilities',
      label: t('nav.facilities'),
      icon: <Building2 className="w-4 h-4" />,
    },
    {
      id: 'research',
      label: t('nav.climateResearch'),
      icon: <Globe className="w-4 h-4" />,
    },
  ];

  const operatorNavItems: { id: NavigationTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'overview',
      label: t('nav.overview'),
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'map',
      label: t('nav.map'),
      icon: <MapPin className="w-4 h-4" />,
      badge: t('badge.live'),
    },
    {
      id: 'risk',
      label: t('nav.risk'),
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: t('badge.indicative'),
    },
    {
      id: 'alerts',
      label: t('nav.alerts'),
      icon: <BellRing className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: t('nav.ai'),
      icon: <BotMessageSquare className="w-4 h-4" />,
    },
    {
      id: 'preparedness',
      label: t('nav.preparedness'),
      icon: <ShieldCheck className="w-4 h-4" />,
    },
  ];

  if (hasPermission('command3d:view_globe')) {
    operatorNavItems.push({
      id: 'command3d',
      label: t('nav.command3d'),
      icon: <Globe className="w-4 h-4" />,
      badge: t('badge.cesium3d'),
    });
  }

  return (
    <aside className="w-64 bg-navy-900 border-r border-navy-800 flex flex-col justify-between flex-shrink-0 text-slate-300 select-none overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div
          onClick={() => handleSelect('home')}
          className="p-4 border-b border-navy-800 flex items-center gap-3 cursor-pointer hover:bg-navy-850/50 transition-colors"
        >
          <div className="w-9 h-9 rounded bg-navy-800 border border-navy-700 flex items-center justify-center text-amber-400">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-wider text-white font-mono">
                {t('brand.name')}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 bg-navy-800 text-amber-400 border border-navy-700 rounded">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-tight font-sans">
              {t('brand.tagline')}
            </p>
          </div>
        </div>

        {/* 1. Public Portal Section */}
        <div className="p-3">
          <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-blue-400/90 flex items-center gap-1.5">
            <span>PUBLIC PORTAL</span>
          </div>
          <nav className="space-y-1 mt-1">
            {publicNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-navy-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                        item.badge === 'LIVE'
                          ? 'bg-teal-950/60 text-teal-400 border-teal-800'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 2. Operational Console Section */}
        <div className="p-3 pt-0">
          <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5 border-t border-navy-800/80 pt-3">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>RESPONSE CONSOLE</span>
          </div>
          <nav className="space-y-1 mt-1">
            {operatorNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-navy-800 text-amber-300 font-semibold border-l-2 border-amber-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-navy-850'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-amber-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                        item.badge === 'LIVE'
                          ? 'bg-teal-950/60 text-teal-400 border-teal-800'
                          : 'bg-amber-950/60 text-amber-400 border-amber-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Info Box */}
      <div className="p-3 border-t border-navy-800 text-[11px] bg-navy-950/60">
        <div className="flex items-center justify-between text-slate-400 font-mono mb-1">
          <span>ACCESS TIER</span>
          <span className="text-amber-400 font-bold uppercase text-[10px]">
            {isAuthenticated && user ? user.role : 'PUBLIC ACCESS'}
          </span>
        </div>
        <p className="text-slate-500 text-[10px] leading-relaxed font-sans">
          Civilian situational triage & verified emergency facility navigation.
        </p>
      </div>
    </aside>
  );
};
