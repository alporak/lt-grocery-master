"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Plus, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Link from "next/link";

interface PriceRecord {
  id: number;
  regularPrice: number;
  salePrice: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
  loyaltyPrice: number | null;
  campaignText: string | null;
  scrapedAt: string;
}

interface ProductDetail {
  id: number;
  nameLt: string;
  nameEn: string | null;
  categoryLt: string | null;
  brand: string | null;
  weightValue: number | null;
  weightUnit: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  store: { id: number; name: string; chain: string };
  priceRecords: PriceRecord[];
  groupMembers?: Array<{
    id: number;
    nameLt: string;
    nameEn: string | null;
    brand: string | null;
    weightValue: number | null;
    weightUnit: string | null;
    imageUrl: string | null;
    store: { id: number; name: string; chain: string };
    price: {
      regular: number;
      sale: number | null;
      loyalty: number | null;
      unit: number | null;
      unitLabel: string | null;
    } | null;
  }>;
}

interface ProductPreviewModalProps {
  productId: number;
  onClose: () => void;
  onAddToList?: (name: string) => void;
}

const CHAIN_COLORS: Record<string, string> = {
  IKI: "bg-red-100 text-red-800",
  MAXIMA: "bg-orange-100 text-orange-800",
  BARBORA: "bg-orange-100 text-orange-800",
  RIMI: "bg-blue-100 text-blue-800",
  PROMO: "bg-purple-100 text-purple-800",
};

const CHAIN_TEXT: Record<string, string> = {
  IKI: "text-red-600",
  MAXIMA: "text-orange-600",
  BARBORA: "text-orange-600",
  RIMI: "text-blue-600",
  PROMO: "text-purple-600",
};

export function ProductPreviewModal({ productId, onClose, onAddToList }: ProductPreviewModalProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setProduct(null);
    fetch(`/api/products/${productId}?days=90`)
      .then((r) => r.json())
      .then((d) => { setProduct(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [productId]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const latestPrice = product?.priceRecords[product.priceRecords.length - 1];

  const chartData = product?.priceRecords.map((pr) => ({
    date: new Date(pr.scrapedAt).toLocaleDateString("lt-LT", { month: "short", day: "numeric" }),
    regular: pr.regularPrice,
    sale: pr.salePrice ?? undefined,
    loyalty: pr.loyaltyPrice ?? undefined,
  }));

  const effectivePrice = latestPrice
    ? Math.min(latestPrice.regularPrice, latestPrice.salePrice ?? Infinity, latestPrice.loyaltyPrice ?? Infinity)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-background w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl shadow-2xl max-h-[92dvh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b sticky top-0 bg-background z-10">
          <div className="flex-1 min-w-0 pr-2">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : product ? (
              <>
                <h2 className="font-bold text-base leading-tight">{product.nameLt}</h2>
                {product.nameEn && product.nameEn !== product.nameLt && (
                  <p className="text-xs text-muted-foreground mt-0.5">{product.nameEn}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <Badge className={`text-xs ${CHAIN_COLORS[product.store.chain] ?? "bg-muted text-muted-foreground"}`}>
                    {product.store.name}
                  </Badge>
                  {product.brand && <Badge variant="secondary" className="text-xs">{product.brand}</Badge>}
                  {product.weightValue && product.weightUnit && (
                    <Badge variant="outline" className="text-xs">{product.weightValue}{product.weightUnit}</Badge>
                  )}
                  {product.categoryLt && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">{product.categoryLt}</Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Product not found</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {product && (
          <div className="p-4 space-y-4 flex-1">
            {/* Image + Prices */}
            <div className="flex gap-4">
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.nameLt}
                  className="w-24 h-24 object-contain rounded-lg border bg-white shrink-0"
                />
              )}
              <div className="flex-1 space-y-2">
                {latestPrice && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Regular price</p>
                      <p className={`text-xl font-bold ${latestPrice.salePrice ? "line-through text-muted-foreground text-base" : ""}`}>
                        {latestPrice.regularPrice.toFixed(2)}€
                      </p>
                    </div>
                    {latestPrice.salePrice && (
                      <div>
                        <p className="text-xs text-muted-foreground">Sale price</p>
                        <p className="text-xl font-bold text-green-600">{latestPrice.salePrice.toFixed(2)}€</p>
                      </div>
                    )}
                    {latestPrice.loyaltyPrice && !latestPrice.salePrice && (
                      <div>
                        <p className="text-xs text-muted-foreground">Loyalty price</p>
                        <p className="text-xl font-bold text-primary">{latestPrice.loyaltyPrice.toFixed(2)}€</p>
                      </div>
                    )}
                    {latestPrice.unitPrice && (
                      <div>
                        <p className="text-xs text-muted-foreground">Unit price</p>
                        <p className="text-sm font-semibold">{latestPrice.unitPrice.toFixed(2)} {latestPrice.unitLabel}</p>
                      </div>
                    )}
                  </div>
                )}
                {latestPrice?.campaignText && (
                  <Badge variant="destructive" className="text-xs">{latestPrice.campaignText}</Badge>
                )}
              </div>
            </div>

            {/* Price stats */}
            {product.priceRecords.length > 1 && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Min</p>
                  <p className="font-bold">
                    {Math.min(...product.priceRecords.map((p) => Math.min(p.regularPrice, p.salePrice ?? Infinity, p.loyaltyPrice ?? Infinity))).toFixed(2)}€
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-bold text-primary">{effectivePrice?.toFixed(2)}€</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Max</p>
                  <p className="font-bold">{Math.max(...product.priceRecords.map((p) => p.regularPrice)).toFixed(2)}€</p>
                </div>
              </div>
            )}

            {/* Price chart */}
            {chartData && chartData.length >= 2 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Price history (90d)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={10} tick={{ fontSize: 10 }} />
                    <YAxis fontSize={10} tickFormatter={(v) => `${v}€`} width={40} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}€`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="regular" name="Regular" stroke="hsl(var(--chart-rimi))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sale" name="Sale" stroke="hsl(var(--chart-iki))" strokeWidth={2} dot={false} connectNulls={false} />
                    {chartData.some(d => d.loyalty) && (
                      <Line type="monotone" dataKey="loyalty" name="Loyalty" stroke="hsl(var(--chart-barbora))" strokeWidth={2} dot={false} connectNulls={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Cross-store comparison */}
            {product.groupMembers && product.groupMembers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Other stores</p>
                <div className="space-y-1.5">
                  {product.groupMembers.map((m) => {
                    const price = m.price
                      ? Math.min(m.price.regular, m.price.sale ?? Infinity, m.price.loyalty ?? Infinity)
                      : null;
                    return (
                      <Link
                        key={m.id}
                        href={`/products/${m.id}`}
                        target="_blank"
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent/50 transition-colors text-sm"
                        onClick={onClose}
                      >
                        {m.imageUrl && (
                          <img src={m.imageUrl} alt="" className="w-8 h-8 object-contain rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <Badge className={`text-xs mr-1 ${CHAIN_COLORS[m.store.chain] ?? "bg-muted"}`}>
                            {m.store.name}
                          </Badge>
                          {m.brand && <span className="text-xs text-muted-foreground">{m.brand}</span>}
                          {m.weightValue && m.weightUnit && (
                            <span className="text-xs text-muted-foreground ml-1">· {m.weightValue}{m.weightUnit}</span>
                          )}
                        </div>
                        {price != null && (
                          <div className="text-right shrink-0">
                            <span className="font-bold">{price.toFixed(2)}€</span>
                            {m.price?.sale && m.price.sale < m.price.regular && (
                              <p className="text-[10px] line-through text-muted-foreground">{m.price.regular.toFixed(2)}€</p>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-background">
          {product && onAddToList && (
            <Button
              className="flex-1 gap-2"
              onClick={() => {
                onAddToList(product.nameLt);
                onClose();
              }}
            >
              <Plus className="h-4 w-4" />
              Add to list
            </Button>
          )}
          {product?.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Store page
            </a>
          )}
          {product && (
            <Link
              href={`/products/${product.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm hover:bg-accent transition-colors"
              onClick={onClose}
            >
              <ExternalLink className="h-4 w-4" />
              Full page
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
