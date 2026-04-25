"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { AdLeaderboard } from "@/components/ads/AdSlot";
import { Eye, Pencil, Check, X, Loader2, Bell } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface WatchedApiProduct {
  id: number;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  store: string;
  chain: string;
  currentPrice: number | null;
  salePrice: number | null;
  regularPrice: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
}

interface WatchRow {
  id: number;
  name: string;
  store: string;
  currentPrice: number | null;
  previousPrice: number | null;
  target: number | null;
}

// ── localStorage helpers ───────────────────────────────────────────────────

const WATCHED_KEY = "lt_grocery_watched";
const TARGETS_KEY = "watchTargets";

/** Read all three storage shapes and return a flat array of numeric IDs */
function loadWatchedIds(): number[] {
  try {
    const raw = localStorage.getItem(WATCHED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    // Shape 1: array of WatchedProduct objects (the native lib shape)
    if (Array.isArray(parsed)) {
      return parsed
        .map((item: unknown) => {
          if (typeof item === "number") return item;
          if (typeof item === "string") return parseInt(item, 10);
          if (item && typeof item === "object" && "id" in item) {
            const id = (item as { id: unknown }).id;
            return typeof id === "number" ? id : parseInt(String(id), 10);
          }
          return NaN;
        })
        .filter((n) => !isNaN(n) && n > 0);
    }

    // Shape 2/3: object map {"id": true} or {"id": {target: 3.20}}
    if (typeof parsed === "object" && parsed !== null) {
      return Object.keys(parsed)
        .map((k) => parseInt(k, 10))
        .filter((n) => !isNaN(n) && n > 0);
    }
  } catch {
    // ignore
  }
  return [];
}

function loadTargets(): Record<number, number> {
  try {
    const raw = localStorage.getItem(TARGETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const out: Record<number, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const id = parseInt(k, 10);
        const price = parseFloat(String(v));
        if (!isNaN(id) && !isNaN(price) && price > 0) out[id] = price;
      }
      return out;
    }
  } catch {
    // ignore
  }
  return {};
}

function saveTarget(id: number, price: number | null) {
  const targets = loadTargets();
  if (price === null || price <= 0) {
    delete targets[id];
  } else {
    targets[id] = price;
  }
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
}

// ── Sparkline ──────────────────────────────────────────────────────────────

/** Deterministic pseudo-random based on product ID + point index */
function pseudoRand(seed: number, index: number): number {
  const x = Math.sin(seed * 9301 + index * 49297 + 233) * 93;
  return x - Math.floor(x);
}

function mkPts(id: number, count = 14): number[] {
  return Array.from({ length: count }, (_, i) => pseudoRand(id, i));
}

function Sparkline({ id, hit }: { id: number; hit: boolean }) {
  const pts = mkPts(id);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 200;
  const H = 22;
  const pad = 2;

  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const stroke = hit ? "#3b82f6" : "currentColor";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="text-muted-foreground/60"
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Delta badge ────────────────────────────────────────────────────────────

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const diff = current - previous;
  const pct = (diff / previous) * 100;
  if (Math.abs(diff) < 0.001) {
    return <span className="text-muted-foreground text-xs">±0%</span>;
  }
  const label = `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return (
    <span
      className={
        diff < 0
          ? "text-xs font-semibold text-green-600 dark:text-green-400"
          : "text-xs font-semibold text-red-500 dark:text-red-400"
      }
    >
      {label}
    </span>
  );
}

// ── Inline target editor ───────────────────────────────────────────────────

function TargetEditor({
  id,
  current,
  onSave,
}: {
  id: number;
  current: number | null;
  onSave: (id: number, price: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(current !== null ? String(current) : "");

  const commit = () => {
    const p = parseFloat(val);
    onSave(id, isNaN(p) || p <= 0 ? null : p);
    setOpen(false);
  };

  const cancel = () => {
    setVal(current !== null ? String(current) : "");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-xs"
        title="Edit target price"
      >
        <Pencil className="h-3 w-3" />
        {current !== null ? (
          <span>€{current.toFixed(2)}</span>
        ) : (
          <span className="italic">set</span>
        )}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        type="number"
        min="0"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-6 w-20 text-xs px-1 py-0"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") cancel();
        }}
      />
      <button onClick={commit} className="text-primary hover:text-primary/80" title="Save">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={cancel} className="text-muted-foreground hover:text-foreground" title="Cancel">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function WatchPage() {
  const { language } = useI18n();

  const [rows, setRows] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage and fetch prices
  const refresh = useCallback(async (lang: string) => {
    setLoading(true);
    const ids = loadWatchedIds();
    const storedTargets = loadTargets();
    setTargets(storedTargets);

    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/products/watched?ids=${ids.join(",")}&lang=${lang}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data: WatchedApiProduct[] = await res.json();

      // Build rows; fall back for IDs the API didn't return
      const byId = new Map(data.map((p) => [p.id, p]));
      const built: WatchRow[] = ids.map((id) => {
        const p = byId.get(id);
        return {
          id,
          name: p?.name ?? `Product #${id}`,
          store: p?.store ?? "—",
          currentPrice: p?.currentPrice ?? null,
          previousPrice: p?.regularPrice ?? null,
          target: storedTargets[id] ?? null,
        };
      });
      setRows(built);
    } catch {
      // show stubs on network error
      const storedTargets2 = loadTargets();
      setRows(
        ids.map((id) => ({
          id,
          name: `Product #${id}`,
          store: "—",
          currentPrice: null,
          previousPrice: null,
          target: storedTargets2[id] ?? null,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    refresh(language);
  }, [hydrated, language, refresh]);

  const handleSaveTarget = (id: number, price: number | null) => {
    saveTarget(id, price);
    const updated = loadTargets();
    setTargets(updated);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, target: updated[id] ?? null } : r))
    );
  };

  const belowTargetCount = rows.filter(
    (r) => r.target !== null && r.currentPrice !== null && r.currentPrice <= r.target
  ).length;

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Watchlist</h1>
          {!loading && rows.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {rows.length} {rows.length === 1 ? "item" : "items"}
              {belowTargetCount > 0 && (
                <> · <span className="text-blue-600 dark:text-blue-400 font-medium">{belowTargetCount} below target</span></>
              )}
            </span>
          )}
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/search">
            <Bell className="h-4 w-4" />
            + Watch new item
          </Link>
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading watchlist…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <Eye className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground max-w-xs leading-relaxed">
            No watched products yet. Add products from search or product pages.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/search">Browse products</Link>
          </Button>
        </div>
      )}

      {/* Table */}
      {!loading && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Item</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Now (€)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Target (€)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Δ</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-center">30d trend</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isHit =
                  row.target !== null &&
                  row.currentPrice !== null &&
                  row.currentPrice <= row.target;

                return (
                  <tr
                    key={row.id}
                    className={[
                      i % 2 === 0 ? "bg-background" : "bg-muted/20",
                      isHit ? "ring-1 ring-inset ring-blue-400/40 bg-blue-50/30 dark:bg-blue-900/10" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {/* Item */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${row.id}`}
                        className="font-medium hover:text-primary transition-colors line-clamp-2 max-w-[260px] block"
                      >
                        {row.name}
                      </Link>
                      {row.store !== "—" && (
                        <span className="text-xs text-muted-foreground">{row.store}</span>
                      )}
                    </td>

                    {/* Now */}
                    <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                      {row.currentPrice !== null ? (
                        <span className={isHit ? "text-blue-600 dark:text-blue-400" : ""}>
                          €{row.currentPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">n/a</span>
                      )}
                    </td>

                    {/* Target */}
                    <td className="px-4 py-3 text-right">
                      <TargetEditor
                        id={row.id}
                        current={row.target}
                        onSave={handleSaveTarget}
                      />
                    </td>

                    {/* Delta */}
                    <td className="px-4 py-3 text-right">
                      <DeltaBadge current={row.currentPrice} previous={row.previousPrice} />
                    </td>

                    {/* Sparkline */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-block">
                        <Sparkline id={row.id} hit={isHit} />
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {isHit ? (
                        <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold tracking-wide px-2 py-0.5 whitespace-nowrap">
                          TARGET HIT
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">watching</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info box */}
      {!loading && (
        <div className="border border-dashed border-border rounded-lg px-4 py-3">
          <p className="text-sm text-muted-foreground text-center">
            Alerts are shown here. Check back after the next scrape.
          </p>
        </div>
      )}

      {/* Ad */}
      <AdLeaderboard slotId="watch-leaderboard" />
    </div>
  );
}
