import React from 'react';
import { DataSourceType } from '../../types';
import { Badge } from './Badge';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  sourceType?: DataSourceType;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  sourceType,
  trend,
  icon,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded p-4 shadow-subtle flex flex-col justify-between">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-mono">
          {label}
        </span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1 my-1">
        <span className="text-2xl font-bold font-mono tracking-tight text-navy-900">
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-500 font-medium">{unit}</span>}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
        {subtext ? (
          <span className="text-slate-500 truncate max-w-[180px]">{subtext}</span>
        ) : trend ? (
          <span
            className={`font-mono text-xs ${
              trend.isNeutral
                ? 'text-slate-600'
                : trend.isPositive
                ? 'text-emerald-700'
                : 'text-amber-700'
            }`}
          >
            {trend.value}
          </span>
        ) : (
          <span className="text-slate-400 font-mono text-[11px]">METRIC IDLE</span>
        )}

        {sourceType && <Badge sourceType={sourceType} size="sm" />}
      </div>
    </div>
  );
};
