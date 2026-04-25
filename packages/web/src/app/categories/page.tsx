"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AdNativeCard } from "@/components/ads/AdSlot";

interface Category {
  id: string;
  lt: string;
  en: string;
  icon: string;
  count: number;
  subcategories: { name: string; count: number }[];
}

export default function CategoriesPage() {
  const { language, t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const totalItems = useMemo(
    () => categories.reduce((sum, c) => sum + c.count, 0),
    [categories],
  );

  const filtered = categories.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.en.toLowerCase().includes(q) || c.lt.toLowerCase().includes(q);
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{t("browse.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("browse.subtitle").replace("{count}", totalItems.toLocaleString())}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("browse.searchPlaceholder")}
            className="pl-9 h-10"
          />
        </div>
        <Button variant="outline" size="sm" className="h-10">
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          {t("browse.filters")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {t("browse.noCategories")}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((cat, idx) => {
            const name = language === "lt" ? cat.lt : cat.en;
            const subs = cat.subcategories.slice(0, 3).map((s) => s.name).join(" · ");
            return (
              <Fragment key={cat.id}>
                <Link
                  href={`/categories/${cat.id}`}
                  className="group flex flex-col border rounded-lg overflow-hidden bg-card hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="h-28 bg-muted/40 flex items-center justify-center text-5xl border-b">
                    <span className="opacity-80 group-hover:scale-110 transition-transform">
                      {cat.icon}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-semibold text-sm leading-tight truncate">{name}</div>
                      <div className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {cat.count.toLocaleString()}
                      </div>
                    </div>
                    {subs && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{subs}</p>
                    )}
                  </div>
                </Link>
                {(idx + 1) % 8 === 0 && (
                  <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                    <AdNativeCard className="h-36" slotId={`browse-${idx}`} />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
