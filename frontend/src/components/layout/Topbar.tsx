import React, { useEffect, useRef, useState } from 'react';
import { Menu, Search, MapPin, LocateFixed, RefreshCw, Shield, LogOut, FileText, ChevronRight, X, Pause, Play, Sun, Moon } from 'lucide-react';
import { NavigationTab, GeocodingResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LanguageSelector } from '../common/LanguageSelector';
import { searchPlaces, reverseGeocodeLocation } from '../../services/route';

interface TopbarProps {
  colorTheme?: 'light' | 'dark'; onToggleColorTheme?: () => void;
  motionEnabled?: boolean; onToggleMotion?: () => void;
  activeTab: NavigationTab; onSelectTab?: (tab: NavigationTab) => void;
  selectedLocation: { name:string; lat:number; lon:number };
  onSelectLocation:(location:{ name:string; lat:number; lon:number }) => void;
  onRefresh?:()=>void; isRefreshing?:boolean; onOpenLogin?:()=>void;
  onExportSitrep?:()=>void; onToggleMobileMenu?:()=>void;
}
const places = [
  { name:'Hyderabad Metropolitan Region',lat:17.385,lon:78.4867 }, { name:'Mumbai Metropolitan Region',lat:19.076,lon:72.8777 },
  { name:'Chennai Coastal Basin',lat:13.0827,lon:80.2707 }, { name:'Brahmaputra Valley (Guwahati)',lat:26.1445,lon:91.7362 },
  { name:'Kolkata Deltaic Zone',lat:22.5726,lon:88.3639 }, { name:'Dehradun Hill Catchment',lat:30.3165,lon:78.0322 },
  { name:'Delhi NCR',lat:28.6139,lon:77.209 }, { name:'Bengaluru Urban',lat:12.9716,lon:77.5946 },
];

export const Topbar: React.FC<TopbarProps> = ({ colorTheme,onToggleColorTheme,motionEnabled,onToggleMotion,activeTab,onSelectTab,selectedLocation,onSelectLocation,onRefresh,isRefreshing,onOpenLogin,onExportSitrep,onToggleMobileMenu }) => {
  const { t } = useLanguage();
  const translate = useRef(t);
  translate.current = t;
  const { user,isAuthenticated,logout } = useAuth();
  const [query,setQuery] = useState('');
  const [results,setResults] = useState<GeocodingResult[]>([]);
  const [searching,setSearching] = useState(false);
  const [open,setOpen] = useState(false);
  const [notice,setNotice] = useState('');
  const [locating,setLocating] = useState(false);
  const geoRequest = useRef(0);
  const showSearch = activeTab !== 'home' && activeTab !== 'overview';
  useEffect(() => {
    if(query.trim().length < 2) { setResults([]);setSearching(false);return; }
    let current=true;
    const timer=setTimeout(async()=>{
      setSearching(true);setNotice('');
      try { const response=await searchPlaces(query.trim());if(current)setResults(response.slice(0,6)); }
      catch { if(current)setNotice(translate.current('home.searchFailed')); }
      finally { if(current)setSearching(false); }
    },300);
    return()=>{ current=false;clearTimeout(timer); };
  },[query]);
  useEffect(()=>()=>{ geoRequest.current++; },[]);
  const choose=(place:GeocodingResult)=>{onSelectLocation({ name:place.displayName,lat:place.latitude,lon:place.longitude });setQuery('');setOpen(false);};
  const gps=()=>{
    if(!navigator.geolocation){setNotice(t('home.geoUnavailableNotice'));return;}
    const sequence=++geoRequest.current;setLocating(true);setNotice('');
    navigator.geolocation.getCurrentPosition(async({coords})=>{
      let name=`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
      try { name=await reverseGeocodeLocation(coords.latitude,coords.longitude); } catch { /* Coordinates remain usable. */ }
      if(sequence!==geoRequest.current)return;
      onSelectLocation({name,lat:coords.latitude,lon:coords.longitude});setLocating(false);
    },()=>{if(sequence===geoRequest.current){setLocating(false);setNotice(t('home.geoUnavailableNotice'));}}, { timeout:10000 });
  };
  const title = { home:t('nav.home'),weather:t('nav.weatherWarnings'),overview:t('nav.overview'),map:t('nav.map'),risk:t('nav.risk'),alerts:t('nav.alerts'),ai:t('nav.ai'),preparedness:t('nav.preparedness'),saferoute:t('nav.saferoute'),facilities:t('nav.facilities'),research:t('nav.climateResearch'),command3d:t('nav.command3d'),admin:'Admin Console' }[activeTab];
  return <header className={`app-topbar refined-topbar ${showSearch ? 'has-location-search' : ''}`} data-page={activeTab}>
    <div className="topbar-identity"><button className="topbar-menu" aria-label="Toggle Navigation Menu" onClick={onToggleMobileMenu}><Menu size={19}/></button><button className="topbar-mobile-brand" onClick={()=>onSelectTab?.('home')}>JATAYU</button><div className="topbar-breadcrumb"><span>JATAYU</span><ChevronRight size={12}/><strong>{title}</strong></div></div>
    {showSearch && <div className="refined-location" onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
      <div className="refined-place-input"><Search size={15}/><input aria-label={t('home.searchLabel')} placeholder={t('home.searchPlaceholder')} value={query} onChange={(event)=>{setQuery(event.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={(event)=>{if(event.key==='Escape')setOpen(false);if(event.key==='Enter'&&results[0])choose(results[0]);}}/>{searching&&<RefreshCw size={13} className="animate-spin"/>}</div>
      <button className="topbar-icon" aria-label={t('home.useLocationBtn')} title={t('home.useLocationBtn')} onClick={gps} disabled={locating}><LocateFixed size={16} className={locating?'animate-spin':''}/></button>
      <select aria-label="Select Target Disaster Sector" value={selectedLocation.name} onChange={(event)=>{const place=places.find((item)=>item.name===event.target.value);if(place)onSelectLocation(place);}}>
        {!places.some((place)=>place.name===selectedLocation.name)&&<option value={selectedLocation.name}>{selectedLocation.name}</option>}
        {places.map((place)=><option key={place.name} value={place.name}>{place.name}</option>)}
      </select>
      {open&&query.length>=2&&<div className="refined-search-results" role="listbox" aria-label={t('home.searchLabel')}>{notice?<p>{notice}</p>:searching?<p>{t('home.searching')}</p>:results.length?results.map((place)=><button role="option" aria-selected="false" key={`${place.latitude},${place.longitude}`} onMouseDown={(event)=>event.preventDefault()} onClick={()=>choose(place)}><MapPin size={15}/>{place.displayName}</button>):<p>{t('home.noResultsFound')}</p>}</div>}
    </div>}
    <div className="topbar-tools"><LanguageSelector/>{onToggleColorTheme && <button className="topbar-icon color-theme-toggle" onClick={onToggleColorTheme} aria-label={t(colorTheme === 'dark' ? 'theme.light' : 'theme.dark')} title={t(colorTheme === 'dark' ? 'theme.light' : 'theme.dark')}>{colorTheme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button>}{onToggleMotion && <button className="topbar-icon weather-motion-toggle" onClick={onToggleMotion} aria-pressed={motionEnabled} aria-label={motionEnabled ? 'Pause background animation' : 'Play background animation'} title={motionEnabled ? 'Pause background animation' : 'Play background animation'}>{motionEnabled ? <Pause size={15}/> : <Play size={15}/>}</button>}{onExportSitrep&&<button className="topbar-icon" onClick={onExportSitrep} title="Export Situation Report" aria-label={t('sitrep.exportBtn')}><FileText size={16}/></button>}{onRefresh&&<button className="topbar-icon" onClick={onRefresh} disabled={isRefreshing} title={t('topbar.refresh')} aria-label={t('topbar.refresh')}><RefreshCw size={16} className={isRefreshing?'animate-spin':''}/></button>}
      {isAuthenticated&&user?<div className="topbar-account"><span><strong>{user.displayName||user.username}</strong><small>{user.role}</small></span><button className="topbar-icon" onClick={logout} title="Sign Out" aria-label={t('topbar.logout')}><LogOut size={15}/></button></div>:<button className="topbar-signin" onClick={()=>onOpenLogin?onOpenLogin():onSelectTab?.('overview')} aria-label={t('topbar.commandSignIn')} title="Access Authorized Response & Researcher Tools"><Shield size={15}/><span>{t('topbar.commandSignIn')}</span></button>}
    </div>
    {notice&&!(open&&query.length>=2)&&<div className="topbar-notice" role="status">{notice}<button aria-label="Dismiss" onClick={()=>setNotice('')}><X size={14}/></button></div>}
  </header>;
};
