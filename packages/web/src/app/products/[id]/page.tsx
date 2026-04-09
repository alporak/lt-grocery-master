"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-provider";
import { ArrowLeft } from "lucide-react";
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
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useI18n();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [days, setDays] = useState(90);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/products/${params.id}?days=${days}`)
      .then((r) => r.json())
      .then(setProduct)
      .catch(() => {});
  }, [params.id, days]);

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
          </CardContent>
        </Card>
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
                <TabsTrigger value="7">{t("products.week")}</TabsTrigger>
                <TabsTrigger value="30">{t("products.month")}</TabsTrigger>
                <TabsTrigger value="90">{t("products.threeMonths")}</TabsTrigger>
                <TabsTrigger value="180">{t("products.sixMonths")}</TabsTrigger>
                <TabsTrigger value="365">{t("products.year")}</TabsTrigger>
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
