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
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBasket,
  Check,
} from "lucide-react";

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

interface GroceryList {
  id: number;
  name: string;
}

export default function ProductsPage() {
  const { t, language } = useI18n();
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStores, setSelectedStores] = useState<number[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [stores, setStores] = useState<Array<{ id: number; name: string; chain: string }>>([]);
  const [categories, setCategories] = useState<Array<{ lt: string; en: string }>>([]);
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [addedProducts, setAddedProducts] = useState<Set<number>>(new Set());
  const [activeListId, setActiveListId] = useState<number | null>(null);

  const fetchProducts = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
      lang: language,
    });
    if (search) params.set("search", search);
    if (selectedStores.length > 0) params.set("storeIds", selectedStores.join(","));
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    fetch(`/api/products?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [page, search, selectedStores, categoryFilter, language]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((s: Array<{ id: number; name: string; chain: string }>) => setStores(s))
      .catch(() => {});
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((lists: GroceryList[]) => {
        setGroceryLists(lists);
        if (lists.length > 0) setActiveListId(lists[0].id);
      })
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

  const toggleStore = (storeId: number) => {
    setSelectedStores((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
    setPage(1);
  };

  const addToList = async (product: Product) => {
    if (!activeListId) return;
    const list = await fetch(`/api/grocery-lists/${activeListId}`).then((r) => r.json());
    const items = [
      ...list.items,
      { itemName: product.name, quantity: 1, unit: null, checked: false },
    ];
    await fetch(`/api/grocery-lists/${activeListId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setAddedProducts((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  };

  const chainColor: Record<string, string> = {
    IKI: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    MAXIMA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    BARBORA: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    RIMI: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    PROMO: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  const chainBorder: Record<string, string> = {
    IKI: "border-l-red-500",
    MAXIMA: "border-l-orange-500",
    BARBORA: "border-l-orange-500",
    RIMI: "border-l-blue-500",
    PROMO: "border-l-purple-500",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t("products.title")}</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("products.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-base h-11"
        />
      </div>

      {/* Store filter chips (multi-select) */}
      <div className="flex flex-wrap gap-2">
        {stores.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleStore(s.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              selectedStores.includes(s.id)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {s.name}
          </button>
        ))}
        {selectedStores.length > 0 && (
          <button
            onClick={() => setSelectedStores([])}
            className="px-3 py-1.5 rounded-full text-sm text-muted-foreground border border-dashed hover:bg-accent"
          >
            {t("products.allStores")} ×
          </button>
        )}
      </div>

      {/* Category + active list selector row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-56">
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
        {groceryLists.length > 0 && (
          <Select
            value={String(activeListId || "")}
            onValueChange={(v) => setActiveListId(Number(v))}
          >
            <SelectTrigger className="w-full sm:w-56">
              <ShoppingBasket className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t("products.addToList")} />
            </SelectTrigger>
            <SelectContent>
              {groceryLists.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Results count */}
      {data && (
        <p className="text-sm text-muted-foreground">
          {data.total} {t("products.resultsFound")}
        </p>
      )}

      {/* Product grid */}
      {!data || data.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("common.noResults")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.items.map((product) => (
              <Card
                key={product.id}
                className={`hover:shadow-md transition-shadow h-full border-l-4 ${
                  chainBorder[product.store.chain] || ""
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
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

                  <Link href={`/products/${product.id}`}>
                    <h3 className="text-sm font-medium mb-1 hover:text-primary cursor-pointer">
                      {product.name}
                    </h3>
                  </Link>

                  {product.category && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.category}
                    </p>
                  )}

                  {/* Pricing: package price + normalized unit price */}
                  <div className="space-y-1">
                    {product.latestPrice?.salePrice ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          {product.latestPrice.salePrice.toFixed(2)}€
                        </span>
                        <span className="text-sm text-muted-foreground line-through">
                          {product.latestPrice.regularPrice.toFixed(2)}€
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-lg font-bold">
                          {product.latestPrice?.regularPrice?.toFixed(2) ?? "—"}€
                        </span>
                        {product.latestPrice?.loyaltyPrice && (
                          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                            🎫 {product.latestPrice.loyaltyPrice.toFixed(2)}€
                          </span>
                        )}
                      </div>
                    )}
                    {product.latestPrice?.unitPrice != null && (
                      <p className="text-xs font-medium text-muted-foreground">
                        {product.latestPrice.unitPrice.toFixed(2)}{" "}
                        {product.latestPrice.unitLabel || "€/kg"}
                      </p>
                    )}
                  </div>

                  {/* Quick add to grocery list */}
                  {activeListId && (
                    <Button
                      variant={addedProducts.has(product.id) ? "secondary" : "outline"}
                      size="sm"
                      className="w-full mt-2 h-8 text-xs gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        addToList(product);
                      }}
                      disabled={addedProducts.has(product.id)}
                    >
                      {addedProducts.has(product.id) ? (
                        <>
                          <Check className="h-3 w-3" />
                          {t("products.added")}
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          {t("products.addToList")}
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
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
