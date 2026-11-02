import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { en, type Translations } from '../locales/en';
import { ta } from '../locales/ta';
import { dishService } from '../services/dishService';
import { getBusinessName } from '../config/site';

export type Language = 'en' | 'ta';

const LANG_KEY = 'catering_lang';

const locales: Record<Language, Translations> = { en, ta };

interface LanguageContextType {
  lang: Language;
  t: Translations;
  businessName: string;
  setLang: (l: Language) => void;
  /** Return the translated dish name for a dish ID, falling back to the canonical name */
  dishName: (id: string, canonicalName: string) => string;
  /** Return the translated category name, falling back to the canonical name */
  categoryName: (id: string, canonicalName: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANG_KEY);
    return (saved === 'ta' || saved === 'en') ? saved : 'en';
  });

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
    document.documentElement.lang = l;
  }, []);

  // Set initial lang attribute
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }

  const t = locales[lang];
  const businessName = getBusinessName(lang);

  const dishName = useCallback((id: string, canonicalName: string): string => {
    if (lang === 'ta' && id) {
      const customTa = dishService.getCustomTamilName(id);
      if (customTa) return customTa;
    }
    const trimmed = canonicalName?.trim();
    if (trimmed && t.dishTranslationsByEnglishName?.[trimmed]) {
      return t.dishTranslationsByEnglishName[trimmed];
    }
    if (id && t.dishes[id]) return t.dishes[id];
    return canonicalName || (id && t.dishes[id]) || '';
  }, [t, lang]);

  const categoryName = useCallback((id: string, canonicalName: string): string => {
    return t.categories[id] ?? canonicalName;
  }, [t]);

  return (
    <LanguageContext.Provider value={{ lang, t, businessName, setLang, dishName, categoryName }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      lang: 'en',
      t: locales.en,
      businessName: getBusinessName('en'),
      setLang: () => {},
      dishName: (_id, name) => name,
      categoryName: (_id, name) => name,
    };
  }
  return ctx;
}
