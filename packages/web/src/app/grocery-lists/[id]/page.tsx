"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Scale,
  Download,
  Check,
  MapPin,
  Navigation,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  ArrowRight,
  Package,
  Info,
} from "lucide-react";
import { parseItem, formatParsed } from "@/lib/parse-item";
import { computeLineCost } from "@/lib/compare";

interface Suggestion {
  id: number;
  name: string;
  nameEn: string | null;
  store: string;
  chain: string;
  price: number | null;
  unitPrice: number | null;
  unitLabel: string | null;
  weightValue: number | null;
  weightUnit: string | null;
}

interface GroceryItem {
  id?: number;
  itemName: string;
  quantity: number;
  unit: string | null;
  checked: boolean;
}

interface GroceryList {
  id: number;
  name: string;
  items: GroceryItem[];
}

interface StoreCompareResult {
  storeId: number;
  storeName: string;
  storeChain: string;
  items: Array<{
    itemName: string;
    match: {
      productId: number;
      productName: string;
      price: number;
      salePrice?: number;
      loyaltyPrice?: number;
      unitPrice?: number;
      brand?: string;
      weightValue?: number;
      weightUnit?: string;
      imageUrl?: string;
      nameLt?: string;
      nameEn?: string;
      categoryLt?: string;
      score?: number;
      matchType?: "pack" | "unit";
    } | null;
    candidates: Array<{
      productId: number;
      productName: string;
      price: number;
      salePrice?: number;
      loyaltyPrice?: number;
      unitPrice?: number;
      brand?: string;
      weightValue?: number;
      weightUnit?: string;
      imageUrl?: string;
      nameLt?: string;
      nameEn?: string;
      categoryLt?: string;
      score?: number;
      matchType?: "pack" | "unit";
    }>;
    lineCost: number;
  }>;
  totalCost: number;
  matchedCount: number;
}

interface SmartRecommendation {
  storeId: number;
  storeName: string;
  storeChain: string;
  totalCost: number;
  distanceKm: number | null;
  travelPenalty: number;
  missingPenalty: number;
  smartScore: number;
  matchedCount: number;
  totalItems: number;
}

interface CompareResult {
  storeResults: StoreCompareResult[];
  cheapestStoreId: number | null;
  cheapestTotal: number;
  splitResult: {
    items: Array<{
      itemName: string;
      bestStoreId: number;
      bestStoreName: string;
      bestPrice: number;
      productName: string;
    }>;
    totalCost: number;
  };
  smartRecommendation?: SmartRecommendation[];
}

export default function GroceryListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t, language } = useI18n();
  const [list, setList] = useState<GroceryList | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [allLists, setAllLists] = useState<Array<{ id: number; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [pickedSuggestion, setPickedSuggestion] = useState<Suggestion | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, Record<number, number>>>({});
  const suggestRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchList = useCallback(() => {
    if (!params.id) return;
    fetch(`/api/grocery-lists/${params.id}`)
      .then((r) => r.json())
      .then(setList)
      .catch(() => {});
  }, [params.id]);

  useEffect(() => {
    fetchList();
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then((lists: Array<{ id: number; name: string }>) =>
        setAllLists(lists.filter((l) => l.id !== Number(params.id)))
      )
      .catch(() => {});
  }, [fetchList, params.id]);

  // Autocomplete suggestions
  useEffect(() => {
    if (newItem.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/products/suggest?q=${encodeURIComponent(newItem)}&limit=6`)
        .then((r) => r.json())
        .then((data: Suggestion[]) => {
          setSuggestions(data);
          setShowSuggestions(data.length > 0);
          setSelectedSuggestion(-1);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [newItem]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const saveItems = async (items: GroceryItem[]) => {
    setSaving(true);
    await fetch(`/api/grocery-lists/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setSaving(false);
  };

  const addItem = async () => {
    if (!newItem.trim() || !list) return;
    let itemName = newItem.trim();
    let quantity = parseFloat(newQty) || 1;
    let unit: string | null = null;

    // If user didn't pick a suggestion, parse the raw text
    if (!pickedSuggestion) {
      const parsed = parseItem(itemName);
      itemName = parsed.name;
      quantity = parsed.quantity;
      unit = parsed.unit;
      if (parsed.name !== newItem.trim()) {
        setParsedPreview(formatParsed(parsed));
        setTimeout(() => setParsedPreview(null), 3000);
      }
    }

    const items = [
      ...list.items,
      { itemName, quantity, unit, checked: false },
    ];
    setList({ ...list, items });
    setNewItem("");
    setNewQty("1");
    setPickedSuggestion(null);
    setSuggestions([]);
    setShowSuggestions(false);
    await saveItems(items);
  };

  const pickSuggestion = (s: Suggestion) => {
    setNewItem(s.name);
    setPickedSuggestion(s);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestion((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedSuggestion >= 0) {
        e.preventDefault();
        pickSuggestion(suggestions[selectedSuggestion]);
        return;
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        return;
      }
    }
    if (e.key === "Enter" && selectedSuggestion < 0) {
      addItem();
    }
  };

  const removeItem = async (index: number) => {
    if (!list) return;
    const items = list.items.filter((_, i) => i !== index);
    setList({ ...list, items });
    await saveItems(items);
  };

  const updateItemQty = async (index: number, qty: number) => {
    if (!list || qty <= 0) return;
    const items = list.items.map((item, i) =>
      i === index ? { ...item, quantity: qty } : item
    );
    setList({ ...list, items });
    setEditingIndex(null);
    await saveItems(items);
  };

  const getQuantityPresets = (s: Suggestion) => {
    const unit = s.weightUnit?.toLowerCase();
    if (unit === "kg" || unit === "g") {
      return [
        { value: 0.25, label: "250g" },
        { value: 0.5, label: "500g" },
        { value: 1, label: "1 kg" },
        { value: 2, label: "2 kg" },
      ];
    }
    if (unit === "l" || unit === "ml") {
      return [
        { value: 1, label: "1" },
        { value: 2, label: "2" },
        { value: 3, label: "3" },
        { value: 6, label: "6" },
      ];
    }
    return [
      { value: 1, label: "1" },
      { value: 2, label: "2" },
      { value: 3, label: "3" },
      { value: 5, label: "5" },
      { value: 10, label: "10" },
    ];
  };

  const toggleCheck = async (index: number) => {
    if (!list) return;
    const items = list.items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    setList({ ...list, items });
    await saveItems(items);
  };

  const comparePrices = async () => {
    if (!list || list.items.length === 0) return;
    setComparing(true);
    try {
      const result = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.items.map((i) => ({
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit || undefined,
          })),
          language,
        }),
      }).then((r) => r.json());
      setCompareResult(result);
    } catch (err) {
      console.error(err);
    }
    setComparing(false);
  };

  const importFromList = async (sourceId: string) => {
    await fetch(`/api/grocery-lists/${params.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    fetchList();
  };

  // Toggle expanded state for a grocery item in comparison
  const toggleItemExpanded = (itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  // Select a different candidate for an item in a store
  const selectCandidate = (itemName: string, storeId: number, candidateIndex: number) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [itemName]: { ...(prev[itemName] || {}), [storeId]: candidateIndex },
    }));
  };

  // Get the effective match for an item in a store (respecting user selection)
  const getEffectiveMatch = (itemName: string, storeId: number, storeResult: StoreCompareResult) => {
    const storeItem = storeResult.items.find((i) => i.itemName === itemName);
    if (!storeItem) return null;
    const selectedIdx = selectedCandidates[itemName]?.[storeId] ?? 0;
    return storeItem.candidates[selectedIdx] || storeItem.match;
  };

  // Recalculate store totals based on current candidate selections
  const recalculatedResults = useMemo(() => {
    if (!compareResult || !list) return null;
    return compareResult.storeResults.map((sr) => {
      let totalCost = 0;
      let matchedCount = 0;
      const items = sr.items.map((item) => {
        const selectedIdx = selectedCandidates[item.itemName]?.[sr.storeId] ?? 0;
        const match = item.candidates[selectedIdx] || item.match;
        const listItem = list.items.find((li) => li.itemName === item.itemName);
        const qty = listItem?.quantity ?? 1;
        let lineCost = 0;
        if (match) {
          lineCost = computeLineCost(match, qty);
          matchedCount++;
        }
        totalCost += lineCost;
        return { ...item, match, lineCost };
      });
      return { ...sr, items, totalCost, matchedCount };
    });
  }, [compareResult, selectedCandidates, list]);

  // Find cheapest store from recalculated results
  const cheapestRecalc = useMemo(() => {
    if (!recalculatedResults || !list) return null;
    const full = recalculatedResults.filter((s) => s.matchedCount === list.items.length);
    if (full.length > 0) return full.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
    return recalculatedResults.reduce((a, b) =>
      b.matchedCount > a.matchedCount || (b.matchedCount === a.matchedCount && b.totalCost < a.totalCost) ? b : a
    );
  }, [recalculatedResults, list]);

  // Split shopping recalculated
  const splitRecalc = useMemo(() => {
    if (!recalculatedResults || !list) return null;
    const items = list.items.map((item) => {
      let bestPrice = Infinity;
      let bestStoreId = 0;
      let bestStoreName = "";
      let bestStoreChain = "";
      let bestMatch: any = null;
      for (const sr of recalculatedResults) {
        const si = sr.items.find((i) => i.itemName === item.itemName);
        if (si?.match && si.lineCost > 0 && si.lineCost < bestPrice) {
          bestPrice = si.lineCost;
          bestStoreId = sr.storeId;
          bestStoreName = sr.storeName;
          bestStoreChain = sr.storeChain;
          bestMatch = si.match;
        }
      }
      return {
        itemName: item.itemName,
        bestStoreId,
        bestStoreName,
        bestStoreChain,
        bestPrice: bestPrice === Infinity ? 0 : bestPrice,
        match: bestMatch,
      };
    });
    return { items, totalCost: items.reduce((s, i) => s + i.bestPrice, 0) };
  }, [recalculatedResults, list]);

  if (!list) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const chainColor: Record<string, string> = {
    IKI: "text-red-600",
    MAXIMA: "text-orange-600",
    BARBORA: "text-orange-600",
    RIMI: "text-blue-600",
    PROMO: "text-purple-600",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{list.name}</h1>
        {saving && (
          <Badge variant="secondary" className="text-xs animate-pulse">
            {t("common.save")}...
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{t("groceryLists.addItem")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    placeholder={t("groceryLists.itemName")}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestRef}
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto"
                    >
                      {suggestions.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => pickSuggestion(s)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2 ${
                            i === selectedSuggestion ? "bg-accent" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.store}</p>
                          </div>
                          {s.price != null && (
                            <span className="text-xs font-semibold shrink-0">
                              {s.price.toFixed(2)}€
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  placeholder={t("groceryLists.quantity")}
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="w-20"
                  min="0.1"
                  step="0.1"
                />
                <Button onClick={addItem} size="icon" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick quantity presets */}
              {pickedSuggestion && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-1">
                    {pickedSuggestion.weightUnit && (
                      <span className="font-medium">
                        {pickedSuggestion.weightValue}{pickedSuggestion.weightUnit}
                        {" · "}
                      </span>
                    )}
                    Qty:
                  </span>
                  {getQuantityPresets(pickedSuggestion).map((preset) => (
                    <Button
                      key={preset.label}
                      variant={newQty === String(preset.value) ? "default" : "outline"}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setNewQty(String(preset.value))}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Parsed item preview */}
              {parsedPreview && (
                <div className="flex items-center gap-2 mt-2 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <Info className="h-3 w-3" />
                  <span>Parsed: <strong>{parsedPreview}</strong></span>
                </div>
              )}

              {/* Import from old list */}
              {allLists.length > 0 && (
                <div className="mt-3">
                  <Select onValueChange={importFromList}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("groceryLists.importFromOld")} />
                    </SelectTrigger>
                    <SelectContent>
                      {allLists.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          <Download className="h-3 w-3 inline mr-2" />
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items list */}
          <Card>
            <CardContent className="p-0">
              {list.items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {t("groceryLists.noLists")}
                </p>
              ) : (
                <ul className="divide-y">
                  {list.items.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <button
                        onClick={() => toggleCheck(index)}
                        className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          item.checked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input"
                        }`}
                      >
                        {item.checked && <Check className="h-3 w-3" />}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          item.checked
                            ? "line-through text-muted-foreground"
                            : ""
                        }`}
                      >
                        {item.itemName}
                      </span>
                      <span className="text-sm text-muted-foreground shrink-0">
                        {editingIndex === index ? (
                          <input
                            type="number"
                            className="w-14 h-6 text-xs text-center border rounded bg-background"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            onBlur={() => {
                              const q = parseFloat(editQty);
                              if (q > 0) updateItemQty(index, q);
                              else setEditingIndex(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const q = parseFloat(editQty);
                                if (q > 0) updateItemQty(index, q);
                                else setEditingIndex(null);
                              } else if (e.key === "Escape") {
                                setEditingIndex(null);
                              }
                            }}
                            autoFocus
                            min="0.1"
                            step="0.1"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingIndex(index);
                              setEditQty(String(item.quantity));
                            }}
                            className="hover:bg-accent px-1 rounded cursor-pointer"
                            title="Click to edit quantity"
                          >
                            ×{item.quantity}
                          </button>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {list.items.length > 0 && (
            <Button
              onClick={comparePrices}
              disabled={comparing}
              className="w-full gap-2"
              size="lg"
            >
              <Scale className="h-5 w-5" />
              {comparing ? t("common.loading") : t("groceryLists.comparePrices")}
            </Button>
          )}
        </div>

        {/* Comparison results */}
        <div>
          {compareResult && recalculatedResults && (
            <div className="space-y-6">
              {/* Section 1: Item Matching */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t("compare.itemMatching") || "Matched Products"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.items.map((item) => {
                    const isExpanded = expandedItems.has(item.itemName);
                    // Collect all candidates across stores for this item
                    const allStoreCandidates = recalculatedResults.map((sr) => {
                      const storeItem = sr.items.find((i) => i.itemName === item.itemName);
                      return { store: sr, storeItem };
                    }).filter((x) => x.storeItem?.match);

                    // Best match overall (cheapest line cost across stores)
                    const bestOverall = allStoreCandidates.reduce<{
                      store: typeof recalculatedResults[0];
                      match: NonNullable<typeof allStoreCandidates[0]["storeItem"]>["match"];
                      lineCost: number;
                    } | null>((best, { store, storeItem }) => {
                      if (!storeItem?.match) return best;
                      const lc = computeLineCost(storeItem.match, item.quantity);
                      if (!best || lc < best.lineCost) return { store, match: storeItem.match, lineCost: lc };
                      return best;
                    }, null);

                    const foundCount = allStoreCandidates.length;

                    return (
                      <div key={item.itemName} className="border rounded-lg overflow-hidden">
                        {/* Collapsed header */}
                        <button
                          onClick={() => toggleItemExpanded(item.itemName)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.itemName}</span>
                              {item.quantity !== 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  ×{item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                </Badge>
                              )}
                            </div>
                            {bestOverall?.match ? (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground truncate">
                                  {bestOverall.match.productName}
                                  {bestOverall.match.brand && (
                                    <span className="text-muted-foreground/70"> · {bestOverall.match.brand}</span>
                                  )}
                                  {bestOverall.match.weightValue && bestOverall.match.weightUnit && (
                                    <span className="text-muted-foreground/70"> · {bestOverall.match.weightValue}{bestOverall.match.weightUnit}</span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-red-500 italic">{t("compare.notFound")}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {bestOverall && (
                              <div className="text-right">
                                <span className="text-sm font-semibold">{bestOverall.lineCost.toFixed(2)}€</span>
                                <p className={`text-[10px] ${chainColor[bestOverall.store.storeChain] || "text-muted-foreground"}`}>
                                  {bestOverall.store.storeName}
                                  {bestOverall.match?.matchType === "pack" && " · pack"}
                                  {bestOverall.match?.matchType === "unit" && item.quantity > 1 && ` · ${item.quantity}×`}
                                </p>
                              </div>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {foundCount}/{recalculatedResults.length}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {/* Expanded: per-store candidates */}
                        {isExpanded && (
                          <div className="border-t bg-muted/30 px-4 py-3 space-y-3">
                            {recalculatedResults.map((sr) => {
                              const storeItem = sr.items.find((i) => i.itemName === item.itemName);
                              if (!storeItem || storeItem.candidates.length === 0) {
                                return (
                                  <div key={sr.storeId} className="flex items-center justify-between text-sm opacity-50">
                                    <span className={`font-medium ${chainColor[sr.storeChain] || ""}`}>{sr.storeName}</span>
                                    <span className="text-xs italic">{t("compare.notFound")}</span>
                                  </div>
                                );
                              }
                              const selectedIdx = selectedCandidates[item.itemName]?.[sr.storeId] ?? 0;
                              return (
                                <div key={sr.storeId} className="space-y-1">
                                  <p className={`text-xs font-semibold ${chainColor[sr.storeChain] || ""}`}>
                                    {sr.storeName}
                                  </p>
                                  {storeItem.candidates.map((c, ci) => {
                                    const effectivePrice = Math.min(
                                      c.price,
                                      c.salePrice ?? Infinity,
                                      c.loyaltyPrice ?? Infinity
                                    );
                                    const lineCost = computeLineCost(c, item.quantity);
                                    const isSelected = ci === selectedIdx;
                                    const isPack = c.matchType === "pack";
                                    return (
                                      <button
                                        key={c.productId}
                                        onClick={() => selectCandidate(item.itemName, sr.storeId, ci)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors ${
                                          isSelected
                                            ? "bg-primary/10 border border-primary/30"
                                            : "hover:bg-accent/50 border border-transparent"
                                        }`}
                                      >
                                        {c.imageUrl && (
                                          <img
                                            src={c.imageUrl}
                                            alt=""
                                            className="w-8 h-8 object-contain rounded shrink-0"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">{c.productName}</p>
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            {c.brand && <span>{c.brand}</span>}
                                            {c.brand && c.weightValue && <span>·</span>}
                                            {c.weightValue && c.weightUnit && (
                                              <span>{c.weightValue}{c.weightUnit}</span>
                                            )}
                                            {isPack && (
                                              <Badge variant="secondary" className="text-[10px] py-0 px-1 ml-1">
                                                {item.quantity}-pack
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                          <p className="font-semibold text-sm">{lineCost.toFixed(2)}€</p>
                                          {!isPack && item.quantity > 1 && (
                                            <p className="text-[10px] text-muted-foreground">
                                              {item.quantity} × {effectivePrice.toFixed(2)}€
                                            </p>
                                          )}
                                          {isPack && (
                                            <p className="text-[10px] text-muted-foreground">
                                              {(effectivePrice / item.quantity).toFixed(2)}€/ea
                                            </p>
                                          )}
                                          {c.salePrice && c.salePrice < c.price && !isPack && item.quantity <= 1 && (
                                            <p className="text-[10px] line-through text-muted-foreground">
                                              {c.price.toFixed(2)}€
                                            </p>
                                          )}
                                        </div>
                                        {isSelected && (
                                          <Check className="h-4 w-4 text-primary shrink-0" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Section 2: Store Recommendations */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    {t("compare.storeRecommendations") || "Store Recommendations"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={compareResult.smartRecommendation ? "smart" : "single"}>
                    <TabsList className="w-full">
                      {compareResult.smartRecommendation && (
                        <TabsTrigger value="smart" className="flex-1">
                          <Navigation className="h-3 w-3 mr-1" />
                          {t("compare.smartPick") || "Smart"}
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="single" className="flex-1">
                        {t("compare.singleStore")}
                      </TabsTrigger>
                      <TabsTrigger value="split" className="flex-1">
                        {t("compare.splitShopping")}
                      </TabsTrigger>
                    </TabsList>

                    {/* Smart recommendation tab */}
                    {compareResult.smartRecommendation && (
                      <TabsContent value="smart" className="space-y-3 mt-4">
                        <p className="text-xs text-muted-foreground">
                          {t("compare.smartDescription") || "Factors in grocery cost, walking distance, and missing items to find the best overall store."}
                        </p>
                        {compareResult.smartRecommendation.map((rec, idx) => {
                          const storeResult = recalculatedResults.find((s) => s.storeId === rec.storeId);
                          return (
                            <Card
                              key={rec.storeId}
                              className={idx === 0 ? "border-primary border-2" : ""}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`font-bold ${chainColor[rec.storeChain] || ""}`}>
                                      {rec.storeName}
                                    </span>
                                    {idx === 0 && (
                                      <Badge className="text-xs">
                                        {t("compare.bestChoice") || "Best choice"} 🎯
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold">{rec.smartScore.toFixed(2)}€</p>
                                    <p className="text-[10px] text-muted-foreground">effective cost</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="bg-muted/50 rounded p-2 text-center">
                                    <p className="text-muted-foreground">Groceries</p>
                                    <p className="font-semibold">{(storeResult?.totalCost ?? rec.totalCost).toFixed(2)}€</p>
                                  </div>
                                  <div className="bg-muted/50 rounded p-2 text-center">
                                    <p className="text-muted-foreground flex items-center justify-center gap-0.5">
                                      <MapPin className="h-3 w-3" />
                                      Distance
                                    </p>
                                    <p className="font-semibold">
                                      {rec.distanceKm !== null ? `${rec.distanceKm.toFixed(1)} km` : "—"}
                                    </p>
                                    {rec.travelPenalty > 0 && (
                                      <p className="text-[10px] text-orange-500">+{rec.travelPenalty.toFixed(2)}€</p>
                                    )}
                                  </div>
                                  <div className="bg-muted/50 rounded p-2 text-center">
                                    <p className="text-muted-foreground">Found</p>
                                    <p className="font-semibold">
                                      {storeResult?.matchedCount ?? rec.matchedCount}/{rec.totalItems}
                                    </p>
                                    {rec.missingPenalty > 0 && (
                                      <p className="text-[10px] text-red-500">+{rec.missingPenalty.toFixed(2)}€</p>
                                    )}
                                  </div>
                                </div>
                                {/* Product breakdown */}
                                {storeResult && (
                                  <div className="mt-3 border-t pt-2 space-y-1">
                                    {storeResult.items.map((item, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs gap-2">
                                        <div className="flex-1 min-w-0">
                                          <span className={item.match ? "" : "text-muted-foreground italic"}>
                                            {item.match ? item.match.productName : item.itemName}
                                          </span>
                                          {item.match?.brand && (
                                            <span className="text-muted-foreground ml-1">({item.match.brand})</span>
                                          )}
                                        </div>
                                        <span className="font-medium shrink-0">
                                          {item.match ? `${item.lineCost.toFixed(2)}€` : t("compare.notFound")}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </TabsContent>
                    )}

                    {/* Single store tab */}
                    <TabsContent value="single" className="space-y-4 mt-4">
                      {recalculatedResults
                        .sort((a, b) => {
                          if (a.matchedCount !== b.matchedCount) return b.matchedCount - a.matchedCount;
                          return a.totalCost - b.totalCost;
                        })
                        .map((sr) => (
                          <Card
                            key={sr.storeId}
                            className={sr.storeId === cheapestRecalc?.storeId ? "border-primary border-2" : ""}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold ${chainColor[sr.storeChain] || ""}`}>
                                    {sr.storeName}
                                  </span>
                                  {sr.storeId === cheapestRecalc?.storeId && (
                                    <Badge className="text-xs">
                                      {t("compare.cheapestStore")} 🏆
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold">{sr.totalCost.toFixed(2)}€</p>
                                  <p className="text-xs text-muted-foreground">
                                    {sr.matchedCount}/{list.items.length} found
                                  </p>
                                </div>
                              </div>
                              <ul className="space-y-1.5">
                                {sr.items.map((item, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm">
                                    {item.match?.imageUrl && (
                                      <img
                                        src={item.match.imageUrl}
                                        alt=""
                                        className="w-6 h-6 object-contain rounded shrink-0"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className={item.match ? "" : "text-muted-foreground italic"}>
                                        {item.match ? item.match.productName : item.itemName}
                                      </span>
                                      {item.match && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          {item.match.brand && `${item.match.brand}`}
                                          {item.match.brand && item.match.weightValue && " · "}
                                          {item.match.weightValue && item.match.weightUnit && `${item.match.weightValue}${item.match.weightUnit}`}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-medium shrink-0">
                                      {item.match ? `${item.lineCost.toFixed(2)}€` : t("compare.notFound")}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          </Card>
                        ))}
                    </TabsContent>

                    {/* Split shopping tab */}
                    <TabsContent value="split" className="space-y-4 mt-4">
                      {splitRecalc && (
                        <Card className="border-primary border-2">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold">{t("compare.splitShopping")}</span>
                              <p className="text-lg font-bold">{splitRecalc.totalCost.toFixed(2)}€</p>
                            </div>
                            <ul className="space-y-2">
                              {splitRecalc.items.map((item, i) => (
                                <li key={i} className="flex items-center justify-between text-sm gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate">
                                      {item.match ? item.match.productName : item.itemName}
                                    </p>
                                    {item.match && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {item.match.brand && `${item.match.brand}`}
                                        {item.match.brand && item.match.weightValue && " · "}
                                        {item.match.weightValue && item.match.weightUnit && `${item.match.weightValue}${item.match.weightUnit}`}
                                      </p>
                                    )}
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs shrink-0 ${chainColor[item.bestStoreChain] || ""}`}
                                  >
                                    {item.bestStoreName}
                                  </Badge>
                                  <span className="font-medium shrink-0">
                                    {item.bestPrice > 0 ? `${item.bestPrice.toFixed(2)}€` : t("compare.notFound")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
