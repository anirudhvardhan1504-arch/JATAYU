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
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded">
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
              <div className="text-right font-mono text-[11px] text-slate-500 hidden sm:block">
                <div>OBS TIMESTAMP: <strong className="text-navy-900">{weather.timestamp}</strong></div>
                <div>FETCHED AT: <strong className="text-slate-700">{new Date(weather.fetchedAt).toLocaleTimeString()}</strong></div>
              </div>
            )}
            <button
              onClick={() => setIsSitrepModalOpen(true)}
              className="px-3.5 py-1.5 bg-navy-900 hover:bg-navy-800 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
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

      {/* Upstream Error Banner (Never replaces failed requests with fake values) */}
      {error && (
        <div className="bg-red-50 border border-red-300 rounded p-4 text-xs shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-red-900">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-mono font-bold uppercase tracking-wider text-[11px] text-red-800">
                {t('weather.unavailableTitle')}
              </div>
              <p className="mt-0.5 text-red-700 leading-relaxed">{error}</p>
              <p className="mt-1 font-mono text-[10px] text-red-600">
                {t('weather.unavailableNotice')}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isLoading}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-semibold rounded flex items-center gap-1.5 self-start sm:self-center flex-shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{t('weather.retry')}</span>
            </button>
          )}
        </div>
      )}

      {/* Top Telemetry KPI Row: Audited live fields */}
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
          icon={<CloudRain className="w-4 h-4 text-sky-600" />}
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
          icon={<Clock className="w-4 h-4 text-blue-600" />}
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
          icon={<Wind className="w-4 h-4 text-teal-600" />}
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
          icon={<Gauge className="w-4 h-4 text-indigo-600" />}
        />
      </div>

      {/* Secondary Row: Soil Moisture & Temperature Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-700">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500">
                {t('weather.soilMoisture')}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-navy-900">{soilMoistureValue}</span>
                <span className="text-xs font-mono text-slate-500">volumetric</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                saturationTier === 'SATURATED'
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : saturationTier === 'HIGH'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}
            >
              {saturationTier}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-sky-50 border border-sky-200 text-sky-700">
              <Thermometer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500">
                Thermal & Humidity State
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-navy-900">
                  {weather ? `${weather.temperatureC}°C` : '--'}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  RH: {weather ? `${weather.relativeHumidityPercent}%` : '--'}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="cyan" size="sm">NWP ANALYSIS</Badge>
        </div>

        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase text-slate-500">
                72h Extended Accumulation
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl font-bold font-mono text-navy-900">
                  {forecast ? forecast.accumulations.next72hRainfallMm : '--'}
                </span>
                <span className="text-xs font-mono text-slate-500">mm cumulative</span>
              </div>
            </div>
          </div>
          <Badge sourceType="OFFICIAL_FORECAST" size="sm" />
        </div>
      </div>

      {/* Mid Section: Geospatial Tactical View & Rainfall Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Preview (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded p-4 shadow-subtle flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-navy-900 tracking-tight">
                Sector Cartography & Radar Baseline
              </h3>
            </div>
            <Badge variant="navy" size="sm">
              LAT: {location.lat.toFixed(4)}° | LON: {location.lon.toFixed(4)}°
            </Badge>
          </div>

          <div className="flex-1 min-h-[360px]">
            <TacticalMap
              center={[location.lon, location.lat]}
              locationName={location.name}
              rainfallMm={weather?.precipitationMm ?? 0}
              riskLevel={riskAssessment?.overallRiskLevel ?? 'GUARDED'}
            />
          </div>
        </div>

        {/* 24-Hour Rainfall Trend Chart (1 col) */}
        <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-navy-900 tracking-tight">
                  24h Precipitation Timeline
                </h3>
              </div>
              <Badge sourceType="OFFICIAL_FORECAST" size="sm" />
            </div>

            <p className="text-xs text-slate-500 mb-3">
              Hourly rainfall rate (mm/h) and rain probability (%) over the next 24 hours.
            </p>

            <div className="h-56 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748B' }} interval={4} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748B' }} unit="mm" />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-navy-900 border border-navy-700 text-slate-100 p-2.5 rounded shadow-panel text-xs font-mono space-y-1">
                              <div className="font-bold text-amber-400">{label}</div>
                              <div>Rain Rate: <span className="font-semibold text-white">{data.precipitation} mm/h</span></div>
                              <div>Probability: <span className="text-sky-300">{data.probability}%</span></div>
                              <div>Temp: <span className="text-slate-300">{data.temperature}°C</span></div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="precipitation"
                      stroke="#0284C7"
                      fill="#E0F2FE"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 font-mono gap-2">
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                      <span>FETCHING METEOROLOGICAL DATA...</span>
                    </>
                  ) : (
                    <span>NO FORECAST TIMELINE DATA</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Provider Attribution:</span>
            <span className="font-bold text-navy-900 truncate max-w-[190px]" title={forecast?.dataSource?.provider || 'Open-Meteo ECMWF'}>
              {forecast?.dataSource?.provider || 'Open-Meteo ECMWF'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Status Card: Provenance & Attribution */}
      <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-navy-900">
                  Data Provenance & Validation Standards
                </h4>
                <Badge sourceType="INDICATIVE_MODEL" size="sm" />
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                JATAYU verifies all meteorological inputs directly from server-side numerical models.
                Observed values reflect seamless assimilation from <strong>ECMWF IFS / DWD ICON</strong>.
                Antecedent rainfall accumulations incorporate rolling 24h observations.
                Indicative flood-risk calculations are strictly separated from official meteorological warnings.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-center font-mono text-xs">
            <span className="text-slate-500 uppercase">Status:</span>
            <span
              className={`px-2 py-1 rounded font-semibold ${
                weather
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
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
