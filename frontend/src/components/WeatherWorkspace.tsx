import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Cloud, CloudRain, Wind, Droplets, Gauge, MapPin, Search, LocateFixed, ShieldCheck, AlertTriangle, Navigation2, Building2, Globe, ChevronRight, RefreshCw, X } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { CurrentWeatherObservation, WeatherForecastResponse, AlertFeedResponse, IndicativeFloodRiskAssessment, NavigationTab, GeocodingResult } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { searchPlaces } from '../services/route';
import { TacticalMap } from './map/TacticalMap';
import { Badge } from './common/Badge';
import './weather-workspace.css';
import { WeatherConditionIcon } from './WeatherConditionIcon';

export interface WeatherWorkspaceProps {
  location: { name: string; lat: number; lon: number };
  weather: CurrentWeatherObservation | null;
  forecast: WeatherForecastResponse | null;
  alertFeed?: AlertFeedResponse | null;
  alertsLoading?: boolean;
  alertsError?: string | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  onSelectTab?: (tab: NavigationTab) => void;
  onSelectLocation?: (location: { name: string; lat: number; lon: number }) => void;
  onRequestLocation?: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  operational?: boolean;
  headerAction?: React.ReactNode;
}

const cities = [
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 }, { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 }, { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Delhi', lat: 28.6139, lon: 77.209 }, { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
];
const number = (value?: number | null, digits = 0) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
const time = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

export const WeatherWorkspace: React.FC<WeatherWorkspaceProps> = ({ location, weather, forecast, alertFeed, alertsLoading, alertsError, riskAssessment, onSelectTab, onSelectLocation, onRequestLocation, isLoading, error, onRetry, operational, headerAction }) => {
  const { t, language } = useLanguage();
  const translate = useRef(t);
  translate.current = t;
  const chartId = useId().replace(/:/g, '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [chart, setChart] = useState<'rain' | 'temperature'>('temperature');
  const labels = {
    te: { eyebrow: 'మీ ప్రాంతానికి వాతావరణ సమాచారం', title: 'మీ నగరం, ఒక చూపులో.', overview: 'కార్యాచరణ అవలోకనం', subtitle: 'వాతావరణాన్ని తెలుసుకోండి. తదుపరి నిర్ణయానికి సిద్ధంగా ఉండండి.', map: 'వాతావరణ పటం తెరవండి', now: 'ప్రస్తుత పరిస్థితులు', outlook: 'రాబోయే 24 గంటలు', hourly: 'గంటల వారీ సమాచారం', rain: 'వర్షపాతం', temp: 'ఉష్ణోగ్రత', wind: 'గాలి', humidity: 'తేమ', pressure: 'పీడనం', feels: 'అనిపించే ఉష్ణోగ్రత', next: 'మీ తదుపరి చర్య', risk: 'వరద ప్రమాద అంచనా', unavailable: 'అందుబాటులో లేదు', explore: 'పటాన్ని చూడండి', source: 'ఆధారం మరియు సమయం', updated: 'నవీకరణ', soil: 'నేలపై పొర తేమ', nextRain: 'రాబోయే 24 గంటల వర్షం', guidance: 'సూచనాత్మక అంచనా మాత్రమే; నిర్ధారిత వరద హెచ్చరిక కాదు.', confirm: 'బయలుదేరే ముందు సేవలు అందుబాటులో ఉన్నాయో ఫోన్ చేసి నిర్ధారించండి.', searching: 'ప్రాంతాలను వెతుకుతోంది…', noResults: 'ప్రాంతం కనుగొనలేదు. సమీప ప్రాంతాన్ని ప్రయత్నించండి.', location: 'ప్రాంతం లేదా అక్షాంశ రేఖాంశాలను వెతకండి', safety: 'సమాచారం తెలుసుకోండి. సిద్ధంగా ఉండండి.', riskDetail: 'అంచనాను చూడండి', data: 'ఈ సమాచారం గురించి' },
    en: { eyebrow: 'Weather intelligence, made local', title: 'Your city, in focus.', overview: 'Operational overview', subtitle: 'A clearer view of the weather. A more informed next step.', map: 'Open tactical map', now: 'Current conditions', outlook: 'The next 24 hours', hourly: 'An hour at a time', rain: 'Rainfall', temp: 'Temperature', wind: 'Wind', humidity: 'Humidity', pressure: 'Pressure', feels: 'Feels like', next: 'Your next step', risk: 'Flood-risk estimate', unavailable: 'Not available', explore: 'Explore the map', source: 'Source & time', updated: 'Updated', soil: 'Topsoil moisture', nextRain: 'Next 24h rain', guidance: 'Indicative screening, not a validated flood prediction.', confirm: 'Listed facilities may be unavailable. Call to confirm before travelling.', searching: 'Searching places…', noResults: 'No places found. Try a nearby locality.', location: 'Search a place or coordinates', safety: 'Stay informed. Stay prepared.', riskDetail: 'View assessment', data: 'About this information' },
    ta: { eyebrow: 'உங்கள் பகுதிக்கான வானிலை தகவல்', title: 'உங்கள் நகரம், தெளிவாக.', overview: 'செயல்பாட்டு கண்ணோட்டம்', subtitle: 'வானிலையை அறிந்து அடுத்த முடிவை எடுங்கள்.', map: 'வானிலை வரைபடம்', now: 'தற்போதைய நிலவரம்', outlook: 'அடுத்த 24 மணி நேரம்', hourly: 'மணிநேர முன்னறிவிப்பு', rain: 'மழை', temp: 'வெப்பநிலை', wind: 'காற்று', humidity: 'ஈரப்பதம்', pressure: 'அழுத்தம்', feels: 'உணரப்படும் வெப்பம்', next: 'அடுத்த படி', risk: 'வெள்ள அபாய மதிப்பீடு', unavailable: 'கிடைக்கவில்லை', explore: 'வரைபடத்தைத் திறக்கவும்', source: 'ஆதாரமும் நேரமும்', updated: 'புதுப்பித்த நேரம்', soil: 'மேல்மண் ஈரப்பதம்', nextRain: 'அடுத்த 24 மணி மழை', guidance: 'இது குறிப்பான மதிப்பீடு; உறுதிசெய்யப்பட்ட வெள்ள முன்னறிவிப்பு அல்ல.', confirm: 'புறப்படும் முன் சேவை கிடைப்பதை தொலைபேசியில் உறுதி செய்யவும்.', searching: 'இடங்களைத் தேடுகிறது…', noResults: 'இடம் கிடைக்கவில்லை. அருகிலுள்ள இடத்தை முயற்சிக்கவும்.', location: 'இடம் அல்லது ஆயங்களைத் தேடவும்', safety: 'தகவலுடன் இருங்கள். தயாராக இருங்கள்.', riskDetail: 'மதிப்பீட்டைக் காண்க', data: 'இந்தத் தகவல் பற்றி' },
    hi: { eyebrow: 'आपके क्षेत्र की मौसम जानकारी', title: 'आपका शहर, एक नज़र में।', overview: 'परिचालन अवलोकन', subtitle: 'मौसम की बेहतर समझ। अगला कदम सोच-समझकर।', map: 'मौसम मानचित्र खोलें', now: 'वर्तमान स्थिति', outlook: 'अगले 24 घंटे', hourly: 'घंटेवार पूर्वानुमान', rain: 'वर्षा', temp: 'तापमान', wind: 'हवा', humidity: 'आर्द्रता', pressure: 'दबाव', feels: 'महसूस होने वाला', next: 'आपका अगला कदम', risk: 'बाढ़ जोखिम अनुमान', unavailable: 'उपलब्ध नहीं', explore: 'मानचित्र देखें', source: 'स्रोत और समय', updated: 'अपडेट', soil: 'ऊपरी मिट्टी की नमी', nextRain: 'अगले 24 घंटे वर्षा', guidance: 'यह सांकेतिक आकलन है, प्रमाणित बाढ़ पूर्वानुमान नहीं।', confirm: 'यात्रा से पहले फ़ोन करके सेवा की उपलब्धता की पुष्टि करें।', searching: 'स्थान खोज रहे हैं…', noResults: 'स्थान नहीं मिला। नज़दीकी इलाका आज़माएँ।', location: 'स्थान या निर्देशांक खोजें', safety: 'जानकारी रखें। तैयार रहें।', riskDetail: 'आकलन देखें', data: 'इस जानकारी के बारे में' },
  }[language];

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
    let current = true;
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError('');
      try { const places = await searchPlaces(query.trim()); if (current) setResults(places.slice(0, 6)); }
      catch (error) { if (current) { setSearchError(error instanceof Error ? error.message : translate.current('home.searchFailed')); setResults([]); } }
      finally { if (current) setSearching(false); }
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);

  const choose = (place: GeocodingResult) => { onSelectLocation?.({ name: place.displayName, lat: place.latitude, lon: place.longitude }); setQuery(''); setOpenSearch(false); };
  const searchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setOpenSearch(false);
    if (event.key !== 'Enter') return;
    const match = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match && Math.abs(+match[1]) <= 90 && Math.abs(+match[2]) <= 180) {
      choose({ latitude: +match[1], longitude: +match[2], displayName: `Coordinates (${Math.abs(+match[1]).toFixed(4)}°${+match[1] >= 0 ? 'N' : 'S'}, ${Math.abs(+match[2]).toFixed(4)}°${+match[2] >= 0 ? 'E' : 'W'})` });
    } else if (results[0]) choose(results[0]);
  };
  const risk = riskAssessment && typeof riskAssessment.overallRiskLevel === 'string' && riskAssessment.explanation ? riskAssessment : null;
  const warnings = alertFeed?.officialAlerts || [];
  const checked = !!alertFeed && !alertsError && !alertsLoading && ['LIVE_VERIFIED', 'EMPTY'].includes(alertFeed.feedStatus);
  const cachedWarnings = !!alertFeed && !alertsError && !alertsLoading && alertFeed.feedStatus === 'CACHED';
  const hours = forecast?.hourly?.slice(0, 24) || [];
  const chartData = hours.map((hour) => ({ time: time(hour.time), rain: hour.precipitationMm, temperature: hour.temperatureC }));
  const rainy = !!weather && (weather.precipitationMm > 0 || weather.weatherCode >= 51);
  const city = location.name.split(',')[0].replace(/ Metropolitan Region| Coastal Basin| Urban/g, '');
  const actions = [
    { tab: 'weather' as const, title: t('home.card1Title'), detail: labels.outlook, icon: CloudRain },
    { tab: 'saferoute' as const, title: t('home.card2Title'), detail: 'Compare routes & hazards', icon: Navigation2 },
    { tab: 'facilities' as const, title: t('home.card3Title'), detail: 'Hospitals & emergency services', icon: Building2 },
    { tab: 'research' as const, title: t('home.card4Title'), detail: 'Explore a wider perspective', icon: Globe },
  ];
  return (
    <div className="weather-workspace">
      <header className="workspace-heading">
        <div><p className="workspace-eyebrow"><span />{labels.eyebrow}</p><h1>{operational ? labels.overview : labels.title}</h1><p className="workspace-subtitle">{labels.subtitle}</p></div>
        <div className="workspace-heading-actions">{headerAction}{onSelectTab && <button className="workspace-button" onClick={() => onSelectTab('map')}>{labels.map}<ArrowUpRight size={16} /></button>}</div>
      </header>

      {<div className="location-toolbar">
        <div className="location-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpenSearch(false); }}>
          <Search size={17} /><input aria-label={labels.location} placeholder={t('home.searchPlaceholder')} value={query} onChange={(event) => { setQuery(event.target.value); setOpenSearch(true); }} onFocus={() => setOpenSearch(true)} onKeyDown={searchKey} aria-expanded={openSearch && query.length >= 2} aria-controls="workspace-place-results" />
          {query && <button aria-label={t('home.searchClear')} onClick={() => setQuery('')}><X size={15} /></button>}
          {onRequestLocation && <button aria-label={t('home.useLocationBtn')} title={t('home.useLocationBtn')} onClick={onRequestLocation}><LocateFixed size={17} /></button>}
          {openSearch && query.length >= 2 && <div id="workspace-place-results" className="location-results" role="listbox" aria-label={labels.location}>
            {searching ? <p role="status">{labels.searching}</p> : searchError ? <p role="alert">{searchError}</p> : results.length ? results.map((place) => <button key={`${place.latitude},${place.longitude}`} role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(place)}><MapPin size={15} />{place.displayName}<ChevronRight size={14} /></button>) : <p>{labels.noResults}</p>}
          </div>}
        </div>
        <div className="city-presets" aria-label="City presets">{cities.map((place) => <button key={place.name} aria-pressed={Math.abs(place.lat - location.lat) < .02 && Math.abs(place.lon - location.lon) < .02} onClick={() => onSelectLocation?.(place)}>{place.name}</button>)}</div>
      </div>}

      <section className={`official-note ${warnings.length ? 'official-note-warning' : !checked ? 'official-note-unavailable' : ''}`} aria-live="polite">
        {warnings.length ? <AlertTriangle size={18} /> : checked ? <ShieldCheck size={18} /> : <RefreshCw size={17} className={alertsLoading ? 'animate-spin' : ''} />}
        <div><strong>{warnings[0]?.headline || (alertsLoading ? t('header.sync') : checked ? t('home.noActiveWarning') : cachedWarnings ? t('home.cachedWarnings') : t('home.feedUnavailable'))}</strong>
          <p>{warnings[0] ? `${warnings[0].sourceAgency} · ${time(warnings[0].issuedAt)} IST` : checked ? t('home.noActiveWarningNote') : cachedWarnings ? `${t('home.cachedWarningsNote')} ${time(alertFeed?.fetchedAt)} IST` : t('home.feedUnavailableNote')}</p></div>
        {onSelectTab && <button aria-label={t('nav.alerts')} onClick={() => onSelectTab('alerts')}><ArrowUpRight size={18} /></button>}
      </section>

      {error && <div className="workspace-error" role="alert"><AlertTriangle size={18} /><div><strong>{t('weather.unavailableTitle')}</strong><p>{error}</p></div>{onRetry && <button className="workspace-button" onClick={onRetry} disabled={isLoading}>{t('weather.retry')}</button>}</div>}

      <div className="workspace-hero-grid">
        <section className="weather-hero" aria-label={labels.now} aria-busy={isLoading}>
          <div className="weather-hero-top"><span><MapPin size={14} />{city}</span><span>{weather?.isStale ? t('weather.staleNotice') : labels.now}</span></div>
          <div className="weather-hero-main"><div><div className="weather-temperature">{number(weather?.temperatureC)}<span>°</span></div><p className="weather-condition">{weather?.weatherDescription || labels.unavailable}</p><p className="weather-feels">{labels.feels} {number(weather?.apparentTemperatureC)}°C</p></div>
            <div className={`weather-sculpture ${rainy ? 'is-rainy' : ''}`} aria-hidden="true"><div className="weather-sun" /><div className="weather-cloud cloud-back" /><div className="weather-cloud cloud-front" />{rainy && <div className="weather-rain"><i /><i /><i /><i /></div>}</div>
          </div>
          <div className="weather-hero-metrics"><div><Wind size={16} /><span>{labels.wind}</span><strong>{number(weather?.windSpeedKmh)} <small>km/h</small></strong></div><div><Droplets size={16} /><span>{labels.humidity}</span><strong>{number(weather?.relativeHumidityPercent)}<small>%</small></strong></div><div><Gauge size={16} /><span>{labels.pressure}</span><strong>{number(weather?.surfacePressureHpa)} <small>hPa</small></strong></div></div>
          <div className="weather-hero-source">{weather ? <><Badge sourceType={weather.sourceType} /><span>{time(weather.timestamp)} IST</span></> : <span>{labels.unavailable} · Open-Meteo</span>}</div>
        </section>

        <section className="workspace-map" aria-label="Local weather map">
          <TacticalMap center={[location.lon, location.lat]} locationName={location.name} zoom={10} showRadar={false} hideDefaultControls variant="full" className="w-full h-full" />
          <div className="workspace-map-caption"><span className="map-caption-dot" />{city}<span className="font-telemetry">{location.lat.toFixed(2)}° N · {location.lon.toFixed(2)}° E</span></div>
          <div className="workspace-map-bottom"><div><span className="workspace-eyebrow">A LOCAL PERSPECTIVE</span><h2>{labels.explore}</h2></div>{onSelectTab && <button className="workspace-round-button" aria-label={labels.map} onClick={() => onSelectTab('map')}><ArrowUpRight size={22} /></button>}</div>
        </section>
      </div>

      <div className="workspace-detail-grid">
        <section className="workspace-panel forecast-panel">
          <div className="workspace-panel-heading"><div><p className="workspace-eyebrow">FORECAST / 24H</p><h2>{labels.outlook}</h2></div><div className="workspace-segmented"><button aria-pressed={chart === 'rain'} onClick={() => setChart('rain')}>{labels.rain}</button><button aria-pressed={chart === 'temperature'} onClick={() => setChart('temperature')}>{labels.temp}</button></div></div>
          {hours.length ? <><div className="workspace-chart"><ResponsiveContainer width="100%" height="100%">
            {chart === 'rain' ? <BarChart data={chartData} margin={{ top: 14, right: 8, left: -25, bottom: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={34} tick={{ fontSize: 11 }} /><YAxis unit="" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: '#edf3f6' }} formatter={(value: number) => [`${value} mm`, labels.rain]} /><Bar dataKey="rain" fill="#83AABD" radius={[4,4,0,0]} maxBarSize={20} /></BarChart> : <AreaChart data={chartData} margin={{ top: 14, right: 8, left: -25, bottom: 0 }}><defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4D968F" stopOpacity={.22} /><stop offset="100%" stopColor="#4D968F" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={34} tick={{ fontSize:11 }} /><YAxis domain={['auto','auto']} tickLine={false} axisLine={false} tick={{ fontSize:11 }} /><Tooltip formatter={(value:number) => [`${value} °C`, labels.temp]} /><Area type="monotone" dataKey="temperature" stroke="#317E78" strokeWidth={2} fill={`url(#${chartId})`} /></AreaChart>}
          </ResponsiveContainer></div><div className="chart-caption"><span><i />{chart === 'rain' ? `${labels.rain} (mm)` : `${labels.temp} (°C)`}</span><span>Open-Meteo · IST</span></div></> : <div className="workspace-empty"><Cloud size={27} /><span>{isLoading ? t('header.sync') : labels.unavailable}</span></div>}
        </section>

        <section className="workspace-panel readiness-panel"><div className="workspace-panel-heading"><div><p className="workspace-eyebrow">AWARENESS / PREPAREDNESS</p><h2>{risk ? labels.risk : labels.safety}</h2></div><ShieldCheck size={22} /></div>
          {risk ? <><div className={`risk-level risk-${risk.overallRiskLevel.toLowerCase()}`}><span />{risk.overallRiskLevel.toLowerCase()}</div><p className="readiness-description">{risk.explanation.summary}</p><p className="readiness-caveat">{labels.guidance}</p>{onSelectTab && <button className="workspace-text-button" onClick={() => onSelectTab('risk')}>{labels.riskDetail}<ArrowUpRight size={15} /></button>}</> : <><p className="readiness-description">{warnings[0]?.recommendedActions?.[0] || labels.confirm}</p><div className="readiness-links"><button onClick={() => onSelectTab?.('saferoute')}><Navigation2 size={17} />{t('home.card2Title')}<ChevronRight size={16} /></button><button onClick={() => onSelectTab?.('preparedness')}><ShieldCheck size={17} />{t('nav.preparedness')}<ChevronRight size={16} /></button></div></>}
          <div className="readiness-stat"><span>{labels.nextRain}</span><strong>{number(forecast?.accumulations.next24hRainfallMm,1)} <small>mm</small></strong></div>
        </section>
      </div>

      <section className="workspace-panel hourly-panel"><div className="workspace-panel-heading"><h2>{labels.hourly}</h2><span>IST · °C</span></div><div className="hourly-strip">{hours.length ? hours.filter((_,index) => index % 3 === 0).map((hour,index) => <div key={hour.time} className={index === 0 ? 'hourly-current' : ''}><span>{time(hour.time)}</span><WeatherConditionIcon code={hour.weatherCode} precipitation={hour.precipitationMm} date={new Date(hour.time)} latitude={location.lat} longitude={location.lon} /><strong>{number(hour.temperatureC)}°</strong><small>{number(hour.precipitationProbabilityPercent)}% <Droplets size={10} /></small></div>) : <p className="text-sm text-jatayu-muted">{labels.unavailable}</p>}</div></section>

      {operational && <section className="telemetry-row" aria-label="Supporting weather measurements"><div><CloudRain size={18} /><span>{t('weather.precipitationRate')}</span><strong>{number(weather?.precipitationMm,1)} <small>mm</small></strong></div><div><Wind size={18} /><span>{t('weather.windVelocity')}</span><strong>{number(weather?.windSpeedKmh)} / {number(weather?.windGustsKmh)} <small>km/h</small></strong></div><div><Droplets size={18} /><span>{t('weather.soilMoisture')}</span><strong>{weather?.soilMoisture0To7cm === undefined ? '—' : `${number(weather.soilMoisture0To7cm * 100,1)}%`}</strong></div></section>}

      {onSelectTab && <section className="workspace-actions" aria-label={labels.next}>{actions.map(({ tab,title,detail,icon:Icon }) => <button key={tab} onClick={() => onSelectTab(tab)}><span className="action-icon"><Icon size={19} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={16} /></button>)}</section>}

      <footer className="workspace-footer"><span>JATAYU <i />{labels.source}: Open-Meteo{alertFeed?.source ? ` · ${alertFeed.source}` : ''}</span><span>{labels.updated} {time(weather?.fetchedAt)} IST</span></footer>
      <details className="workspace-disclosure"><summary>{labels.data}</summary><p>JATAYU provides indicative situational screening and aggregates official alerts from authoritative meteorological agencies to support early awareness and civilian preparedness.</p><p><strong>Data Trust Architecture:</strong> Official alerts, indicative heuristics, and experimental research simulations are strictly segregated.</p><div><span>Authoritative Ingestion</span><span>Transparent Hazard Screening</span><span>Actionable Public Guidance</span></div>{weather && <p>{weather.sourceAttribution}</p>}</details>
    </div>
  );
};
