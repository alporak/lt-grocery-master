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
import {
  Check,
  AlertCircle,
  Loader2,
  Languages,
  Brain,
  RotateCcw,
  Cpu,
  Wifi,
  WifiOff,
  Square,
  Globe,
  Tags,
  Sparkles,
  RefreshCw,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";

interface PipelineState {
  status: "idle" | "clearing" | "scraping" | "translating" | "enriching" | "done" | "error";
  trigger?: string;
  startedAt?: string;
  storesTotal?: number;
  storesCompleted?: number;
  productsScraped?: number;
  currentStore?: string | null;
  categoriesTotal?: number;
  categoriesCompleted?: number;
  currentCategory?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  updatedAt?: string;
}

interface OllamaHealthStatus {
  status: string;
  models?: string[];
  error?: string;
}

interface StoreInfo {
  id: number;
  name: string;
  slug: string;
}

const PIPELINE_STEPS = ["clearing", "scraping", "translating", "enriching", "done"] as const;

function isActive(status: string) {
  return ["clearing", "scraping", "translating", "enriching"].includes(status);
}

function OllamaSettings({
  language, ollamaUrl, setOllamaUrl, ollamaModel, setOllamaModel,
  useOllamaForBulk, setUseOllamaForBulk, ollamaStatus, setOllamaStatus,
  testingOllama, setTestingOllama,
}: {
  language: string;
  ollamaUrl: string;
  setOllamaUrl: (v: string) => void;
  ollamaModel: string;
  setOllamaModel: (v: string) => void;
  useOllamaForBulk: boolean;
  setUseOllamaForBulk: (v: boolean) => void;
  ollamaStatus: OllamaHealthStatus | null;
  setOllamaStatus: (v: OllamaHealthStatus | null) => void;
  testingOllama: boolean;
  setTestingOllama: (v: boolean) => void;
}) {
  const modelCountThreshold = 3;

  const testConnection = async () => {
    setTestingOllama(true);
    setOllamaStatus(null);
    try {
      const res = await fetch(`/api/enrichment-stats?ollamaUrl=${encodeURIComponent(ollamaUrl)}`);
      const data = await res.json();
      setOllamaStatus(data.ollamaHealth || { status: "error", error: "No response" });
    } catch {
      setOllamaStatus({ status: "error", error: "Failed to test connection" });
    }
    setTestingOllama(false);
  };

  const hasModels = ollamaStatus?.models && ollamaStatus.models.length !== 0;
  const extraModels = hasModels ? ollamaStatus!.models!.length - modelCountThreshold : 0;

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {language === "lt" ? "Ollama adresas" : "Ollama URL"}
        </label>
        <Input
          placeholder="http://192.168.1.x:11434"
          value={ollamaUrl}
          onChange={(e) => setOllamaUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {language === "lt"
            ? 'Paleiskite "ollama serve" savo Mac ir naudokite vietini IP adresa'
            : 'Run "ollama serve" on your Mac and use its local IP address'}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {language === "lt" ? "Modelis" : "Model"}
        </label>
        <Select value={ollamaModel} onValueChange={setOllamaModel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="llama3.1:8b">
              llama3.1:8b (~8 GB{" \u2014 "}{language === "lt" ? "Groq atitikmuo, greitas" : "Groq-equivalent, fast"})
            </SelectItem>
            <SelectItem value="gemma4:e2b">
              gemma4:e2b (~7 GB{" \u2014 "}{language === "lt" ? "greitas, lengvos užduotys" : "fast, lightweight tasks"})
            </SelectItem>
            <SelectItem value="gemma4:e4b">
              gemma4:e4b (~10 GB{" \u2014 "}{language === "lt" ? "rekomenduojamas" : "recommended"})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <button
        onClick={() => setUseOllamaForBulk(!useOllamaForBulk)}
        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors w-full ${
          useOllamaForBulk ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
        }`}
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
          useOllamaForBulk ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}>
          <Cpu className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {language === "lt" ? "Naudoti masiniam praturtinimui" : "Use for bulk enrichment"}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === "lt"
              ? "Vertimas ir praturtinimas naudos Ollama vietoj Groq"
              : "Translation & enrichment phases will use Ollama instead of Groq"}
          </p>
        </div>
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          useOllamaForBulk ? "border-primary bg-primary" : "border-muted-foreground/30"
        }`}>
          {useOllamaForBulk && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
      </button>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!ollamaUrl || testingOllama}
          onClick={testConnection}
          className="gap-2"
        >
          {testingOllama ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
          {language === "lt" ? "Tikrinti rysi" : "Test Connection"}
        </Button>

        {ollamaStatus && (
          <div className={`flex items-center gap-1.5 text-xs ${
            ollamaStatus.status === "ok" ? "text-green-600" : "text-destructive"
          }`}>
            {ollamaStatus.status === "ok" ? (
              <>
                <Wifi className="h-3 w-3" />
                <span>
                  {language === "lt" ? "Prisijungta" : "Connected"}
                  {hasModels && (
                    <>{" \u2014 "}{ollamaStatus.models!.slice(0, modelCountThreshold).join(", ")}{extraModels >= 1 ? ` +${extraModels}` : ""}</>
                  )}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span>{ollamaStatus.error || (language === "lt" ? "Nepavyko prisijungti" : "Connection failed")}</span>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdvancedSettingsPage() {
  const { language } = useI18n();

  // Ollama state
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
  const [useOllamaForBulk, setUseOllamaForBulk] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaHealthStatus | null>(null);
  const [testingOllama, setTestingOllama] = useState(false);
  const [ollamaSaved, setOllamaSaved] = useState(false);

  // Pipeline state
  const [pipeline, setPipeline] = useState<PipelineState>({ status: "idle" });
  const [triggering, setTriggering] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set());
  const [storeSelectOpen, setStoreSelectOpen] = useState(false);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        if (s.ollamaUrl) setOllamaUrl(s.ollamaUrl);
        if (s.ollamaModel) setOllamaModel(s.ollamaModel);
        if (s.useOllamaForBulk === true) setUseOllamaForBulk(true);
      })
      .catch(() => {});

    fetch("/api/stores")
      .then((r) => r.json())
      .then((data: StoreInfo[]) => {
        setStores(data);
        setSelectedStores(new Set(data.map((s) => s.slug)));
      })
      .catch(() => {});

    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

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

  const saveOllamaSettings = async () => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ollamaUrl, ollamaModel, useOllamaForBulk }),
    });
    setOllamaSaved(true);
    setTimeout(() => setOllamaSaved(false), 2000);
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
      if (data.success) await fetchPipelineStatus();
    } catch { /* ignore */ }
    setTriggering(false);
  };

  const stopAll = async () => {
    setStopping(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop-all" }),
      });
      await fetchPipelineStatus();
    } catch { /* ignore */ }
    setStopping(false);
  };

  const togglePhase = (phase: string) => {
    setSelectedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
        if (phase === "scrape") setStoreSelectOpen(false);
      } else {
        if (phase === "retranslate") next.delete("translate");
        if (phase === "translate") next.delete("retranslate");
        if (phase === "scrape") next.clear();
        else next.delete("scrape");
        next.add(phase);
      }
      return next;
    });
  };

  const toggleStore = (slug: string) => {
    setSelectedStores((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const toggleAllStores = () => {
    if (selectedStores.size === stores.length) {
      setSelectedStores(new Set());
    } else {
      setSelectedStores(new Set(stores.map((s) => s.slug)));
    }
  };

  const runPhases = async () => {
    if (selectedPhases.size === 0) return;
    setTriggering(true);
    try {
      if (selectedPhases.has("scrape")) {
        const slugs = selectedStores.size === stores.length ? [] : [...selectedStores];
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scrape-only", storeSlugs: slugs }),
        });
        const data = await res.json();
        if (data.success) await fetchPipelineStatus();
      } else {
        const res = await fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "run-phases", phases: [...selectedPhases] }),
        });
        const data = await res.json();
        if (data.success) await fetchPipelineStatus();
      }
    } catch { /* ignore */ }
    setTriggering(false);
  };

  const stepLabels: Record<string, { en: string; lt: string }> = {
    clearing:    { en: "Clearing data",   lt: "Duomenų valymas" },
    scraping:    { en: "Scraping stores", lt: "Parduotuvių nuskaitymas" },
    translating: { en: "Translating",     lt: "Vertimas" },
    enriching:   { en: "Enriching",       lt: "Praturtinimas" },
    done:        { en: "Done",            lt: "Baigta" },
  };

  const stepIndex = PIPELINE_STEPS.indexOf(pipeline.status as typeof PIPELINE_STEPS[number]);
  const pipelineActive = isActive(pipeline.status);
  const pipelineDone = pipeline.status === "done";
  const pipelineError = pipeline.status === "error";
  const showPipeline = pipelineActive || pipelineDone || pipelineError;

  const elapsed = pipeline.startedAt
    ? Math.floor(((pipeline.finishedAt ? new Date(pipeline.finishedAt).getTime() : Date.now()) - new Date(pipeline.startedAt).getTime()) / 1000)
    : 0;
  const elapsedStr = elapsed > 0 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : "";

  // Progress % calculation
  const storesTotal = pipeline.storesTotal ?? 0;
  const storesCompleted = pipeline.storesCompleted ?? 0;
  const catsTotal = pipeline.categoriesTotal ?? 0;
  const catsCompleted = pipeline.categoriesCompleted ?? 0;
  const catFraction = catsTotal > 0 ? catsCompleted / catsTotal : 0;
  const progressPct = storesTotal > 0
    ? Math.min(100, Math.round(((storesCompleted + catFraction) / storesTotal) * 100))
    : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">
          {language === "lt" ? "Išplėstiniai nustatymai" : "Advanced Settings"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "lt"
            ? "Įrankiai, duomenų apdorojimas ir vietinis praturtinimas"
            : "Tools, data processing, and local enrichment"}
        </p>
      </div>

      {/* Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "lt" ? "Įrankiai" : "Tools"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/category-parser" className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary/60 hover:bg-accent transition-colors">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted shrink-0">
              <Tags className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {language === "lt" ? "Kategorijų kūrėjas" : "Category Parser"}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Peržiūrėti ir mokyti kategorijas" : "Review and train category assignments"}
              </p>
            </div>
          </Link>

          <Link href="/manual-enrichment" className="flex items-center gap-3 p-4 rounded-lg border hover:border-primary/60 hover:bg-accent transition-colors">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {language === "lt" ? "Rankinis praturtinimas" : "Manual Enrichment"}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Rankiniu būdu praturtinti produktus" : "Manually enrich product data"}
              </p>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Local Enrichment (Ollama) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            {language === "lt" ? "Vietinis praturtinimas (Ollama)" : "Local Enrichment (Ollama)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {language === "lt"
              ? "Naudokite Ollama savo Mac kompiuteryje nemokamam masiniam praturtinimui."
              : "Run Ollama on your Mac for free bulk enrichment. Daily scraping uses Groq (cloud)."}
          </p>
          <OllamaSettings
            language={language}
            ollamaUrl={ollamaUrl}
            setOllamaUrl={setOllamaUrl}
            ollamaModel={ollamaModel}
            setOllamaModel={setOllamaModel}
            useOllamaForBulk={useOllamaForBulk}
            setUseOllamaForBulk={setUseOllamaForBulk}
            ollamaStatus={ollamaStatus}
            setOllamaStatus={setOllamaStatus}
            testingOllama={testingOllama}
            setTestingOllama={setTestingOllama}
          />
          <Button onClick={saveOllamaSettings} size="sm" className="gap-2">
            {ollamaSaved ? <Check className="h-4 w-4" /> : null}
            {ollamaSaved
              ? (language === "lt" ? "Išsaugota" : "Saved")
              : (language === "lt" ? "Išsaugoti nustatymus" : "Save settings")}
          </Button>
        </CardContent>
      </Card>

      {/* Data Processing */}
      <Card className={pipelineActive ? "border-primary" : pipelineError ? "border-destructive" : ""}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" />
            {language === "lt" ? "Duomenų apdorojimas" : "Data Processing"}
            {pipelineActive && <Loader2 className="h-4 w-4 animate-spin ml-auto text-primary" />}
            {pipelineDone && <Check className="h-4 w-4 ml-auto text-green-500" />}
            {pipelineError && <AlertCircle className="h-4 w-4 ml-auto text-destructive" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline progress */}
          {showPipeline && (
            <div className="space-y-3">
              {/* Step indicators */}
              <div className="flex items-center gap-1">
                {PIPELINE_STEPS.map((step, i) => {
                  const isCompleted = pipelineDone || stepIndex > i;
                  const isCurrent = stepIndex === i && pipelineActive;
                  const isErrorStep = pipelineError && i === 0;
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
                      <span className={`text-xs truncate ${isCurrent ? "font-semibold" : "text-muted-foreground/70"}`}>
                        {language === "lt" ? stepLabels[step]?.lt : stepLabels[step]?.en}
                      </span>
                      {i < PIPELINE_STEPS.length - 1 && <div className={`h-px flex-1 ${isCompleted ? "bg-green-500" : "bg-muted"}`} />}
                    </div>
                  );
                })}
              </div>

              {/* Detail info + progress bar */}
              <div className="space-y-2 p-3 rounded-md bg-muted/50">
                {pipeline.status === "scraping" && (
                  <>
                    <p className="text-sm font-medium">
                      {pipeline.currentStore
                        ? `${language === "lt" ? "Nuskaitoma" : "Scraping"}: ${pipeline.currentStore}`
                        : (language === "lt" ? "Laukiama pradžios..." : "Waiting to start...")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "lt" ? "Parduotuvės" : "Stores"}: {storesCompleted}/{storesTotal || "?"}
                      {(pipeline.productsScraped ?? 0) > 0 && (
                        <> &middot; {language === "lt" ? "Produktai" : "Products"}: {pipeline.productsScraped?.toLocaleString()}</>
                      )}
                    </p>
                    {catsTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {language === "lt" ? "Kategorijos" : "Categories"}: {catsCompleted}/{catsTotal}
                        {pipeline.currentCategory && <> &middot; {pipeline.currentCategory}</>}
                      </p>
                    )}
                    {storesTotal > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{language === "lt" ? "Pažanga" : "Progress"}</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
                {pipeline.status === "translating" && (
                  <p className="text-sm font-medium">{language === "lt" ? "Verčiami produktai..." : "Translating products..."}</p>
                )}
                {pipeline.status === "enriching" && (
                  <p className="text-sm font-medium">{language === "lt" ? "Apdorojami duomenys..." : "Processing data..."}</p>
                )}
                {pipeline.status === "clearing" && (
                  <p className="text-sm font-medium">{language === "lt" ? "Valomi esami duomenys..." : "Clearing existing data..."}</p>
                )}
                {pipelineDone && (
                  <p className="text-sm font-medium text-green-600">
                    {language === "lt" ? "Baigta!" : "Complete!"}
                    {(pipeline.productsScraped ?? 0) > 0 && (
                      <> &middot; {pipeline.productsScraped?.toLocaleString()} {language === "lt" ? "produktai" : "products"}</>
                    )}
                  </p>
                )}
                {pipelineError && (
                  <p className="text-sm font-medium text-destructive">
                    {language === "lt" ? "Klaida" : "Error"}: {pipeline.error || "Unknown"}
                  </p>
                )}
                {elapsedStr && (
                  <p className="text-xs text-muted-foreground">
                    {language === "lt" ? "Trukmė" : "Elapsed"}: {elapsedStr}
                  </p>
                )}
              </div>

              {pipelineActive && (
                <Button onClick={stopAll} disabled={stopping} variant="destructive" className="w-full gap-2" size="sm">
                  {stopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  {stopping
                    ? (language === "lt" ? "Stabdoma..." : "Stopping...")
                    : (language === "lt" ? "Stabdyti viską" : "Stop all")}
                </Button>
              )}
            </div>
          )}

          {/* Phase selection */}
          {!pipelineActive && (
            <>
              <p className="text-sm text-muted-foreground">
                {language === "lt" ? "Pasirinkite vieną ar daugiau etapų ir paleiskite." : "Select one or more phases to run."}
              </p>

              <div className="grid gap-2">
                {/* Scrape stores */}
                <div>
                  <button
                    onClick={() => togglePhase("scrape")}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors w-full ${
                      selectedPhases.has("scrape") ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                      selectedPhases.has("scrape") ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {language === "lt" ? "Nuskaityti parduotuves" : "Scrape stores"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {language === "lt"
                          ? "Nuskaityti kainas iš įjungtų parduotuvių"
                          : "Fetch prices from enabled stores (without clearing)"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPhases.has("scrape") && stores.length > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setStoreSelectOpen(!storeSelectOpen); }}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {selectedStores.size === stores.length
                            ? (language === "lt" ? "Visos" : "All")
                            : `${selectedStores.size}/${stores.length}`}
                          {storeSelectOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedPhases.has("scrape") ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {selectedPhases.has("scrape") && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </button>

                  {/* Store checkboxes */}
                  {selectedPhases.has("scrape") && storeSelectOpen && stores.length > 0 && (
                    <div className="mt-1 ml-4 pl-3 border-l-2 border-primary/20 space-y-1">
                      <button
                        onClick={toggleAllStores}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 py-1"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selectedStores.size === stores.length ? "bg-primary border-primary" : "border-muted-foreground/40"
                        }`}>
                          {selectedStores.size === stores.length && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        {language === "lt" ? "Visos parduotuvės" : "All stores"}
                      </button>
                      {stores.map((store) => (
                        <button
                          key={store.slug}
                          onClick={() => toggleStore(store.slug)}
                          className="flex items-center gap-1.5 text-sm py-1 w-full text-left hover:text-foreground text-muted-foreground"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            selectedStores.has(store.slug) ? "bg-primary border-primary" : "border-muted-foreground/40"
                          }`}>
                            {selectedStores.has(store.slug) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          {store.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Translate untranslated */}
                <button
                  onClick={() => togglePhase("translate")}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedPhases.has("translate") ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                    selectedPhases.has("translate") ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Languages className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {language === "lt" ? "Versti naujus produktus" : "Translate new products"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "lt" ? "Versti tik neišverstus produktus (LT → EN)" : "Translate only untranslated products (LT → EN)"}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedPhases.has("translate") ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedPhases.has("translate") && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>

                {/* Re-translate all */}
                <button
                  onClick={() => togglePhase("retranslate")}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedPhases.has("retranslate") ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                    selectedPhases.has("retranslate") ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <RotateCcw className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {language === "lt" ? "Perversti visus produktus" : "Re-translate all products"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "lt" ? "Išvalyti esamus vertimus ir versti viską iš naujo" : "Clear existing translations and re-translate everything"}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedPhases.has("retranslate") ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedPhases.has("retranslate") && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>

                {/* Enrich */}
                <button
                  onClick={() => togglePhase("enrich")}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selectedPhases.has("enrich") ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                    selectedPhases.has("enrich") ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <Brain className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {language === "lt" ? "Praturtinti duomenis" : "Enrich data"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "lt" ? "Embedding, kategorijos, LLM praturtinimas, grupavimas" : "Embedding, categories, LLM enrichment, grouping"}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    selectedPhases.has("enrich") ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}>
                    {selectedPhases.has("enrich") && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              </div>

              <Button
                onClick={runPhases}
                disabled={triggering || selectedPhases.size === 0 || (selectedPhases.has("scrape") && selectedStores.size === 0)}
                className="w-full gap-2"
                size="lg"
              >
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {triggering
                  ? (language === "lt" ? "Vykdoma..." : "Running...")
                  : selectedPhases.size === 0
                    ? (language === "lt" ? "Pasirinkite etapus" : "Select phases to run")
                    : `${language === "lt" ? "Vykdyti" : "Run"} ${selectedPhases.size} ${
                        selectedPhases.size === 1
                          ? (language === "lt" ? "etapą" : "phase")
                          : (language === "lt" ? "etapus" : "phases")
                      }`}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">
                    {language === "lt" ? "arba" : "or"}
                  </span>
                </div>
              </div>

              <Button
                onClick={rebuildDatabase}
                disabled={triggering}
                variant="outline"
                className="w-full gap-2"
                size="sm"
              >
                {triggering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {language === "lt" ? "Pilnas perkūrimas (valyti + nuskaityti + praturtinti)" : "Full rebuild (clear + scrape + enrich)"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
