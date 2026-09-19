import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  LOCALE_OPTIONS,
  SUPPORTED_LOCALES,
  persistLocalePreference,
  readLocalePreference,
  translate,
} from '../lib/publicLocale';

const LocaleContext = createContext(null);

export function LocaleProvider({ active = true, children }) {
  const [locale, setLocaleState] = useState(() => readLocalePreference(
    typeof window === 'undefined' ? null : window.localStorage,
    typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
  ));

  const setLocale = useCallback((nextLocale) => {
    if (!SUPPORTED_LOCALES.includes(nextLocale)) return;
    setLocaleState(nextLocale);
    persistLocalePreference(typeof window === 'undefined' ? null : window.localStorage, nextLocale);
  }, []);

  const effectiveLocale = active ? locale : 'pt-BR';

  useEffect(() => {
    document.documentElement.lang = effectiveLocale;
  }, [effectiveLocale]);

  const value = useMemo(() => ({
    locale: effectiveLocale,
    localeOptions: LOCALE_OPTIONS,
    setLocale,
    t: (text) => translate(effectiveLocale, text),
  }), [effectiveLocale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside LocaleProvider');
  return value;
}
