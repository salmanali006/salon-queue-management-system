import { createContext, useContext, useMemo, useState } from 'react';
import { translations } from './translations.js';

const Context = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('salon-language') || 'en');
  const value = useMemo(() => ({ language, t: translations[language], toggleLanguage: () => setLanguage(current => { const next = current === 'en' ? 'gu' : 'en'; localStorage.setItem('salon-language', next); return next; }) }), [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLanguage() { return useContext(Context); }
