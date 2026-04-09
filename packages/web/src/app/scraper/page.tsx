"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import {
  Plus,
  Play,
  FlaskConical,
  Trash2,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle,
  MousePointerClick,
  ArrowRight,
  SkipForward,
  RotateCcw,
  Eye,
} from "lucide-react";

interface ScraperConfig {
  id: number;
  name: string;
  url: string;
  storeName: string;
  chain: string;
  containerSel: string;
  nameSel: string;
  priceSel: string;
  linkSel: string | null;
  imageSel: string | null;
  categorySel: string | null;
  paginationSel: string | null;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunCount: number;
}

interface TestResult {
  url: string;
  totalContainers: number;
  items: Array<{
    name: string;
    price: string;
    link: string | null;
    image: string | null;
    category: string | null;
  }>;
  totalMatched: number;
  error?: string;
}

type PickerStep = "container" | "name" | "price" | "link" | "image";

const STEPS: { key: PickerStep; label: string; required: boolean }[] = [
  { key: "container", label: "Product Card", required: true },
  { key: "name", label: "Product Name", required: true },
  { key: "price", label: "Price", required: true },
  { key: "link", label: "Link", required: false },
  { key: "image", label: "Image", required: false },
];

interface PickedSelector {
  selector: string;
  preview: string;
  matchCount: number;
}

export default function ScraperPage() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<ScraperConfig[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [runResult, setRunResult] = useState<{ id: number; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Visual builder state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderUrl, setBuilderUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [picked, setPicked] = useState<Record<PickerStep, PickedSelector | null>>({
    container: null,
    name: null,
    price: null,
    link: null,
    image: null,
  });
  const [configName, setConfigName] = useState("");
  const [storeName, setStoreName] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchConfigs = () => {
    fetch("/api/scraper-configs")
      .then((r) => r.json())
      .then(setConfigs)
      .catch(() => {});
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Send mode to iframe when step changes
  useEffect(() => {
    if (iframeRef.current?.contentWindow && previewHtml) {
      const step = STEPS[currentStep];
      iframeRef.current.contentWindow.postMessage(
        {
          type: "set-mode",
          mode: step.key,
          containerSelector: picked.container?.selector || null,
        },
        "*"
      );
    }
  }, [currentStep, previewHtml, picked.container]);

  // Listen for messages from iframe
  const handleIframeMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type !== "element-selected") return;
      const step = STEPS[currentStep];
      setPicked((prev) => ({
        ...prev,
        [step.key]: {
          selector: e.data.selector,
          preview: e.data.text?.substring(0, 100) || "",
          matchCount: e.data.matchCount || 0,
        },
      }));
    },
    [currentStep]
  );

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  const loadPreview = async () => {
    if (!builderUrl) return;
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewHtml(null);
    setPicked({ container: null, name: null, price: null, link: null, image: null });
    setCurrentStep(0);
    try {
      const res = await fetch("/api/scraper-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: builderUrl }),
      });
      const data = await res.json();
      if (data.error) {
        setPreviewError(data.error);
      } else {
        setPreviewHtml(data.html);
      }
    } catch {
      setPreviewError("Failed to load page");
    }
    setLoadingPreview(false);
  };

  const advanceStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const skipStep = () => {
    const step = STEPS[currentStep];
    if (!step.required) {
      setPicked((prev) => ({ ...prev, [step.key]: null }));
      advanceStep();
    }
  };

  const resetBuilder = () => {
    setPreviewHtml(null);
    setPreviewError(null);
    setPicked({ container: null, name: null, price: null, link: null, image: null });
    setCurrentStep(0);
    setConfigName("");
    setStoreName("");
  };

  const canSave =
    picked.container && picked.name && picked.price && configName && storeName;

  const saveVisualConfig = async () => {
    if (!canSave) return;
    setSaving(true);
    await fetch("/api/scraper-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: configName,
        url: builderUrl,
        storeName,
        chain: "CUSTOM",
        containerSel: picked.container!.selector,
        nameSel: picked.name!.selector,
        priceSel: picked.price!.selector,
        linkSel: picked.link?.selector || "",
        imageSel: picked.image?.selector || "",
        categorySel: "",
        paginationSel: "",
      }),
    });
    setSaving(false);
    resetBuilder();
    setBuilderOpen(false);
    fetchConfigs();
  };

  const deleteConfig = async (id: number) => {
    await fetch(`/api/scraper-configs/${id}`, { method: "DELETE" });
    fetchConfigs();
  };

  const testConfig = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/scraper-configs/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setTestResult({ url: "", totalContainers: 0, items: [], totalMatched: 0, error: data.error });
      } else {
        setTestResult(data);
      }
    } catch {
      setTestResult({ url: "", totalContainers: 0, items: [], totalMatched: 0, error: "Request failed" });
    }
    setTesting(null);
  };

  const runConfig = async (id: number) => {
    setRunning(id);
    setRunResult(null);
    try {
      const res = await fetch(`/api/scraper-configs/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setRunResult({ id, msg: `Error: ${data.error}` });
      } else {
        setRunResult({ id, msg: `Imported ${data.imported} products to "${data.storeName}"` });
        fetchConfigs();
      }
    } catch {
      setRunResult({ id, msg: "Request failed" });
    }
    setRunning(null);
  };

  const allStepsDone = currentStep >= STEPS.length - 1 && (picked.image || !STEPS[4].required);
  const currentStepData = STEPS[currentStep];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("scraper.title")}</h1>
        <Button
          onClick={() => setBuilderOpen(!builderOpen)}
          className="gap-2"
          variant={builderOpen ? "secondary" : "default"}
        >
          {builderOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <MousePointerClick className="h-4 w-4" />
          )}
          {t("scraper.visualBuilder") || "Visual Builder"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("scraper.visualDescription") || "Point-and-click to select product elements from any website. No CSS knowledge needed."}
      </p>

      {/* Visual Builder */}
      {builderOpen && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointerClick className="h-5 w-5 text-primary" />
              {t("scraper.visualBuilder") || "Visual Selector Builder"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL input */}
            <div className="flex gap-2">
              <Input
                placeholder="https://shop.example.com/products"
                value={builderUrl}
                onChange={(e) => setBuilderUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadPreview()}
                className="flex-1"
              />
              <Button onClick={loadPreview} disabled={loadingPreview || !builderUrl} className="gap-2 shrink-0">
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {loadingPreview ? "Loading..." : "Load Preview"}
              </Button>
              {previewHtml && (
                <Button variant="outline" size="icon" onClick={resetBuilder} title="Reset">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {previewError && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {previewError}
              </div>
            )}

            {previewHtml && (
              <>
                {/* Step indicator */}
                <div className="flex items-center gap-1 flex-wrap">
                  {STEPS.map((step, idx) => {
                    const isDone = picked[step.key] !== null;
                    const isCurrent = idx === currentStep;
                    return (
                      <button
                        key={step.key}
                        onClick={() => setCurrentStep(idx)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isDone
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{idx + 1}</span>}
                        {step.label}
                        {!step.required && <span className="opacity-60">(opt)</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Instruction */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {currentStep === 0
                      ? "👆 Click on any PRODUCT CARD in the preview below"
                      : currentStep === 1
                      ? "👆 Now click on the PRODUCT NAME inside a product card"
                      : currentStep === 2
                      ? "👆 Click on the PRICE element inside a product card"
                      : currentStep === 3
                      ? "👆 Click on a LINK element (optional - click Skip if none)"
                      : "👆 Click on an IMAGE element (optional - click Skip if none)"}
                  </p>
                  {picked[currentStepData.key] && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="font-mono">
                        {picked[currentStepData.key]!.selector}
                      </Badge>
                      <span className="text-muted-foreground">
                        &quot;{picked[currentStepData.key]!.preview.substring(0, 60)}&quot;
                      </span>
                      {picked[currentStepData.key]!.matchCount > 0 && (
                        <Badge variant="outline">
                          {picked[currentStepData.key]!.matchCount} found
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    {picked[currentStepData.key] && currentStep < STEPS.length - 1 && (
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={advanceStep}>
                        Next <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                    {!currentStepData.required && !picked[currentStepData.key] && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={skipStep}>
                        <SkipForward className="h-3 w-3" /> Skip
                      </Button>
                    )}
                  </div>
                </div>

                {/* iframe preview */}
                <div className="border rounded-lg overflow-hidden bg-white" style={{ height: "55vh" }}>
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    className="w-full h-full"
                    sandbox="allow-scripts allow-same-origin"
                    title="Page Preview"
                  />
                </div>

                {/* Selector summary */}
                <div className="space-y-2">
                  {STEPS.map((step) => (
                    <div key={step.key} className="flex items-center gap-2 text-sm">
                      {picked[step.key] ? (
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                      )}
                      <span className="w-20 shrink-0 text-muted-foreground">{step.label}:</span>
                      {picked[step.key] ? (
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded truncate">
                          {picked[step.key]!.selector}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          {step.required ? "Required" : "Optional"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Save form - shown when required selectors are done */}
                {picked.container && picked.name && picked.price && (
                  <div className="border-t pt-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder={t("scraper.configName") || "Config name"}
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                      />
                      <Input
                        placeholder={t("scraper.storeName") || "Store name"}
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={saveVisualConfig}
                      disabled={saving || !canSave}
                      className="w-full gap-2"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {t("scraper.createConfig") || "Create Scraper Config"}
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Empty state when no URL loaded */}
            {!previewHtml && !loadingPreview && !previewError && (
              <div className="py-8 text-center text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Enter a product listing URL above and click &quot;Load Preview&quot;</p>
                <p className="text-xs mt-1">Then click on elements to define your scraper</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing configs */}
      {configs.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">{t("scraper.existingConfigs") || "Saved Scrapers"}</h2>
          <div className="space-y-3">
            {configs.map((cfg) => (
              <Card key={cfg.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === cfg.id ? null : cfg.id)}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{cfg.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {cfg.storeName}
                        </Badge>
                        {cfg.lastRunAt && (
                          <Badge variant="secondary" className="text-xs">
                            {cfg.lastRunCount} products
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {cfg.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConfig(cfg.id)}
                        disabled={testing === cfg.id}
                        className="gap-1"
                      >
                        {testing === cfg.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <FlaskConical className="h-3 w-3" />
                        )}
                        {t("scraper.test")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => runConfig(cfg.id)}
                        disabled={running === cfg.id}
                        className="gap-1"
                      >
                        {running === cfg.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {t("scraper.run")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteConfig(cfg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <button onClick={() => setExpandedId(expandedId === cfg.id ? null : cfg.id)}>
                        {expandedId === cfg.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Run result */}
                  {runResult && runResult.id === cfg.id && (
                    <div className={`mt-2 p-2 rounded text-sm ${
                      runResult.msg.startsWith("Error")
                        ? "bg-destructive/10 text-destructive"
                        : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    }`}>
                      {runResult.msg.startsWith("Error") ? (
                        <AlertCircle className="h-3 w-3 inline mr-1" />
                      ) : (
                        <Check className="h-3 w-3 inline mr-1" />
                      )}
                      {runResult.msg}
                    </div>
                  )}

                  {/* Expanded: show selectors */}
                  {expandedId === cfg.id && (
                    <div className="mt-3 pt-3 border-t space-y-1 text-xs">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-muted-foreground">{t("scraper.container")}:</span>
                        <code className="font-mono">{cfg.containerSel}</code>
                        <span className="text-muted-foreground">{t("scraper.productName")}:</span>
                        <code className="font-mono">{cfg.nameSel}</code>
                        <span className="text-muted-foreground">{t("scraper.price")}:</span>
                        <code className="font-mono">{cfg.priceSel}</code>
                        {cfg.linkSel && (
                          <>
                            <span className="text-muted-foreground">{t("scraper.link")}:</span>
                            <code className="font-mono">{cfg.linkSel}</code>
                          </>
                        )}
                        {cfg.imageSel && (
                          <>
                            <span className="text-muted-foreground">{t("scraper.image")}:</span>
                            <code className="font-mono">{cfg.imageSel}</code>
                          </>
                        )}
                        {cfg.paginationSel && (
                          <>
                            <span className="text-muted-foreground">{t("scraper.pagination")}:</span>
                            <code className="font-mono">{cfg.paginationSel}</code>
                          </>
                        )}
                      </div>
                      {cfg.lastRunAt && (
                        <p className="text-muted-foreground pt-1">
                          Last run: {new Date(cfg.lastRunAt).toLocaleString()} — {cfg.lastRunCount} products
                        </p>
                      )}
                    </div>
                  )}

                  {/* Test results */}
                  {testResult && expandedId === cfg.id && (
                    <div className="mt-3 pt-3 border-t">
                      {testResult.error ? (
                        <div className="text-sm text-destructive flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {testResult.error}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Found {testResult.totalMatched} items in {testResult.totalContainers} containers
                          </p>
                          <div className="max-h-64 overflow-y-auto space-y-1">
                            {testResult.items.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50"
                              >
                                <span className="truncate flex-1">{item.name}</span>
                                <span className="font-mono text-xs shrink-0 ml-2">
                                  {item.price}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {configs.length === 0 && !builderOpen && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t("scraper.noConfigs")}</p>
            <Button className="mt-4 gap-2" onClick={() => setBuilderOpen(true)}>
              <MousePointerClick className="h-4 w-4" />
              {t("scraper.visualBuilder") || "Open Visual Builder"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
