import React, { useState, useMemo } from 'react';
import {
  CloudRain,
  Wind,
  Gauge,
  AlertTriangle,
  Radio,
  Clock,
  Compass,
  RefreshCw,
  AlertCircle,
  Droplets,
  Thermometer,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MetricCard } from '../components/common/MetricCard';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import { TacticalMap } from '../components/map/TacticalMap';
import { Luxury3DIcon, ArcGauge } from '../components/common/Luxury3DIcon';
import {
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
} from '../types';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { generateTacticalSitrep } from '../utils/sitrepGenerator';
import { SitrepExportModal } from '../components/sitrep/SitrepExportModal';

interface OverviewPageProps {
  location: { name: string; lat: number; lon: number };
  weather: CurrentWeatherObservation | null;
  forecast: WeatherForecastResponse | null;
  riskAssessment: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
  alertsError?: string | null;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  location,
  weather,
  forecast,
  riskAssessment,
  alertFeed = null,
  alertsError = null,
  isLoading,
  error,
  onRetry,
}) => {
  const authContext = React.useContext(AuthContext);
  const user = authContext?.user || null;
  const { t, language } = useLanguage();
  const [isSitrepModalOpen, setIsSitrepModalOpen] = useState(false);

  // Generate tactical SITREP text
  const sitrepContent = useMemo(() => {
    return generateTacticalSitrep({
      location,
      weather,
      forecast,
      riskAssessment,
      alertFeed,
      alertsError,
      weatherError: error,
      language,
      user,
    });
  }, [location, weather, forecast, riskAssessment, alertFeed, alertsError, error, language, user]);

  // Format chart data from forecast hourly (next 24 hours)
  const chartData = (forecast?.hourly || []).slice(0, 24).map((h) => ({
    time: new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    precipitation: h.precipitationMm,
    probability: h.precipitationProbabilityPercent,
    temperature: h.temperatureC,
  }));

  const soilMoistureValue =
    weather?.soilMoisture0To7cm !== undefined
      ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%`
      : forecast?.soilProfile.moisture0To7cm !== undefined
      ? `${(forecast.soilProfile.moisture0To7cm * 100).toFixed(1)}%`
      : 'N/A';

  const saturationTier = forecast?.soilProfile.saturationTier || 'LOW';

  // Calculate risk numeric score for ArcGauge (0-100)
  const riskScore = useMemo(() => {
    if (!riskAssessment) return 25;
    switch (riskAssessment.overallRiskLevel) {
      case 'CRITICAL':
        return 92;
      case 'HIGH':
        return 75;
      case 'ELEVATED':
        return 54;
      case 'GUARDED':
      case 'LOW':
      default:
        return 22;
    }
  }, [riskAssessment]);

  const riskStatusVariant = useMemo<'low' | 'moderate' | 'high' | 'critical'>(() => {
    if (!riskAssessment) return 'low';
    switch (riskAssessment.overallRiskLevel) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'ELEVATED':
        return 'moderate';
      default:
        return 'low';
    }
  }, [riskAssessment]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Sector Telemetry: ${location.name}`}
        subtitle="Audited real-time meteorological observation and verified numerical prediction"
        badge={
          weather ? (
            <div className="flex items-center gap-2">
              <Badge sourceType={weather.sourceType} size="sm">
                {t('weather.liveObservation')}
              </Badge>
              {weather.isStale && (
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                  {t('weather.staleNotice')}
                </span>
              )}
            </div>
          ) : (
            <Badge variant="slate" size="sm">
              {isLoading ? t('weather.fetching') : t('weather.standby')}
            </Badge>
          )
        }
        action={
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            {weather?.timestamp && (
              <div className="text-right font-mono text-[11px] text-jatayu-secondary hidden sm:block">
                <div>OBS TIMESTAMP: <strong className="text-jatayu-primary">{weather.timestamp}</strong></div>
                <div>FETCHED AT: <strong className="text-emerald-400">{new Date(weather.fetchedAt).toLocaleTimeString()}</strong></div>
              </div>
            )}
            <button
              onClick={() => setIsSitrepModalOpen(true)}
              className="px-4 py-2 bg-dark-emerald/70 hover:bg-dark-emerald text-amber-300 border border-amber-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-all cursor-pointer whitespace-nowrap"
              title="Export Tactical Situation Report"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('sitrep.exportBtn')}</span>
            </button>
          </div>
        }
      />

      <SitrepExportModal
        isOpen={isSitrepModalOpen}
        onClose={() => setIsSitrepModalOpen(false)}
        sitrepMarkdown={sitrepContent}
        locationName={location.name}
      />

      {/* Upstream Error Banner */}
      {error && (
        <div className="bg-red-950/50 border border-red-500/40 rounded-2xl p-4 text-xs shadow-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-start gap-2.5 text-red-200">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-mono font-bold uppercase tracking-wider text-[11px] text-red-300">
                {t('weather.unavailableTitle')}
              </div>
              <p className="mt-0.5 text-red-200 leading-relaxed">{error}</p>
              <p className="mt-1 font-mono text-[10px] text-red-400">
                {t('weather.unavailableNotice')}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-semibold rounded-xl flex items-center gap-1.5 self-start sm:self-center flex-shrink-0 transition-all shadow-[0_0_12px_rgba(239,68,68,0.3)] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('weather.retry')}</span>
            </button>
          )}
        </div>
      )}

      {/* Hero Bento Grid Row (Inspired by Reference Images 2 & 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Large Weather & Thermal Hero Tile (7 cols) */}
        <div className="lg:col-span-8 bento-card p-6 flex flex-col justify-between relative overflow-hidden group">
          {/* Ambient Emerald & Warm Atmospheric Radial Glows */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-emerald-500/10 to-transparent blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-radial from-amber-500/5 to-transparent blur-2xl pointer-events-none -ml-16 -mb-16" />

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#00D99A]"></span>
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-jatayu-secondary">
                  Atmospheric Command Core
                </span>
              </div>
              <Badge sourceType={weather?.sourceType || 'OBSERVED'} size="sm" />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 my-6">
              <div className="flex items-center gap-5">
                <Luxury3DIcon
                  type={weather && weather.precipitationMm > 5 ? 'weather-storm' : 'weather-sun-cloud'}
                  size={84}
                />
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl sm:text-6xl font-bold font-mono tracking-tight text-white text-gradient-emerald">
                      {weather ? `${weather.temperatureC}°C` : '--'}
                    </span>
                    <span className="text-sm font-mono text-jatayu-muted">
                      ({weather ? `${((weather.temperatureC * 9) / 5 + 32).toFixed(0)}°F` : '--'})
                    </span>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-jatayu-primary capitalize mt-1">
                    {weather ? weather.weatherDescription : 'Standby for Telemetry'}
                  </p>
                </div>
              </div>

              {/* Arc Gauge for Threat Level */}
              <div className="flex flex-col items-center bg-obsidian/40 border border-white/5 rounded-2xl p-3">
                <ArcGauge
                  value={riskScore}
                  label="Flood Threat"
                  statusText={riskAssessment?.overallRiskLevel || 'GUARDED'}
                  statusVariant={riskStatusVariant}
                  size={130}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar at bottom of Hero */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/5">
            <div className="bg-obsidian/50 rounded-xl p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-jatayu-muted block">Feels Like</span>
              <span className="text-sm font-mono font-bold text-jatayu-primary">
                {weather ? `${weather.apparentTemperatureC}°C` : '--'}
              </span>
            </div>
            <div className="bg-obsidian/50 rounded-xl p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-jatayu-muted block">Humidity</span>
              <span className="text-sm font-mono font-bold text-jatayu-primary">
                {weather ? `${weather.relativeHumidityPercent}%` : '--'}
              </span>
            </div>
            <div className="bg-obsidian/50 rounded-xl p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-jatayu-muted block">Barometer</span>
              <span className="text-sm font-mono font-bold text-jatayu-primary">
                {weather ? `${weather.surfacePressureHpa} hPa` : '--'}
              </span>
            </div>
            <div className="bg-obsidian/50 rounded-xl p-2.5 border border-white/5">
              <span className="text-[10px] font-mono uppercase text-jatayu-muted block">Wind Gusts</span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {weather ? `${weather.windGustsKmh} km/h` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 24-Hour Precipitation Spline Chart Tile (4 cols) */}
        <div className="lg:col-span-4 bento-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold text-jatayu-primary uppercase tracking-wider">
                  24h Precipitation Timeline
                </h3>
              </div>
              <Badge sourceType="OFFICIAL_FORECAST" size="sm" />
            </div>

            <p className="text-xs text-jatayu-secondary mb-3">
              Hourly rainfall rate (mm/h) and rain probability (%) over next 24h.
            </p>

            <div className="h-44 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="emeraldRainGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D99A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00D99A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#637B74' }} interval={4} />
                    <YAxis tick={{ fontSize: 9, fill: '#637B74' }} unit="mm" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-charcoal/95 border border-white/15 text-jatayu-primary p-2.5 rounded-xl shadow-2xl text-xs font-mono space-y-1 backdrop-blur-xl">
                              <div className="font-bold text-emerald-400">{label}</div>
                              <div>Rain Rate: <span className="font-semibold text-white">{data.precipitation} mm/h</span></div>
                              <div>Probability: <span className="text-mint">{data.probability}%</span></div>
                              <div>Temp: <span className="text-jatayu-secondary">{data.temperature}°C</span></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="precipitation"
                      stroke="#00D99A"
                      fill="url(#emeraldRainGrad)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-jatayu-muted font-mono gap-2">
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>FETCHING METEOROLOGICAL DATA...</span>
                    </>
                  ) : (
                    <span>NO FORECAST TIMELINE DATA</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-jatayu-muted">
            <span>Attribution:</span>
            <span className="font-bold text-emerald-400 truncate max-w-[190px]" title={forecast?.dataSource?.provider || 'Open-Meteo ECMWF'}>
              {forecast?.dataSource?.provider || 'Open-Meteo ECMWF'}
            </span>
          </div>
        </div>
      </div>

      {/* Top Telemetry KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('weather.precipitationRate')}
          value={weather ? weather.precipitationMm : '--'}
          unit={weather ? weather.units.precipitation : 'mm/h'}
          subtext={
            weather
              ? `${weather.weatherDescription}${weather.showersMm > 0 ? ` (Showers: ${weather.showersMm} mm)` : ''}`
              : isLoading
              ? t('weather.querying')
              : 'Data unavailable'
          }
          sourceType={weather?.sourceType}
          icon={<CloudRain className="w-4 h-4 text-emerald-400" />}
        />

        <MetricCard
          label={t('weather.projectedRain24h')}
          value={forecast ? forecast.accumulations.next24hRainfallMm : '--'}
          unit="mm"
          subtext={
            forecast
              ? `${t('weather.past24hObs')}: ${forecast.accumulations.past24hRainfallMm} mm`
              : t('weather.accumulationModel')
          }
          sourceType="OFFICIAL_FORECAST"
          icon={<Clock className="w-4 h-4 text-mint" />}
        />

        <MetricCard
          label={t('weather.windVelocity')}
          value={weather ? weather.windSpeedKmh : '--'}
          unit={weather ? weather.units.windSpeed : 'km/h'}
          subtext={
            weather
              ? `Dir: ${weather.windDirectionDegrees}° | Gusts: ${weather.windGustsKmh} km/h`
              : 'Anemometer reading'
          }
          sourceType={weather?.sourceType}
          icon={<Wind className="w-4 h-4 text-teal-400" />}
        />

        <MetricCard
          label="Surface Pressure"
          value={weather ? weather.surfacePressureHpa : '--'}
          unit={weather ? weather.units.surfacePressure : 'hPa'}
          subtext={
            weather
              ? `Ambient: ${weather.temperatureC}°C (Feels: ${weather.apparentTemperatureC}°C)`
              : 'Barometric sensor'
          }
          sourceType={weather?.sourceType}
          icon={<Gauge className="w-4 h-4 text-indigo-400" />}
        />
      </div>

      {/* Secondary Row: Soil Moisture & Environmental Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-jatayu-secondary">
                {t('weather.soilMoisture')}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-jatayu-primary">{soilMoistureValue}</span>
                <span className="text-xs font-mono text-jatayu-muted">volumetric</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase ${
                saturationTier === 'SATURATED'
                  ? 'bg-red-950/80 text-red-300 border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                  : saturationTier === 'HIGH'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.25)]'
              }`}
            >
              {saturationTier}
            </span>
          </div>
        </div>

        <div className="bento-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-jatayu-secondary">
                Thermal & Humidity State
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-jatayu-primary">
                  {weather ? `${weather.temperatureC}°C` : '--'}
                </span>
                <span className="text-xs font-mono text-jatayu-muted">
                  RH: {weather ? `${weather.relativeHumidityPercent}%` : '--'}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="cyan" size="sm">NWP ANALYSIS</Badge>
        </div>

        <div className="bento-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-dark-emerald/70 border border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(0,217,154,0.2)]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-jatayu-secondary">
                72h Extended Accumulation
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-jatayu-primary">
                  {forecast ? forecast.accumulations.next72hRainfallMm : '--'}
                </span>
                <span className="text-xs font-mono text-jatayu-muted">mm cumulative</span>
              </div>
            </div>
          </div>
          <Badge sourceType="OFFICIAL_FORECAST" size="sm" />
        </div>
      </div>

      {/* Geospatial Tactical Map Preview */}
      <div className="bento-card p-5 flex flex-col">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-jatayu-primary tracking-tight">
              Sector Cartography & Radar Baseline
            </h3>
          </div>
          <Badge variant="navy" size="sm">
            LAT: {location.lat.toFixed(4)}° | LON: {location.lon.toFixed(4)}°
          </Badge>
        </div>

        <div className="flex-1 min-h-[380px] rounded-xl overflow-hidden border border-white/10">
          <TacticalMap
            center={[location.lon, location.lat]}
            locationName={location.name}
            rainfallMm={weather?.precipitationMm ?? 0}
            riskLevel={riskAssessment?.overallRiskLevel ?? 'GUARDED'}
          />
        </div>
      </div>

      {/* Bottom Status Card: Provenance & Attribution */}
      <div className="bento-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-400 mt-0.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-jatayu-primary">
                  Data Provenance & Validation Standards
                </h4>
                <Badge sourceType="INDICATIVE_MODEL" size="sm" />
              </div>
              <p className="text-xs text-jatayu-secondary mt-1 max-w-3xl leading-relaxed">
                JATAYU verifies all meteorological inputs directly from server-side numerical models.
                Observed values reflect seamless assimilation from <strong>ECMWF IFS / DWD ICON</strong>.
                Antecedent rainfall accumulations incorporate rolling 24h observations.
                Indicative flood-risk calculations are strictly separated from official meteorological warnings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center font-mono text-xs">
            <span className="text-jatayu-muted uppercase">Status:</span>
            <span
              className={`px-3 py-1 rounded-full font-semibold border ${
                weather
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(0,217,154,0.2)]'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}
            >
              {weather ? 'LIVE STREAM VERIFIED' : 'CONNECTING'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
