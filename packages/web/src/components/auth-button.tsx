"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { LogIn, LogOut, User } from "lucide-react";
import { useI18n } from "./i18n-provider";

export function AuthButton() {
  const { data: session, status } = useSession();
  const { t } = useI18n();

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border hover:bg-accent transition-colors"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">{t("auth.signIn")}</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {session.user?.image ? (
        <img
          src={session.user.image}
          alt={session.user.name || ""}
          className="h-8 w-8 rounded-full"
        />
      ) : (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="h-4 w-4 text-primary" />
        </div>
      )}
      <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
        {session.user?.name}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("auth.signOut")}
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
