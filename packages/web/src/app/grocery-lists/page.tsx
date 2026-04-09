"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { Plus, Copy, Trash2, ShoppingBasket } from "lucide-react";

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
  const { t } = useI18n();
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

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
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setCreating(false);
    fetchLists();
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("groceryLists.title")}</h1>

      {/* Create new list */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder={t("groceryLists.listName")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
            />
            <Button onClick={createList} disabled={creating} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              {t("groceryLists.newList")}
            </Button>
          </div>
        </CardContent>
      </Card>

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
