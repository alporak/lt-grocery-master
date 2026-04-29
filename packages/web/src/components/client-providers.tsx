"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "./theme-provider";
import { I18nProvider } from "./i18n-provider";
import { Sidebar, BottomNav } from "./navigation";
import { LanguageSwitcher } from "./language-switcher";
import { AuthButton } from "./auth-button";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60}>
      <ThemeProvider>
        <I18nProvider>
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 md:ml-64">
            {/* Top bar */}
            <header className="sticky top-0 z-40 h-16 border-b bg-card flex items-center justify-between px-4 md:px-6">
              <div className="md:hidden text-lg font-bold text-primary">
                🛒 LT Grocery
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <AuthButton />
                <LanguageSwitcher />
              </div>
            </header>

            {/* Main content */}
            <main className="p-4 md:p-6 pb-20 md:pb-6">{children}</main>
          </div>
          <BottomNav />
        </div>
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
