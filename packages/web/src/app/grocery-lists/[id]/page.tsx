"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

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
    } | null;
    lineCost: number;
  }>;
  totalCost: number;
  matchedCount: number;
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
    const items = [
      ...list.items,
      {
        itemName: newItem.trim(),
        quantity: parseFloat(newQty) || 1,
        unit: null,
        checked: false,
      },
    ];
    setList({ ...list, items });
    setNewItem("");
    setNewQty("1");
    await saveItems(items);
  };

  const removeItem = async (index: number) => {
    if (!list) return;
    const items = list.items.filter((_, i) => i !== index);
    setList({ ...list, items });
    await saveItems(items);
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

  if (!list) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  const chainColor: Record<string, string> = {
    IKI: "text-red-600",
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
                <Input
                  placeholder={t("groceryLists.itemName")}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  className="flex-1"
                />
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
                        ×{item.quantity}
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
          {compareResult && (
            <Card>
              <CardHeader>
                <CardTitle>{t("compare.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="single">
                  <TabsList className="w-full">
                    <TabsTrigger value="single" className="flex-1">
                      {t("compare.singleStore")}
                    </TabsTrigger>
                    <TabsTrigger value="split" className="flex-1">
                      {t("compare.splitShopping")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-4 mt-4">
                    {compareResult.storeResults
                      .sort((a, b) => {
                        if (a.matchedCount !== b.matchedCount)
                          return b.matchedCount - a.matchedCount;
                        return a.totalCost - b.totalCost;
                      })
                      .map((sr) => (
                        <Card
                          key={sr.storeId}
                          className={
                            sr.storeId === compareResult.cheapestStoreId
                              ? "border-primary border-2"
                              : ""
                          }
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold ${
                                    chainColor[sr.storeChain] || ""
                                  }`}
                                >
                                  {sr.storeName}
                                </span>
                                {sr.storeId ===
                                  compareResult.cheapestStoreId && (
                                  <Badge className="text-xs">
                                    {t("compare.cheapestStore")} 🏆
                                  </Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">
                                  {sr.totalCost.toFixed(2)}€
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {sr.matchedCount}/{list.items.length} found
                                </p>
                              </div>
                            </div>
                            <ul className="space-y-1">
                              {sr.items.map((item, i) => (
                                <li
                                  key={i}
                                  className="flex justify-between text-sm"
                                >
                                  <span
                                    className={
                                      item.match
                                        ? ""
                                        : "text-muted-foreground italic"
                                    }
                                  >
                                    {item.itemName}
                                  </span>
                                  <span className="font-medium">
                                    {item.match
                                      ? `${item.lineCost.toFixed(2)}€`
                                      : t("compare.notFound")}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                  </TabsContent>

                  <TabsContent value="split" className="space-y-4 mt-4">
                    <Card className="border-primary border-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold">
                            {t("compare.splitShopping")}
                          </span>
                          <p className="text-lg font-bold">
                            {compareResult.splitResult.totalCost.toFixed(2)}€
                          </p>
                        </div>
                        <ul className="space-y-2">
                          {compareResult.splitResult.items.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between text-sm gap-2"
                            >
                              <span className="flex-1">{item.itemName}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${
                                  chainColor[
                                    compareResult.storeResults.find(
                                      (s) => s.storeId === item.bestStoreId
                                    )?.storeChain || ""
                                  ] || ""
                                }`}
                              >
                                {item.bestStoreName}
                              </Badge>
                              <span className="font-medium shrink-0">
                                {item.bestPrice > 0
                                  ? `${item.bestPrice.toFixed(2)}€`
                                  : t("compare.notFound")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
