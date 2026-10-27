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
      className={`flex items-center gap-1.5 bg-warm-200/80 border border-slate-300 rounded px-2 py-1 text-xs text-navy-900 ${className}`}
      title={t('topbar.language')}
    >
      <Languages className="w-3.5 h-3.5 text-navy-700 flex-shrink-0" />
      <span className="font-mono text-slate-500 font-semibold uppercase text-[10px] hidden sm:inline">
        {t('topbar.language')}:
      </span>
      <select
        data-testid="language-select"
        aria-label={t('topbar.language')}
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        className="bg-transparent font-medium text-navy-900 outline-none cursor-pointer text-xs"
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-white text-navy-900">
            {lang.nativeLabel} ({lang.code.toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
};
