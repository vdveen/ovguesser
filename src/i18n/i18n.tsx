import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DICTIONARIES, type Lang, LOCALES, type StringKey } from "./strings";

type Vars = Record<string, string | number>;
interface I18n {
  lang: Lang;
  locale: string;
  setLang: (lang: Lang) => void;
  t: (key: StringKey, vars?: Vars) => string;
  num: (n: number) => string;
}

const STORAGE_KEY = "ovg-lang";
const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "nl" || saved === "en") return saved;
  } catch {}
  return "nl";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<I18n>(() => {
    const dict = DICTIONARIES[lang];
    const locale = LOCALES[lang];
    const nf = new Intl.NumberFormat(locale);
    const num = (n: number) => nf.format(n);
    return {
      lang,
      locale,
      setLang,
      num,
      t: (key, vars) =>
        dict[key].replace(/\{(\w+)\}/g, (_, name: string) => {
          const v = vars?.[name];
          return v === undefined ? `{${name}}` : typeof v === "number" ? num(v) : v;
        }),
    };
  }, [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
