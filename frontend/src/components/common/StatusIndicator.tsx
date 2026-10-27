import React from 'react';

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'critical' | 'standby';
  label?: string;
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  pulse = true,
}) => {
  const styles = {
    active: 'bg-emerald-500 text-emerald-800',
    warning: 'bg-amber-500 text-amber-800',
    critical: 'bg-red-600 text-red-800',
    standby: 'bg-slate-400 text-slate-700',
  };

  const dotColor = {
    active: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-600',
    standby: 'bg-slate-400',
  }[status];

  return (
    <div className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && status !== 'standby' && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
          ></span>
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
      </span>
      {label && (
        <span className={`text-xs font-mono tracking-wider uppercase font-medium ${styles[status].split(' ')[1]}`}>
          {label}
        </span>
      )}
    </div>
  );
};
