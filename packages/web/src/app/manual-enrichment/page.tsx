"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/categoryLabels";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  buildFullPrompt,
  parseEnrichmentResponse,
  type ProductForPrompt,
  type EnrichmentItem,
  type ParsedResult,
} from "@/lib/enrichmentPrompt";
import {
  ClipboardCopy,
  Check,
  Loader2,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Save,
  Cpu,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface LoadedProduct extends ProductForPrompt {
  canonicalCategory: string | null;
  enrichedAt: string | null;
  imageUrl: string | null;
  store: { id: number; name: string; chain: string };
  latestPrice: { regularPrice: number; salePrice: number | null } | null;
}

interface StoreItem {
  id: number;
  name: string;
  chain: string;
}

interface SaveResult {
  saved: number;
  skipped: number;
  errors: string[];
}

type Step = "config" | "prompt" | "paste" | "preview" | "saved";

const BATCH_SIZES = [10, 50, 100, 500, 1000, 2000] as const;
const LOAD_CHUNK_SIZE = 200; // max products per GET request
const SAVE_CHUNK_SIZE = 200; // max entries per POST request

const CHAIN_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-800",
  BARBORA: "bg-orange-100 text-orange-800",
  RIMI: "bg-blue-100 text-blue-800",
  MAXIMA: "bg-orange-100 text-orange-800",
  PROMO: "bg-purple-100 text-purple-800",
  CUSTOM: "bg-gray-100 text-gray-800",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function ManualEnrichmentPage() {
  // Config
  const [batchSizeInput, setBatchSizeInput] = useState("10");
  const [storeFilter, setStoreFilter] = useState("all");
  const [mode, setMode] = useState<"unenriched" | "all">("unenriched");
  const [offsetInput, setOffsetInput] = useState("0");
  const batchSize = Math.max(1, parseInt(batchSizeInput) || 1);
  const offset = Math.max(0, parseInt(offsetInput) || 0);

  // Reference data
  const [stores, setStores] = useState<StoreItem[]>([]);

  // Loaded batch
  const [products, setProducts] = useState<LoadedProduct[]>([]);
  const [totalUnenriched, setTotalUnenriched] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<string | null>(null);

  // Step tracking
  const [step, setStep] = useState<Step>("config");

  // Prompt display
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedSystem, setCopiedSystem] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);

  // Paste / parse
  const [pasteText, setPasteText] = useState("");
  const [parseResult, setParseResult] = useState<ParsedResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Editable items (mirrors parseResult.items but mutable)
  const [editedItems, setEditedItems] = useState<(EnrichmentItem | null)[]>([]);

  // Collapsible batch list
  const [showBatch, setShowBatch] = useState(false);

  // Preview: which items are selected for saving (by index)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Save
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);

  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // ── Load stores once ────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(Array.isArray(d) ? d : d.stores ?? []))
      .catch(() => {});
  }, []);

  // ── Load batch ──────────────────────────────────────────────────────

  const loadBatch = useCallback(async (nextOffset?: number) => {
    setLoading(true);
    setLoadError(null);
    setLoadProgress(null);
    setParseResult(null);
    setPasteText("");
    setSaveResult(null);
    const useOffset = nextOffset ?? offset;

    try {
      const totalToLoad = batchSize;
      const chunkSize = Math.min(LOAD_CHUNK_SIZE, totalToLoad);
      const numChunks = Math.ceil(totalToLoad / chunkSize);

      let allProducts: LoadedProduct[] = [];
      let latestTotalUnenriched = 0;
      let latestTotalAll = 0;

      for (let chunk = 0; chunk < numChunks; chunk++) {
        const chunkOffset = useOffset + allProducts.length;
        const chunkBatchSize = Math.min(chunkSize, totalToLoad - allProducts.length);

        if (numChunks > 1) {
          setLoadProgress(`Loading ${allProducts.length} / ${totalToLoad}…`);
        }

        const params = new URLSearchParams({
          batchSize: String(chunkBatchSize),
          mode,
          offset: String(chunkOffset),
        });
        if (storeFilter !== "all") params.set("storeId", storeFilter);

        const res = await fetch(`/api/manual-enrichment?${params}`);
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Failed to load (${res.status})${errText ? ": " + errText.slice(0, 120) : ""}`);
        }
        const data = await res.json();
        const chunk_products: LoadedProduct[] = data.products ?? [];
        allProducts = [...allProducts, ...chunk_products];
        latestTotalUnenriched = data.totalUnenriched ?? latestTotalUnenriched;
        latestTotalAll = data.totalAll ?? latestTotalAll;

        // Stop early if server returned fewer products than requested
        if (chunk_products.length < chunkBatchSize) break;
      }

      setProducts(allProducts);
      setTotalUnenriched(latestTotalUnenriched);
      setTotalAll(latestTotalAll);
      setOffsetInput(String(useOffset));
      setStep("prompt");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Error loading products");
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  }, [batchSize, mode, storeFilter, offset]);

  // ── Derived ─────────────────────────────────────────────────────────

  const userMessage = products.length > 0 ? buildUserMessage(products) : "";
  const fullPrompt = products.length > 0 ? buildFullPrompt(products) : "";

  // ── Copy helpers ────────────────────────────────────────────────────

  async function copyToClipboard(text: string, setter: (v: boolean) => void) {
    try {
      // Modern clipboard API (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: create a temporary textarea and execCommand
        const el = document.createElement("textarea");
        el.value = text;
        el.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Last resort: select the text in the nearest textarea so user can copy manually
      setter(false);
    }
  }

  // ── Parse response ──────────────────────────────────────────────────

  function handleParse() {
    setParseError(null);
    const result = parseEnrichmentResponse(pasteText, products.length);
    setParseResult(result);
    if (!result.ok) {
      setParseError(result.error ?? "Parse failed");
      return;
    }
    setEditedItems([...result.items]);
    // Pre-select all valid items
    const sel = new Set<number>();
    result.items.forEach((item, i) => { if (item) sel.add(i); });
    setSelectedItems(sel);
    setStep("preview");
  }

  // ── Save ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!parseResult) return;
    setSaving(true);
    setSaveResult(null);
    setSaveProgress(null);

    const entries = Array.from(selectedItems)
      .map((i) => ({
        id: products[i].id,
        enrichment: editedItems[i] as EnrichmentItem,
      }))
      .filter((e) => e.enrichment);

    const total: SaveResult = { saved: 0, skipped: 0, errors: [] };

    try {
      const numChunks = Math.ceil(entries.length / SAVE_CHUNK_SIZE);

      for (let i = 0; i < numChunks; i++) {
        if (numChunks > 1) {
          setSaveProgress(`Saving chunk ${i + 1} / ${numChunks}…`);
        }
        const chunk = entries.slice(i * SAVE_CHUNK_SIZE, (i + 1) * SAVE_CHUNK_SIZE);
        const res = await fetch("/api/manual-enrichment/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: chunk }),
        });
        const data = await res.json() as SaveResult;
        total.saved += data.saved ?? 0;
        total.skipped += data.skipped ?? 0;
        if (Array.isArray(data.errors)) total.errors.push(...data.errors);
      }

      setSaveResult(total);
      setStep("saved");
    } catch (e) {
      setSaveResult({ ...total, errors: [...total.errors, String(e)] });
      if (total.saved > 0) setStep("saved");
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  }

  // ── Toggle item selection ────────────────────────────────────────────

  function toggleItem(i: number) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // ── Reset ───────────────────────────────────────────────────────────

  function reset() {
    setProducts([]);
    setParseResult(null);
    setEditedItems([]);
    setPasteText("");
    setSaveResult(null);
    setStep("config");
  }

  function updateEditedItem(i: number, field: keyof EnrichmentItem, value: unknown) {
    setEditedItems((prev) => {
      const next = [...prev];
      const existing = next[i];
      if (existing === null || existing === undefined) {
        next[i] = {
          name_clean: "",
          brand: null,
          canonical_category: "",
          subcategory: "",
          is_food: true,
          [field]: value,
        };
      } else {
        next[i] = { ...existing, [field]: value };
      }
      return next;
    });
    // Auto-select item when user fills it in
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.add(i);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Manual Enrichment</h1>
          <Badge variant="outline" className="text-xs">copy-paste LLM</Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {totalUnenriched > 0 && (
            <span>{totalUnenriched} unenriched · {totalAll} total</span>
          )}
        </div>
      </div>

      {/* ── Step indicator ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1 text-xs">
        {(["config", "prompt", "paste", "preview", "saved"] as Step[]).map((s, i) => {
          const labels: Record<Step, string> = {
            config: "1. Configure",
            prompt: "2. Copy Prompt",
            paste: "3. Paste Response",
            preview: "4. Review",
            saved: "5. Done",
          };
          const reached = ["config", "prompt", "paste", "preview", "saved"].indexOf(step) >= i;
          return (
            <span key={s} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded font-medium ${reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {labels[s]}
              </span>
              {i < 4 && <span className="text-muted-foreground">→</span>}
            </span>
          );
        })}
      </div>

      {/* ── Step 1: Config ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Batch size */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Batch Size
              </label>
              <div className="flex gap-1">
                {BATCH_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setBatchSizeInput(String(s))}
                    className={`px-3 py-1.5 text-sm rounded border font-mono transition-colors ${
                      batchSize === s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                {/* Custom size */}
                <Input
                  type="number"
                  min={1}
                  value={batchSizeInput}
                  onChange={(e) => setBatchSizeInput(e.target.value)}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value);
                    setBatchSizeInput(String(isNaN(v) || v < 1 ? 1 : v));
                  }}
                  className="w-24 h-8 text-sm font-mono"
                />
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mode
              </label>
              <Select value={mode} onValueChange={(v) => setMode(v as "unenriched" | "all")}>
                <SelectTrigger className="h-8 text-sm w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unenriched">Unenriched only</SelectItem>
                  <SelectItem value="all">All products</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Store filter */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Store
              </label>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="h-8 text-sm w-44">
                  <SelectValue placeholder="All stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stores</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Offset */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Skip (offset)
              </label>
              <Input
                type="number"
                min={0}
                value={offsetInput}
                onChange={(e) => setOffsetInput(e.target.value)}
                onBlur={(e) => {
                  const v = parseInt(e.target.value);
                  setOffsetInput(String(isNaN(v) || v < 0 ? 0 : v));
                }}
                className="h-8 text-sm w-24 font-mono"
              />
            </div>

            {/* Load button */}
            <Button onClick={() => loadBatch()} disabled={loading} className="gap-2 h-8">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Load Batch
            </Button>

            {step !== "config" && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={reset}>
                <RefreshCw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>
          {loadProgress && (
            <p className="text-xs text-muted-foreground mt-2">{loadProgress}</p>
          )}
          {loadError && (
            <p className="text-xs text-destructive mt-2">{loadError}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Prompt ───────────────────────────────────────────── */}
      {step !== "config" && products.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Step 1 — Copy & send to LLM</h2>
              <span className="text-xs text-muted-foreground">{products.length} products in batch</span>
            </div>

            {/* Product list (collapsible) */}
            <div className="border rounded-md overflow-hidden">
              <button
                onClick={() => setShowBatch((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-muted/80 transition-colors text-xs font-medium"
              >
                <span>{products.length} products in this batch</span>
                {showBatch ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showBatch && (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">#</th>
                      <th className="text-left px-3 py-1.5 font-medium">Lithuanian Name</th>
                      <th className="text-left px-3 py-1.5 font-medium">Store</th>
                      <th className="text-left px-3 py-1.5 font-medium">Category (store)</th>
                      <th className="text-left px-3 py-1.5 font-medium">Current Brand</th>
                      <th className="text-left px-3 py-1.5 font-medium">Price</th>
                      <th className="text-left px-3 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, i) => (
                      <tr key={p.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                        <td className="px-3 py-1 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1 max-w-xs">
                          <span className="font-medium">{p.nameLt}</span>
                          {p.nameEn && (
                            <span className="text-muted-foreground ml-1">/ {p.nameEn}</span>
                          )}
                        </td>
                        <td className="px-3 py-1">
                          <Badge className={`text-xs ${CHAIN_COLORS[p.store.chain] ?? CHAIN_COLORS.CUSTOM}`}>
                            {p.store.name}
                          </Badge>
                        </td>
                        <td className="px-3 py-1 text-muted-foreground">{p.categoryLt ?? "—"}</td>
                        <td className="px-3 py-1">{p.brand ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1 font-mono">
                          {p.latestPrice
                            ? `${(p.latestPrice.salePrice ?? p.latestPrice.regularPrice).toFixed(2)}€`
                            : "—"}
                        </td>
                        <td className="px-3 py-1">
                          {p.enrichedAt
                            ? <span className="text-amber-600">re-enrich</span>
                            : <span className="text-blue-600">new</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Prompt copy section */}
            <div className="space-y-2">
              {/* Full prompt (combined) */}
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  onClick={() => copyToClipboard(fullPrompt, setCopiedFull)}
                  className="gap-2 h-8"
                  size="sm"
                >
                  {copiedFull ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                  {copiedFull ? "Copied!" : "Copy Full Prompt"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8"
                  onClick={() => copyToClipboard(SYSTEM_PROMPT, setCopiedSystem)}
                >
                  {copiedSystem ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                  {copiedSystem ? "Copied!" : "Copy System Prompt"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-8"
                  onClick={() => copyToClipboard(userMessage, setCopiedUser)}
                >
                  {copiedUser ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                  {copiedUser ? "Copied!" : "Copy User Message Only"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Use "Copy System Prompt" + "Copy User Message" for models that accept separate inputs (Claude, GPT-4)
                </span>
              </div>

              {/* System prompt preview (collapsible) */}
              <div>
                <button
                  onClick={() => setShowSystemPrompt((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showSystemPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showSystemPrompt ? "Hide system prompt" : "Show system prompt"}
                </button>
                {showSystemPrompt && (
                  <textarea
                    readOnly
                    value={SYSTEM_PROMPT}
                    className="mt-1 w-full h-48 text-xs font-mono bg-muted border rounded-md p-2 resize-y"
                  />
                )}
              </div>

              {/* User message (always visible) */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">User message (send after system prompt):</p>
                <textarea
                  readOnly
                  value={userMessage}
                  className="w-full h-28 text-xs font-mono bg-muted border rounded-md p-2 resize-y"
                />
              </div>
            </div>

            <Button
              onClick={() => setStep("paste")}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              I&apos;ve sent it → Next: Paste Response
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Paste ────────────────────────────────────────────── */}
      {(step === "paste" || step === "preview" || step === "saved") && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Step 2 — Paste LLM Response</h2>
              <span className="text-xs text-muted-foreground">
                Paste raw JSON — markdown fences OK
              </span>
            </div>
            <textarea
              ref={pasteRef}
              value={pasteText}
              onChange={(e) => { setPasteText(e.target.value); setParseResult(null); setStep("paste"); }}
              placeholder={`Paste the LLM response here. Expected format:\n{"results": [{"name_clean": "...", "brand": "...", "canonical_category": "milk", ...}, ...]}`}
              className="w-full h-48 text-xs font-mono bg-muted border rounded-md p-3 resize-y"
              spellCheck={false}
            />
            {parseError && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {parseError}
              </div>
            )}
            <Button onClick={handleParse} disabled={!pasteText.trim()} className="gap-2 h-8" size="sm">
              <Zap className="h-3 w-3" />
              Parse &amp; Preview
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Preview ──────────────────────────────────────────── */}
      {step === "preview" && parseResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Step 3 — Review &amp; Save</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">{editedItems.filter(Boolean).length} valid</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-600">{editedItems.filter((item) => !item).length} missing</span>
                <span className="text-muted-foreground">·</span>
                <span>{selectedItems.size} selected</span>
              </div>
            </div>

            {/* Warnings */}
            {parseResult.warnings.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-1">
                {parseResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />{w}
                  </p>
                ))}
              </div>
            )}

            {/* Batch actions */}
            <div className="flex gap-2 text-xs">
              <button
                className="underline text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedItems(new Set(editedItems.map((_, i) => i).filter((i) => editedItems[i])))}
              >
                Select all valid
              </button>
              <button
                className="underline text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedItems(new Set())}
              >
                Deselect all
              </button>
            </div>

            {/* Per-product preview table (editable) */}
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 w-8">✓</th>
                    <th className="text-left px-3 py-1.5">#</th>
                    <th className="text-left px-3 py-1.5">Lithuanian Name</th>
                    <th className="text-left px-3 py-1.5">name_clean (EN)</th>
                    <th className="text-left px-3 py-1.5">Brand</th>
                    <th className="text-left px-3 py-1.5">Category</th>
                    <th className="text-left px-3 py-1.5">Subcategory</th>
                    <th className="text-left px-3 py-1.5">Food?</th>
                    <th className="text-left px-3 py-1.5">Tags (EN)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, i) => {
                    const item = editedItems[i];
                    const isSelected = selectedItems.has(i);
                    const isMissing = item === null || item === undefined;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isMissing
                            ? "bg-amber-50 dark:bg-amber-950/30"
                            : isSelected
                            ? "bg-primary/5"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-2 py-1.5 text-center" onClick={() => !isMissing && toggleItem(i)}>
                          {!isMissing ? (
                            <div className={`w-4 h-4 rounded border-2 inline-flex items-center justify-center cursor-pointer ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                              {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-500 inline" />
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 max-w-[140px]">
                          <span className="truncate block font-medium">{product.nameLt}</span>
                          {product.nameEn && <span className="truncate block text-muted-foreground">{product.nameEn}</span>}
                        </td>
                        {/* name_clean — editable */}
                        <td className="px-2 py-1 max-w-[180px]">
                          <input
                            type="text"
                            value={item?.name_clean ?? ""}
                            placeholder={isMissing ? "fill in…" : ""}
                            onChange={(e) => updateEditedItem(i, "name_clean", e.target.value)}
                            className={`w-full bg-transparent border rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary min-w-[120px] ${isMissing ? "border-amber-400 placeholder-amber-400" : "border-transparent hover:border-border"}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        {/* brand — editable */}
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item?.brand ?? ""}
                            placeholder="null"
                            onChange={(e) => updateEditedItem(i, "brand", e.target.value || null)}
                            className="w-full bg-transparent border border-transparent hover:border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[80px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        {/* canonical_category — select */}
                        <td className="px-2 py-1">
                          <select
                            value={item?.canonical_category ?? ""}
                            onChange={(e) => updateEditedItem(i, "canonical_category", e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`bg-transparent border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary ${!item?.canonical_category ? "border-amber-400 text-amber-600" : "border-transparent hover:border-border"}`}
                          >
                            <option value="">— pick —</option>
                            {Object.entries(CATEGORY_LABELS).map(([id, { icon, en }]) => (
                              <option key={id} value={id}>{icon} {en}</option>
                            ))}
                          </select>
                        </td>
                        {/* subcategory — editable */}
                        <td className="px-2 py-1">
                          <input
                            type="text"
                            value={item?.subcategory ?? ""}
                            placeholder="—"
                            onChange={(e) => updateEditedItem(i, "subcategory", e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[80px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        {/* is_food — toggle */}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateEditedItem(i, "is_food", !(item?.is_food ?? true)); }}
                            title="Toggle food/non-food"
                            className="text-base leading-none"
                          >
                            {(item?.is_food ?? true) ? "🍎" : "🧹"}
                          </button>
                        </td>
                        {/* tags_en — editable comma list */}
                        <td className="px-2 py-1 max-w-[180px]">
                          <input
                            type="text"
                            value={item?.tags_en?.join(", ") ?? ""}
                            placeholder="tag1, tag2…"
                            onChange={(e) => updateEditedItem(i, "tags_en", e.target.value ? e.target.value.split(",").map((t) => t.trim()).filter(Boolean) : undefined)}
                            className="w-full bg-transparent border border-transparent hover:border-border rounded px-1.5 py-0.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-w-[120px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleSave}
                disabled={saving || selectedItems.size === 0}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save {selectedItems.size} products
              </Button>
              {saveProgress ? (
                <span className="text-xs text-muted-foreground">{saveProgress}</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Only selected products will be written to DB
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Done ─────────────────────────────────────────────── */}
      {step === "saved" && saveResult && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-bold text-green-700 dark:text-green-400">Saved!</h2>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-green-600">{saveResult.saved}</p>
                <p className="text-xs text-muted-foreground">products saved</p>
              </div>
              {saveResult.skipped > 0 && (
                <div>
                  <p className="text-2xl font-bold text-amber-600">{saveResult.skipped}</p>
                  <p className="text-xs text-muted-foreground">skipped</p>
                </div>
              )}
            </div>
            {saveResult.errors.length > 0 && (
              <div className="space-y-1">
                {saveResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">{e}</p>
                ))}
              </div>
            )}
            {/* Next batch */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  const nextOffset = offset + products.length;
                  setOffsetInput(String(nextOffset));
                  loadBatch(nextOffset);
                }}
                className="gap-2"
              >
                <Zap className="h-3 w-3" />
                Next batch (offset {offset + products.length})
              </Button>
              <Button size="sm" variant="outline" onClick={reset} className="gap-2">
                <RefreshCw className="h-3 w-3" />
                Start over
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
