"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBasket,
  Package,
  MapPin,
  Settings,
  LayoutGrid,
  SlidersHorizontal,
  Search,
  TrendingUp,
  MoreHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";
import { Logo } from "./logo";

// Desktop sidebar: 6 items
const sideNavItems = [
  { path: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", fallback: "Home" },
  { path: "/search", icon: Search, labelKey: "nav.search", fallback: "Search" },
  { path: "/grocery-lists", icon: ShoppingBasket, labelKey: "nav.groceryLists", fallback: "My List" },
  { path: "/stores", icon: MapPin, labelKey: "nav.stores", fallback: "Stores" },
  { path: "/watch", icon: TrendingUp, labelKey: "nav.trends", fallback: "Trends" },
  { path: "/settings", icon: Settings, labelKey: "nav.settings", fallback: "Settings" },
];

// Mobile bottom nav: 5 items (last one is "More")
const bottomNavItems = [
  { path: "/", icon: LayoutDashboard, labelKey: "nav.dashboard", fallback: "Home" },
  { path: "/search", icon: Search, labelKey: "nav.search", fallback: "Search" },
  { path: "/grocery-lists", icon: ShoppingBasket, labelKey: "nav.groceryLists", fallback: "List" },
  { path: "/stores", icon: MapPin, labelKey: "nav.stores", fallback: "Stores" },
];

// "More" sheet links — items removed from main nav + extras
const moreItems = [
  { path: "/products", icon: Package, labelKey: "nav.products", fallback: "Products" },
  { path: "/categories", icon: LayoutGrid, labelKey: "nav.categories", fallback: "Categories" },
  { path: "/watch", icon: TrendingUp, labelKey: "nav.trends", fallback: "Trends" },
  { path: "/advanced-settings", icon: SlidersHorizontal, labelKey: "nav.advancedSettings", fallback: "Advanced Settings" },
];

function safeT(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const result = t(key);
    // If the i18n helper returns the key itself (missing translation), use fallback
    return result === key ? fallback : result;
  } catch {
    return fallback;
  }
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 border-b">
          <span className="text-xl font-bold text-primary flex items-center gap-2">
            <Logo size={20} />
            {t("common.appName")}
          </span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {sideNavItems.map((item) => {
            const active =
              item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {safeT(t, item.labelKey, item.fallback)}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const active =
              item.path === "/"
                ? pathname === "/"
                : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-1 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate max-w-[4rem]">
                  {safeT(t, item.labelKey, item.fallback)}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-2 py-1 text-xs transition-colors",
              moreOpen ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate max-w-[4rem]">
              {safeT(t, "nav.more", "More")}
            </span>
          </button>
        </div>
      </nav>

      {/* More sheet overlay */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMoreOpen(false)}
          />

          {/* Slide-up sheet */}
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card rounded-t-2xl border-t shadow-lg">
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
              <span className="text-sm font-semibold">
                {safeT(t, "nav.more", "More")}
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="px-2 py-3 space-y-1">
              {moreItems.map((item) => {
                const active =
                  item.path === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {safeT(t, item.labelKey, item.fallback)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
