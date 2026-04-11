"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const STORE_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  RIMI: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BARBORA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  MAXIMA: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  PROMO: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

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

const CATEGORY_NAMES: Record<string, { lt: string; en: string; icon: string }> = {
  "poultry": { lt: "Paukštiena", en: "Poultry", icon: "🍗" },
  "beef": { lt: "Jautiena", en: "Beef", icon: "🥩" },
  "pork": { lt: "Kiauliena", en: "Pork", icon: "🥓" },
  "lamb": { lt: "Aviena", en: "Lamb", icon: "🐑" },
  "minced-meat": { lt: "Faršas", en: "Minced Meat", icon: "🫙" },
  "deli-meat": { lt: "Mėsos gaminiai", en: "Deli Meat & Sausages", icon: "🌭" },
  "fish-seafood": { lt: "Žuvis ir jūros gėrybės", en: "Fish & Seafood", icon: "🐟" },
  "milk": { lt: "Pienas", en: "Milk", icon: "🥛" },
  "cheese": { lt: "Sūris", en: "Cheese", icon: "🧀" },
  "yogurt": { lt: "Jogurtas", en: "Yogurt", icon: "🍶" },
  "butter-cream": { lt: "Sviestas ir grietinė", en: "Butter & Cream", icon: "🧈" },
  "cottage-cheese": { lt: "Varškė", en: "Cottage Cheese", icon: "🍮" },
  "eggs": { lt: "Kiaušiniai", en: "Eggs", icon: "🥚" },
  "bread": { lt: "Duona", en: "Bread", icon: "🍞" },
  "bakery": { lt: "Kepiniai", en: "Bakery & Pastry", icon: "🥐" },
  "fruits": { lt: "Vaisiai", en: "Fruits", icon: "🍎" },
  "vegetables": { lt: "Daržovės", en: "Vegetables", icon: "🥕" },
  "salads-herbs": { lt: "Salotos ir žalumynai", en: "Salads & Herbs", icon: "🥗" },
  "mushrooms": { lt: "Grybai", en: "Mushrooms", icon: "🍄" },
  "frozen-food": { lt: "Šaldyti produktai", en: "Frozen Food", icon: "🧊" },
  "rice-grains": { lt: "Ryžiai ir kruopos", en: "Rice & Grains", icon: "🍚" },
  "pasta": { lt: "Makaronai", en: "Pasta & Noodles", icon: "🍝" },
  "flour-baking": { lt: "Miltai ir kepimo reikmenys", en: "Flour & Baking", icon: "🫓" },
  "oil-vinegar": { lt: "Aliejus ir actas", en: "Oil & Vinegar", icon: "🫙" },
  "canned-food": { lt: "Konservai", en: "Canned Food", icon: "🥫" },
  "sauces-condiments": { lt: "Padažai ir prieskoniai", en: "Sauces & Condiments", icon: "🍯" },
  "snacks": { lt: "Užkandžiai", en: "Snacks", icon: "🍿" },
  "sweets-chocolate": { lt: "Saldumynai", en: "Sweets & Chocolate", icon: "🍫" },
  "cereals": { lt: "Dribsniai ir granola", en: "Cereals & Granola", icon: "🥣" },
  "honey-jam": { lt: "Medus ir džemas", en: "Honey & Jam", icon: "🍯" },
  "tea": { lt: "Arbata", en: "Tea", icon: "🍵" },
  "coffee": { lt: "Kava", en: "Coffee", icon: "☕" },
  "juice": { lt: "Sultys", en: "Juice", icon: "🧃" },
  "water": { lt: "Vanduo", en: "Water", icon: "💧" },
  "soda-soft-drinks": { lt: "Gaivieji gėrimai", en: "Soft Drinks", icon: "🥤" },
  "beer": { lt: "Alus", en: "Beer", icon: "🍺" },
  "wine": { lt: "Vynas", en: "Wine", icon: "🍷" },
  "spirits": { lt: "Stiprieji alkoholiniai gėrimai", en: "Spirits", icon: "🥃" },
  "baby-food": { lt: "Kūdikių maistas", en: "Baby Food", icon: "🍼" },
  "pet-food": { lt: "Gyvūnų maistas", en: "Pet Food", icon: "🐾" },
  "cleaning": { lt: "Valymo priemonės", en: "Cleaning Products", icon: "🧹" },
  "laundry": { lt: "Skalbimo priemonės", en: "Laundry", icon: "🧺" },
  "paper-products": { lt: "Popieriniai gaminiai", en: "Paper Products", icon: "🧻" },
  "personal-care": { lt: "Asmens higiena", en: "Personal Care", icon: "🧴" },
  "health": { lt: "Sveikata", en: "Health & Wellness", icon: "💊" },
  "ready-meals": { lt: "Paruošti patiekalai", en: "Ready Meals", icon: "🍱" },
  "spices": { lt: "Prieskoniai", en: "Spices & Seasonings", icon: "🌶️" },
  "other": { lt: "Kita", en: "Other", icon: "📦" },
};

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
    searchParams.get("subcategory") || ""
  );
  const [selectedBrand, setSelectedBrand] = useState(searchParams.get("brand") || "");
  const [sortBy, setSortBy] = useState("price_asc");
  const [page, setPage] = useState(1);
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const catInfo = CATEGORY_NAMES[category] || { lt: category, en: category, icon: "📦" };

  const fetchData = useCallback(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "24",
      sort: sortBy,
      lang: language,
    });
    if (selectedSubcategory) params.set("subcategory", selectedSubcategory);
    if (selectedBrand) params.set("brand", selectedBrand);

    setLoading(true);
    fetch(`/api/categories/${category}?${params}`)
      .then((r) => r.json())
      .then((d: CategoryResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, page, selectedSubcategory, selectedBrand, sortBy, language]);

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
  }, []);

  const selectSubcategory = (sub: string) => {
    setSelectedSubcategory(sub === selectedSubcategory ? "" : sub);
    setPage(1);
  };

  const selectBrand = (brand: string) => {
    setSelectedBrand(brand === selectedBrand ? "" : brand);
    setPage(1);
  };

  const addToList = async (product: Product) => {
    if (!activeListId) return;
    const list = await fetch(`/api/grocery-lists/${activeListId}`).then((r) => r.json());
    const displayName = language === "en"
      ? product.nameEn || product.nameLt
      : product.nameLt;
    const items = [
      ...list.items,
      { itemName: displayName, quantity: 1, unit: null, checked: false },
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

  const clearFilters = () => {
    setSelectedSubcategory("");
    setSelectedBrand("");
    setPage(1);
  };

  const hasFilters = selectedSubcategory || selectedBrand;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Breadcrumb */}
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

      {/* Header */}
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
                  {language === "lt" ? "Išvalyti filtrus" : "Clear filters"}
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

      {/* Subcategory tabs */}
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

      {/* Brand filter */}
      {data && data.brands.length > 1 && (
        <div className="mb-5">
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

      {/* Product grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : data && data.products.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {data.products.map((p) => {
            const pr = p.latestPrice;
            const hasDiscount = pr && (pr.salePrice || pr.loyaltyPrice);
            const chainKey = p.store.chain.toUpperCase();
            const storeColor = STORE_COLORS[chainKey] || "bg-gray-100 text-gray-700";

            return (
              <Card
                key={p.id}
                className="group overflow-hidden hover:shadow-md transition-shadow relative"
              >
                {hasDiscount && (
                  <div className="absolute top-2 left-2 z-10 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    SALE
                  </div>
                )}
                {p.imageUrl ? (
                  <div className="h-28 overflow-hidden bg-muted">
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

      {/* Pagination */}
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
  );
}
