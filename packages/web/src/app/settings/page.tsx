"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { useTheme } from "@/components/theme-provider";
import { Save, Sun, Moon, Droplets, MapPin, SlidersHorizontal, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [address, setAddress] = useState("");
  const [scrapeInterval, setScrapeInterval] = useState("24");
  const [retention, setRetention] = useState("90");
  const [scheduledScrapeEnabled, setScheduledScrapeEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scrapingLocations, setScrapingLocations] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.address) setAddress(s.address);
        if (s.scrapeIntervalHours) setScrapeInterval(String(s.scrapeIntervalHours));
        if (s.priceRetentionDays) setRetention(String(s.priceRetentionDays));
        setScheduledScrapeEnabled(String(s.scheduledScrapeEnabled) === "true");
      })
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        scrapeIntervalHours: parseInt(scrapeInterval, 10),
        priceRetentionDays: parseInt(retention, 10),
        scheduledScrapeEnabled,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={language === "lt" ? "default" : "outline"}
              onClick={() => setLanguage("lt")}
              className="flex-1"
            >
              🇱🇹 Lietuvių
            </Button>
            <Button
              variant={language === "en" ? "default" : "outline"}
              onClick={() => setLanguage("en")}
              className="flex-1"
            >
              🇬🇧 English
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.theme")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="gap-2"
            >
              <Sun className="h-4 w-4" />
              {t("settings.light")}
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => setTheme("dark")}
              className="gap-2"
            >
              <Moon className="h-4 w-4" />
              {t("settings.dark")}
            </Button>
            <Button
              variant={theme === "saltibarscia" ? "default" : "outline"}
              onClick={() => setTheme("saltibarscia")}
              className="gap-2"
            >
              <Droplets className="h-4 w-4" />
              {t("settings.saltibarscia")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.address")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder={t("settings.addressPlaceholder")}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Used for calculating nearest stores. Will be geocoded automatically.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              setScrapingLocations(true);
              try {
                await fetch("/api/stores/scrape-locations", { method: "POST" });
              } catch {}
              setScrapingLocations(false);
            }}
            disabled={scrapingLocations}
            className="w-full gap-2 mt-3"
          >
            <MapPin className={`h-4 w-4 ${scrapingLocations ? "animate-pulse" : ""}`} />
            {scrapingLocations ? "Importing store locations..." : "Import store locations from web"}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled scraping toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "lt" ? "Automatinis kainavimas" : "Scheduled Scraping"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {language === "lt"
                ? "Automatiškai atnaujinti kainas pagal intervalą"
                : "Automatically update prices on the configured interval"}
            </p>
            <Button
              variant={scheduledScrapeEnabled ? "default" : "outline"}
              onClick={() => setScheduledScrapeEnabled(!scheduledScrapeEnabled)}
              className="ml-4 shrink-0"
            >
              {scheduledScrapeEnabled
                ? (language === "lt" ? "Įjungta" : "Enabled")
                : (language === "lt" ? "Išjungta" : "Disabled")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scrape interval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.scrapeInterval")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={scrapeInterval} onValueChange={setScrapeInterval}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">{t("settings.everyNHours").replace("{hours}", "6")}</SelectItem>
              <SelectItem value="12">{t("settings.everyNHours").replace("{hours}", "12")}</SelectItem>
              <SelectItem value="24">{t("settings.everyNHours").replace("{hours}", "24")}</SelectItem>
              <SelectItem value="48">{t("settings.everyNHours").replace("{hours}", "48")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Price retention */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.priceRetention")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={retention} onValueChange={setRetention}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 {t("settings.days")}</SelectItem>
              <SelectItem value="60">60 {t("settings.days")}</SelectItem>
              <SelectItem value="90">90 {t("settings.days")}</SelectItem>
              <SelectItem value="180">180 {t("settings.days")}</SelectItem>
              <SelectItem value="365">365 {t("settings.days")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Advanced Settings link */}
      <Link href="/advanced-settings">
        <Card className="hover:border-primary/60 transition-colors cursor-pointer">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {language === "lt" ? "Išplėstiniai nustatymai" : "Advanced Settings"}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === "lt"
                  ? "Duomenų apdorojimas, vietinis praturtinimas, įrankiai"
                  : "Data processing, local enrichment, tools"}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      </Link>

      {/* Save */}
      <Button onClick={saveSettings} className="w-full gap-2" size="lg">
        <Save className="h-5 w-5" />
        {saved ? `✓ ${t("settings.saved")}` : t("common.save")}
      </Button>
    </div>
  );
}
