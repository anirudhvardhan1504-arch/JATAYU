import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { NavigationTab } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onCloseMobile,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}) => {
  const { user, isAuthenticated, hasPermission } = useAuth();
  const { t } = useLanguage();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  };

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

  if (user?.role === 'ADMIN' || hasPermission('admin:manage_roles')) {
    operatorNavItems.push({
      id: 'admin',
      label: 'Admin Console',
      icon: <Shield className="w-4 h-4 text-emerald-400" />,
      badge: 'ADMIN',
    });
  }

  return (
    <aside
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-charcoal/90 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between flex-shrink-0 text-jatayu-secondary select-none overflow-y-auto overflow-x-hidden transition-all duration-300 shadow-[10px_0_30px_-10px_rgba(0,0,0,0.5)]`}
    >
      <div>
        {/* Brand Header */}
        {!isCollapsed ? (
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div
              onClick={() => handleSelect('home')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-95 transition-opacity min-w-0 group"
              title="JATAYU Disaster Intelligence - Return to Home"
            >
              <div className="w-9 h-9 rounded-xl bg-dark-emerald/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(0,217,154,0.3)] group-hover:scale-105 transition-transform flex-shrink-0">
                <Compass className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-wider text-jatayu-primary font-mono truncate">
                    {t('brand.name')}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-full flex-shrink-0 shadow-[0_0_6px_rgba(0,217,154,0.2)]">
                    v0.1
                  </span>
                </div>
                <p className="text-[11px] text-jatayu-secondary tracking-tight font-sans truncate">
                  {t('brand.tagline')}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-1.5 rounded-lg text-jatayu-muted hover:text-jatayu-primary hover:bg-white/5 transition-colors cursor-pointer ml-2 flex-shrink-0"
              title="Collapse Navigation"
              aria-label="Collapse Navigation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3 border-b border-white/10 flex flex-col items-center gap-2">
            <div
              onClick={() => handleSelect('home')}
              className="w-10 h-10 rounded-xl bg-dark-emerald/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400 cursor-pointer hover:scale-105 transition-transform shadow-[0_0_12px_rgba(0,217,154,0.3)]"
              title="JATAYU Disaster Intelligence - Return to Home"
            >
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <button
              onClick={handleToggleCollapse}
              className="p-1 rounded-lg text-jatayu-muted hover:text-jatayu-primary hover:bg-white/5 transition-colors cursor-pointer"
              title="Expand Navigation"
              aria-label="Expand Navigation"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Public Portal Section */}
        {!isCollapsed ? (
          <div className="p-3">
            <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5">
              <span>PUBLIC PORTAL</span>
            </div>
            <nav className="space-y-1 mt-1">
              {publicNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-[0_0_15px_rgba(0,217,154,0.2)]'
                        : 'text-jatayu-secondary hover:text-jatayu-primary hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-emerald-300' : 'text-jatayu-secondary'}>
                        {item.icon}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                          item.badge === 'LIVE'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]'
                            : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
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
        ) : (
          <div className="p-2">
            <div className="h-px bg-white/10 my-1 mx-2" title="PUBLIC PORTAL" />
            <nav className="space-y-1.5 mt-2 flex flex-col items-center">
              {publicNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                    aria-label={item.label}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(0,217,154,0.2)]'
                        : 'text-slate-400 hover:text-jatayu-primary hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    {item.badge && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                          item.badge === 'LIVE' ? 'bg-emerald-400 shadow-[0_0_4px_#00D99A]' : 'bg-amber-400'
                        }`}
                      />
                    )}
                    <span className="sr-only">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* 2. Operational Console Section */}
        {!isCollapsed ? (
          <div className="p-3 pt-0">
            <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5 border-t border-white/10 pt-3">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>RESPONSE CONSOLE</span>
            </div>
            <nav className="space-y-1 mt-1">
              {operatorNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-[0_0_15px_rgba(0,217,154,0.2)]'
                        : 'text-jatayu-secondary hover:text-jatayu-primary hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={isActive ? 'text-emerald-300' : 'text-jatayu-secondary'}>
                        {item.icon}
                      </span>
                      <span className="truncate font-medium">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                          item.badge === 'LIVE'
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]'
                            : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
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
        ) : (
          <div className="p-2 pt-0">
            <div className="h-px bg-white/10 my-1 mx-2" title="RESPONSE CONSOLE" />
            <nav className="space-y-1.5 mt-2 flex flex-col items-center">
              {operatorNavItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                    aria-label={item.label}
                    className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(0,217,154,0.2)]'
                        : 'text-slate-400 hover:text-jatayu-primary hover:bg-white/5'
                    }`}
                  >
                    {item.icon}
                    {item.badge && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                          item.badge === 'LIVE' ? 'bg-emerald-400 shadow-[0_0_4px_#00D99A]' : 'bg-amber-400'
                        }`}
                      />
                    )}
                    <span className="sr-only">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-white/10 text-xs bg-obsidian/70">
          <div className="flex items-center justify-between text-jatayu-primary font-medium mb-1.5">
            <span className="text-[11px] font-mono text-jatayu-secondary">ACCESS TIER</span>
            <span className="text-emerald-300 font-bold uppercase text-[10px] px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40">
              {isAuthenticated && user ? user.role : 'PUBLIC ACCESS'}
            </span>
          </div>
          <p className="text-jatayu-secondary text-[11px] leading-relaxed font-sans">
            Civilian situational triage & verified emergency facility navigation.
          </p>
        </div>
      ) : (
        <div
          className="p-2 border-t border-white/10 text-center bg-obsidian/60"
          title={`ACCESS TIER: ${isAuthenticated && user ? user.role : 'PUBLIC ACCESS'}`}
        >
          <span className="text-[9px] font-mono px-1 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 rounded font-bold uppercase block truncate">
            {isAuthenticated && user ? user.role.slice(0, 3) : 'PUB'}
          </span>
        </div>
      )}
    </aside>
  );
};
