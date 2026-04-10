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
import { Save, RefreshCw, Sun, Moon, Droplets, MapPin, Globe, Trash2, Sparkles, AlertTriangle, Cpu } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [address, setAddress] = useState("");
  const [scrapeInterval, setScrapeInterval] = useState("24");
  const [retention, setRetention] = useState("90");
  const [saved, setSaved] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapingLocations, setScrapingLocations] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichConfirm, setEnrichConfirm] = useState(false);
  const [enrichResult, setEnrichResult] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.address) setAddress(s.address);
        if (s.scrapeIntervalHours) setScrapeInterval(String(s.scrapeIntervalHours));
        if (s.priceRetentionDays) setRetention(String(s.priceRetentionDays));
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
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const triggerScrape = async () => {
    setScraping(true);
    // This will be handled by the scraper service; for now we just update the last scrape request
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrapeRequested: new Date().toISOString() }),
    });
    setTimeout(() => setScraping(false), 3000);
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

      {/* Scrape interval */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.scrapeInterval")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={scrapeInterval} onValueChange={setScrapeInterval}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">
                {t("settings.everyNHours").replace("{hours}", "6")}
              </SelectItem>
              <SelectItem value="12">
                {t("settings.everyNHours").replace("{hours}", "12")}
              </SelectItem>
              <SelectItem value="24">
                {t("settings.everyNHours").replace("{hours}", "24")}
              </SelectItem>
              <SelectItem value="48">
                {t("settings.everyNHours").replace("{hours}", "48")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={triggerScrape}
            disabled={scraping}
            className="w-full gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
            {scraping ? t("settings.scraping") : t("settings.scrapeNow")}
          </Button>
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

      {/* Web Scraper */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("scraper.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            {t("scraper.description")}
          </p>
          <Link href="/scraper">
            <Button variant="outline" className="w-full gap-2">
              <Globe className="h-4 w-4" />
              {t("scraper.title")}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* AI / Data Management */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            {language === "lt" ? "Duomenų valdymas" : "Data Management"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reprocess pipeline */}
          <div>
            <Button
              variant="outline"
              onClick={async () => {
                setReprocessing(true);
                setReprocessResult(null);
                try {
                  const res = await fetch("/api/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "reprocess" }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    const r = data.result || {};
                    setReprocessResult(
                      `Embedded: ${r.embed?.embedded ?? 0}, Categorized: ${r.categorize?.categorized ?? 0}, Enriched: ${r.enrich?.enriched ?? "skipped"}`
                    );
                  } else {
                    setReprocessResult(data.error || "Failed");
                  }
                } catch {
                  setReprocessResult("Failed to reach embedder service");
                }
                setReprocessing(false);
              }}
              disabled={reprocessing}
              className="w-full gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${reprocessing ? "animate-spin" : ""}`} />
              {reprocessing
                ? (language === "lt" ? "Apdorojama..." : "Processing...")
                : (language === "lt" ? "Paleisti AI apdorojimo pipeline" : "Run AI Processing Pipeline")}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "lt"
                ? "Sugeneruoja naujus embeddingus, kategorijas ir LLM praturtinimą naujiems produktams."
                : "Generates embeddings, categories, and LLM enrichment for new products."}
            </p>
            {reprocessResult && (
              <p className="text-xs mt-1 p-2 rounded bg-muted">{reprocessResult}</p>
            )}
          </div>

          {/* Enrich ALL with Ollama */}
          <div className="border-t pt-4">
            {!enrichConfirm ? (
              <Button
                variant="outline"
                onClick={() => setEnrichConfirm(true)}
                className="w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {language === "lt" ? "Ollama: praturtinti VISUS produktus" : "Ollama: Enrich ALL Products"}
              </Button>
            ) : (
              <div className="space-y-2 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {language === "lt" ? "Ar tikrai?" : "Are you sure?"}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {language === "lt"
                        ? "Tai istrins visus esamus LLM praturtinimus ir pradės iš naujo. Su ~15k produktų tai gali užtrukti kelias valandas."
                        : "This will clear all existing LLM enrichments and re-process from scratch. With ~15k products this can take several hours."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      setEnrichConfirm(false);
                      setEnrichingAll(true);
                      setEnrichResult(null);
                      try {
                        const res = await fetch("/api/admin", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "enrich-all" }),
                        });
                        const data = await res.json();
                        setEnrichResult(
                          data.success
                            ? `${data.productsCleared} products queued for enrichment. Processing in batches...`
                            : "Failed"
                        );
                      } catch {
                        setEnrichResult("Failed to reach server");
                      }
                      setEnrichingAll(false);
                    }}
                    disabled={enrichingAll}
                    className="gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {enrichingAll
                      ? (language === "lt" ? "Paleidžiama..." : "Starting...")
                      : (language === "lt" ? "Taip, praturtinti visus" : "Yes, enrich all")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEnrichConfirm(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {language === "lt"
                ? "Reikia veikiančio Ollama serviso (docker compose --profile full)."
                : "Requires Ollama service running (docker compose --profile full)."}
            </p>
            {enrichResult && (
              <p className="text-xs mt-1 p-2 rounded bg-muted">{enrichResult}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {language === "lt" ? "Pavojinga zona" : "Danger Zone"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!resetConfirm ? (
            <Button
              variant="outline"
              onClick={() => setResetConfirm(true)}
              className="w-full gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              {language === "lt" ? "Ištrinti visus nuskaitytus duomenis" : "Delete All Scraped Data"}
            </Button>
          ) : (
            <div className="space-y-2 p-3 rounded-md border border-destructive/50 bg-destructive/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {language === "lt"
                      ? "Ar tikrai norite ištrinti VISUS duomenis?"
                      : "Delete ALL scraped data?"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "lt"
                      ? "Bus ištrinta: visi produktai, kainos, nuskaitymo žurnalai, embeddings. Parduotuvės, nustatymai, pirkinių sąrašai, vietos – LIKS."
                      : "Will delete: all products, prices, scrape logs, embeddings. Stores, settings, grocery lists, locations — KEPT."}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    setResetConfirm(false);
                    setResetting(true);
                    setResetResult(null);
                    try {
                      const res = await fetch("/api/admin", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reset" }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        const d = data.deleted;
                        setResetResult(
                          `Deleted ${d.products} products, ${d.priceRecords} prices, ${d.scrapeLogs} logs`
                        );
                      } else {
                        setResetResult("Reset failed");
                      }
                    } catch {
                      setResetResult("Failed to reach server");
                    }
                    setResetting(false);
                  }}
                  disabled={resetting}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  {resetting
                    ? (language === "lt" ? "Trinama..." : "Deleting...")
                    : (language === "lt" ? "Taip, ištrinti viską" : "Yes, delete everything")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetConfirm(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
          {resetResult && (
            <p className="text-xs mt-2 p-2 rounded bg-muted">{resetResult}</p>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={saveSettings} className="w-full gap-2" size="lg">
        <Save className="h-5 w-5" />
        {saved ? `✓ ${t("settings.saved")}` : t("common.save")}
      </Button>
    </div>
  );
}
