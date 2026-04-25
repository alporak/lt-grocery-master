"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingBasket,
  Check,
  ArrowLeft,
  Filter,
  X,
} from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categoryLabels";
import { AdSideRail, AdSponsoredRow } from "@/components/ads/AdSlot";
import { addProductToList } from "@/lib/addProductToList";

const STORE_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  RIMI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BARBORA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  MAXIMA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PROMO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

const ATTR_OPTIONS: { key: string; lt: string; en: string }[] = [
  { key: "organic", lt: "Ekologiškas", en: "Organic" },
  { key: "lactose-free", lt: "Be laktozės", en: "Lactose-free" },
  { key: "gluten-free", lt: "Be gliuteno", en: "Gluten-free" },
  { key: "vegan", lt: "Veganiškas", en: "Vegan" },
];

interface ProductPrice {
  regularPrice: number;
  salePrice: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
  loyaltyPrice: number | null;
  campaignText: string | null;
}

interface Product {
  id: number;
  name: string;
  nameLt: string;
  nameEn: string | null;
  brand: string | null;
  subcategory: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  store: { id: number; name: string; chain: string };
  productGroupId: number | null;
  latestPrice: ProductPrice | null;
  effectivePrice: number | null;
}

interface CategoryResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  subcategories: { name: string; count: number }[];
  brands: { name: string; count: number }[];
}

interface GroceryList {
  id: number;
  name: string;
}

interface Store {
  id: number;
  name: string;
  chain: string;
}

function formatPrice(price: number) {
  return `€${price.toFixed(2)}`;
}

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language } = useI18n();

  const [data, setData] = useState<CategoryResponse | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    searchParams.get("subcategory") || "",
  );
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get("brand") || "");
  const [sortBy, setSortBy] = useState("price_asc");
  const [page, setPage] = useState(1);
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filter rail state
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<number>>(new Set());
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [selectedAttrs, setSelectedAttrs] = useState<Set<string>>(new Set());

  const catInfo = CATEGORY_LABELS[category] || { lt: category, en: category, icon: "📦" };

  const fetchData = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "24",
      sort: sortBy,
      lang: language,
    });
    if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
    if (selectedBrand) params.set("brand", selectedBrand);
    if (selectedStoreIds.size > 0) params.set("storeIds", [...selectedStoreIds].join(","));
    if (priceMin) params.set("priceMin", priceMin);
    if (priceMax) params.set("priceMax", priceMax);
    if (selectedAttrs.size > 0) params.set("attrs", [...selectedAttrs].join(","));

    setLoading(true);
    fetch(`/api/categories/${category}?${params}`)
      .then((r) => r.json())
      .then((d: CategoryResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, page, selectedSubcategory, selectedBrand, sortBy, language, selectedStoreIds, priceMin, priceMax, selectedAttrs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((lists: GroceryList[]) => {
        setGroceryLists(lists);
        if (lists.length > 0) setActiveListId(lists[0].id);
      })
      .catch(() => {});
    fetch("/api/stores")
      .then((r) => r.json())
      .then((s: Store[]) => setStores(s))
      .catch(() => {});
  }, []);

  const selectSubcategory = (sub: string) => {
    setSelectedSubcategory(sub === selectedSubcategory ? "" : sub);
    setPage(1);
  };

  const selectBrand = (brand: string) => {
    setSelectedBrand(brand === selectedBrand ? "" : brand);
    setPage(1);
  };

  const toggleStore = (id: number) => {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setPage(1);
  };

  const toggleAttr = (key: string) => {
    setSelectedAttrs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    setPage(1);
  };

  const addToList = async (product: Product) => {
    if (!activeListId) return;
    await addProductToList(
      activeListId,
      { id: product.id, nameLt: product.nameLt, nameEn: product.nameEn },
      language,
    );
    setAddedProducts((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  };

  const clearFilters = () => {
    setSelectedSubcategory("");
    setSelectedBrand("");
    setSelectedStoreIds(new Set());
    setPriceMin("");
    setPriceMax("");
    setSelectedAttrs(new Set());
    setPage(1);
  };

  const hasFilters =
    selectedSubcategory ||
    selectedBrand ||
    selectedStoreIds.size > 0 ||
    priceMin ||
    priceMax ||
    selectedAttrs.size > 0;

  const popularCategories = Object.entries(CATEGORY_LABELS).slice(0, 16);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Link href="/categories" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          {language === "lt" ? "Kategorijos" : "Categories"}
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {catInfo.icon} {language === "lt" ? catInfo.lt : catInfo.en}
        </span>
      </div>

      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-6">
        {/* Desktop filter rail */}
        <aside className="hidden md:block">
          <div className="sticky top-4 space-y-5 text-sm">
            <FilterSection label={language === "lt" ? "Parduotuvės" : "Stores"}>
              {stores.length === 0 && (
                <p className="text-xs text-muted-foreground">—</p>
              )}
              {stores.map((s) => {
                const checked = selectedStoreIds.has(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStore(s.id)}
                      className="accent-primary"
                    />
                    <span className="text-xs">{s.name}</span>
                  </label>
                );
              })}
            </FilterSection>

            <FilterSection label={language === "lt" ? "Kategorija" : "Category"}>
              <div className="max-h-72 overflow-y-auto pr-1">
                {popularCategories.map(([id, labels]) => {
                  const active = id === category;
                  return (
                    <Link
                      key={id}
                      href={`/categories/${id}`}
                      className={`block py-1 text-xs truncate ${active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {language === "lt" ? labels.lt : labels.en}
                    </Link>
                  );
                })}
              </div>
            </FilterSection>

            <FilterSection label={language === "lt" ? "Kaina" : "Price"}>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceMin}
                  onChange={(e) => { setPriceMin(e.target.value); setPage(1); }}
                  placeholder="€0"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceMax}
                  onChange={(e) => { setPriceMax(e.target.value); setPage(1); }}
                  placeholder="€10"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </FilterSection>

            <FilterSection label={language === "lt" ? "Požymiai" : "Attributes"}>
              {ATTR_OPTIONS.map((a) => {
                const checked = selectedAttrs.has(a.key);
                return (
                  <label key={a.key} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAttr(a.key)}
                      className="accent-primary"
                    />
                    <span className="text-xs">{language === "lt" ? a.lt : a.en}</span>
                  </label>
                );
              })}
            </FilterSection>

            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full h-8 text-xs">
                {language === "lt" ? "Išvalyti filtrus" : "Clear filters"}
              </Button>
            )}

            <AdSideRail slotId="cat-rail" />
          </div>
        </aside>

        {/* Main */}
        <div>
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span>{catInfo.icon}</span>
                {language === "lt" ? catInfo.lt : catInfo.en}
              </h1>
              {data && (
                <p className="text-muted-foreground text-sm mt-1">
                  {data.total.toLocaleString()} {language === "lt" ? "produktų" : "products"}
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="ml-2 text-primary hover:underline"
                    >
                      {language === "lt" ? "Išvalyti" : "Clear"}
                    </button>
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {groceryLists.length > 0 && (
                <Select
                  value={activeListId ? String(activeListId) : ""}
                  onValueChange={(v) => setActiveListId(Number(v))}
                >
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <ShoppingBasket className="h-3 w-3 mr-1" />
                    <SelectValue placeholder={language === "lt" ? "Sąrašas" : "List"} />
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

              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price_asc">{language === "lt" ? "Kaina ↑" : "Price ↑"}</SelectItem>
                  <SelectItem value="price_desc">{language === "lt" ? "Kaina ↓" : "Price ↓"}</SelectItem>
                  <SelectItem value="name_asc">{language === "lt" ? "Pavadinimas A-Z" : "Name A-Z"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {data && data.subcategories.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-4">
              <button
                onClick={() => selectSubcategory("")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedSubcategory
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {language === "lt" ? "Visi" : "All"}
              </button>
              {data.subcategories.map((sub) => (
                <button
                  key={sub.name}
                  onClick={() => selectSubcategory(sub.name)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    selectedSubcategory === sub.name
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {sub.name}
                  <span className="ml-1 text-xs opacity-70">({sub.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Mobile brand strip (desktop uses sidebar instead) */}
          {data && data.brands.length > 1 && (
            <div className="mb-5 md:hidden">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                {language === "lt" ? "Prekės ženklas" : "Brand"}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {data.brands.slice(0, 20).map((b) => (
                  <button
                    key={b.name}
                    onClick={() => selectBrand(b.name)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
                      selectedBrand === b.name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {b.name}
                    {selectedBrand !== b.name && (
                      <span className="ml-1 opacity-60">({b.count})</span>
                    )}
                    {selectedBrand === b.name && (
                      <X className="inline-block ml-1 h-3 w-3" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : data && data.products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {data.products.map((p, idx) => {
                const pr = p.latestPrice;
                const hasDiscount = pr && (pr.salePrice || pr.loyaltyPrice);
                const chainKey = p.store.chain.toUpperCase();
                const storeColor = STORE_COLORS[chainKey] || "bg-gray-100 text-gray-700";

                return (
                  <Fragment key={p.id}>
                    {idx === 3 && (
                      <div className="col-span-2 sm:col-span-3 lg:col-span-4 xl:col-span-5">
                        <AdSponsoredRow slotId={`cat-${category}-row3`} />
                      </div>
                    )}
                    <Card className="group overflow-hidden hover:shadow-md transition-shadow relative">
                      {hasDiscount && (
                        <div className="absolute top-2 left-2 z-10 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          SALE
                        </div>
                      )}
                      {p.imageUrl ? (
                        <div className="h-28 overflow-hidden bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-contain p-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-28 bg-muted flex items-center justify-center text-3xl">
                          {catInfo.icon}
                        </div>
                      )}
                      <CardContent className="p-2.5">
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${storeColor}`}>
                            {p.store.chain}
                          </span>
                          {p.subcategory && !selectedSubcategory && (
                            <span className="text-[10px] text-muted-foreground capitalize truncate">
                              {p.subcategory}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium leading-tight line-clamp-2 mb-1.5 min-h-[2rem]">
                          {p.name}
                        </p>
                        {p.brand && (
                          <p className="text-[10px] text-muted-foreground mb-1">{p.brand}</p>
                        )}
                        <div className="flex items-end justify-between">
                          <div>
                            {pr ? (
                              <>
                                <p className={`text-sm font-bold ${hasDiscount ? "text-red-600 dark:text-red-400" : ""}`}>
                                  {formatPrice(pr.salePrice ?? pr.loyaltyPrice ?? pr.regularPrice)}
                                </p>
                                {hasDiscount && (
                                  <p className="text-[10px] text-muted-foreground line-through">
                                    {formatPrice(pr.regularPrice)}
                                  </p>
                                )}
                                {pr.unitPrice && pr.unitLabel && (
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatPrice(pr.unitPrice)}/{pr.unitLabel.replace("€/", "")}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">—</p>
                            )}
                          </div>
                          <button
                            onClick={() => addToList(p)}
                            disabled={!activeListId}
                            title={language === "lt" ? "Pridėti į sąrašą" : "Add to list"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              addedProducts.has(p.id)
                                ? "bg-green-100 text-green-600"
                                : "bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-40"
                            }`}
                          >
                            {addedProducts.has(p.id) ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-4xl mb-3">{catInfo.icon}</p>
              <p>{language === "lt" ? "Produktų nerasta" : "No products found"}</p>
              {hasFilters && (
                <button onClick={clearFilters} className="mt-2 text-primary hover:underline text-sm">
                  {language === "lt" ? "Išvalyti filtrus" : "Clear filters"}
                </button>
              )}
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}
