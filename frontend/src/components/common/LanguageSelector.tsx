import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { SupportedLanguage } from '../../i18n/types';

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ className = '' }) => {
  const { language, setLanguage, supportedLanguages, t } = useLanguage();

  return (
    <div
      className={`flex items-center gap-1.5 bg-charcoal/80 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-jatayu-primary hover:border-emerald-500/40 transition-colors shadow-xs ${className}`}
      title={t('topbar.language')}
    >
      <Languages className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <span className="font-mono text-jatayu-secondary font-semibold uppercase text-[10px] hidden 2xl:inline">
        {t('topbar.language')}:
      </span>
      <select
        data-testid="language-select"
        aria-label={t('topbar.language')}
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        className="bg-transparent font-medium text-jatayu-primary outline-none cursor-pointer text-xs"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-charcoal text-jatayu-primary">
            {lang.nativeLabel} ({lang.code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
};
