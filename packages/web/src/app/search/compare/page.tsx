"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdSponsoredRow } from "@/components/ads/AdSlot";
import { addProductToList } from "@/lib/addProductToList";

type Cell = { productId: number; price: number } | null;
type Chain = "RIMI" | "IKI" | "BARBORA" | "PROMO";
const CHAINS: Chain[] = ["RIMI", "IKI", "BARBORA", "PROMO"];

type Row = {
  key: string;
  groupId: number | null;
  name: string;
  nameEn: string | null;
  imageUrl: string | null;
  brand: string | null;
  prices: Record<Chain, Cell>;
  bestChain: Chain | null;
  bestPrice: number | null;
};

type GroceryList = { id: number; name: string };

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function priceStr(p: number | null): string {
  return p === null ? "—" : `€${p.toFixed(2)}`;
}

export default function SearchComparePage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">…</div>}>
      <SearchComparePageInner />
    </Suspense>
  );
}

function SearchComparePageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { language, t } = useI18n();

  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [sort, setSort] = useState<"cheapest" | "name" | "savings">(
    (sp.get("sort") as "cheapest" | "name" | "savings") || "cheapest",
  );
  const dq = useDebounced(query, 300);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (dq) params.set("q", dq);
    if (sort !== "cheapest") params.set("sort", sort);
    router.replace(`/search/compare${params.toString() ? `?${params}` : ""}`);
  }, [dq, sort, router]);

  // Fetch rows
  useEffect(() => {
    if (!dq.trim()) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/search/compare?q=${encodeURIComponent(dq)}&sort=${sort}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setRows(d.rows ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dq, sort]);

  // Lists
  useEffect(() => {
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((ls: GroceryList[]) => {
        setLists(ls);
        if (ls.length > 0) setActiveListId(ls[0].id);
      })
      .catch(() => {});
  }, []);

  const handleAdd = async (row: Row) => {
    if (!activeListId) return;
    const firstCell = CHAINS.map((c) => row.prices[c]).find((c) => c !== null);
    if (!firstCell) return;
    await addProductToList(
      activeListId,
      { id: firstCell.productId, nameLt: row.name, nameEn: row.nameEn },
      language,
    );
    setAdded((prev) => new Set(prev).add(row.key));
    setTimeout(() => {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(row.key);
        return next;
      });
    }, 2000);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center gap-2 mb-4 text-sm">
        <Link href="/search" className="text-muted-foreground hover:text-foreground">
          ← {t("nav.search")}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span>{t("compareSearch.title")}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="pl-9 h-10"
          />
        </div>

        {lists.length > 0 && (
          <Select
            value={activeListId ? String(activeListId) : ""}
            onValueChange={(v) => setActiveListId(Number(v))}
          >
            <SelectTrigger className="w-44 h-10 text-xs">
              <SelectValue placeholder={language === "lt" ? "Sąrašas" : "List"} />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={sort} onValueChange={(v) => setSort(v as "cheapest" | "name" | "savings")}>
          <SelectTrigger className="w-40 h-10 text-xs">
            <span className="text-muted-foreground mr-1">{t("compareSearch.sort")}:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cheapest">{t("compareSearch.sortCheapest")}</SelectItem>
            <SelectItem value="name">{t("compareSearch.sortName")}</SelectItem>
            <SelectItem value="savings">{t("compareSearch.sortSavings")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.trim() && (
        <p className="text-xs text-muted-foreground mb-3 font-mono">
          {total} {t("search.resultsCount")}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {query.trim() ? t("search.empty") : t("compareSearch.empty")}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          {/* header (desktop) */}
          <div className="hidden md:grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr_110px] px-3 py-2 border-b bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div>{t("compareSearch.product")}</div>
            {CHAINS.map((c) => (
              <div key={c} className="text-center">{c}</div>
            ))}
            <div />
          </div>

          {rows.map((r, i) => {
            const display = language === "en" ? r.nameEn || r.name : r.name;
            const isAdded = added.has(r.key);
            const canAdd = !!activeListId && r.bestPrice !== null;
            return (
              <Fragment key={r.key}>
                {i === 3 && (
                  <div className="p-2 border-b">
                    <AdSponsoredRow slotId="compare-row3" className="border-dashed" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-[1.8fr_1fr_1fr_1fr_1fr_110px] gap-y-2 items-center px-3 py-3 border-b last:border-b-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" className="w-full h-full object-contain rounded" />
                      ) : (
                        "·"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{display}</div>
                      {r.brand && <div className="text-[10px] text-muted-foreground truncate">{r.brand}</div>}
                    </div>
                  </div>
                  {CHAINS.map((c) => {
                    const cell = r.prices[c];
                    const isBest = cell !== null && c === r.bestChain;
                    return (
                      <div
                        key={c}
                        className={cn(
                          "md:text-center font-mono text-sm tabular-nums flex md:block items-center justify-between md:justify-center",
                          cell ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <span className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mr-2">{c}</span>
                        <span
                          className={cn(
                            "relative inline-block",
                            isBest && "font-bold after:absolute after:left-1/2 after:-translate-x-1/2 after:-bottom-1 after:w-5 after:h-[2px] after:bg-foreground",
                          )}
                        >
                          {priceStr(cell?.price ?? null)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="md:text-right">
                    <button
                      onClick={() => handleAdd(r)}
                      disabled={!canAdd}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors",
                        isAdded
                          ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300"
                          : "border-border hover:border-primary hover:text-primary disabled:opacity-40",
                      )}
                    >
                      {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {isAdded ? t("products.added") : t("compareSearch.add")}
                    </button>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
