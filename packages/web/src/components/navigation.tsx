"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "./i18n-provider";

const navItems = [
  { path: "/", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { path: "/products", icon: Package, labelKey: "nav.products" },
  { path: "/categories", icon: LayoutGrid, labelKey: "nav.categories" },
  { path: "/grocery-lists", icon: ShoppingBasket, labelKey: "nav.groceryLists" },
  { path: "/stores", icon: MapPin, labelKey: "nav.stores" },
  { path: "/settings", icon: Settings, labelKey: "nav.settings" },
  { path: "/advanced-settings", icon: SlidersHorizontal, labelKey: "nav.advancedSettings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-4 border-b">
          <span className="text-xl font-bold text-primary">🛒 {t("common.appName")}</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
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
                {t(item.labelKey)}
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

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-card">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
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
                active
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-[4rem]">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
