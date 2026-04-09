"use client";

import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <div className="flex gap-1">
      <Button
        variant={language === "lt" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("lt")}
      >
        LT
      </Button>
      <Button
        variant={language === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
    </div>
  );
}
