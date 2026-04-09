"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  store: { name: string; chain: string };
  latestPrice: {
    regularPrice: number;
    salePrice: number | null;
    campaignText: string | null;
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

export default function DashboardPage() {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);

  useEffect(() => {
    // Fetch products with sales
    fetch(`/api/products?pageSize=12&lang=${language}`)
      .then((r) => r.json())
      .then((data) => {
        const onSale = data.items.filter(
          (p: DealProduct) => p.latestPrice?.salePrice || p.latestPrice?.campaignText
        );
        setDeals(onSale.slice(0, 8));
        setStats({
          totalProducts: data.total,
          storesTracked: 4,
          lastScraped: null,
          activeListCount: 0,
        });
      })
      .catch(() => {});

    // Fetch grocery list count
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((lists) => {
        setStats((prev) =>
          prev ? { ...prev, activeListCount: lists.length } : prev
        );
      })
      .catch(() => {});

    // Fetch store info for last scraped
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
            ? { ...prev, lastScraped: latest?.lastScrapedAt || null }
            : prev
        );
      })
      .catch(() => {});

    // Fetch scrape status
    const fetchStatus = () =>
      fetch("/api/scrape-status")
        .then((r) => r.json())
        .then((data: StoreStatus[]) => setStoreStatuses(data))
        .catch(() => {});
    fetchStatus();
    const statusInterval = setInterval(fetchStatus, 15000);
    return () => clearInterval(statusInterval);
  }, [language]);

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
              <Card key={store.id} className={isRunning ? "border-primary/50" : ""}>
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
                        <span className="text-destructive" title={latest.errorMessage || ""}>
                          {t("dashboard.statusError")}:{" "}
                          {latest.errorMessage?.substring(0, 60)}
                        </span>
                      ) : (
                        <span>
                          {t("dashboard.statusSuccess")} — {latest.productCount}{" "}
                          {t("dashboard.productsFound")}
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

      {/* Current deals */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {t("dashboard.currentDeals")}
        </h2>
        {deals.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t("common.noResults")}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {deals.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className="text-xs shrink-0">
                        {product.store.name}
                      </Badge>
                      {product.latestPrice?.campaignText && (
                        <Badge variant="destructive" className="text-xs">
                          {product.latestPrice.campaignText}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-medium line-clamp-2 mb-2">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      {product.latestPrice?.salePrice ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            {product.latestPrice.salePrice.toFixed(2)}€
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {product.latestPrice.regularPrice.toFixed(2)}€
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {product.latestPrice?.regularPrice.toFixed(2)}€
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
