"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Command } from "cmdk";
import {
  Search as SearchIcon,
  Clock,
  ListPlus,
  LayoutGrid,
  Bell,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { AdBanner, AdSponsoredRow } from "@/components/ads/AdSlot";
import { addProductToList } from "@/lib/addProductToList";
import {
  getWatchedProducts,
  watchProduct,
  unwatchProduct,
} from "@/lib/watchedProducts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GroceryList = { id: number; name: string };

type SearchResult = {
  id: number;
  nameLt: string;
  nameEn: string | null;
  brand: string | null;
  subcategory: string | null;
  imageUrl: string | null;
  store: { id: number; name: string; chain: string };
  productGroupId: number | null;
  productGroupName: string | null;
  canonicalCategory: string | null;
  price: number | null;
};

const CHAIN_COLOR: Record<string, string> = {
  IKI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  RIMI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BARBORA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  MAXIMA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PROMO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const RECENT_KEY = "recentSearches";
const RECENT_CAP = 8;

function useDebounced<T>(value: T, delay = 180): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function highlight(text: string, q: string): React.ReactNode {
  if (!q.trim()) return text;
  try {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
    const parts = text.split(re);
    return parts.map((part, i) =>
      re.test(part) ? (
        <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  } catch {
    return text;
  }
}

function priceStr(p: number | null): string {
  return p === null ? "—" : `€${p.toFixed(2)}`;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-sm text-muted-foreground">…</div>}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { language, t } = useI18n();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const dq = useDebounced(query, 180);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [watchedIds, setWatchedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent + watched
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
    setWatchedIds(new Set(getWatchedProducts().map((w) => w.id)));
  }, []);

  // Load grocery lists once
  useEffect(() => {
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((ls: GroceryList[]) => {
        setLists(ls);
        if (ls.length > 0) setActiveListId(ls[0].id);
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 1800);
  };

  const pushRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, RECENT_CAP);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Fetch results
  useEffect(() => {
    if (!dq.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(dq)}&limit=25`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dq]);

  // Focus input on mount, also handle Cmd+K within page
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape" && !query) {
        router.back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, query]);

  const onSelectProduct = (r: SearchResult) => {
    pushRecent(query);
    router.push(`/products/${r.id}`);
  };

  const onCompareAll = () => {
    const q = query.trim();
    if (!q) return;
    pushRecent(q);
    router.push(`/search/compare?q=${encodeURIComponent(q)}`);
  };

  const onAddQueryToList = async () => {
    const q = query.trim();
    if (!q) return;
    pushRecent(q);
    if (!activeListId) {
      router.push("/grocery-lists");
      return;
    }
    await addProductToList(
      activeListId,
      { id: 0, nameLt: q, nameEn: null },
      language,
    );
    showToast(t("products.added"));
  };

  const toggleWatch = (r: SearchResult) => {
    if (watchedIds.has(r.id)) {
      unwatchProduct(r.id);
      setWatchedIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    } else {
      watchProduct({
        id: r.id,
        name: language === "en" ? r.nameEn || r.nameLt : r.nameLt,
        store: r.store.chain,
        price: r.price ?? 0,
      });
      setWatchedIds((prev) => new Set(prev).add(r.id));
    }
  };

  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem(RECENT_KEY); } catch {}
  };

  const showRecent = !query.trim();

  const footer = useMemo(() => t("search.footerHint"), [t]);

  return (
    <div className="flex items-start justify-center px-4 pt-10 pb-24 md:pt-16 md:pb-10 min-h-[70vh]">
      <Command
        shouldFilter={false}
        label={t("search.title")}
        className="w-full max-w-[640px] rounded-lg border bg-card text-card-foreground shadow-lg overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent outline-none text-base font-mono placeholder:text-muted-foreground/70"
          />
          <span className="font-mono text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 bg-muted">
            ESC
          </span>
        </div>

        {!showRecent && (
          <p className="px-4 pt-2 pb-1 text-[11px] font-mono text-muted-foreground">
            {t("search.hint")}
          </p>
        )}

        <Command.List className="max-h-[60vh] overflow-y-auto py-1">
          {loading && (
            <Command.Loading>
              <div className="px-4 py-3 text-xs text-muted-foreground">{t("common.loading")}</div>
            </Command.Loading>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <Command.Empty className="px-4 py-6 text-sm text-muted-foreground text-center">
              {t("search.empty")}
            </Command.Empty>
          )}

          {showRecent && recent.length > 0 && (
            <Command.Group
              heading={t("search.recent")}
              className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {recent.map((r) => (
                <Command.Item
                  key={r}
                  value={`recent:${r}`}
                  onSelect={() => setQuery(r)}
                  className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer data-[selected=true]:bg-accent"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{r}</span>
                </Command.Item>
              ))}
              <button
                onClick={clearRecent}
                className="text-[10px] text-muted-foreground hover:text-foreground px-4 py-1"
              >
                clear
              </button>
            </Command.Group>
          )}

          {showRecent && recent.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">
              {t("search.noRecent")}
            </p>
          )}

          {showRecent && (
            <div className="px-3 pb-3 pt-1 md:hidden">
              <AdBanner small slotId="search-recent" />
            </div>
          )}

          {!showRecent && results.length > 0 && (
            <Command.Group
              heading={`${t("search.matchingProducts")} · ${total}`}
              className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {results.flatMap((r, idx) => {
                const name = language === "en" ? r.nameEn || r.nameLt : r.nameLt;
                const chain = r.store.chain.toUpperCase();
                const item = (
                  <Command.Item
                    key={r.id}
                    value={`product:${r.id}:${name}`}
                    onSelect={() => onSelectProduct(r)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent"
                  >
                    <div className="w-6 h-6 rounded bg-muted shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                      {r.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.imageUrl} alt="" className="w-full h-full object-contain rounded" />
                      ) : (
                        r.canonicalCategory?.[0]?.toUpperCase() ?? "·"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{highlight(name, query.trim().split(/\s+/)[0] ?? "")}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        <span className={cn("font-semibold px-1 py-px rounded text-[9px]", CHAIN_COLOR[chain] ?? "bg-muted")}>
                          {chain}
                        </span>
                        {r.brand && <span className="truncate">{r.brand}</span>}
                      </div>
                    </div>
                    <div className="font-mono text-sm font-semibold tabular-nums">{priceStr(r.price)}</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatch(r); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      aria-label="watch"
                      title={watchedIds.has(r.id) ? t("search.watching") : t("search.watchPrice")}
                      className={cn(
                        "p-1 rounded hover:bg-accent transition-colors",
                        watchedIds.has(r.id) ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {watchedIds.has(r.id) ? <Bell className="h-3.5 w-3.5 fill-current" /> : <BellOff className="h-3.5 w-3.5" />}
                    </button>
                    <span className="font-mono text-[9px] text-muted-foreground bg-muted rounded px-1 py-0.5">↵</span>
                  </Command.Item>
                );
                if ((idx + 1) % 5 === 0) {
                  return [item, <div key={`ad-${idx}`} className="px-3 py-1"><AdSponsoredRow slotId={`search-row-${idx}`} /></div>];
                }
                return [item];
              })}
            </Command.Group>
          )}

          {!showRecent && query.trim() && (
            <Command.Group
              heading={t("search.actions")}
              className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <Command.Item
                value="action:add"
                onSelect={onAddQueryToList}
                className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <ListPlus className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">
                  {t("search.addToList").replace("{q}", query.trim())}
                  {activeListId && lists.length > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      → {lists.find((l) => l.id === activeListId)?.name}
                    </span>
                  )}
                </span>
              </Command.Item>
              <Command.Item
                value="action:compare"
                onSelect={onCompareAll}
                className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer data-[selected=true]:bg-accent"
              >
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{t("search.compareAll")}</span>
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>

        <div className="flex items-center gap-3 border-t px-4 py-2 text-[10px] font-mono text-muted-foreground">
          <span className="truncate">{footer}</span>
          {lists.length > 0 && (
            <div className="ml-auto flex items-center gap-2 normal-case">
              <span>list:</span>
              <Select
                value={activeListId ? String(activeListId) : ""}
                onValueChange={(v) => setActiveListId(Number(v))}
              >
                <SelectTrigger className="h-6 text-[10px] px-2 py-0 font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <span className="ml-2">4 {t("search.storesSuffix")}</span>
        </div>
      </Command>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 md:bottom-8 bg-foreground text-background px-4 py-2 rounded-md text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
