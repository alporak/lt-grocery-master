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
  Package,
  Info,
  Tag,
  Pencil,
  ClipboardList,
  Loader2,
  CreditCard,
} from "lucide-react";
import { parseItem, formatParsed, splitIngredientLine } from "@/lib/parse-item";
import { computeLineCost } from "@/lib/cost";
import { BrandPickerModal } from "@/components/BrandPickerModal";
import { ProductPreviewModal } from "@/components/ProductPreviewModal";
import { getPreferredBrand, getBrandPreferences } from "@/lib/brandPreferences";
import { matchesDietaryFilter, type DietaryFilter } from "@/lib/dietaryTags";

interface Suggestion {
  id: number;
  name: string;
  nameEn: string | null;
  brand: string | null;
  canonicalCategory: string | null;
  subcategory: string | null;
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
      unitLabel?: string;
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
      unitLabel?: string;
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

  // Core data
  const [list, setList] = useState<GroceryList | null>(null);
  const [allLists, setAllLists] = useState<Array<{ id: number; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  // Tab control
  const [activeTab, setActiveTab] = useState<"items" | "products" | "compare">("items");

  // Inline rename
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  // Mass import
  const [importText, setImportText] = useState("");
  const [importParsed, setImportParsed] = useState<Array<{ raw: string; parsed: ReturnType<typeof parseItem> }> | null>(null);
  const [importAdding, setImportAdding] = useState(false);

  // Single-item add
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [pickedSuggestion, setPickedSuggestion] = useState<Suggestion | null>(null);
  const [parsedPreview, setParsedPreview] = useState<string | null>(null);
  const [dominantCategory, setDominantCategory] = useState<string | null>(null);
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  // Item list interaction
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");

  // Products tab
  const [productSuggestions, setProductSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [productSuggestionsLoading, setProductSuggestionsLoading] = useState(false);
  const [categoryFilters, setCategoryFilters] = useState<Record<string, string | null>>({});

  // Dietary filter for Products tab
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter | null>(null);

  // Auto-match loading indicator (by itemName)
  const [autoMatchLoading, setAutoMatchLoading] = useState<Set<string>>(new Set());

  // Price comparison
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [comparing, setComparing] = useState(false);
  // Travel mode: €/km for distance penalty. 0 = ignore distance.
  const [travelCostPerKm, setTravelCostPerKm] = useState<number>(0.3);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, Record<number, number>>>({});

  // Modals
  const [previewProductId, setPreviewProductId] = useState<number | null>(null);
  // When non-null, opening preview from Products tab for this item — "Add to list" updates that item
  const [previewSourceItemName, setPreviewSourceItemName] = useState<string | null>(null);

  const suggestRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live parse hint shown while typing
  const liveHint = (() => {
    if (!newItem.trim() || pickedSuggestion) return null;
    const p = parseItem(newItem.trim());
    if (p.name === newItem.trim() && p.quantity === 1 && !p.unit) return null;
    return `→ "${p.name}"${p.quantity !== 1 || p.unit ? ` × ${p.quantity}${p.unit ? " " + p.unit : ""}` : ""}`;
  })();

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

  // Auto-enter rename mode when navigated here with ?rename=1
  useEffect(() => {
    if (!list) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("rename") === "1") {
      setIsRenaming(true);
      setRenameValue(list.name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list?.id]); // only fire once when list first loads

  // Autocomplete suggestions
  useEffect(() => {
    if (newItem.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(() => {
      const parsed = parseItem(newItem.trim());
      const searchQuery = parsed.name.length >= 2 ? parsed.name : newItem.trim();
      fetch(`/api/products/suggest?q=${encodeURIComponent(searchQuery)}&limit=8`)
        .then((r) => r.json())
        .then((data: { suggestions: Suggestion[]; dominantCategory: string | null }) => {
          const suggs = Array.isArray(data) ? data : (data.suggestions || []);
          setSuggestions(suggs);
          setDominantCategory(Array.isArray(data) ? null : (data.dominantCategory || null));
          setShowSuggestions(suggs.length > 0);
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

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !list || trimmed === list.name) {
      setIsRenaming(false);
      return;
    }
    setRenameSaving(true);
    await fetch(`/api/grocery-lists/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setList({ ...list, name: trimmed });
    setIsRenaming(false);
    setRenameSaving(false);
  };

  // Mass import
  const handlePreviewImport = () => {
    if (!importText.trim()) { setImportParsed(null); return; }
    const lines = importText
      .split("\n")
      .flatMap(splitIngredientLine);
    setImportParsed(lines.map((raw) => ({ raw, parsed: parseItem(raw) })));
  };

  const handleAddAll = async () => {
    if (!importParsed || !list) return;
    setImportAdding(true);
    const newItems = importParsed.map(({ parsed }) => ({
      itemName: parsed.name,
      quantity: parsed.quantity,
      unit: parsed.unit,
      checked: false,
    }));
    const items = [...list.items, ...newItems];
    setList({ ...list, items });
    await saveItems(items);
    setImportText("");
    setImportParsed(null);
    setImportAdding(false);
    setProductSuggestions({});
  };

  const addItem = async () => {
    if (!newItem.trim() || !list) return;
    let itemName = newItem.trim();
    let quantity = parseFloat(newQty) || 1;
    let unit: string | null = null;

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
    setProductSuggestions({});
    await saveItems(items);
  };

  const pickSuggestion = (s: Suggestion) => {
    setNewItem(s.name);
    setPickedSuggestion(s);
    setSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const addSuggestionDirectly = async (s: Suggestion) => {
    if (!list) return;
    const items = [...list.items, { itemName: s.name, quantity: 1, unit: null, checked: false }];
    setList({ ...list, items });
    setNewItem("");
    setNewQty("1");
    setPickedSuggestion(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setProductSuggestions({});
    await saveItems(items);
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
    setProductSuggestions({});
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
          travelCostPerKm,
        }),
      }).then((r) => r.json());
      setCompareResult(result);
    } catch (err) {
      console.error(err);
    }
    setComparing(false);
  };

  const handleFindPrices = async () => {
    await comparePrices();
    setActiveTab("compare");
  };

  const exportList = () => {
    if (!list) return;
    const lines: string[] = [`${list.name}`, `Exported: ${new Date().toLocaleDateString()}`, ""];
    lines.push("ITEMS:");
    for (const item of list.items) {
      lines.push(`  ×${item.quantity}${item.unit ? " " + item.unit : ""}  ${item.itemName}`);
    }
    if (compareResult) {
      const smartRec = compareResult.smartRecommendation?.[0];
      const best = smartRec
        ? compareResult.storeResults.find((s) => s.storeId === smartRec.storeId)
        : compareResult.storeResults.find((s) => s.storeId === compareResult.cheapestStoreId);
      if (best) {
        lines.push("");
        lines.push(`RECOMMENDED STORE: ${best.storeName} — ${best.totalCost.toFixed(2)}€`);
        for (const item of best.items) {
          if (item.match) {
            lines.push(`  ${item.itemName}: ${item.match.productName} — ${item.lineCost.toFixed(2)}€`);
          } else {
            lines.push(`  ${item.itemName}: NOT FOUND`);
          }
        }
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${list.name.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFromList = async (sourceId: string) => {
    await fetch(`/api/grocery-lists/${params.id}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    fetchList();
    setProductSuggestions({});
  };

  const fetchProductSuggestions = async () => {
    if (!list) return;
    setProductSuggestionsLoading(true);
    const brandPrefs = getBrandPreferences();
    const results: Record<string, Suggestion[]> = {};
    await Promise.all(
      list.items.map(async (item) => {
        // nodedupe=1 so all stores' copies of the same product are returned,
        // letting the user pick which store to buy from.
        const res = await fetch(
          `/api/products/suggest?q=${encodeURIComponent(item.itemName)}&limit=12&nodedupe=1`
        ).then((r) => r.json());
        let suggestions: Suggestion[] = Array.isArray(res) ? res : (res.suggestions || []);
        // Boost preferred brand to top — sort preferred first, then by original order
        const dominantCat = Array.isArray(res) ? null : (res.dominantCategory ?? null);
        const preferred = dominantCat ? (brandPrefs[dominantCat] ?? null) : null;
        if (preferred) {
          suggestions = [
            ...suggestions.filter((s) => s.brand === preferred),
            ...suggestions.filter((s) => s.brand !== preferred),
          ];
        }
        results[item.itemName] = suggestions;
      })
    );
    setProductSuggestions(results);
    setProductSuggestionsLoading(false);
  };

  const toggleItemExpanded = (itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  const selectCandidate = (itemName: string, storeId: number, candidateIndex: number) => {
    setSelectedCandidates((prev) => ({
      ...prev,
      [itemName]: { ...(prev[itemName] || {}), [storeId]: candidateIndex },
    }));
  };

  /** Select a candidate and auto-match equivalent products in other stores. */
  const selectAndAutoMatch = async (itemName: string, storeId: number, candidateIndex: number) => {
    selectCandidate(itemName, storeId, candidateIndex);

    if (!compareResult || !list) return;
    const storeResult = compareResult.storeResults.find((s) => s.storeId === storeId);
    const storeItem = storeResult?.items.find((i) => i.itemName === itemName);
    const selectedProduct = storeItem?.candidates[candidateIndex];
    if (!selectedProduct) return;

    setAutoMatchLoading((prev) => new Set([...prev, itemName]));
    try {
      const similar: Record<string, Array<{
        productId: number; productName: string; price: number; salePrice?: number;
        loyaltyPrice?: number; unitPrice?: number; brand?: string;
        weightValue?: number; weightUnit?: string; imageUrl?: string;
        nameLt?: string; nameEn?: string; categoryLt?: string; score?: number;
      }>> = await fetch("/api/products/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selectedProduct.productId }),
      }).then((r) => r.json());

      const listItem = list.items.find((li) => li.itemName === itemName);
      const qty = listItem?.quantity ?? 1;

      setCompareResult((prev) => {
        if (!prev) return prev;
        const newStoreResults = prev.storeResults.map((sr) => {
          if (sr.storeId === storeId) return sr; // leave source store unchanged
          const matches = similar[String(sr.storeId)];
          if (!matches || matches.length === 0) return sr;
          const items = sr.items.map((item) => {
            if (item.itemName !== itemName) return item;
            const newCandidates = matches;
            const newMatch = matches[0];
            const lineCost = computeLineCost(newMatch, qty);
            return { ...item, match: newMatch, candidates: newCandidates, lineCost };
          });
          const totalCost = items.reduce((s, i) => s + i.lineCost, 0);
          const matchedCount = items.filter((i) => i.match !== null).length;
          return { ...sr, items, totalCost, matchedCount };
        });
        return { ...prev, storeResults: newStoreResults };
      });
    } catch {
      // auto-match failure is silent
    } finally {
      setAutoMatchLoading((prev) => {
        const next = new Set(prev);
        next.delete(itemName);
        return next;
      });
    }
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

  const cheapestRecalc = useMemo(() => {
    if (!recalculatedResults || !list) return null;
    const full = recalculatedResults.filter((s) => s.matchedCount === list.items.length);
    if (full.length > 0) return full.reduce((a, b) => (a.totalCost < b.totalCost ? a : b));
    return recalculatedResults.reduce((a, b) =>
      b.matchedCount > a.matchedCount || (b.matchedCount === a.matchedCount && b.totalCost < a.totalCost) ? b : a
    );
  }, [recalculatedResults, list]);

  const splitRecalc = useMemo(() => {
    if (!recalculatedResults || !list) return null;
    const items = list.items.map((item) => {
      let bestPrice = Infinity;
      let bestStoreId = 0;
      let bestStoreName = "";
      let bestStoreChain = "";
      let bestMatch: StoreCompareResult["items"][0]["match"] = null;
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

  // How many packs of a product cover the requested quantity.
  // e.g. 6 eggs / 10-pack = 1; 200g butter / 125g pack = 2
  const calcPacksNeeded = (itemQty: number, itemUnit: string | null, packValue: number | null, packUnit: string | null): number => {
    if (!packValue || packValue <= 0) return 1;
    const iu = itemUnit?.toLowerCase() ?? null;
    const pu = packUnit?.toLowerCase() ?? null;
    const toGrams = (v: number, u: string) => u === "kg" ? v * 1000 : v;
    const toMl = (v: number, u: string) => u === "l" ? v * 1000 : v;
    if (iu && pu && ["g", "kg"].includes(iu) && ["g", "kg"].includes(pu))
      return Math.max(1, Math.ceil(toGrams(itemQty, iu) / toGrams(packValue, pu)));
    if (iu && pu && ["l", "ml"].includes(iu) && ["l", "ml"].includes(pu))
      return Math.max(1, Math.ceil(toMl(itemQty, iu) / toMl(packValue, pu)));
    if (!iu && pu && ["vnt", "vnt.", "pcs", "pc", "vn"].includes(pu))
      return Math.max(1, Math.ceil(itemQty / packValue));
    return 1;
  };

  const chainColor: Record<string, string> = {
    IKI: "text-red-600",
    MAXIMA: "text-orange-600",
    BARBORA: "text-orange-600",
    RIMI: "text-blue-600",
    PROMO: "text-purple-600",
  };

  const itemCount = list.items.length;
  const hasProductSuggestions = Object.keys(productSuggestions).length > 0;

  return (
    <div className="space-y-4">
      {/* Header: back + inline-editable title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {isRenaming ? (
          <input
            autoFocus
            className="text-2xl font-bold bg-transparent border-b-2 border-primary outline-none flex-1 max-w-sm"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setIsRenaming(false); setRenameValue(list.name); }
            }}
          />
        ) : (
          <h1
            className="text-2xl font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
            onClick={() => { setIsRenaming(true); setRenameValue(list.name); }}
            title="Click to rename"
          >
            {list.name}
            <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-opacity" />
          </h1>
        )}
        {(saving || renameSaving) && (
          <Badge variant="secondary" className="text-xs animate-pulse">
            {t("common.save")}…
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto shrink-0"
          onClick={exportList}
          title={language === "lt" ? "Eksportuoti sąrašą" : "Export list"}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* 3-tab layout */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="items" className="flex-1">
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
            {language === "lt" ? "Prekės" : "Items"}
            {itemCount > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({itemCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1" disabled={itemCount === 0}>
            <Package className="h-3.5 w-3.5 mr-1.5" />
            {language === "lt" ? "Produktai" : "Products"}
          </TabsTrigger>
          <TabsTrigger
            value="compare"
            className="flex-1"
            disabled={!compareResult && itemCount === 0}
          >
            <Scale className="h-3.5 w-3.5 mr-1.5" />
            {language === "lt" ? "Palyginti" : "Compare"}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Items ─── */}
        <TabsContent value="items" className="space-y-4 mt-4">
          {/* Mass import */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                {language === "lt" ? "Įklijuoti prekes" : "Paste items"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="w-full min-h-[90px] p-2.5 rounded-md border bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={language === "lt"
                  ? "pienas, duona\n2kg vištiena\n6 kiaušiniai"
                  : "milk, bread\n2kg chicken\n6 eggs"}
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportParsed(null); }}
              />

              {/* Parsed preview */}
              {importParsed !== null && (
                <div className="rounded-md bg-muted/50 p-3 text-sm">
                  {importParsed.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs">Nothing to parse</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {language === "lt" ? "Bus pridėta:" : "You're adding:"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {importParsed.map(({ parsed }, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {parsed.name}
                            {(parsed.quantity !== 1 || parsed.unit) && (
                              <span className="ml-1 opacity-60">
                                ×{parsed.quantity}{parsed.unit ? ` ${parsed.unit}` : ""}
                              </span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewImport}
                  disabled={!importText.trim()}
                >
                  {language === "lt" ? "Peržiūrėti" : "Preview"}
                </Button>
                {importParsed !== null && importParsed.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleAddAll}
                    disabled={importAdding}
                    className="gap-1.5"
                  >
                    {importAdding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {language === "lt" ? `Pridėti viską (${importParsed.length})` : `Add All (${importParsed.length})`}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Single-item add */}
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
                      className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-80 overflow-y-auto"
                    >
                      {suggestions.map((s, i) => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-1 border-b last:border-0 ${i === selectedSuggestion ? "bg-accent" : ""}`}
                        >
                          <button
                            onClick={() => pickSuggestion(s)}
                            className="flex-1 text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center gap-2 min-w-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.store}
                                {s.brand && <span className="ml-1 text-primary/70">· {s.brand}</span>}
                                {s.weightValue && s.weightUnit && (
                                  <span className="ml-1 text-muted-foreground/60">· {s.weightValue}{s.weightUnit}</span>
                                )}
                              </p>
                            </div>
                            {s.price != null && (
                              <div className="text-right shrink-0">
                                <span className="text-xs font-semibold text-primary">{s.price.toFixed(2)}€</span>
                                {s.unitPrice != null && s.unitLabel && (
                                  <p className="text-[10px] text-muted-foreground">{s.unitPrice.toFixed(2)}€/{s.unitLabel}</p>
                                )}
                              </div>
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewProductId(s.id); setShowSuggestions(false); }}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors shrink-0"
                            title="Preview product"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); addSuggestionDirectly(s); }}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors shrink-0 mr-1"
                            title="Add directly to list"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {dominantCategory && (
                        <div className="border-t px-3 py-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setShowSuggestions(false);
                              setShowBrandPicker(true);
                            }}
                            className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                          >
                            <Tag className="h-3 w-3" />
                            {language === "lt" ? "Pasirinkti prekės ženklą..." : "Pick a brand..."}
                            {getPreferredBrand(dominantCategory) && (
                              <span className="text-muted-foreground font-normal">
                                ({getPreferredBrand(dominantCategory)})
                              </span>
                            )}
                          </button>
                        </div>
                      )}
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

              {liveHint && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 shrink-0" />
                  <span>{liveHint}</span>
                </div>
              )}
              {parsedPreview && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                  <Check className="h-3 w-3" />
                  <span>Added: <strong>{parsedPreview}</strong></span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items list */}
          <Card>
            {list.items.length > 0 && (
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {list.items.filter(i => i.checked).length}/{list.items.length} checked
                </span>
                {list.items.some(i => i.checked) && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                    onClick={async () => {
                      const items = list.items.filter(i => !i.checked);
                      setList({ ...list, items });
                      await saveItems(items);
                    }}
                  >
                    Clear checked
                  </button>
                )}
              </div>
            )}
            <CardContent className="p-0">
              {list.items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {language === "lt" ? "Nėra prekių. Pridėkite aukščiau." : "No items yet. Add some above."}
                </p>
              ) : (
                <ul className="divide-y">
                  {list.items.map((item, index) => (
                    <li key={index} className="flex items-center gap-3 px-4 py-3">
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
                      <div className={`flex-1 min-w-0 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                        <span className="text-sm">{item.itemName}</span>
                        {(item.quantity !== 1 || item.unit) && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            ×{item.quantity}{item.unit ? " " + item.unit : ""}
                          </span>
                        )}
                      </div>
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
                            className="hover:bg-accent px-1 rounded cursor-pointer text-xs"
                            title="Click to edit quantity"
                          >
                            edit qty
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

              {/* Import from another list */}
              {allLists.length > 0 && (
                <div className="p-4 border-t">
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

          {/* CTA to go to Products tab */}
          {itemCount > 0 && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                setActiveTab("products");
                if (!hasProductSuggestions) fetchProductSuggestions();
              }}
            >
              <Package className="h-4 w-4" />
              {language === "lt" ? "Rasti produktus →" : "Find Products →"}
            </Button>
          )}
        </TabsContent>

        {/* ─── Tab 2: Products ─── */}
        <TabsContent value="products" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {language === "lt"
                ? "Pasirinkite konkrečius produktus kiekvienai prekei prieš lyginant kainas."
                : "Pick specific products for each item before comparing prices."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchProductSuggestions}
              disabled={productSuggestionsLoading}
              className="gap-1.5 shrink-0 ml-3"
            >
              {productSuggestionsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Package className="h-3.5 w-3.5" />
              )}
              {hasProductSuggestions
                ? (language === "lt" ? "Atnaujinti" : "Refresh")
                : (language === "lt" ? "Ieškoti produktų" : "Find Products")}
            </Button>
          </div>

          {/* Dietary filters */}
          {hasProductSuggestions && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground shrink-0">
                {language === "lt" ? "Dieta:" : "Diet:"}
              </span>
              {([
                { id: null, label: language === "lt" ? "Visi" : "All" },
                { id: "vegan" as DietaryFilter, label: language === "lt" ? "Veganiška" : "Vegan" },
                { id: "vegetarian" as DietaryFilter, label: language === "lt" ? "Vegetariška" : "Vegetarian" },
                { id: "gluten-free" as DietaryFilter, label: language === "lt" ? "Be gliuteno" : "Gluten-free" },
                { id: "lactose-free" as DietaryFilter, label: language === "lt" ? "Be laktozės" : "Lactose-free" },
              ]).map((f) => (
                <button
                  key={String(f.id)}
                  onClick={() => setDietaryFilter(f.id)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    dietaryFilter === f.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {!hasProductSuggestions && !productSuggestionsLoading && (
            <Card>
              <CardContent className="py-10 text-center">
                <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm">
                  {language === "lt"
                    ? "Spustelėkite 'Ieškoti produktų', kad rastumėte atitikmenų kiekvienai prekei."
                    : "Click 'Find Products' to search for matches for each item."}
                </p>
              </CardContent>
            </Card>
          )}

          {productSuggestionsLoading && (
            <Card>
              <CardContent className="py-10 flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  {language === "lt" ? "Ieškoma..." : "Searching..."}
                </p>
              </CardContent>
            </Card>
          )}

          {hasProductSuggestions && list.items.map((item) => {
            const allCandidates = productSuggestions[item.itemName] || [];
            const activeCategory = categoryFilters[item.itemName] ?? null;
            // Distinct categories for disambiguation pills
            const distinctCategories = [...new Set(
              allCandidates.map((c) => c.canonicalCategory).filter(Boolean) as string[]
            )];
            const candidates = allCandidates
              .filter((c) => !activeCategory || c.canonicalCategory === activeCategory)
              .filter((c) => !dietaryFilter || matchesDietaryFilter(dietaryFilter, {
                name: c.name, nameEn: c.nameEn,
                canonicalCategory: c.canonicalCategory, subcategory: c.subcategory,
              }));
            // Preferred brand for this item's category
            const itemPreferredBrand = allCandidates[0]?.canonicalCategory
              ? getPreferredBrand(allCandidates[0].canonicalCategory)
              : null;

            return (
              <Card key={item.itemName}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.itemName}</span>
                    {(item.quantity !== 1 || item.unit) && (
                      <Badge variant="secondary" className="text-xs">
                        ×{item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </Badge>
                    )}
                    {allCandidates.length === 0 && (
                      <Badge variant="outline" className="text-xs text-red-500">
                        {language === "lt" ? "nerasta" : "not found"}
                      </Badge>
                    )}
                    {/* Category disambiguation pills */}
                    {distinctCategories.length > 1 && (
                      <div className="flex gap-1 flex-wrap ml-1">
                        <button
                          onClick={() => setCategoryFilters((p) => ({ ...p, [item.itemName]: null }))}
                          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                            activeCategory === null
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {language === "lt" ? "Visi" : "All"}
                        </button>
                        {distinctCategories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCategoryFilters((p) => ({ ...p, [item.itemName]: cat }))}
                            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                              activeCategory === cat
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border text-muted-foreground hover:border-primary/50"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                {candidates.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {candidates.map((c) => (
                        <div
                          key={c.id}
                          className={`border rounded-lg p-2.5 cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors relative ${
                            itemPreferredBrand && c.brand === itemPreferredBrand
                              ? "border-amber-400/60 bg-amber-50/30 dark:bg-amber-900/10"
                              : ""
                          }`}
                          onClick={() => { setPreviewProductId(c.id); setPreviewSourceItemName(item.itemName); }}
                        >
                          {itemPreferredBrand && c.brand === itemPreferredBrand && (
                            <span className="absolute top-1.5 left-1.5 text-[10px]" title="Preferred brand">⭐</span>
                          )}
                          {c.price != null && (
                            <div className="flex items-baseline gap-1 flex-wrap">
                              <span className="text-xs font-bold text-primary">{c.price.toFixed(2)}€</span>
                              {c.unitPrice != null && c.unitLabel && (
                                <span className="text-[10px] text-muted-foreground">{c.unitPrice.toFixed(2)}€/{c.unitLabel}</span>
                              )}
                            </div>
                          )}
                          <p className="text-xs font-medium leading-snug mt-1 line-clamp-2">{c.name}</p>
                          {c.brand && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">{c.brand}</p>
                          )}
                          {c.weightValue && c.weightUnit && (
                            <p className="text-[10px] text-muted-foreground">{c.weightValue}{c.weightUnit}</p>
                          )}
                          <Badge variant="outline" className={`text-[10px] mt-1.5 truncate max-w-full ${chainColor[c.chain] || ""}`}>
                            {c.store}
                          </Badge>
                          <button
                            className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); setPreviewProductId(c.id); setPreviewSourceItemName(item.itemName); }}
                            title="Preview"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          {/* Find Best Prices CTA */}
          {itemCount > 0 && (
            <Button
              onClick={handleFindPrices}
              disabled={comparing}
              className="w-full gap-2"
              size="lg"
            >
              {comparing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
              {comparing
                ? t("common.loading")
                : (language === "lt" ? "Rasti geriausias kainas →" : "Find Best Prices →")}
            </Button>
          )}
        </TabsContent>

        {/* ─── Tab 3: Compare ─── */}
        <TabsContent value="compare" className="space-y-4 mt-4">
          {!compareResult ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Scale className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground text-sm mb-4">
                  {language === "lt"
                    ? "Dar nėra rezultatų. Eikite į skirtuką 'Produktai' ir ieškokite geriausių kainų."
                    : "No results yet. Go to the Products tab and find the best prices."}
                </p>
                {itemCount > 0 && (
                  <Button onClick={handleFindPrices} disabled={comparing} className="gap-2">
                    {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                    {comparing ? t("common.loading") : (language === "lt" ? "Palyginti kainas" : "Compare Prices")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Re-run button */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {language === "lt" ? "Palyginimo rezultatai" : "Comparison results"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={comparePrices}
                  disabled={comparing}
                  className="gap-1.5"
                >
                  {comparing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Scale className="h-3.5 w-3.5" />
                  )}
                  {language === "lt" ? "Atnaujinti" : "Re-run"}
                </Button>
              </div>

              {recalculatedResults && (
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
                        const allStoreCandidates = recalculatedResults.map((sr) => {
                          const storeItem = sr.items.find((i) => i.itemName === item.itemName);
                          return { store: sr, storeItem };
                        }).filter((x) => x.storeItem?.match);

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
                        const isAutoMatching = autoMatchLoading.has(item.itemName);

                        return (
                          <div key={item.itemName} className="border rounded-lg overflow-hidden">
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
                                    {/* Match confidence badge */}
                                    {(() => {
                                      const s = bestOverall.match.score ?? 0;
                                      if (s >= 0.7) return <span className="text-[10px] text-emerald-600 font-semibold shrink-0" title="High confidence match">✓</span>;
                                      if (s >= 0.35) return <span className="text-[10px] text-amber-500 font-semibold shrink-0" title="Likely match — verify">~</span>;
                                      return <span className="text-[10px] text-red-400 font-semibold shrink-0" title="Uncertain match — check manually">?</span>;
                                    })()}
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
                                {isAutoMatching && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
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
                                            onClick={() => selectAndAutoMatch(item.itemName, sr.storeId, ci)}
                                            onDoubleClick={() => setPreviewProductId(c.productId)}
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
                                              {c.unitPrice != null && c.unitLabel && (
                                                <p className="text-[10px] text-sky-600 dark:text-sky-400">
                                                  {c.unitPrice.toFixed(2)}€/{c.unitLabel}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                              {isSelected && <Check className="h-4 w-4 text-primary" />}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setPreviewProductId(c.productId); }}
                                                className="text-muted-foreground hover:text-foreground"
                                                title="Preview product"
                                              >
                                                <Info className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
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
                      {/* Travel mode selector — affects distance penalty in smart score */}
                      {compareResult.smartRecommendation && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {language === "lt" ? "Transportas:" : "Travel mode:"}
                          </span>
                          {([
                            { label: language === "lt" ? "Pėsčias" : "Walking", value: 0.05 },
                            { label: language === "lt" ? "Dviratis" : "Cycling", value: 0.1 },
                            { label: language === "lt" ? "Automobilis" : "Car", value: 0.3 },
                            { label: language === "lt" ? "Ignoruoti" : "Ignore dist.", value: 0 },
                          ] as { label: string; value: number }[]).map((m) => (
                            <button
                              key={m.value}
                              onClick={() => setTravelCostPerKm(m.value)}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                travelCostPerKm === m.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-1">
                            ({travelCostPerKm === 0 ? "—" : `${travelCostPerKm.toFixed(2)}€/km`})
                          </span>
                          {travelCostPerKm !== compareResult.smartRecommendation[0]?.travelPenalty / (compareResult.smartRecommendation[0]?.distanceKm ?? 1) / 2 && (
                            <button
                              onClick={comparePrices}
                              className="text-[10px] text-primary underline ml-1"
                            >
                              {language === "lt" ? "Perskaičiuoti →" : "Recalculate →"}
                            </button>
                          )}
                        </div>
                      )}
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

                        {compareResult.smartRecommendation && (
                          <TabsContent value="smart" className="space-y-3 mt-4">
                            <p className="text-xs text-muted-foreground">
                              {t("compare.smartDescription") || "Factors in grocery cost, walking distance, and missing items to find the best overall store."}
                            </p>
                            {compareResult.smartRecommendation.map((rec, idx) => {
                              const storeResult = recalculatedResults.find((s) => s.storeId === rec.storeId);
                              const loyaltySavings = storeResult ? storeResult.items.reduce((sum, item) => {
                                if (!item.match?.loyaltyPrice) return sum;
                                const listItem = list.items.find((li) => li.itemName === item.itemName);
                                const qty = listItem?.quantity ?? 1;
                                const isPack = item.match.matchType === "pack";
                                const withoutLoyalty = Math.min(item.match.price, item.match.salePrice ?? Infinity) * (isPack ? 1 : qty);
                                return sum + Math.max(0, withoutLoyalty - item.lineCost);
                              }, 0) : 0;
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
                                    {loyaltySavings > 0.005 && (
                                      <div className="flex items-center gap-1.5 text-xs text-primary mt-2">
                                        <CreditCard className="h-3.5 w-3.5 shrink-0" />
                                        <span>{language === "lt" ? "Su lojalumo kortele" : "With loyalty card"}:</span>
                                        <span className="font-semibold text-green-600 dark:text-green-400">-{loyaltySavings.toFixed(2)}€</span>
                                      </div>
                                    )}
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
                                              {item.match?.loyaltyPrice && item.match.loyaltyPrice < Math.min(item.match.price, item.match.salePrice ?? Infinity) && (
                                                <CreditCard className="inline h-3 w-3 text-primary ml-1" />
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

                        <TabsContent value="single" className="space-y-4 mt-4">
                          {(() => {
                            const sorted = [...recalculatedResults].sort((a, b) => {
                              if (a.matchedCount !== b.matchedCount) return b.matchedCount - a.matchedCount;
                              return a.totalCost - b.totalCost;
                            });
                            const maxCost = Math.max(...sorted.map(s => s.totalCost));
                            return sorted.map((sr) => {
                              const missingItems = sr.items.filter((i) => !i.match);
                              const savings = sr.storeId !== sorted[sorted.length - 1]?.storeId
                                ? maxCost - sr.totalCost
                                : null;
                              const srLoyaltySavings = sr.items.reduce((sum, item) => {
                                if (!item.match?.loyaltyPrice) return sum;
                                const listItem = list.items.find((li) => li.itemName === item.itemName);
                                const qty = listItem?.quantity ?? 1;
                                const isPack = item.match.matchType === "pack";
                                const withoutLoyalty = Math.min(item.match.price, item.match.salePrice ?? Infinity) * (isPack ? 1 : qty);
                                return sum + Math.max(0, withoutLoyalty - item.lineCost);
                              }, 0);
                              return (
                                <Card
                                  key={sr.storeId}
                                  className={sr.storeId === cheapestRecalc?.storeId ? "border-primary border-2" : ""}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`font-bold ${chainColor[sr.storeChain] || ""}`}>
                                          {sr.storeName}
                                        </span>
                                        {sr.storeId === cheapestRecalc?.storeId && (
                                          <Badge className="text-xs">
                                            {t("compare.cheapestStore")} 🏆
                                          </Badge>
                                        )}
                                        {savings !== null && savings > 0.01 && sr.storeId !== cheapestRecalc?.storeId && (
                                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                            -{savings.toFixed(2)}€ {language === "lt" ? "sutaupote" : "savings"}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <p className="text-lg font-bold">{sr.totalCost.toFixed(2)}€</p>
                                        <p className="text-xs text-muted-foreground">
                                          {sr.matchedCount}/{list.items.length} {language === "lt" ? "rasta" : "found"}
                                        </p>
                                        {srLoyaltySavings > 0.005 && (
                                          <div className="flex items-center gap-1 justify-end text-[10px] text-primary mt-0.5">
                                            <CreditCard className="h-3 w-3" />
                                            <span className="text-green-600 dark:text-green-400 font-semibold">-{srLoyaltySavings.toFixed(2)}€</span>
                                          </div>
                                        )}
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
                                            <span className={item.match ? "" : "text-muted-foreground italic line-through"}>
                                              {item.match ? item.match.productName : item.itemName}
                                            </span>
                                            {item.match && (
                                              <span className="text-xs text-muted-foreground ml-1">
                                                {item.match.brand && `${item.match.brand}`}
                                                {item.match.brand && item.match.weightValue && " · "}
                                                {item.match.weightValue && item.match.weightUnit && `${item.match.weightValue}${item.match.weightUnit}`}
                                              </span>
                                            )}
                                            {!item.match && (
                                              <span className="ml-1 text-xs text-red-500">
                                                {language === "lt" ? "nerasta" : "not available"}
                                              </span>
                                            )}
                                          </div>
                                          <span className={`font-medium shrink-0 ${!item.match ? "text-muted-foreground" : ""}`}>
                                            {item.match ? `${item.lineCost.toFixed(2)}€` : "—"}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                    {missingItems.length > 0 && (
                                      <div className="mt-2 pt-2 border-t">
                                        <p className="text-xs text-red-500">
                                          ⚠️ {missingItems.length} {language === "lt" ? "produktų nerasta:" : "items not available:"}{" "}
                                          {missingItems.map(i => i.itemName).join(", ")}
                                        </p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            });
                          })()}
                        </TabsContent>

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
            </>
          )}
        </TabsContent>
      </Tabs>

      {showBrandPicker && dominantCategory && (
        <BrandPickerModal
          categoryId={dominantCategory}
          categoryName={dominantCategory}
          currentBrand={getPreferredBrand(dominantCategory)}
          onSelect={(brand) => {
            if (brand) {
              setNewItem(brand + " " + newItem.trim().replace(new RegExp(`^${brand}\\s*`, "i"), ""));
            }
          }}
          onClose={() => setShowBrandPicker(false)}
        />
      )}

      {previewProductId !== null && (
        <ProductPreviewModal
          productId={previewProductId}
          onClose={() => { setPreviewProductId(null); setPreviewSourceItemName(null); }}
          addToListLabel={previewSourceItemName ? `Select for "${previewSourceItemName}"` : "Add to list"}
          onAddToList={async (name, weightValue, weightUnit) => {
            if (!list) return;
            if (previewSourceItemName) {
              // Update the existing item: rename it and compute how many packs are needed
              const sourceItem = list.items.find((i) => i.itemName === previewSourceItemName);
              const packs = sourceItem
                ? calcPacksNeeded(sourceItem.quantity, sourceItem.unit, weightValue, weightUnit)
                : 1;
              const items = list.items.map((i) =>
                i.itemName === previewSourceItemName
                  ? { ...i, itemName: name, quantity: packs, unit: null }
                  : i
              );
              setList({ ...list, items });
              // Re-key productSuggestions so the Products tab still shows results
              setProductSuggestions((prev) => {
                const next = { ...prev };
                if (next[previewSourceItemName]) {
                  next[name] = next[previewSourceItemName];
                  delete next[previewSourceItemName];
                }
                return next;
              });
              setPreviewSourceItemName(null);
              setParsedPreview(`Selected: ${name}${packs > 1 ? ` ×${packs}` : ""}`);
              setTimeout(() => setParsedPreview(null), 3000);
              await saveItems(items);
            } else {
              // Add as a new item (opened from autocomplete suggestions)
              const items = [...list.items, { itemName: name, quantity: 1, unit: null, checked: false }];
              setList({ ...list, items });
              setNewItem("");
              setPickedSuggestion(null);
              setSuggestions([]);
              setShowSuggestions(false);
              setParsedPreview(`Added: ${name}`);
              setTimeout(() => setParsedPreview(null), 3000);
              await saveItems(items);
            }
          }}
        />
      )}
    </div>
  );
}
