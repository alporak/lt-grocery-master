"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-provider";
import {
  Package,
  ShoppingBasket,
  Store,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  ChevronDown,
  ChevronUp,
  Bell,
  TrendingDown,
  Info,
  Eye,
  MapPin,
  RefreshCw,
  BarChart3,
  PiggyBank,
} from "lucide-react";
import { getWatchedProducts, updateLastSeenPrice, unwatchProduct, type WatchedProduct } from "@/lib/watchedProducts";
import { CATEGORY_LABELS } from "@/lib/categoryLabels";
import { ProductPreviewModal } from "@/components/ProductPreviewModal";
import { AdLeaderboard, AdBanner } from "@/components/ads/AdSlot";

interface DashboardStats {
  totalProducts: number;
  storesTracked: number;
  lastScraped: string | null;
  activeListCount: number;
}

// --- Phase 2 types ---
interface GroceryListItem {
  id: number;
  itemName: string;
  quantity: number;
  unit: string | null;
  pinnedProductId: number | null;
}

interface GroceryList {
  id: number;
  name: string;
  items: GroceryListItem[];
}

interface StoreCompareResult {
  storeId: number;
  storeName: string;
  storeChain: string;
  totalCost: number;
  matchedCount: number;
}

interface BasketHeroData {
  cheapestTotal: number;
  cheapestStoreName: string;
  storeResults: StoreCompareResult[];
}

interface NearestStoreInfo {
  name: string;
  chain: string;
  distanceKm: number | null;
  lastScrapedAt: string | null;
}

interface WidgetData {
  basketTotal: number | null;
  savedAmount: number | null;
  watchingCount: number;
  nearestStore: NearestStoreInfo | null;
  lastSync: string | null;
  itemsTracked: number | null;
}

interface DealProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  productUrl: string | null;
  store: { id: number; name: string; chain: string } | null;
  canonicalCategory: string | null;
  discountPct: number | null;
  latestPrice: {
    regularPrice: number;
    salePrice: number | null;
    campaignText: string | null;
    unitPrice: number | null;
    unitLabel: string | null;
  } | null;
}

interface ScrapeLogEntry {
  id: number;
  status: string;
  productCount: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface StoreStatus {
  id: number;
  name: string;
  chain: string;
  lastScrapedAt: string | null;
  productCount: number;
  recentLogs: ScrapeLogEntry[];
}

const CHAIN_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MAXIMA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  BARBORA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  RIMI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  LIDL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  PROMO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `<1m`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function savingsPercent(regular: number, sale: number): number {
  return Math.round(((regular - sale) / regular) * 100);
}

function DealCard({ product, onPreview }: { product: DealProduct; onPreview: (id: number) => void }) {
  const price = product.latestPrice;
  const chain = product.store?.chain ?? "";
  const chainColor = CHAIN_COLORS[chain] ?? "bg-gray-100 text-gray-700";
  const savings =
    price?.salePrice != null
      ? savingsPercent(price.regularPrice, price.salePrice)
      : null;

  return (
    <div className="relative group">
      <Link href={`/products/${product.id}`}>
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
          {product.imageUrl && (
            <div className="relative w-full h-32 bg-muted rounded-t-lg overflow-hidden">
              <Image
                src={product.imageUrl}
                alt={product.name ?? ""}
                fill
                className="object-contain p-2"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </div>
          )}
          <CardContent className="p-3 flex flex-col flex-1">
            <div className="flex items-start justify-between gap-1 mb-1">
              <Badge className={`text-xs shrink-0 ${chainColor}`} variant="secondary">
                {product.store?.name ?? chain}
              </Badge>
              {price?.campaignText && (
                <Badge variant="destructive" className="text-xs shrink-0">
                  {price.campaignText}
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium leading-snug mb-2 flex-1 line-clamp-2">
              {product.name}
            </p>
            <div className="flex items-baseline gap-2 mt-auto">
              {price?.salePrice != null ? (
                <>
                  <span className="text-base font-bold text-primary">
                    {price.salePrice.toFixed(2)}€
                  </span>
                  <span className="text-xs text-muted-foreground line-through">
                    {price.regularPrice.toFixed(2)}€
                  </span>
                  {savings != null && savings > 0 && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">
                      -{savings}%
                    </span>
                  )}
                </>
              ) : (
                <span className="text-base font-bold">
                  {price?.regularPrice.toFixed(2)}€
                </span>
              )}
            </div>
            {price?.unitPrice != null && price.unitLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {price.unitPrice.toFixed(2)} {price.unitLabel}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
      {/* Quick-view button overlay */}
      <button
        onClick={(e) => { e.preventDefault(); onPreview(product.id); }}
        className="absolute top-1.5 right-1.5 bg-background/80 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border"
        title="Quick view"
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}

function DealGrid({ deals, onPreview }: { deals: DealProduct[]; onPreview: (id: number) => void }) {
  if (deals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          No deals found
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {deals.map((p) => (
        <DealCard key={p.id} product={p} onPreview={onPreview} />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [dealCategory, setDealCategory] = useState<string | null>(null);
  const [showScrapeStatus, setShowScrapeStatus] = useState(false);
  const [previewProductId, setPreviewProductId] = useState<number | null>(null);
  const [watchedList, setWatchedList] = useState<WatchedProduct[]>([]);
  const [watchedPrices, setWatchedPrices] = useState<Record<number, {
    currentPrice: number | null; regularPrice: number | null; salePrice: number | null;
    name: string; store: string; chain: string; imageUrl: string | null;
    unitPrice: number | null; unitLabel: string | null;
  }>>({});

  // Phase 2 state
  const [basketHero, setBasketHero] = useState<BasketHeroData | null | "loading">("loading");
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);

  useEffect(() => {
    // Fetch deal products
    const dealsUrl = `/api/deals?limit=96&lang=${language}${minDiscount > 0 ? `&minDiscount=${minDiscount}` : ""}${dealCategory ? `&category=${dealCategory}` : ""}`;
    fetch(dealsUrl)
      .then((r) => r.json())
      .then((data: { items: DealProduct[]; total: number }) => {
        setDeals(data.items);
      })
      .catch(() => {});

    // Total product count
    fetch(`/api/products?pageSize=1&lang=${language}`)
      .then((r) => r.json())
      .then((data) => {
        setStats((prev) => ({
          totalProducts: data.total,
          storesTracked: prev?.storesTracked ?? 0,
          lastScraped: prev?.lastScraped ?? null,
          activeListCount: prev?.activeListCount ?? 0,
        }));
      })
      .catch(() => {});

    // Grocery list count
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((lists: unknown[]) => {
        setStats((prev) =>
          prev ? { ...prev, activeListCount: lists.length } : prev
        );
      })
      .catch(() => {});

    // Last scraped
    fetch("/api/stores")
      .then((r) => r.json())
      .then((stores: Array<{ lastScrapedAt: string | null }>) => {
        const latest = stores
          .filter((s) => s.lastScrapedAt)
          .sort(
            (a, b) =>
              new Date(b.lastScrapedAt!).getTime() -
              new Date(a.lastScrapedAt!).getTime()
          )[0];
        setStats((prev) =>
          prev
            ? {
                ...prev,
                storesTracked: stores.length,
                lastScraped: latest?.lastScrapedAt ?? null,
              }
            : prev
        );
      })
      .catch(() => {});

    // Scrape status — poll every 15s
    const fetchStatus = () =>
      fetch("/api/scrape-status")
        .then((r) => r.json())
        .then((data: StoreStatus[]) => setStoreStatuses(data))
        .catch(() => {});
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 15000);

    return () => clearInterval(statusInterval);
  }, [language, minDiscount, dealCategory]);

  // Phase 2: Basket Hero + Widget Grid data
  useEffect(() => {
    let cancelled = false;

    // SSR-safe watched count
    let watchingCount = 0;
    try {
      const raw = localStorage.getItem("watchedProducts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) watchingCount = parsed.length;
      }
    } catch { /* ignore */ }

    // Fetch stores for nearest store / last sync widgets
    const storesPromise = fetch("/api/stores")
      .then((r) => r.json())
      .then((stores: Array<{ name: string; chain: string; nearestDistance: number | null; lastScrapedAt: string | null }>) => stores)
      .catch(() => [] as Array<{ name: string; chain: string; nearestDistance: number | null; lastScrapedAt: string | null }>);

    // Fetch items tracked
    const trackedPromise = fetch("/api/products?pageSize=1")
      .then((r) => r.json())
      .then((d: { total: number }) => d.total as number)
      .catch(() => null as number | null);

    // Fetch grocery list then compare
    const basketPromise: Promise<BasketHeroData | null> = fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then(async (lists: GroceryList[]) => {
        const listWithItems = lists.find((l) => l.items && l.items.length > 0);
        if (!listWithItems) return null;
        const compareBody = {
          items: listWithItems.items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit ?? undefined,
            pinnedProductId: i.pinnedProductId ?? null,
          })),
          language: "lt",
        };
        const res = await fetch("/api/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(compareBody),
        });
        if (!res.ok) return null;
        const data = await res.json() as {
          storeResults: StoreCompareResult[];
          cheapestStoreId: number | null;
          cheapestTotal: number;
        };
        if (!data.storeResults || data.storeResults.length === 0) return null;
        const cheapestResult = data.cheapestStoreId != null
          ? data.storeResults.find((s) => s.storeId === data.cheapestStoreId)
          : data.storeResults.reduce((a, b) => a.totalCost <= b.totalCost ? a : b);
        return {
          cheapestTotal: data.cheapestTotal,
          cheapestStoreName: cheapestResult?.storeName ?? data.storeResults[0].storeName,
          storeResults: data.storeResults,
        } satisfies BasketHeroData;
      })
      .catch(() => null);

    Promise.all([storesPromise, trackedPromise, basketPromise]).then(([stores, tracked, basket]) => {
      if (cancelled) return;

      // Nearest store: first (sorted by distance in API)
      const firstStore = stores[0] ?? null;
      const nearestStore: NearestStoreInfo | null = firstStore
        ? {
            name: firstStore.name,
            chain: firstStore.chain,
            distanceKm: firstStore.nearestDistance,
            lastScrapedAt: firstStore.lastScrapedAt,
          }
        : null;

      // Last sync: most recently scraped across all stores
      const lastSync = stores
        .filter((s) => s.lastScrapedAt)
        .sort((a, b) => new Date(b.lastScrapedAt!).getTime() - new Date(a.lastScrapedAt!).getTime())[0]
        ?.lastScrapedAt ?? null;

      // Savings = most expensive - cheapest
      let savedAmount: number | null = null;
      if (basket && basket.storeResults.length > 1) {
        const costs = basket.storeResults.map((s) => s.totalCost).filter((c) => c > 0);
        if (costs.length > 1) {
          savedAmount = Math.max(...costs) - Math.min(...costs);
        }
      }

      setBasketHero(basket);
      setWidgetData({
        basketTotal: basket?.cheapestTotal ?? null,
        savedAmount,
        watchingCount,
        nearestStore,
        lastSync,
        itemsTracked: tracked,
      });
    });

    return () => { cancelled = true; };
  }, []);

  // Load watched products and fetch current prices
  useEffect(() => {
    const watched = getWatchedProducts();
    setWatchedList(watched);
    if (watched.length === 0) return;
    const ids = watched.map((w) => w.id).join(",");
    fetch(`/api/products/watched?ids=${ids}&lang=${language}`)
      .then((r) => r.json())
      .then((data: Array<{
        id: number; name: string; store: string; chain: string; imageUrl: string | null;
        currentPrice: number | null; regularPrice: number | null; salePrice: number | null;
        unitPrice: number | null; unitLabel: string | null;
      }>) => {
        const map: typeof watchedPrices = {};
        for (const p of data) {
          map[p.id] = { currentPrice: p.currentPrice, regularPrice: p.regularPrice, salePrice: p.salePrice, name: p.name, store: p.store, chain: p.chain, imageUrl: p.imageUrl, unitPrice: p.unitPrice, unitLabel: p.unitLabel };
        }
        setWatchedPrices(map);
      })
      .catch(() => {});
  }, [language]);

  const chains = [...new Set(deals.map((d) => d.store?.chain).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      {/* ── Section A: Basket Hero ──────────────────────────────────────── */}
      {basketHero === "loading" ? (
        <div className="animate-pulse bg-muted h-28 rounded-xl" />
      ) : basketHero === null ? (
        <div className="flex items-center justify-center border border-dashed border-border rounded-xl h-20 text-sm text-muted-foreground gap-2">
          <ShoppingBasket className="h-4 w-4" />
          {language === "lt"
            ? "Sukurkite pirkinių sąrašą, kad pamatytumėte krepšelio palyginimą"
            : "Create a grocery list to see basket comparison"}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Big price */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                {language === "lt" ? "Krepšelis" : "Basket total"}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-primary leading-none">
                  €{basketHero.cheapestTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {language === "lt" ? "pigiausia" : "cheapest"}{" "}
                <span className="font-semibold text-foreground">
                  {basketHero.cheapestStoreName}
                </span>
              </p>
            </div>
            {/* Store comparison chips */}
            <div className="flex flex-wrap gap-2">
              {basketHero.storeResults
                .filter((s) => s.totalCost > 0)
                .sort((a, b) => a.totalCost - b.totalCost)
                .slice(0, 4)
                .map((s, idx) => {
                  const delta = s.totalCost - basketHero.cheapestTotal;
                  const isChampion = idx === 0;
                  return (
                    <div
                      key={s.storeId}
                      className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-medium ${
                        isChampion
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-muted border-border text-muted-foreground"
                      }`}
                    >
                      <span className="font-bold text-sm">
                        {s.storeChain || s.storeName.split(" ")[0].toUpperCase().slice(0, 4)}
                      </span>
                      <span>
                        {isChampion
                          ? "✓"
                          : delta > 0
                          ? `+€${delta.toFixed(2)}`
                          : `€${delta.toFixed(2)}`}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── Section B: Widget Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Basket */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <ShoppingBasket className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Krepšelis" : "Basket"}
              </p>
              {widgetData === null ? (
                <div className="animate-pulse bg-muted h-5 w-16 rounded mt-0.5" />
              ) : widgetData.basketTotal != null ? (
                <p className="text-xl font-bold leading-none mt-0.5">
                  €{widgetData.basketTotal.toFixed(2)}
                </p>
              ) : (
                <p className="text-xl font-bold leading-none mt-0.5 text-muted-foreground">—</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* You Saved */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <PiggyBank className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Sutaupyta" : "You Saved"}
              </p>
              {widgetData === null ? (
                <div className="animate-pulse bg-muted h-5 w-16 rounded mt-0.5" />
              ) : widgetData.savedAmount != null ? (
                <p className="text-xl font-bold leading-none mt-0.5 text-green-600 dark:text-green-400">
                  €{widgetData.savedAmount.toFixed(2)}
                </p>
              ) : (
                <p className="text-xl font-bold leading-none mt-0.5 text-muted-foreground">—</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Watching */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Stebima" : "Watching"}
              </p>
              <p className="text-xl font-bold leading-none mt-0.5">
                {widgetData?.watchingCount ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Nearest Store */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Artimiausia parduotuvė" : "Nearest Store"}
              </p>
              {widgetData === null ? (
                <div className="animate-pulse bg-muted h-5 w-20 rounded mt-0.5" />
              ) : widgetData.nearestStore ? (
                <p className="text-sm font-bold leading-none mt-0.5 truncate">
                  {widgetData.nearestStore.name}
                  {widgetData.nearestStore.distanceKm != null && (
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      {widgetData.nearestStore.distanceKm.toFixed(1)}km
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm font-bold leading-none mt-0.5 text-muted-foreground">—</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Paskutinis sinchronizavimas" : "Last Sync"}
              </p>
              {widgetData === null ? (
                <div className="animate-pulse bg-muted h-5 w-16 rounded mt-0.5" />
              ) : (
                <p className="text-sm font-semibold leading-none mt-0.5">
                  {widgetData.lastSync ? timeAgo(new Date(widgetData.lastSync)) : "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items Tracked */}
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                {language === "lt" ? "Produktų seka" : "Items Tracked"}
              </p>
              {widgetData === null ? (
                <div className="animate-pulse bg-muted h-5 w-16 rounded mt-0.5" />
              ) : (
                <p className="text-xl font-bold leading-none mt-0.5">
                  {widgetData.itemsTracked ?? "—"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section C: Ad Leaderboard ──────────────────────────────────── */}
      <AdLeaderboard slotId="home-leaderboard" />

      {/* Hero: Current Deals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">{t("dashboard.currentDeals")}</h1>
          {deals.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {deals.length} {language === "lt" ? "pasiūlymų" : "deals"}
            </Badge>
          )}
        </div>

        {/* Discount filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-muted-foreground">{language === "lt" ? "Min. nuolaida:" : "Min. discount:"}</span>
          {([0, 10, 20, 30, 50] as const).map((pct) => (
            <button
              key={pct}
              onClick={() => setMinDiscount(pct)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                minDiscount === pct
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {pct === 0 ? (language === "lt" ? "Visos" : "All") : `-${pct}%+`}
            </button>
          ))}
        </div>

        {/* Category filter — derived from current deals */}
        {(() => {
          const catCounts = new Map<string, number>();
          for (const d of deals) {
            if (d.canonicalCategory) catCounts.set(d.canonicalCategory, (catCounts.get(d.canonicalCategory) ?? 0) + 1);
          }
          const topCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => id);
          if (topCats.length < 2) return null;
          return (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              <span className="text-xs text-muted-foreground shrink-0">{language === "lt" ? "Kategorija:" : "Category:"}</span>
              <button
                onClick={() => setDealCategory(null)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${dealCategory === null ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                {language === "lt" ? "Visos" : "All"}
              </button>
              {topCats.map((cat) => {
                const label = CATEGORY_LABELS[cat];
                if (!label) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setDealCategory(cat === dealCategory ? null : cat)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${dealCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                  >
                    {label.icon} {language === "lt" ? label.lt : label.en}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {deals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("common.noResults")}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="all">
                {language === "lt" ? "Visos" : "All"} ({deals.length})
              </TabsTrigger>
              {chains.map((chain) => {
                const count = deals.filter((d) => d.store?.chain === chain).length;
                return (
                  <TabsTrigger key={chain} value={chain}>
                    {chain} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="all">
              <DealGrid deals={deals} onPreview={setPreviewProductId} />
            </TabsContent>

            {chains.map((chain) => (
              <TabsContent key={chain} value={chain}>
                <DealGrid deals={deals.filter((d) => d.store?.chain === chain)} onPreview={setPreviewProductId} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Watched Products */}
      {watchedList.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {language === "lt" ? "Stebiami produktai" : "Watched Products"}
            </h2>
            <span className="text-xs text-muted-foreground ml-1">
              {language === "lt" ? "— sekite kainų pokyčius" : "— track price changes"}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {watchedList.map((w) => {
              const live = watchedPrices[w.id];
              const currentPrice = live?.currentPrice ?? null;
              const dropped = currentPrice != null && currentPrice < w.lastSeenPrice;
              const rose = currentPrice != null && currentPrice > w.lastSeenPrice;
              const pctChange = currentPrice != null && w.lastSeenPrice > 0
                ? Math.round(((currentPrice - w.lastSeenPrice) / w.lastSeenPrice) * 100)
                : null;
              const chainColor = CHAIN_COLORS[live?.chain ?? ""] ?? "bg-gray-100 text-gray-700";

              return (
                <div key={w.id} className={`shrink-0 w-44 border rounded-lg p-3 flex flex-col gap-1.5 ${dropped ? "border-green-400/60 bg-green-50/30 dark:bg-green-900/10" : ""}`}>
                  {live?.imageUrl && (
                    <img src={live.imageUrl} alt="" className="w-10 h-10 object-contain rounded mx-auto" />
                  )}
                  <p className="text-xs font-medium line-clamp-2 leading-tight">{live?.name ?? w.name}</p>
                  <Badge className={`text-[10px] w-fit ${chainColor}`} variant="secondary">
                    {live?.store ?? w.store}
                  </Badge>
                  <div className="flex items-baseline gap-1 mt-auto">
                    {currentPrice != null ? (
                      <>
                        <span className={`text-sm font-bold ${dropped ? "text-green-600" : rose ? "text-red-500" : ""}`}>
                          {currentPrice.toFixed(2)}€
                        </span>
                        {pctChange !== null && pctChange !== 0 && (
                          <span className={`text-[10px] font-semibold ${dropped ? "text-green-600" : "text-red-500"}`}>
                            {dropped ? <TrendingDown className="inline h-3 w-3" /> : "↑"}{Math.abs(pctChange)}%
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  {dropped && (
                    <p className="text-[10px] text-muted-foreground">
                      {language === "lt" ? "Buvo" : "Was"} {w.lastSeenPrice.toFixed(2)}€
                    </p>
                  )}
                  {live?.unitPrice != null && live.unitLabel && (
                    <p className="text-[10px] text-muted-foreground">{live.unitPrice.toFixed(2)}€/{live.unitLabel}</p>
                  )}
                  <div className="flex gap-1 mt-1">
                    {dropped && currentPrice != null && (
                      <button
                        onClick={() => {
                          updateLastSeenPrice(w.id, currentPrice);
                          setWatchedList(getWatchedProducts());
                        }}
                        className="text-[10px] text-green-700 border border-green-400/50 rounded px-1.5 py-0.5 hover:bg-green-50 transition-colors"
                      >
                        {language === "lt" ? "Patvirtinti" : "Dismiss"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        unwatchProduct(w.id);
                        setWatchedList(getWatchedProducts());
                      }}
                      className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 hover:bg-muted transition-colors ml-auto"
                    >
                      {language === "lt" ? "Pašalinti" : "Remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.totalProducts")}</p>
              <p className="text-xl font-bold leading-none mt-0.5">{stats?.totalProducts ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.storesTracked")}</p>
              <p className="text-xl font-bold leading-none mt-0.5">{stats?.storesTracked ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <ShoppingBasket className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.activeList")}</p>
              <p className="text-xl font-bold leading-none mt-0.5">{stats?.activeListCount ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0 flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t("dashboard.lastScraped")}</p>
              <p className="text-sm font-semibold leading-none mt-0.5">
                {stats?.lastScraped ? timeAgo(new Date(stats.lastScraped)) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scrape Status — collapsible */}
      <div>
        <button
          onClick={() => setShowScrapeStatus((p) => !p)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("dashboard.scrapeStatus")}
          {showScrapeStatus ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {storeStatuses.some((s) => s.recentLogs[0]?.status === "running") && (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin ml-1" />
          )}
          {storeStatuses.some((s) => s.recentLogs[0]?.status === "error") && (
            <XCircle className="h-3.5 w-3.5 text-destructive ml-1" />
          )}
        </button>
        {showScrapeStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            {storeStatuses.map((store) => {
              const latest = store.recentLogs[0];
              const isRunning = latest?.status === "running";
              const isError = latest?.status === "error";
              const isSuccess = latest?.status === "success";

              return (
                <Card
                  key={store.id}
                  className={isRunning ? "border-primary/50" : ""}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {store.name}
                    </CardTitle>
                    {isRunning && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                    {isSuccess && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {isError && <XCircle className="h-4 w-4 text-destructive" />}
                    {!latest && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-bold">
                      {store.productCount}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {t("dashboard.productsFound")}
                      </span>
                    </div>
                    {latest && (
                      <div className="text-xs text-muted-foreground">
                        {isRunning ? (
                          <span className="text-primary font-medium">{t("dashboard.statusRunning")}</span>
                        ) : isError ? (
                          <span className="text-destructive" title={latest.errorMessage || ""}>
                            {t("dashboard.statusError")}: {latest.errorMessage?.substring(0, 60)}
                          </span>
                        ) : (
                          <span>{t("dashboard.statusSuccess")} — {latest.productCount} {t("dashboard.productsFound")}</span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {store.lastScrapedAt ? timeAgo(new Date(store.lastScrapedAt)) : t("dashboard.neverScraped")}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {previewProductId && (
        <ProductPreviewModal
          productId={previewProductId}
          onClose={() => setPreviewProductId(null)}
        />
      )}

      {/* Mobile AdBanner — shown only on small screens */}
      <div className="sm:hidden">
        <AdBanner small slotId="home-mobile-bottom" />
      </div>
    </div>
  );
}
