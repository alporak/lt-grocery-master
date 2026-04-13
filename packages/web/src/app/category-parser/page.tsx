"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import type { EnrichmentBlob, LearnResult } from "@/lib/categoryParser";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Sparkles,
  Brain,
  ExternalLink,
  Loader2,
  Tags,
  RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface LatestPrice {
  regularPrice: number;
  salePrice: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
}

interface ParserProduct {
  id: number;
  nameLt: string;
  nameEn: string | null;
  categoryLt: string | null;
  brand: string | null;
  canonicalCategory: string | null;
  subcategory: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  enrichment: EnrichmentBlob | null;
  reviewedAt: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  barcode: string | null;
  store: { id: number; name: string; chain: string };
  latestPrice: LatestPrice | null;
}

interface Stats {
  total: number;
  reviewed: number;
  pending: number;
  suggested: number;
}

interface StoreItem {
  id: number;
  name: string;
  chain: string;
}

// ── Chain colours (matches existing pattern in the codebase) ──────────────

const CHAIN_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  BARBORA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  RIMI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MAXIMA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  PROMO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  CUSTOM: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

type StatusFilter = "pending" | "reviewed" | "suggested" | "all";

// ── Component ─────────────────────────────────────────────────────────────

export default function CategoryParserPage() {
  // Data state
  const [products, setProducts] = useState<ParserProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [storeFilter, setStoreFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reference data
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [brands, setBrands] = useState<{ name: string; count: number }[]>([]);

  // Edit state
  const [editNameEn, setEditNameEn] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editSubcategory, setEditSubcategory] = useState("");
  const [editIsFood, setEditIsFood] = useState(true);

  // Brand autocomplete
  const [brandSearch, setBrandSearch] = useState("");
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);

  // Operations
  const [saving, setSaving] = useState(false);
  const [learning, setLearning] = useState(false);
  const [learnResult, setLearnResult] = useState<LearnResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Load reference data once ──────────────────────────────────────────

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((d) => setStores(d.stores ?? d ?? []))
      .catch(() => {});
    fetch("/api/category-parser/brands")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands ?? []))
      .catch(() => {});
  }, []);

  // ── Fetch products ────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        pageSize: "20",
      });
      if (storeFilter !== "all") params.set("storeId", storeFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/category-parser?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      setProducts(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 0);
      setStats(data.stats ?? null);
      setCurrentIndex(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [status, page, storeFilter, categoryFilter, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Sync edit fields when current product changes ─────────────────────

  const currentProduct = products[currentIndex] ?? null;

  useEffect(() => {
    if (!currentProduct) return;
    const enr = currentProduct.enrichment;
    setEditNameEn(currentProduct.nameEn ?? enr?.name_clean ?? "");
    setEditBrand(currentProduct.brand ?? enr?.brand ?? "");
    setEditCategory(currentProduct.canonicalCategory ?? enr?.canonical_category ?? "");
    setEditSubcategory(currentProduct.subcategory ?? enr?.subcategory ?? "");
    setEditIsFood(enr?.is_food !== false); // default to true (food) unless explicitly false
    setBrandSearch("");
    setShowBrandSuggestions(false);
    setError(null);
  }, [currentProduct?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    if (currentIndex < products.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (page < totalPages) {
      setPage((p) => p + 1);
    }
  }, [currentIndex, products.length, page, totalPages]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else if (page > 1) {
      setPage((p) => p - 1);
    }
  }, [currentIndex, page]);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleApprove = useCallback(async () => {
    if (!currentProduct || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/category-parser/${currentProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve: true,
          nameEn: editNameEn || undefined,
          brand: editBrand || null,
          canonicalCategory: editCategory || null,
          subcategory: editSubcategory || null,
          isFood: editIsFood,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Remove from list on approval (it's "done")
      setProducts((prev) => {
        const next = prev.filter((_, i) => i !== currentIndex);
        return next;
      });
      setCurrentIndex((i) => Math.min(i, products.length - 2));
      // Refresh stats
      fetchProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }, [currentProduct, saving, editNameEn, editBrand, editCategory, editSubcategory, editIsFood, currentIndex, products.length, fetchProducts]);

  const handleAcceptLLM = useCallback(async () => {
    if (!currentProduct || saving) return;
    const enr = currentProduct.enrichment;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/category-parser/${currentProduct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approve: true,
          nameEn: enr?.name_clean ?? currentProduct.nameEn ?? undefined,
          brand: enr?.brand ?? currentProduct.brand ?? null,
          canonicalCategory: enr?.canonical_category ?? currentProduct.canonicalCategory ?? null,
          subcategory: enr?.subcategory ?? currentProduct.subcategory ?? null,
          isFood: enr?.is_food !== false,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setProducts((prev) => prev.filter((_, i) => i !== currentIndex));
      setCurrentIndex((i) => Math.min(i, products.length - 2));
      fetchProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }, [currentProduct, saving, currentIndex, products.length, fetchProducts]);

  const handleSkip = useCallback(() => {
    goNext();
  }, [goNext]);

  const handleRunLearning = useCallback(async () => {
    setLearning(true);
    setLearnResult(null);
    setError(null);
    try {
      const res = await fetch("/api/category-parser/learn", { method: "POST" });
      if (!res.ok) throw new Error("Learning failed");
      const data = await res.json() as LearnResult;
      setLearnResult(data);
      fetchProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Learning error");
    } finally {
      setLearning(false);
    }
  }, [fetchProducts]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Enter") handleApprove();
      else if (e.key === "a" || e.key === "A") handleAcceptLLM();
      else if (e.key === "s" || e.key === "S") handleSkip();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, handleApprove, handleAcceptLLM, handleSkip]);

  // ── Brand autocomplete ────────────────────────────────────────────────

  const brandSuggestions =
    brandSearch.length >= 1
      ? brands
          .filter((b) => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
          .slice(0, 8)
      : [];

  // ── Search debounce ───────────────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  const enr = currentProduct?.enrichment ?? null;
  const reviewedPct = stats ? Math.round((stats.reviewed / Math.max(stats.total, 1)) * 100) : 0;

  function formatPrice(p: LatestPrice) {
    const price = p.salePrice ?? p.regularPrice;
    return `${price.toFixed(2)}€${p.unitPrice && p.unitLabel ? ` · ${p.unitPrice.toFixed(2)}€/${p.unitLabel}` : ""}`;
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 p-4 max-w-full">

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Category Parser V2</h1>
          {stats && (
            <span className="text-sm text-muted-foreground">
              {stats.reviewed}/{stats.total} reviewed ({stats.pending} pending · {stats.suggested} suggested)
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Status filter */}
          <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suggested">Suggested</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>

          {/* Store filter */}
          <Select value={storeFilter} onValueChange={(v) => { setStoreFilter(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-8 text-xs">
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

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([id, labels]) => (
                <SelectItem key={id} value={id}>
                  {labels.icon} {labels.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search names..."
            className="h-8 text-xs w-40"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchProducts()}
            disabled={loading}
            className="h-8"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>

          <Button
            onClick={handleRunLearning}
            disabled={learning}
            size="sm"
            className="h-8 gap-1.5"
          >
            {learning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
            Run Learning
          </Button>
        </div>
      </div>

      {/* ── Learning result feedback ───────────────────────────────────── */}
      {learnResult && (
        <div className="text-xs bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-md px-3 py-2 flex gap-4">
          <span>Updated <strong>{learnResult.updated}</strong> products</span>
          <span><strong>{learnResult.rules_brand}</strong> brand rules</span>
          <span><strong>{learnResult.rules_category}</strong> category rules</span>
          <span>{learnResult.elapsed_ms}ms</span>
          <button className="ml-auto text-green-500 hover:text-green-700" onClick={() => setLearnResult(null)}>✕</button>
        </div>
      )}

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      {stats && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${reviewedPct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">{reviewedPct}%</span>
        </div>
      )}

      {/* ── Position indicator ────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {products.length > 0
            ? `Viewing ${currentIndex + 1} of ${products.length} loaded · page ${page}/${totalPages} · ${total} total`
            : "No products"}
        </span>
        {/* Page navigation */}
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>←pg</Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>pg→</Button>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Main review card ──────────────────────────────────────────── */}
      {currentProduct ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* LEFT — Original store data */}
          <Card className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              {/* Store badge + status */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={CHAIN_COLORS[currentProduct.store.chain] ?? CHAIN_COLORS.CUSTOM}>
                  {currentProduct.store.name}
                </Badge>
                {currentProduct.reviewedAt && (
                  <Badge variant="secondary" className="text-xs">✓ Reviewed</Badge>
                )}
                {enr?.suggested_category && !currentProduct.reviewedAt && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                    Has suggestion
                  </Badge>
                )}
                {currentProduct.barcode && (
                  <span className="text-xs text-muted-foreground font-mono">{currentProduct.barcode}</span>
                )}
              </div>

              {/* Image */}
              {currentProduct.imageUrl && (
                <div className="relative bg-muted rounded-md overflow-hidden h-36 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentProduct.imageUrl}
                    alt={currentProduct.nameLt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}

              {/* Lithuanian name (the raw scraped truth) */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Lithuanian name (scraped)</p>
                <p className="font-semibold text-base leading-tight">{currentProduct.nameLt}</p>
                {(currentProduct.weightValue != null) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentProduct.weightValue}{currentProduct.weightUnit}
                  </p>
                )}
              </div>

              {/* Store's own category */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Store category</p>
                <p className="text-sm">{currentProduct.categoryLt ?? <span className="italic text-muted-foreground">—</span>}</p>
              </div>

              {/* Price */}
              {currentProduct.latestPrice && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Price</p>
                  <p className="font-bold text-xl">
                    {(currentProduct.latestPrice.salePrice ?? currentProduct.latestPrice.regularPrice).toFixed(2)}€
                    {currentProduct.latestPrice.salePrice && (
                      <span className="text-sm line-through text-muted-foreground ml-2">
                        {currentProduct.latestPrice.regularPrice.toFixed(2)}€
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatPrice(currentProduct.latestPrice)}</p>
                </div>
              )}

              {/* Original product link */}
              {currentProduct.productUrl && (
                <a
                  href={currentProduct.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on store website
                </a>
              )}
            </CardContent>
          </Card>

          {/* RIGHT — Editable fields */}
          <Card>
            <CardContent className="p-4 space-y-4">

              {/* English name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  English Name
                </label>
                <Input
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  placeholder="Clean English product name..."
                  className="h-8 text-sm"
                />
                {enr?.name_clean && editNameEn !== enr.name_clean && (
                  <p
                    className="text-xs text-muted-foreground/60 italic cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setEditNameEn(enr.name_clean!)}
                  >
                    LLM: {enr.name_clean}
                  </p>
                )}
              </div>

              {/* Brand (with autocomplete) */}
              <div className="space-y-1 relative">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Brand
                </label>
                <Input
                  value={editBrand}
                  onChange={(e) => {
                    setEditBrand(e.target.value);
                    setBrandSearch(e.target.value);
                    setShowBrandSuggestions(true);
                  }}
                  onFocus={() => setShowBrandSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 150)}
                  placeholder="Brand name..."
                  className="h-8 text-sm"
                />
                {/* Autocomplete dropdown */}
                {showBrandSuggestions && brandSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 bg-popover border rounded-md shadow-lg mt-1 overflow-hidden">
                    {brandSuggestions.map((b) => (
                      <button
                        key={b.name}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex justify-between"
                        onMouseDown={() => {
                          setEditBrand(b.name);
                          setBrandSearch("");
                          setShowBrandSuggestions(false);
                        }}
                      >
                        <span>{b.name}</span>
                        <span className="text-xs text-muted-foreground">{b.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* LLM hint */}
                {enr?.brand && editBrand !== enr.brand && (
                  <p
                    className="text-xs text-muted-foreground/60 italic cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setEditBrand(enr.brand!)}
                  >
                    LLM: {enr.brand}
                  </p>
                )}
                {/* Learning suggestion */}
                {enr?.suggested_brand && (
                  <p
                    className="text-xs text-amber-500 italic cursor-pointer hover:text-amber-700 transition-colors"
                    onClick={() => setEditBrand(enr.suggested_brand!)}
                  >
                    Suggested: {enr.suggested_brand}
                  </p>
                )}
              </div>

              {/* Canonical Category */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Canonical Category
                </label>
                <Select
                  value={editCategory || "__none__"}
                  onValueChange={(v) => setEditCategory(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([id, labels]) => (
                      <SelectItem key={id} value={id}>
                        {labels.icon} {labels.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* LLM hint */}
                {enr?.canonical_category && editCategory !== enr.canonical_category && (
                  <p
                    className="text-xs text-muted-foreground/60 italic cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setEditCategory(enr.canonical_category!)}
                  >
                    LLM: {CATEGORY_LABELS[enr.canonical_category]?.en ?? enr.canonical_category}
                  </p>
                )}
                {/* Learning suggestion */}
                {enr?.suggested_category && (
                  <p
                    className="text-xs text-amber-500 italic cursor-pointer hover:text-amber-700 transition-colors"
                    onClick={() => setEditCategory(enr.suggested_category!)}
                  >
                    Suggested: {CATEGORY_LABELS[enr.suggested_category]?.en ?? enr.suggested_category}
                    {enr.suggestion_confidence != null && (
                      <span className="ml-1 opacity-70">
                        ({Math.round(enr.suggestion_confidence * 100)}% · {enr.suggestion_source})
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Subcategory */}
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Subcategory
                </label>
                <Input
                  value={editSubcategory}
                  onChange={(e) => setEditSubcategory(e.target.value)}
                  placeholder="e.g. sparkling water, whole grain..."
                  className="h-8 text-sm"
                />
                {enr?.subcategory && editSubcategory !== enr.subcategory && (
                  <p
                    className="text-xs text-muted-foreground/60 italic cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setEditSubcategory(enr.subcategory!)}
                  >
                    LLM: {enr.subcategory}
                  </p>
                )}
                {enr?.suggested_subcategory && (
                  <p
                    className="text-xs text-amber-500 italic cursor-pointer hover:text-amber-700 transition-colors"
                    onClick={() => setEditSubcategory(enr.suggested_subcategory!)}
                  >
                    Suggested: {enr.suggested_subcategory}
                  </p>
                )}
              </div>

              {/* isFood toggle */}
              <button
                type="button"
                onClick={() => setEditIsFood((f) => !f)}
                className={`flex items-center gap-3 w-full p-3 rounded-lg border text-left transition-colors ${
                  editIsFood
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-xl">{editIsFood ? "🍎" : "🧹"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {editIsFood ? "Food product" : "Non-food product"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    LLM says: {enr?.is_food === false ? "non-food 🧹" : "food 🍎"}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    editIsFood ? "border-primary bg-primary" : "border-muted-foreground/30"
                  }`}
                >
                  {editIsFood && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
              </button>

              {/* Raw enrichment data (collapsible debug) */}
              {enr && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Raw LLM enrichment data
                  </summary>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                    {JSON.stringify(enr, null, 2)}
                  </pre>
                </details>
              )}

            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <Tags className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No products to review</p>
                <p className="text-xs mt-1">Try changing the filter or run the scraper first.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Action bar ────────────────────────────────────────────────── */}
      {currentProduct && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 sticky bottom-0 bg-background pb-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goPrev}
            disabled={currentIndex === 0 && page === 1}
            title="Previous (←)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleApprove}
            disabled={saving}
            className="gap-1.5 h-8"
            title="Approve with current values (Enter)"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Approve
            <kbd className="ml-1 text-xs opacity-60 bg-primary-foreground/20 px-1 rounded">↵</kbd>
          </Button>

          <Button
            variant="secondary"
            onClick={handleAcceptLLM}
            disabled={saving}
            className="gap-1.5 h-8"
            title="Accept LLM output as-is (A)"
          >
            <Sparkles className="h-3 w-3" />
            Accept LLM
            <kbd className="ml-1 text-xs opacity-60 bg-secondary-foreground/20 px-1 rounded">A</kbd>
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="gap-1.5 h-8"
            title="Skip this product (S)"
          >
            <SkipForward className="h-3 w-3" />
            Skip
            <kbd className="ml-1 text-xs opacity-60 px-1 rounded border">S</kbd>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={goNext}
            title="Next (→)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {error && (
            <p className="text-xs text-destructive ml-2">{error}</p>
          )}

          <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
            ← → navigate &nbsp;·&nbsp; Enter approve &nbsp;·&nbsp; A accept LLM &nbsp;·&nbsp; S skip
          </div>
        </div>
      )}

    </div>
  );
}
