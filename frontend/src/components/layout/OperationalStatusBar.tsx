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
    <div className="bg-obsidian/90 backdrop-blur-md text-jatayu-secondary text-xs border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Left: System state and telemetry */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <StatusIndicator status={systemStatus} />
          <span className="font-mono font-medium text-jatayu-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#00D99A]"></span>
            {t('brand.network')}
          </span>
        </div>

        <div className="h-3 w-px bg-white/10 hidden sm:block"></div>

        <div className="flex items-center gap-1.5 text-jatayu-secondary font-mono text-[11px] hidden sm:flex">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('header.meteorology')}</span>
        </div>

        <div className="h-3 w-px bg-white/10 hidden md:block"></div>

        <div className="flex items-center gap-1.5 text-jatayu-secondary font-mono text-[11px] hidden md:flex">
          <Server className="w-3.5 h-3.5 text-mint" />
          <span>
            {openRouterConfigured ? t('header.aiEngineActive') : t('header.aiEngineScaffolding')}
          </span>
        </div>
      </div>

      {/* Right: Clock & Data Provenance Notice */}
      <div className="flex items-center gap-4 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 text-amber-300 hidden lg:flex bg-amber-950/40 px-2.5 py-0.5 border border-amber-800/60 rounded-full">
          <ShieldAlert className="w-3 h-3 text-amber-400" />
          <span>{t('header.disclaimer')}</span>
        </div>

        <span className="text-emerald-400/90 font-medium tracking-tight font-mono">
          {currentTime || t('header.sync')}
        </span>
      </div>
    </div>
  );
};
