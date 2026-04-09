"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { MapPin, Navigation } from "lucide-react";

interface StoreLocation {
  id: number;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  sizeCategory: string;
  openingHours: string | null;
  distance: number | null;
}

interface StoreData {
  id: number;
  slug: string;
  name: string;
  chain: string;
  url: string;
  lastScrapedAt: string | null;
  productCount: number;
  locations: StoreLocation[];
  nearestDistance: number | null;
}

export default function StoresPage() {
  const { t } = useI18n();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [chainFilter, setChainFilter] = useState("all");

  useEffect(() => {
    const params = chainFilter !== "all" ? `?chain=${chainFilter}` : "";
    fetch(`/api/stores${params}`)
      .then((r) => r.json())
      .then(setStores)
      .catch(() => {});
  }, [chainFilter]);

  const sizeLabel: Record<string, string> = {
    SMALL: t("stores.small"),
    MEDIUM: t("stores.medium"),
    LARGE: t("stores.large"),
    HYPERMARKET: t("stores.hypermarket"),
  };

  const sizeColor: Record<string, string> = {
    SMALL: "bg-gray-100 text-gray-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    LARGE: "bg-green-100 text-green-700",
    HYPERMARKET: "bg-purple-100 text-purple-700",
  };

  const chainColor: Record<string, string> = {
    IKI: "border-red-500",
    MAXIMA: "border-orange-500",
    BARBORA: "border-orange-500",
    RIMI: "border-blue-500",
    PROMO: "border-purple-500",
  };

  const chains = [...new Set(stores.map((s) => s.chain))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold">{t("stores.title")}</h1>
        <Select value={chainFilter} onValueChange={setChainFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("stores.filterByChain")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("stores.allChains")}</SelectItem>
            {chains.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("common.loading")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {stores.map((store) => (
            <Card
              key={store.id}
              className={`border-l-4 ${chainColor[store.chain] || ""}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {store.name}
                      <Badge variant="outline" className="text-xs">
                        {store.productCount} products
                      </Badge>
                    </CardTitle>
                    {store.lastScrapedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last scraped:{" "}
                        {new Date(store.lastScrapedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {store.nearestDistance !== null && (
                    <div className="flex items-center gap-1 text-sm">
                      <Navigation className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {store.nearestDistance.toFixed(1)} km
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {store.locations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {store.chain === "BARBORA" || store.chain === "MAXIMA"
                      ? t("stores.deliveryOnly")
                      : "No location data available"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {store.locations.slice(0, 5).map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{loc.address}</p>
                            <p className="text-muted-foreground">{loc.city}</p>
                            {loc.openingHours && (
                              <p className="text-xs text-muted-foreground">
                                {loc.openingHours}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            className={`text-xs ${
                              sizeColor[loc.sizeCategory] || ""
                            }`}
                            variant="secondary"
                          >
                            {sizeLabel[loc.sizeCategory] || loc.sizeCategory}
                          </Badge>
                          {loc.distance !== null && (
                            <span className="text-muted-foreground text-xs">
                              {loc.distance.toFixed(1)} km
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {store.locations.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{store.locations.length - 5} more locations
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
