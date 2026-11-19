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
    <div className="bento-card p-4 flex flex-col justify-between group hover:border-emerald-500/30 transition-all duration-300">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-jatayu-secondary font-mono">
          {label}
        </span>
        {icon && (
          <div className="text-emerald-400/80 group-hover:text-emerald-300 transition-colors">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 my-1.5">
        <span className="text-2xl font-bold font-mono tracking-tight text-jatayu-primary group-hover:text-white transition-colors">
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-emerald-400 font-medium">{unit}</span>}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-white/5 text-xs">
        {subtext ? (
          <span className="text-jatayu-muted truncate max-w-[180px] font-mono text-[11px]">{subtext}</span>
        ) : trend ? (
          <span
            className={`font-mono text-xs ${
              trend.isNeutral
                ? 'text-slate-400'
                : trend.isPositive
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {trend.value}
          </span>
        ) : (
          <span className="text-slate-500 font-mono text-[11px]">METRIC IDLE</span>
        )}

        {sourceType && <Badge sourceType={sourceType} size="sm" />}
      </div>
    </div>
  );
};
