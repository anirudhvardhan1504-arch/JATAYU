import React, { useState, useEffect } from 'react';
import { ShieldAlert, Radio, Server } from 'lucide-react';
import { StatusIndicator } from '../common/StatusIndicator';
import { useLanguage } from '../../context/LanguageContext';

interface OperationalStatusBarProps {
  systemStatus?: 'active' | 'warning' | 'standby';
  openRouterConfigured?: boolean;
}

export const OperationalStatusBar: React.FC<OperationalStatusBarProps> = ({
  systemStatus = 'active',
  openRouterConfigured = false,
}) => {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-navy-950 text-slate-300 text-xs border-b border-navy-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
      {/* Left: System state and telemetry */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <StatusIndicator status={systemStatus} />
          <span className="font-mono font-medium text-slate-200 uppercase tracking-wider text-[11px]">
            {t('brand.network')}
          </span>
        </div>

        <div className="h-3 w-px bg-navy-800 hidden sm:block"></div>

        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] hidden sm:flex">
          <Radio className="w-3.5 h-3.5 text-teal-400" />
          <span>{t('header.meteorology')}</span>
        </div>

        <div className="h-3 w-px bg-navy-800 hidden md:block"></div>

        <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] hidden md:flex">
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {openRouterConfigured ? t('header.aiEngineActive') : t('header.aiEngineScaffolding')}
          </span>
        </div>
      </div>

      {/* Right: Clock & Data Provenance Notice */}
      <div className="flex items-center gap-4 font-mono text-[11px]">
        <div className="flex items-center gap-1 text-amber-300/90 hidden lg:flex bg-amber-950/40 px-2 py-0.5 border border-amber-900/60 rounded">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>{t('header.disclaimer')}</span>
        </div>

        <span className="text-slate-300 font-medium tracking-tight">
          {currentTime || t('header.sync')}
        </span>
      </div>
    </div>
  );
};
