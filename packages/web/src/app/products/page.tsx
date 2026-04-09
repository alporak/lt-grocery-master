"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  id: number;
  name: string;
  category: string | null;
  brand: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  store: { id: number; name: string; chain: string };
  latestPrice: {
    regularPrice: number;
    salePrice: number | null;
    unitPrice: number | null;
    unitLabel: string | null;
    loyaltyPrice: number | null;
    campaignText: string | null;
  } | null;
}

interface ProductsResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ProductsPage() {
  const { t, language } = useI18n();
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ lt: string; en: string }>>([]);

  const fetchProducts = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      lang: language,
    });
    if (search) params.set("search", search);
    if (storeFilter !== "all") params.set("storeId", storeFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [page, search, storeFilter, categoryFilter, language]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((s: Array<{ id: number; name: string }>) => setStores(s))
      .catch(() => {});
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const chainColor: Record<string, string> = {
    IKI: "bg-red-100 text-red-800",
    BARBORA: "bg-orange-100 text-orange-800",
    RIMI: "bg-blue-100 text-blue-800",
    PROMO: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("products.title")}</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("products.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={storeFilter} onValueChange={(v) => { setStoreFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("products.filterByStore")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.allStores")}</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("products.filterByCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.allCategories")}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.lt} value={language === "en" ? c.en : c.lt}>
                {language === "en" ? c.en : c.lt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product grid */}
      {!data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("common.noResults")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.items.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge
                        className={`text-xs ${chainColor[product.store.chain] || ""}`}
                        variant="secondary"
                      >
                        {product.store.name}
                      </Badge>
                      {product.latestPrice?.campaignText && (
                        <Badge variant="destructive" className="text-xs">
                          {product.latestPrice.campaignText}
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-sm font-medium line-clamp-2 mb-1 min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    {product.category && (
                      <p className="text-xs text-muted-foreground mb-3 truncate">
                        {product.category}
                      </p>
                    )}

                    <div className="flex items-baseline gap-2 flex-wrap">
                      {product.latestPrice?.salePrice ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            {product.latestPrice.salePrice.toFixed(2)}€
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {product.latestPrice.regularPrice.toFixed(2)}€
                          </span>
                        </>
                      ) : product.latestPrice?.loyaltyPrice ? (
                        <>
                          <span className="text-lg font-bold text-primary">
                            {product.latestPrice.loyaltyPrice.toFixed(2)}€
                          </span>
                          <span className="text-xs text-muted-foreground">
                            🎫 Lojalumo
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-bold">
                          {product.latestPrice?.regularPrice.toFixed(2) ?? "—"}€
                        </span>
                      )}
                    </div>

                    {product.latestPrice?.unitPrice && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {product.latestPrice.unitPrice.toFixed(2)}{" "}
                        {product.latestPrice.unitLabel || "€/kg"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
