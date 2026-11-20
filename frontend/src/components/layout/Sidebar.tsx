import React, { useState } from 'react';
import { Compass, Home, CloudRain, Navigation2, Building2, Globe, LayoutDashboard, Map, Activity, Bell, Bot, ShieldCheck, Shield, PanelLeftClose, PanelLeftOpen, ArrowUpRight, X } from 'lucide-react';
import { NavigationTab } from '../../types';
import { TranslationKey } from '../../i18n/types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

interface SidebarProps {
  activeTab: NavigationTab; onSelectTab: (tab: NavigationTab) => void; onCloseMobile?: () => void;
  isCollapsed?: boolean; onToggleCollapse?: () => void;
}
export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onCloseMobile, isCollapsed: controlled, onToggleCollapse }) => {
  const [internal, setInternal] = useState(false);
  const collapsed = controlled ?? internal;
  const { user, hasPermission } = useAuth();
  const { t, language } = useLanguage();
  const choose = (tab: NavigationTab) => { onSelectTab(tab); onCloseMobile?.(); };
  const publicItems = [
    { id:'home', key:'nav.home', icon:Home }, { id:'weather', key:'nav.weatherWarnings', icon:CloudRain },
    { id:'saferoute', key:'nav.saferoute', icon:Navigation2 }, { id:'facilities', key:'nav.facilities', icon:Building2 },
    { id:'research', key:'nav.climateResearch', icon:Globe },
  ];
  const workspaceItems = [
    { id:'overview', key:'nav.overview', icon:LayoutDashboard }, { id:'map', key:'nav.map', icon:Map },
    { id:'risk', key:'nav.risk', icon:Activity }, { id:'alerts', key:'nav.alerts', icon:Bell },
    { id:'ai', key:'nav.ai', icon:Bot }, { id:'preparedness', key:'nav.preparedness', icon:ShieldCheck },
  ];
  workspaceItems.splice(2,0,{ id:'command3d',key:'nav.command3d',icon:Globe });
  const groupLabel = language === 'te' ? ['ప్రజా సేవలు','కార్యస్థలం'] : language === 'ta' ? ['பொது சேவைகள்','செயல்பாடுகள்'] : language === 'hi' ? ['सार्वजनिक सेवाएँ','कार्यस्थल'] : ['Explore','Workspace'];
  return <aside className={`app-sidebar sidebar-design ${collapsed ? 'sidebar-collapsed' : ''}`} style={collapsed ? { width:68 } : undefined}>
    <div className="sidebar-brand"><button aria-label="JATAYU Home" onClick={() => choose('home')}><span className="sidebar-mark"><Compass size={21} strokeWidth={1.5} /></span>{!collapsed && <span className="sidebar-wordmark"><strong>JATAYU</strong><small>{t('brand.tagline')}</small></span>}</button>{onCloseMobile && <button className="sidebar-mobile-close" aria-label="Close navigation" onClick={onCloseMobile}><X size={18} /></button>}</div>
    <div className="sidebar-navigation">{[publicItems,workspaceItems].map((items,index) => <div className="sidebar-group" key={index}>
      {!collapsed && <p className="sidebar-group-label">{groupLabel[index]}</p>}
      <nav aria-label={groupLabel[index]}>{items.map(({id,key,icon:Icon}) => <button key={id} title={collapsed ? t(key as TranslationKey) : undefined} aria-label={t(key as TranslationKey)} aria-current={activeTab === id ? 'page' : undefined} onClick={() => choose(id as NavigationTab)}><Icon size={17} strokeWidth={1.6} />{!collapsed && <span>{t(key as TranslationKey)}</span>}{!collapsed && activeTab === id && <span className="sidebar-active-dot" />}</button>)}</nav>
    </div>)}
      {(user?.role === 'ADMIN' || hasPermission('admin:manage_roles')) && <nav aria-label="Administration"><button onClick={() => choose('admin')} aria-current={activeTab === 'admin' ? 'page' : undefined} title="Admin Console"><Shield size={17} />{!collapsed && <span>Admin Console</span>}</button></nav>}
    </div>
    <div className="sidebar-bottom">{!collapsed && <div className="sidebar-fieldnote"><Globe size={20} strokeWidth={1.25} /><strong>One connected perspective.</strong><p>Weather. Place. Preparedness.</p><button onClick={() => choose('research')}>Explore the observatory<ArrowUpRight size={14} /></button></div>}
      <div className="sidebar-access"><span className="sidebar-avatar">{user?.displayName?.slice(0,1) || 'J'}</span>{!collapsed && <div><strong>{user?.displayName || 'Public access'}</strong><small>{user?.role || 'India · Local intelligence'}</small></div>}
        <button onClick={() => onToggleCollapse ? onToggleCollapse() : setInternal(!internal)} aria-label={collapsed ? 'Expand Navigation' : 'Collapse Navigation'} title={collapsed ? 'Expand Navigation' : 'Collapse Navigation'}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
      </div>
    </div>
  </aside>;
};
