"use client";

import { useState, useEffect } from "react";
import { useI18n } from "./i18n-provider";

export function useConsent(): boolean {
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("krepza_ad_consent");
    setConsent(stored === "1");
  }, []);
  return consent;
}

export function ConsentBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("krepza_ad_consent");
    if (stored === null) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("krepza_ad_consent", "1");
    setVisible(false);
    window.location.reload();
  };

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-card p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-lg">
      <p className="text-sm text-muted-foreground flex-1">
        {t("ads.consentText")}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={accept}
          className="text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
        >
          {t("ads.consentAccept")}
        </button>
      </div>
    </div>
  );
}
