"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { MapPin, Navigation, AlertCircle, Plus, X, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

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

interface AddLocationForm {
  address: string;
  city: string;
  sizeCategory: string;
  openingHours: string;
  lat: string;
  lng: string;
}

const EMPTY_FORM: AddLocationForm = {
  address: "",
  city: "",
  sizeCategory: "MEDIUM",
  openingHours: "",
  lat: "",
  lng: "",
};

export default function StoresPage() {
  const { t, language } = useI18n();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [chainFilter, setChainFilter] = useState("all");
  const [addingFor, setAddingFor] = useState<number | null>(null);
  const [form, setForm] = useState<AddLocationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fetchingChain, setFetchingChain] = useState<string | null>(null);
  const [fetchResult, setFetchResult] = useState<Record<string, string>>({});

  const fetchStores = () => {
    const params = chainFilter !== "all" ? `?chain=${chainFilter}` : "";
    fetch(`/api/stores${params}`)
      .then((r) => r.json())
      .then(setStores)
      .catch(() => {});
  };

  useEffect(() => {
    fetchStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainFilter]);

  const totalLocations = stores.reduce((sum, s) => sum + s.locations.length, 0);

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
    LIDL: "border-yellow-500",
  };

  const chains = [...new Set(stores.map((s) => s.chain))];

  const startAdd = (storeId: number) => {
    setAddingFor(storeId);
    setForm(EMPTY_FORM);
    setSaveError(null);
  };

  const cancelAdd = () => {
    setAddingFor(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
  };

  const submitAdd = async (storeId: number) => {
    if (!form.address.trim() || !form.city.trim()) {
      setSaveError("Address and city are required");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: form.address.trim(),
          city: form.city.trim(),
          sizeCategory: form.sizeCategory,
          openingHours: form.openingHours.trim() || null,
          lat: form.lat ? parseFloat(form.lat) : undefined,
          lng: form.lng ? parseFloat(form.lng) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error ?? "Failed to save");
        return;
      }
      cancelAdd();
      fetchStores();
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const fetchLocationsFromWeb = async (chain: string) => {
    setFetchingChain(chain);
    setFetchResult((prev) => ({ ...prev, [chain]: "" }));
    try {
      const res = await fetch("/api/stores/fetch-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain }),
      });
      const data = await res.json();
      if (data.success) {
        setFetchResult((prev) => ({
          ...prev,
          [chain]: language === "lt"
            ? `Išsaugota ${data.saved} vietų`
            : `Saved ${data.saved} locations`,
        }));
        fetchStores();
      } else {
        setFetchResult((prev) => ({
          ...prev,
          [chain]: data.errors?.[0] ?? "Failed",
        }));
      }
    } catch {
      setFetchResult((prev) => ({ ...prev, [chain]: "Network error" }));
    } finally {
      setFetchingChain(null);
    }
  };

  const deleteLocation = async (storeId: number, locationId: number) => {
    setDeletingId(locationId);
    try {
      await fetch(`/api/stores/${storeId}/locations?locationId=${locationId}`, {
        method: "DELETE",
      });
      fetchStores();
    } finally {
      setDeletingId(null);
    }
  };

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
            {chains.filter(Boolean).map((c) => (
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
          {totalLocations === 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {language === "lt"
                        ? "Parduotuvių vietos dar neimportuotos"
                        : "Store locations not imported yet"}
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      {language === "lt"
                        ? "Eikite į Nustatymai ir importuokite parduotuvių vietas, arba pridėkite rankiniu būdu."
                        : "Go to Settings to import store locations, or add them manually below."}
                    </p>
                    <Link href="/settings" className="inline-block mt-2">
                      <span className="text-xs font-medium text-primary hover:underline">
                        {t("nav.settings")} →
                      </span>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                        {store.productCount}{" "}
                        {language === "lt" ? "prekės" : "products"}
                      </Badge>
                      {store.locations.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {store.locations.length}{" "}
                          {language === "lt" ? "vietos" : "locations"}
                        </Badge>
                      )}
                    </CardTitle>
                    {store.lastScrapedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {language === "lt" ? "Paskutinį kartą:" : "Last scraped:"}{" "}
                        {new Date(store.lastScrapedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {store.nearestDistance !== null && (
                      <div className="flex items-center gap-1 text-sm">
                        <Navigation className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {store.nearestDistance.toFixed(1)} km
                        </span>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => fetchLocationsFromWeb(store.chain)}
                      disabled={fetchingChain === store.chain}
                      title={
                        language === "lt"
                          ? "Gauti vietas iš interneto"
                          : "Fetch locations from web"
                      }
                    >
                      {fetchingChain === store.chain ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      {language === "lt" ? "Atnaujinti" : "Fetch"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() =>
                        addingFor === store.id
                          ? cancelAdd()
                          : startAdd(store.id)
                      }
                    >
                      {addingFor === store.id ? (
                        <>
                          <X className="h-3 w-3" />
                          {language === "lt" ? "Atšaukti" : "Cancel"}
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          {language === "lt" ? "Pridėti vietą" : "Add location"}
                        </>
                      )}
                    </Button>
                  </div>
                  {fetchResult[store.chain] && (
                    <p className="text-xs text-muted-foreground w-full mt-1">
                      {fetchResult[store.chain]}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {/* Existing locations */}
                {store.locations.length === 0 && addingFor !== store.id ? (
                  <p className="text-sm text-muted-foreground">
                    {store.chain === "BARBORA" || store.chain === "MAXIMA"
                      ? t("stores.deliveryOnly")
                      : language === "lt"
                      ? "Nėra vietos duomenų"
                      : "No location data available"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {store.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-start justify-between gap-4 text-sm group"
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
                            className={`text-xs ${sizeColor[loc.sizeCategory] || ""}`}
                            variant="secondary"
                          >
                            {sizeLabel[loc.sizeCategory] || loc.sizeCategory}
                          </Badge>
                          {loc.distance !== null && (
                            <span className="text-muted-foreground text-xs">
                              {loc.distance.toFixed(1)} km
                            </span>
                          )}
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deleteLocation(store.id, loc.id)}
                            disabled={deletingId === loc.id}
                            title={language === "lt" ? "Ištrinti" : "Delete"}
                          >
                            {deletingId === loc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                    {store.locations.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        {language === "lt"
                          ? `Rodoma ${Math.min(store.locations.length, store.locations.length)} iš ${store.locations.length} vietų`
                          : `${store.locations.length} locations total`}
                      </p>
                    )}
                  </div>
                )}

                {/* Inline add form */}
                {addingFor === store.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <p className="text-sm font-medium">
                      {language === "lt"
                        ? "Pridėti naują vietą"
                        : "Add new location"}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt" ? "Adresas *" : "Address *"}
                        </label>
                        <Input
                          placeholder={
                            language === "lt"
                              ? "Pvz. Gedimino pr. 28"
                              : "e.g. Gedimino pr. 28"
                          }
                          value={form.address}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, address: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt" ? "Miestas *" : "City *"}
                        </label>
                        <Input
                          placeholder="Vilnius"
                          value={form.city}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, city: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt" ? "Dydis *" : "Size *"}
                        </label>
                        <Select
                          value={form.sizeCategory}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, sizeCategory: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SMALL">
                              {t("stores.small")}
                            </SelectItem>
                            <SelectItem value="MEDIUM">
                              {t("stores.medium")}
                            </SelectItem>
                            <SelectItem value="LARGE">
                              {t("stores.large")}
                            </SelectItem>
                            <SelectItem value="HYPERMARKET">
                              {t("stores.hypermarket")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt"
                            ? "Darbo laikas"
                            : "Opening hours"}
                        </label>
                        <Input
                          placeholder="8:00-22:00"
                          value={form.openingHours}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              openingHours: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt"
                            ? "Platuma (neprivaloma)"
                            : "Latitude (optional)"}
                        </label>
                        <Input
                          placeholder="54.6857"
                          value={form.lat}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, lat: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {language === "lt"
                            ? "Ilguma (neprivaloma)"
                            : "Longitude (optional)"}
                        </label>
                        <Input
                          placeholder="25.2675"
                          value={form.lng}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, lng: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === "lt"
                        ? "Jei platuma/ilguma nepateikta, koordinatės bus nustatytos automatiškai pagal adresą."
                        : "If lat/lng are left blank, coordinates will be auto-geocoded from the address."}
                    </p>
                    {saveError && (
                      <p className="text-xs text-destructive">{saveError}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => submitAdd(store.id)}
                        disabled={saving}
                        className="gap-1"
                      >
                        {saving && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {language === "lt" ? "Išsaugoti" : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelAdd}
                        disabled={saving}
                      >
                        {language === "lt" ? "Atšaukti" : "Cancel"}
                      </Button>
                    </div>
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
