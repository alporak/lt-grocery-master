"use client";

import { useTheme } from "./theme-provider";
import { useI18n } from "./i18n-provider";
import { Button } from "./ui/button";
import { Sun, Moon, Droplets } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  const themes = [
    { value: "light" as const, icon: Sun, label: t("theme.light") },
    { value: "dark" as const, icon: Moon, label: t("theme.dark") },
    { value: "saltibarscia" as const, icon: Droplets, label: t("theme.saltibarscia") },
  ];

  return (
    <div className="flex gap-1">
      {themes.map((th) => (
        <Button
          key={th.value}
          variant={theme === th.value ? "default" : "ghost"}
          size="icon"
          onClick={() => setTheme(th.value)}
          title={th.label}
        >
          <th.icon className="h-4 w-4" />
        </Button>
      ))}
    </div>
  );
}
