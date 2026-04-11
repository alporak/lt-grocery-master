"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Category {
  id: string;
  lt: string;
  en: string;
  icon: string;
  count: number;
  subcategories: { name: string; count: number }[];
}

export default function CategoriesPage() {
  const { language } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const filtered = categories.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.en.toLowerCase().includes(q) || c.lt.toLowerCase().includes(q);
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">
          {language === "lt" ? "Kategorijos" : "Categories"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {language === "lt"
            ? "Naršykite produktus pagal kategoriją"
            : "Browse products by category"}
        </p>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={language === "lt" ? "Ieškoti kategorijos..." : "Search categories..."}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground">
          {language === "lt" ? "Kategorijų nerasta" : "No categories found"}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {filtered.map((cat) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.id}`}
            className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center hover:border-primary hover:shadow-sm transition-all"
          >
            <span className="text-3xl">{cat.icon}</span>
            <div>
              <p className="font-medium text-sm leading-tight">
                {language === "lt" ? cat.lt : cat.en}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {cat.count.toLocaleString()} {language === "lt" ? "produktų" : "products"}
              </p>
            </div>
            {cat.subcategories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-1">
                {cat.subcategories.slice(0, 3).map((sub) => (
                  <span
                    key={sub.name}
                    className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[80px]"
                    title={sub.name}
                  >
                    {sub.name}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
