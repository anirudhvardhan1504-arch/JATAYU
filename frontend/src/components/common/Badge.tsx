import React from 'react';
import { DataSourceType } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  sourceType?: DataSourceType;
  variant?: 'crimson' | 'amber' | 'emerald' | 'cyan' | 'slate' | 'navy';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  sourceType,
  variant,
  size = 'sm',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  if (sourceType) {
    switch (sourceType) {
      case 'MODEL_ANALYSIS':
      case 'NUMERICAL_FORECAST':
        return (
          <span className={`inline-flex items-center rounded border border-cyan-500/40 bg-cyan-950/60 text-cyan-200 ${sizeClasses}`}
            title="Model-derived weather data from Open-Meteo; not an official warning or station measurement">
            {sourceType === 'MODEL_ANALYSIS' ? 'Model-derived conditions' : 'Numerical forecast'}
          </span>
        );
      case 'OBSERVED':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(0,217,154,0.15)] ${sizeClasses}`}
            title="Actual observed telemetry from ground station or verified radar"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse shadow-[0_0_6px_#00D99A]"></span>
            {children || 'LIVE OBSERVED'}
          </span>
        );
      case 'OFFICIAL_FORECAST':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-cyan-500/40 bg-cyan-950/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)] ${sizeClasses}`}
            title="Official numerical prediction from meteorological agency"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5"></span>
            {children || 'OFFICIAL FORECAST'}
          </span>
        );
      case 'INDICATIVE_MODEL':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)] ${sizeClasses}`}
            title="Calculated indicative risk metric — not a validated hydraulic forecast"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
            {children || 'INDICATIVE MODEL'}
          </span>
        );
      case 'DEMO_DATA':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-slate-600 bg-slate-900/80 text-slate-400 ${sizeClasses}`}
            title="Synthetic offline simulation data for testing and drills"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
            {children || 'DEMO / SIMULATION'}
          </span>
        );
    }
  }

  const colorMap = {
    crimson: 'border-red-500/40 bg-red-950/60 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
    amber: 'border-amber-500/40 bg-amber-950/60 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    emerald: 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300 shadow-[0_0_8px_rgba(0,217,154,0.2)]',
    cyan: 'border-cyan-500/40 bg-cyan-950/60 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]',
    slate: 'border-white/10 bg-white/5 text-jatayu-secondary',
    navy: 'border-emerald-900/60 bg-dark-emerald/50 text-emerald-200',
  };

  const selectedClass = variant ? colorMap[variant] : colorMap.slate;

  return (
    <span
      className={`inline-flex items-center font-medium font-mono tracking-wide rounded border ${selectedClass} ${sizeClasses}`}
    >
      {children}
    </span>
  );
};
