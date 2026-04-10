"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Save, RefreshCw, Sun, Moon, Droplets, MapPin, Database, Sparkles, Check, AlertCircle, Loader2 } from "lucide-react";

interface PipelineState {
  status: "idle" | "clearing" | "scraping" | "translating" | "enriching" | "done" | "error";
  trigger?: string;
  startedAt?: string;
  storesTotal?: number;
  storesCompleted?: number;
  productsScraped?: number;
  currentStore?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  updatedAt?: string;
}

const PIPELINE_STEPS = ["clearing", "scraping", "translating", "enriching", "done"] as const;

function isActive(status: string) {
  return ["clearing", "scraping", "translating", "enriching"].includes(status);
}

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const [address, setAddress] = useState("");
  const [scrapeInterval, setScrapeInterval] = useState("24");
  const [retention, setRetention] = useState("90");
  const [saved, setSaved] = useState(false);
  const [scrapingLocations, setScrapingLocations] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineState>({ status: "idle" });
  const [triggering, setTriggering] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (res.ok) {
        const data: PipelineState = await res.json();
        setPipeline(data);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  // Initial load: fetch settings + pipeline status
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.address) setAddress(s.address);
        if (s.scrapeIntervalHours) setScrapeInterval(String(s.scrapeIntervalHours));
        if (s.priceRetentionDays) setRetention(String(s.priceRetentionDays));
      })
      .catch(() => {});

    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  // Poll pipeline status while active
  useEffect(() => {
    if (isActive(pipeline.status)) {
      if (!pollRef.current) {
        pollRef.current = setInterval(fetchPipelineStatus, 3000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pipeline.status, fetchPipelineStatus]);

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

  const rebuildDatabase = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redo-database" }),
      });
      const data = await res.json();
      if (data.success) {
        // Immediately start polling
        await fetchPipelineStatus();
      }
    } catch { /* ignore */ }
    setTriggering(false);
  };

  // Step rendering
  const stepLabels: Record<string, { en: string; lt: string }> = {
    clearing:    { en: "Clearing data",  lt: "Duomenų valymas" },
    scraping:    { en: "Scraping stores", lt: "Parduotuvių nuskaitymas" },
    translating: { en: "Translating",    lt: "Vertimas" },
    enriching:   { en: "Enriching",      lt: "Praturtinimas" },
    done:        { en: "Done",           lt: "Baigta" },
  };

  const stepIndex = PIPELINE_STEPS.indexOf(pipeline.status as typeof PIPELINE_STEPS[number]);
  const pipelineActive = isActive(pipeline.status);
  const pipelineDone = pipeline.status === "done";
  const pipelineError = pipeline.status === "error";
  const showPipeline = pipelineActive || pipelineDone || pipelineError;

  // Elapsed time
  const elapsed = pipeline.startedAt
    ? Math.floor(((pipeline.finishedAt ? new Date(pipeline.finishedAt).getTime() : Date.now()) - new Date(pipeline.startedAt).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed > 0 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : "";

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
        <CardContent>
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

      {/* Full rebuild */}
      <Card className={pipelineActive ? "border-primary" : pipelineError ? "border-destructive" : "border-primary/30"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === "lt" ? "Pilnas duomenų atnaujinimas" : "Full Database Rebuild"}
            {pipelineActive && <Loader2 className="h-4 w-4 animate-spin ml-auto text-primary" />}
            {pipelineDone && <Check className="h-4 w-4 ml-auto text-green-500" />}
            {pipelineError && <AlertCircle className="h-4 w-4 ml-auto text-destructive" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline step progress */}
          {showPipeline && (
            <div className="space-y-3">
              {/* Step indicators */}
              <div className="flex items-center gap-1">
                {PIPELINE_STEPS.map((step, i) => {
                  const isCompleted = pipelineDone || (stepIndex > i);
                  const isCurrent = stepIndex === i && pipelineActive;
                  const isErrorStep = pipelineError && i === 0; // show error at first
                  return (
                    <div key={step} className="flex items-center gap-1 flex-1">
                      <div className={`
                        flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium shrink-0
                        ${isCompleted ? "bg-green-500 text-white" : ""}
                        ${isCurrent ? "bg-primary text-primary-foreground" : ""}
                        ${isErrorStep ? "bg-destructive text-destructive-foreground" : ""}
                        ${!isCompleted && !isCurrent && !isErrorStep ? "bg-muted text-muted-foreground" : ""}
                      `}>
                        {isCompleted ? <Check className="h-3 w-3" /> : isCurrent ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                      </div>
                      <span className={`text-xs truncate ${isCurrent ? "font-semibold" : isCompleted ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                        {language === "lt" ? stepLabels[step]?.lt : stepLabels[step]?.en}
                      </span>
                      {i < PIPELINE_STEPS.length - 1 && <div className={`h-px flex-1 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />}
                    </div>
                  );
                })}
              </div>

              {/* Detail info */}
              <div className="text-sm space-y-1 p-3 rounded-md bg-muted/50">
                {pipeline.status === "scraping" && (
                  <>
                    <p className="font-medium">
                      {pipeline.currentStore
                        ? `${language === "lt" ? "Nuskaitoma" : "Scraping"}: ${pipeline.currentStore}`
                        : (language === "lt" ? "Laukiama pradžios..." : "Waiting to start...")}
                    </p>
                    <p className="text-muted-foreground">
                      {language === "lt" ? "Parduotuvės" : "Stores"}: {pipeline.storesCompleted ?? 0}/{pipeline.storesTotal ?? "?"}
                      {(pipeline.productsScraped ?? 0) > 0 && (
                        <> &middot; {language === "lt" ? "Produktai" : "Products"}: {pipeline.productsScraped?.toLocaleString()}</>
                      )}
                    </p>
                  </>
                )}
                {pipeline.status === "translating" && (
                  <p className="font-medium">{language === "lt" ? "Verčiami produktai..." : "Translating products..."}</p>
                )}
                {pipeline.status === "enriching" && (
                  <p className="font-medium">{language === "lt" ? "Apdorojami duomenys (embedding, kategorijos, grupavimas)..." : "Processing data (embedding, categories, grouping)..."}</p>
                )}
                {pipeline.status === "clearing" && (
                  <p className="font-medium">{language === "lt" ? "Valomi esami duomenys..." : "Clearing existing data..."}</p>
                )}
                {pipelineDone && (
                  <p className="font-medium text-green-600">
                    {language === "lt" ? "Baigta!" : "Complete!"}
                    {(pipeline.productsScraped ?? 0) > 0 && (
                      <> &middot; {pipeline.productsScraped?.toLocaleString()} {language === "lt" ? "produktai" : "products"}</>
                    )}
                  </p>
                )}
                {pipelineError && (
                  <p className="font-medium text-destructive">
                    {language === "lt" ? "Klaida" : "Error"}: {pipeline.error || "Unknown"}
                  </p>
                )}
                {elapsedStr && (
                  <p className="text-xs text-muted-foreground">
                    {language === "lt" ? "Trukmė" : "Elapsed"}: {elapsedStr}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Description + button */}
          {!pipelineActive && (
            <>
              <p className="text-sm text-muted-foreground">
                {language === "lt"
                  ? "Vienas veiksmas: išvalo esamus produktus, paleidžia pilną nuskaitymą ir po to praturtinimą."
                  : "One action: clears current products, runs a full scrape, then starts enrichment."}
              </p>
              <Button
                onClick={rebuildDatabase}
                disabled={triggering}
                className="w-full gap-2"
                size="lg"
              >
                {triggering ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {triggering
                  ? (language === "lt" ? "Paleidžiama..." : "Starting...")
                  : (language === "lt" ? "Perdaryti duomenų bazę" : "Redo Database: Scrape + Enrich")}
              </Button>
            </>
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
