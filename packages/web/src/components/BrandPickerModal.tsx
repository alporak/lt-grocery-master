"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "./i18n-provider";
import { getPreferredBrand, setPreferredBrand, clearPreferredBrand } from "@/lib/brandPreferences";
import { X, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Brand {
  name: string;
  count: number;
  sampleImage: string | null;
  sampleProductName: string | null;
  minPrice: number | null;
}

interface Props {
  categoryId: string;
  categoryName: string;
  onSelect: (brand: string | null) => void;
  onClose: () => void;
  currentBrand?: string | null;
}

export function BrandPickerModal({
  categoryId,
  categoryName,
  onSelect,
  onClose,
  currentBrand,
}: Props) {
  const { language } = useI18n();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const rememberedBrand = getPreferredBrand(categoryId);

  useEffect(() => {
    fetch(`/api/categories/${categoryId}/brands`)
      .then((r) => r.json())
      .then((d) => {
        setBrands(d.brands || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryId]);

  const handleSelect = (brand: string) => {
    setPreferredBrand(categoryId, brand);
    onSelect(brand);
    onClose();
  };

  const handleAny = () => {
    clearPreferredBrand(categoryId);
    onSelect(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <h2 className="font-semibold text-base">
              {language === "lt" ? "Pasirinkite prekės ženklą" : "Pick a brand"}
            </h2>
            <p className="text-xs text-muted-foreground">{categoryName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-3">
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* "Any brand" option */}
              <button
                onClick={handleAny}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border mb-2 transition-colors text-left ${
                  !currentBrand
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <span className="text-lg">🛒</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {language === "lt" ? "Bet koks prekės ženklas" : "Any brand"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {language === "lt" ? "Pigiausias pasirinkimas" : "Cheapest option"}
                  </p>
                </div>
                {!currentBrand && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>

              {/* Brand grid */}
              <div className="grid grid-cols-2 gap-2">
                {brands.map((b) => {
                  const isSelected = currentBrand === b.name;
                  const isRemembered = rememberedBrand === b.name;

                  return (
                    <button
                      key={b.name}
                      onClick={() => handleSelect(b.name)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between w-full gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {b.sampleImage ? (
                            <img
                              src={b.sampleImage}
                              alt={b.name}
                              className="w-8 h-8 object-contain shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center text-sm shrink-0">
                              🏷️
                            </div>
                          )}
                          <span className="text-sm font-semibold truncate">{b.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isRemembered && (
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          )}
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                      </div>

                      {b.sampleProductName && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 w-full">
                          {b.sampleProductName}
                        </p>
                      )}

                      <div className="flex items-center justify-between w-full mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {b.count} {language === "lt" ? "produktų" : "products"}
                        </span>
                        {b.minPrice !== null && (
                          <span className="text-xs font-semibold text-primary">
                            {language === "lt" ? "nuo " : "from "}€{b.minPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
