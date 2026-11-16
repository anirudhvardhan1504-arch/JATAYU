import React from 'react';
import { Compass, ShieldAlert, ChevronRight, MapPin, Gauge, Droplets, Wind, Thermometer, Activity } from 'lucide-react';
import { CurrentWeatherObservation, WeatherForecastResponse, IndicativeFloodRiskAssessment } from '../../types';

export interface TelemetryDrawerProps {
  location: { name: string; lat: number; lon: number };
  weather?: CurrentWeatherObservation | null;
  forecast?: WeatherForecastResponse | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  location,
  weather,
  forecast,
  riskAssessment,
  isOpen,
  onClose,
  className = '',
}) => {
  if (!isOpen) return null;

  const riskLevel = riskAssessment?.overallRiskLevel ?? 'GUARDED';
  const riskScore = riskAssessment?.riskScore ?? null;

  return (
    <aside
      className={`absolute top-16 right-3 z-30 w-72 sm:w-76 max-h-[calc(100vh-170px)] overflow-y-auto bg-navy-900/95 backdrop-blur-md border border-navy-700/80 rounded-xl p-3 shadow-2xl text-slate-300 font-mono text-xs space-y-2.5 transition-all animate-in fade-in slide-in-from-right duration-200 select-none ${className}`}
      aria-label="Sector Telemetry Drawer"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-navy-800">
        <div className="flex items-center gap-1.5 text-white font-bold text-xs">
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Sector Fix</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-navy-800 transition-colors cursor-pointer"
          title="Close telemetry panel"
          aria-label="Close telemetry panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Coordinates & Location */}
      <div className="bg-navy-950/70 p-2.5 rounded-lg border border-navy-800/80 space-y-1.5">
        <div className="flex items-start gap-1.5">
          <MapPin className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider">TARGET SECTOR</div>
            <div className="font-bold text-white text-xs truncate" title={location.name}>
              {location.name}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1.5 border-t border-navy-800/80 text-[10px]">
          <span className="text-slate-400">COORDINATES:</span>
          <strong className="text-slate-200 font-mono">
            {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
          </strong>
        </div>
      </div>

      {/* Hazard Tier & Risk Score */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-navy-950/60 border border-navy-800">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-slate-400">HAZARD TIER:</span>
        </div>
        <span
          className={`font-bold px-1.5 py-0.2 rounded text-[10px] tracking-wide ${
            riskLevel === 'CRITICAL'
              ? 'bg-red-950 text-red-400 border border-red-800'
              : riskLevel === 'HIGH'
              ? 'bg-orange-950 text-orange-400 border border-orange-800'
              : riskLevel === 'ELEVATED'
              ? 'bg-amber-950 text-amber-400 border border-amber-800'
              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
          }`}
        >
          {riskLevel} {riskScore !== null ? `(${riskScore}/100)` : ''}
        </span>
      </div>

      {/* Real-Time Meteorological Telemetry Grid */}
      <div className="space-y-1 text-[10px] bg-navy-950/40 p-2.5 rounded-lg border border-navy-800/60">
        <div className="flex justify-between items-center py-0.5 border-b border-navy-800/60">
          <span className="text-slate-400 flex items-center gap-1">
            <Droplets className="w-3 h-3 text-sky-400" />
            <span>PRECIP RATE:</span>
          </span>
          <strong className="text-sky-400 font-bold">{weather ? `${weather.precipitationMm} mm/h` : '--'}</strong>
        </div>

        <div className="flex justify-between items-center py-0.5 border-b border-navy-800/60">
          <span className="text-slate-400 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span>TEMPERATURE:</span>
          </span>
          <strong className="text-white">{weather ? `${weather.temperatureC}°C` : '--'}</strong>
        </div>

        <div className="flex justify-between items-center py-0.5 border-b border-navy-800/60">
          <span className="text-slate-400 flex items-center gap-1">
            <Wind className="w-3 h-3 text-teal-400" />
            <span>WIND & GUSTS:</span>
          </span>
          <strong className="text-slate-200">
            {weather ? `${weather.windSpeedKmh} / ${weather.windGustsKmh} km/h` : '--'}
          </strong>
        </div>

        <div className="flex justify-between items-center py-0.5 border-b border-navy-800/60">
          <span className="text-slate-400 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-purple-400" />
            <span>ATM PRESSURE:</span>
          </span>
          <strong className="text-slate-200">{weather ? `${weather.surfacePressureHpa} hPa` : '--'}</strong>
        </div>

        <div className="flex justify-between items-center py-0.5">
          <span className="text-slate-400">SOIL MOISTURE:</span>
          <strong className="text-slate-200">
            {weather?.soilMoisture0To7cm !== undefined
              ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%`
              : forecast?.soilProfile?.moisture0To7cm !== undefined
              ? `${(forecast.soilProfile.moisture0To7cm * 100).toFixed(1)}%`
              : 'UNAVAILABLE'}
          </strong>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-600/40 flex items-start gap-1.5 text-[9px] text-amber-300 leading-tight">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
        <span>Indicative screening assessment only — not a calibrated hydraulic flood model.</span>
      </div>

      {/* Provenance Tag */}
      {weather?.sourceAttribution && (
        <div className="text-[8px] text-slate-500 font-mono text-center pt-0.5 border-t border-navy-800">
          Source: {weather.sourceAttribution} ({weather.sourceType})
        </div>
      )}
    </aside>
  );
};
