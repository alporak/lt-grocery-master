"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import ltMessages from "@/messages/lt.json";
import enMessages from "@/messages/en.json";

type Language = "lt" | "en";
type Messages = typeof ltMessages;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
}

const messagesMap: Record<Language, Messages> = {
  lt: ltMessages,
  en: enMessages,
};

const I18nContext = createContext<I18nContextType>({
  language: "lt",
  setLanguage: () => {},
  t: (path) => path,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("lt");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.language === "en" || s.language === "lt") {
          setLanguageState(s.language);
        }
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    }).catch(() => {});
  }, []);

  const t = useCallback(
    (path: string): string => {
      const messages = messagesMap[language];
      const keys = path.split(".");
      let current: unknown = messages;
      for (const key of keys) {
        if (current && typeof current === "object" && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return path;
        }
      }
      return typeof current === "string" ? current : path;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
