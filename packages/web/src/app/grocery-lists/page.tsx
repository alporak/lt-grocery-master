"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { Plus, Copy, Trash2, ShoppingBasket, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { STARTER_PACKS } from "@/lib/starterPacks";

interface GroceryList {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unit: string | null;
    checked: boolean;
  }>;
  _count?: { items: number };
}

export default function GroceryListsPage() {
  const { t, language } = useI18n();
  const router = useRouter();
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [creating, setCreating] = useState(false);
  const [cloningPackId, setCloningPackId] = useState<string | null>(null);
  const [showPacks, setShowPacks] = useState(false);

  const fetchLists = () => {
    fetch("/api/grocery-lists")
      .then((r) => r.json())
      .then(setLists)
      .catch(() => {});
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const createList = async () => {
    setCreating(true);
    const defaultName = `${t("groceryLists.title")} ${lists.length + 1}`;
    const created = await fetch("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: defaultName }),
    }).then((r) => r.json());
    setCreating(false);
    if (created?.id) {
      router.push(`/grocery-lists/${created.id}?rename=1`);
    }
  };

  const duplicateList = async (list: GroceryList) => {
    const created = await fetch("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${list.name} (copy)`,
        items: list.items.map((i) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          unit: i.unit,
        })),
      }),
    }).then((r) => r.json());

    if (created?.id) fetchLists();
  };

  const deleteList = async (id: number) => {
    await fetch(`/api/grocery-lists/${id}`, { method: "DELETE" });
    fetchLists();
  };

  const cloneStarterPack = async (pack: typeof STARTER_PACKS[0]) => {
    setCloningPackId(pack.id);
    const created = await fetch("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: language === "lt" ? pack.nameLt : pack.nameEn,
        items: pack.items.map((i) => ({
          itemName: i.itemName,
          quantity: i.quantity,
          unit: i.unit ?? null,
        })),
      }),
    }).then((r) => r.json());
    setCloningPackId(null);
    if (created?.id) router.push(`/grocery-lists/${created.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("groceryLists.title")}</h1>
        <Button onClick={createList} disabled={creating} className="gap-2">
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t("groceryLists.newList")}
        </Button>
      </div>

      {/* Starter Packs */}
      <div>
        <button
          onClick={() => setShowPacks((p) => !p)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          {language === "lt" ? "Pradžios rinkiniai" : "Starter Packs"}
          <span className="text-xs text-muted-foreground">
            {language === "lt" ? "— greitai pradėkite" : "— get started quickly"}
          </span>
          {showPacks ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
        </button>
        {showPacks && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {STARTER_PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => cloneStarterPack(pack)}
                disabled={cloningPackId === pack.id}
                className="flex flex-col items-center gap-1.5 p-3 border rounded-lg hover:border-primary hover:bg-accent/30 transition-colors text-center disabled:opacity-60"
              >
                {cloningPackId === pack.id ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                ) : (
                  <span className="text-3xl">{pack.emoji}</span>
                )}
                <p className="text-xs font-semibold leading-tight">
                  {language === "lt" ? pack.nameLt : pack.nameEn}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {language === "lt" ? pack.descLt : pack.descEn}
                </p>
                <Badge variant="outline" className="text-[10px] mt-0.5">
                  {pack.items.length} {language === "lt" ? "prekės" : "items"}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lists */}
      {lists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBasket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t("groceryLists.noLists")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("groceryLists.createFirst")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Card key={list.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Link href={`/grocery-lists/${list.id}`}>
                    <CardTitle className="text-lg hover:text-primary cursor-pointer">
                      {list.name}
                    </CardTitle>
                  </Link>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => duplicateList(list)}
                      title={t("groceryLists.duplicateList")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteList(list.id)}
                      title={t("groceryLists.deleteList")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {list.items?.length ?? list._count?.items ?? 0}{" "}
                    {t("groceryLists.items")}
                  </span>
                  <span>
                    {t("groceryLists.lastUpdated")}{" "}
                    {new Date(list.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {list.items && list.items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {list.items.slice(0, 5).map((item) => (
                      <Badge key={item.id} variant="secondary" className="text-xs">
                        {item.itemName}
                      </Badge>
                    ))}
                    {list.items.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{list.items.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
                <Link href={`/grocery-lists/${list.id}`}>
                  <Button variant="outline" className="w-full mt-4" size="sm">
                    {t("common.edit")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
