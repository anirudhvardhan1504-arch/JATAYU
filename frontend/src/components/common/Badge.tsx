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
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (sourceType) {
    switch (sourceType) {
      case 'OBSERVED':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-teal-300 bg-teal-50 text-teal-800 ${sizeClasses}`}
            title="Actual observed telemetry from ground station or verified radar"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5"></span>
            {children || 'LIVE OBSERVED'}
          </span>
        );
      case 'OFFICIAL_FORECAST':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-blue-300 bg-blue-50 text-blue-800 ${sizeClasses}`}
            title="Official numerical prediction from meteorological agency"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
            {children || 'OFFICIAL FORECAST'}
          </span>
        );
      case 'INDICATIVE_MODEL':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-amber-300 bg-amber-50 text-amber-900 ${sizeClasses}`}
            title="Calculated indicative risk metric — not a validated hydraulic forecast"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
            {children || 'INDICATIVE MODEL'}
          </span>
        );
      case 'DEMO_DATA':
        return (
          <span
            className={`inline-flex items-center font-medium font-mono uppercase tracking-wider rounded border border-slate-300 bg-slate-100 text-slate-700 ${sizeClasses}`}
            title="Synthetic offline simulation data for testing and drills"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            {children || 'DEMO / SIMULATION'}
          </span>
        );
    }
  }

  const colorMap = {
    crimson: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    cyan: 'border-sky-200 bg-sky-50 text-sky-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    navy: 'border-navy-700 bg-navy-800 text-slate-200',
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
