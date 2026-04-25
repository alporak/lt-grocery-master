"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

function useAdblockDetect(): boolean {
  const [blocked, setBlocked] = useState(false);
  const baitRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bait = document.createElement("div");
    bait.className = "ad-banner adsbox ad ads advert sponsor";
    bait.style.cssText = "position:absolute;left:-9999px;width:2px;height:2px;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);
    baitRef.current = bait;

    const check = () => {
      if (!bait.offsetParent || bait.offsetHeight === 0 || getComputedStyle(bait).display === "none") {
        setBlocked(true);
      }
    };
    const t = setTimeout(check, 150);
    return () => {
      clearTimeout(t);
      bait.remove();
    };
  }, []);

  return blocked;
}

function useDismiss(slotId: string): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(sessionStorage.getItem(`adSlotDismissed_${slotId}`) === "1");
  }, [slotId]);
  const dismiss = () => {
    sessionStorage.setItem(`adSlotDismissed_${slotId}`, "1");
    setDismissed(true);
  };
  return [dismissed, dismiss];
}

function AdLabel() {
  const { t } = useI18n();
  return (
    <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1 py-px bg-background/50">
      {t("ads.label")}
    </span>
  );
}

function BegCopy({ blocked, size = "sm" }: { blocked: boolean; size?: "sm" | "md" | "lg" }) {
  const { t } = useI18n();
  const key = blocked ? "ads.pleaseWhitelistDesperate" : "ads.pleaseWhitelist";
  const cls = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[11px]";
  return <p className={cn(cls, "leading-snug text-muted-foreground")}>{t(key)}</p>;
}

function HatchImg({ className }: { className?: string }) {
  return (
    <div
      className={cn("border border-border rounded-sm bg-muted/40", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 10px)",
        color: "hsl(var(--border))",
      }}
    />
  );
}

function DismissBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="dismiss"
      className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

function useAdState(slotId: string) {
  const blocked = useAdblockDetect();
  const [dismissed, dismiss] = useDismiss(slotId);
  return { blocked, dismissed, dismiss };
}

export function AdBanner({ small, className, slotId = "banner" }: { small?: boolean; className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 border border-border rounded-md bg-muted/30",
        small ? "p-2" : "p-3",
        className,
      )}
    >
      <HatchImg className={cn("shrink-0", small ? "w-8 h-8" : "w-10 h-10")} />
      <div className="flex-1 min-w-0">
        <BegCopy blocked={blocked} size={small ? "sm" : "md"} />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdLeaderboard({ className, slotId = "leaderboard" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  return (
    <div className={cn("relative flex items-center gap-4 border border-border rounded-md bg-muted/30 h-16 px-4", className)}>
      <HatchImg className="w-10 h-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <BegCopy blocked={blocked} size="md" />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdNativeCard({ className, slotId = "native" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  return (
    <div className={cn("relative flex flex-col border border-dashed border-border rounded-lg bg-card overflow-hidden", className)}>
      <HatchImg className="flex-1 rounded-none border-0 border-b border-dashed min-h-[96px]" />
      <div className="p-3">
        <BegCopy blocked={blocked} size="sm" />
      </div>
      <div className="absolute top-2 left-2"><AdLabel /></div>
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdSideRail({ className, slotId = "siderail" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  return (
    <div className={cn("relative border border-border rounded-md bg-card p-3", className)}>
      <div className="absolute top-2 right-2"><AdLabel /></div>
      <HatchImg className="w-full h-24 mb-2" />
      <BegCopy blocked={blocked} size="sm" />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdSponsoredRow({ className, slotId = "sponsoredrow" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  return (
    <div className={cn("relative flex items-center gap-3 px-3 py-2.5 border border-dashed border-border rounded-md bg-muted/20", className)}>
      <HatchImg className="w-8 h-8 shrink-0" />
      <div className="flex-1 min-w-0">
        <BegCopy blocked={blocked} size="sm" />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}
