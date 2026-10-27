import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SupportedLanguage, TranslationKey, SUPPORTED_LANGUAGES } from '../i18n/types';
import { translations } from '../i18n/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const STORAGE_KEY = 'jatayu_preferred_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode; defaultLanguage?: SupportedLanguage }> = ({
  children,
  defaultLanguage,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    if (defaultLanguage && ['en', 'ta', 'hi'].includes(defaultLanguage)) {
      return defaultLanguage;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'ta' || stored === 'hi') {
          return stored;
        }
      }
    } catch {
      // LocalStorage access might be restricted; fallback safely
    }
    return 'en';
  });

  useEffect(() => {
    if (defaultLanguage && ['en', 'ta', 'hi'].includes(defaultLanguage)) {
      setLanguageState(defaultLanguage);
    }
  }, [defaultLanguage]);

  const setLanguage = useCallback((newLang: SupportedLanguage) => {
    if (!['en', 'ta', 'hi'].includes(newLang)) return;
    setLanguageState(newLang);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, newLang);
      }
    } catch {
      // Ignore localStorage write failures
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      // Lookup translation in active language dictionary
      let text = translations[language]?.[key];

      // Missing translation fallback to English
      if (text === undefined) {
        text = translations['en']?.[key];
      }

      // If even English is missing, return raw key
      if (text === undefined) {
        return key;
      }

      // Parameter interpolation (e.g. {location})
      if (params) {
        for (const [paramKey, paramVal] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }
      }

      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback for components rendered outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => {
        let text = translations['en']?.[key] || key;
        if (params) {
          for (const [pKey, pVal] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal));
          }
        }
        return text;
      },
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
};
