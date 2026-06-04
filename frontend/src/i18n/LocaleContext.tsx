import { createContext, useContext, useMemo, useState } from 'react';
import type { Language } from '../types';
import { getMessages } from './messages';

type LocaleContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: ReturnType<typeof getMessages>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = 'edt.language';

const getInitialLanguage = (): Language => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-HK' || stored === 'en') return stored;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-HK' : 'en';
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'zh-HK' ? 'zh-Hant' : 'en';
    setLanguageState(next);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: getMessages(language),
    }),
    [language],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return context;
}
