"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

const PUBLISHER_ID = process.env.NEXT_PUBLIC_ADSENSE_ID;

function useAdblockDetect(): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const bait = document.createElement("div");
    bait.className = "ad-banner adsbox ad ads advert sponsor";
    bait.style.cssText = "position:absolute;left:-9999px;width:2px;height:2px;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);

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
  if (!PUBLISHER_ID) return null;
  return (
    <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground border border-border rounded px-1 py-px bg-background/50">
      {t("ads.label")}
    </span>
  );
}

function AdUnit({
  slotId,
  format,
  blocked,
  className,
}: {
  slotId: string;
  format?: string;
  blocked: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (blocked || !PUBLISHER_ID) return;
    try {
      (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle || [];
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle as unknown[]).push({});
    } catch {
      // AdSense not available (adblock, no script loaded, etc.)
    }
  }, [blocked]);

  if (!PUBLISHER_ID) return null;

  if (blocked) {
    return (
      <p className="text-xs text-muted-foreground leading-snug">
        {t("ads.adblockNotice")}
      </p>
    );
  }

  return (
    <ins
      ref={ref}
      className={cn("adsbygoogle", className)}
      style={{ display: "block" }}
      data-ad-client={`ca-${PUBLISHER_ID}`}
      data-ad-slot={slotId}
      data-ad-format={format || "auto"}
      data-full-width-responsive="true"
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
  if (!PUBLISHER_ID && !blocked) return null;
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 border border-border rounded-md bg-muted/30",
        small ? "p-2" : "p-3",
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <AdUnit slotId={slotId} blocked={blocked} />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdLeaderboard({ className, slotId = "leaderboard" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  if (!PUBLISHER_ID && !blocked) return null;
  return (
    <div className={cn("relative flex items-center gap-4 border border-border rounded-md bg-muted/30 h-16 px-4", className)}>
      <div className="flex-1 min-w-0">
        <AdUnit slotId={slotId} blocked={blocked} />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdNativeCard({ className, slotId = "native" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  if (!PUBLISHER_ID && !blocked) return null;
  return (
    <div className={cn("relative flex flex-col border border-dashed border-border rounded-lg bg-card overflow-hidden", className)}>
      <div className="flex-1 min-h-[96px] flex items-center justify-center p-4">
        <AdUnit slotId={slotId} format="rectangle" blocked={blocked} />
      </div>
      <div className="absolute top-2 left-2"><AdLabel /></div>
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdSideRail({ className, slotId = "siderail" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  if (!PUBLISHER_ID && !blocked) return null;
  return (
    <div className={cn("relative border border-border rounded-md bg-card p-3", className)}>
      <div className="absolute top-2 right-2"><AdLabel /></div>
      <div className="min-h-[250px]">
        <AdUnit slotId={slotId} format="vertical" blocked={blocked} />
      </div>
      <DismissBtn onClick={dismiss} />
    </div>
  );
}

export function AdSponsoredRow({ className, slotId = "sponsoredrow" }: { className?: string; slotId?: string }) {
  const { blocked, dismissed, dismiss } = useAdState(slotId);
  if (dismissed) return null;
  if (!PUBLISHER_ID && !blocked) return null;
  return (
    <div className={cn("relative flex items-center gap-3 px-3 py-2.5 border border-dashed border-border rounded-md bg-muted/20", className)}>
      <div className="flex-1 min-w-0">
        <AdUnit slotId={slotId} blocked={blocked} />
      </div>
      <AdLabel />
      <DismissBtn onClick={dismiss} />
    </div>
  );
}
