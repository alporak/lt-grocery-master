"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-provider";
import { ArrowLeft, Bell, BellOff } from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AdBanner, AdSideRail } from "@/components/ads/AdSlot";

interface PriceRecord {
  id: number;
  regularPrice: number;
  salePrice: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
  loyaltyPrice: number | null;
  campaignText: string | null;
  scrapedAt: string;
}

interface ProductDetail {
  id: number;
  nameLt: string;
  nameEn: string | null;
  categoryLt: string | null;
  categoryEn: string | null;
  brand: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  store: { id: number; name: string; chain: string };
  priceRecords: PriceRecord[];
  groupMembers?: GroupMember[];
}

interface GroupMember {
  id: number;
  nameLt: string;
  nameEn: string | null;
  brand: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  store: { id: number; name: string; chain: string };
  price: {
    regular: number;
    sale: number | null;
    loyalty: number | null;
    unit: number | null;
    unitLabel: string | null;
  } | null;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useI18n();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [days, setDays] = useState(90);
  const [watched, setWatched] = useState(false);
  const [watchTargets, setWatchTargets] = useState<Record<string, number>>({});
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [targetInputValue, setTargetInputValue] = useState("");

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/products/${params.id}?days=${days}`)
      .then((r) => r.json())
      .then(setProduct)
      .catch(() => {});
  }, [params.id, days]);

  useEffect(() => {
    if (!params.id) return;
    const watchedList: number[] = JSON.parse(localStorage.getItem("watchedProducts") || "[]");
    setWatched(watchedList.includes(Number(params.id)));
    const targets: Record<string, number> = JSON.parse(localStorage.getItem("watchTargets") || "{}");
    setWatchTargets(targets);
  }, [params.id]);

  const productId = String(params.id);

  const handleWatchClick = () => {
    if (watched) return; // already watched — edit handled separately
    setShowTargetInput(true);
  };

  const handleWatchSave = () => {
    const target = parseFloat(targetInputValue);
    const watchedList: number[] = JSON.parse(localStorage.getItem("watchedProducts") || "[]");
    if (!watchedList.includes(Number(productId))) {
      watchedList.push(Number(productId));
      localStorage.setItem("watchedProducts", JSON.stringify(watchedList));
    }
    if (!isNaN(target) && target > 0) {
      const targets: Record<string, number> = JSON.parse(localStorage.getItem("watchTargets") || "{}");
      targets[productId] = target;
      localStorage.setItem("watchTargets", JSON.stringify(targets));
      setWatchTargets(targets);
    }
    setWatched(true);
    setShowTargetInput(false);
    setTargetInputValue("");
  };

  const handleWatchSkip = () => {
    const watchedList: number[] = JSON.parse(localStorage.getItem("watchedProducts") || "[]");
    if (!watchedList.includes(Number(productId))) {
      watchedList.push(Number(productId));
      localStorage.setItem("watchedProducts", JSON.stringify(watchedList));
    }
    setWatched(true);
    setShowTargetInput(false);
    setTargetInputValue("");
  };

  const handleWatchEditOpen = () => {
    setTargetInputValue(watchTargets[productId] ? String(watchTargets[productId]) : "");
    setShowTargetInput(true);
  };

  if (!product) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const name = language === "en" ? product.nameEn || product.nameLt : product.nameLt;
  const category = language === "en" ? product.categoryEn || product.categoryLt : product.categoryLt;
  const latestPrice = product.priceRecords[product.priceRecords.length - 1];

  const chainColor: Record<string, string> = {
    IKI: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    MAXIMA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    BARBORA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    RIMI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    PROMO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  const chartData = product.priceRecords.map((pr) => ({
    date: new Date(pr.scrapedAt).toLocaleDateString(),
    regular: pr.regularPrice,
    sale: pr.salePrice ?? undefined,
    loyalty: pr.loyaltyPrice ?? undefined,
  }));

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        {t("common.back")}
      </Button>

      {/* Product info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">{name}</CardTitle>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline">{product.store.name}</Badge>
                  {category && <Badge variant="secondary">{category}</Badge>}
                  {product.brand && (
                    <Badge variant="secondary">{product.brand}</Badge>
                  )}
                  {product.weightValue && (
                    <Badge variant="secondary">
                      {product.weightValue}
                      {product.weightUnit}
                    </Badge>
                  )}
                </div>
              </div>
              {/* Watch / price alert */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {watched ? (
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                      disabled
                    >
                      <Bell className="h-4 w-4 text-primary" />
                      Watching
                    </Button>
                    {watchTargets[productId] && !showTargetInput && (
                      <p className="text-xs text-muted-foreground">
                        Alert below{" "}
                        <span className="font-semibold text-foreground">
                          {watchTargets[productId].toFixed(2)}€
                        </span>{" "}
                        <button
                          onClick={handleWatchEditOpen}
                          className="text-primary hover:underline"
                        >
                          Edit
                        </button>
                      </p>
                    )}
                    {!watchTargets[productId] && !showTargetInput && (
                      <button
                        onClick={handleWatchEditOpen}
                        className="text-xs text-primary hover:underline"
                      >
                        Set price alert
                      </button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleWatchClick}
                  >
                    <BellOff className="h-4 w-4" />
                    Watch price
                  </Button>
                )}
                {showTargetInput && (
                  <div className="flex flex-col items-end gap-1.5 mt-1">
                    <label className="text-xs text-muted-foreground">
                      Alert when below €
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={targetInputValue}
                      onChange={(e) => setTargetInputValue(e.target.value)}
                      className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="0.00"
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleWatchSave}>
                        Save
                      </Button>
                      <button
                        onClick={handleWatchSkip}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {latestPrice && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t("products.regularPrice")}
                  </p>
                  <p className="text-2xl font-bold">
                    {latestPrice.regularPrice.toFixed(2)}€
                  </p>
                </div>
                {latestPrice.salePrice && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("products.salePrice")}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {latestPrice.salePrice.toFixed(2)}€
                    </p>
                  </div>
                )}
                {latestPrice.loyaltyPrice && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("products.loyaltyPrice")}
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {latestPrice.loyaltyPrice.toFixed(2)}€
                    </p>
                  </div>
                )}
                {latestPrice.unitPrice && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("products.unitPrice")}
                    </p>
                    <p className="text-lg font-semibold">
                      {latestPrice.unitPrice.toFixed(2)}{" "}
                      {latestPrice.unitLabel}
                    </p>
                  </div>
                )}
              </div>
            )}
            {latestPrice?.campaignText && (
              <div className="mt-4">
                <Badge variant="destructive" className="text-sm">
                  {latestPrice.campaignText}
                </Badge>
              </div>
            )}
            {product.productUrl && (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-sm text-primary hover:underline"
              >
                View on {product.store.name} →
              </a>
            )}
          </CardContent>
        </Card>

        {/* Price summary card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("products.priceHistory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {product.priceRecords.length > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min</span>
                    <span className="font-semibold">
                      {Math.min(
                        ...product.priceRecords.map((p) =>
                          Math.min(
                            p.regularPrice,
                            p.salePrice ?? Infinity,
                            p.loyaltyPrice ?? Infinity
                          )
                        )
                      ).toFixed(2)}
                      €
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max</span>
                    <span className="font-semibold">
                      {Math.max(
                        ...product.priceRecords.map((p) => p.regularPrice)
                      ).toFixed(2)}
                      €
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg</span>
                    <span className="font-semibold">
                      {(
                        product.priceRecords.reduce(
                          (s, p) => s + p.regularPrice,
                          0
                        ) / product.priceRecords.length
                      ).toFixed(2)}
                      €
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records</span>
                    <span className="font-semibold">
                      {product.priceRecords.length}
                    </span>
                  </div>
                </>
              )}
            </div>
            {/* Ad: desktop side-rail below stats */}
            <div className="hidden lg:block mt-4">
              <AdSideRail slotId="product-siderail" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cross-store comparison */}
      {product.groupMembers && product.groupMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("products.compareAcrossStores")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {product.groupMembers.map((m) => {
                const effectivePrice = m.price
                  ? Math.min(
                      m.price.regular,
                      m.price.sale ?? Infinity,
                      m.price.loyalty ?? Infinity
                    )
                  : null;
                return (
                  <Link
                    key={m.id}
                    href={`/products/${m.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    {m.imageUrl && (
                      <img
                        src={m.imageUrl}
                        alt=""
                        className="w-10 h-10 object-contain rounded shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {language === "en" ? m.nameEn || m.nameLt : m.nameLt}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge
                          className={`text-xs ${chainColor[m.store.chain] || ""}`}
                          variant="secondary"
                        >
                          {m.store.name}
                        </Badge>
                        {m.brand && <span>{m.brand}</span>}
                        {m.weightValue && m.weightUnit && (
                          <span>{m.weightValue}{m.weightUnit}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {effectivePrice != null ? (
                        <>
                          <p className="text-sm font-bold">{effectivePrice.toFixed(2)}€</p>
                          {m.price?.sale && m.price.sale < m.price.regular && (
                            <p className="text-[10px] line-through text-muted-foreground">
                              {m.price.regular.toFixed(2)}€
                            </p>
                          )}
                          {m.price?.unit && m.price.unitLabel && (
                            <p className="text-[10px] text-muted-foreground">
                              {m.price.unit.toFixed(2)} {m.price.unitLabel}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ad: mobile banner above chart */}
      <div className="lg:hidden">
        <AdBanner small slotId="product-mobile-banner" />
      </div>

      {/* Price chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>{t("products.priceChart")}</CardTitle>
            <Tabs
              value={String(days)}
              onValueChange={(v) => setDays(parseInt(v, 10))}
            >
              <TabsList>
                <TabsTrigger value="30">1M</TabsTrigger>
                <TabsTrigger value="90">3M</TabsTrigger>
                <TabsTrigger value="180">6M</TabsTrigger>
                <TabsTrigger value="365">1Y</TabsTrigger>
                <TabsTrigger value="9999">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="text-center text-muted-foreground py-8">
              Not enough data to display a chart yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}€`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="regular"
                  name={t("products.regularPrice")}
                  stroke="hsl(var(--chart-rimi))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="sale"
                  name={t("products.salePrice")}
                  stroke="hsl(var(--chart-iki))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="loyalty"
                  name={t("products.loyaltyPrice")}
                  stroke="hsl(var(--chart-barbora))"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
