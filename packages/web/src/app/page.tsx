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
} from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  storesTracked: number;
  lastScraped: string | null;
  activeListCount: number;
}

interface DealProduct {
  id: number;
  name: string;
  imageUrl: string | null;
  productUrl: string | null;
  store: { id: number; name: string; chain: string } | null;
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

function DealCard({ product }: { product: DealProduct }) {
  const price = product.latestPrice;
  const chain = product.store?.chain ?? "";
  const chainColor = CHAIN_COLORS[chain] ?? "bg-gray-100 text-gray-700";
  const savings =
    price?.salePrice != null
      ? savingsPercent(price.regularPrice, price.salePrice)
      : null;

  return (
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
  );
}

function DealGrid({ deals }: { deals: DealProduct[] }) {
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
        <DealCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);

  useEffect(() => {
    // Fetch deal products
    fetch(`/api/deals?limit=64&lang=${language}`)
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
  }, [language]);

  const chains = [...new Set(deals.map((d) => d.store?.chain).filter(Boolean))] as string[];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.totalProducts")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalProducts ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.storesTracked")}
            </CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.storesTracked ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.activeList")}
            </CardTitle>
            <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeListCount ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("dashboard.lastScraped")}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {stats?.lastScraped
                ? new Date(stats.lastScraped).toLocaleString()
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scrape Status */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {t("dashboard.scrapeStatus")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {isRunning && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}
                  {isSuccess && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {isError && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {!latest && (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
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
                        <span className="text-primary font-medium">
                          {t("dashboard.statusRunning")}
                        </span>
                      ) : isError ? (
                        <span
                          className="text-destructive"
                          title={latest.errorMessage || ""}
                        >
                          {t("dashboard.statusError")}:{" "}
                          {latest.errorMessage?.substring(0, 60)}
                        </span>
                      ) : (
                        <span>
                          {t("dashboard.statusSuccess")} —{" "}
                          {latest.productCount} {t("dashboard.productsFound")}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {store.lastScrapedAt
                      ? timeAgo(new Date(store.lastScrapedAt))
                      : t("dashboard.neverScraped")}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Current Deals */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-5 w-5" />
          <h2 className="text-xl font-semibold">{t("dashboard.currentDeals")}</h2>
          {deals.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {deals.length} deals
            </Badge>
          )}
        </div>

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
                All ({deals.length})
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
              <DealGrid deals={deals} />
            </TabsContent>

            {chains.map((chain) => (
              <TabsContent key={chain} value={chain}>
                <DealGrid deals={deals.filter((d) => d.store?.chain === chain)} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}
