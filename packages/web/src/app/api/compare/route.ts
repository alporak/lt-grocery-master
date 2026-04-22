import { NextRequest, NextResponse } from "next/server";
import { compareGroceryList } from "@/lib/compare";
import { getSettings } from "@/lib/settings";
import { geocodeAddress } from "@/lib/distance";

export const dynamic = "force-dynamic";

let geoCache: { address: string; lat: number; lng: number } | null = null;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = Array.isArray(body.items)
    ? body.items.map((i: { itemName: string; quantity: number; unit?: string; pinnedProductId?: number | null }) => ({
        itemName: i.itemName,
        quantity: i.quantity,
        unit: i.unit,
        pinnedProductId:
          typeof i.pinnedProductId === "number" ? i.pinnedProductId : null,
      }))
    : [];
  const language = body.language || "lt";
  const travelCostPerKm: number = typeof body.travelCostPerKm === "number"
    ? Math.max(0, Math.min(body.travelCostPerKm, 5))
    : 0.3;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );
  }

  // Resolve user location from settings
  let userLat: number | undefined;
  let userLng: number | undefined;
  try {
    const settings = await getSettings();
    const address = settings.address as string | undefined;
    if (address && address.length > 3) {
      if (geoCache && geoCache.address === address) {
        userLat = geoCache.lat;
        userLng = geoCache.lng;
      } else {
        const coords = await geocodeAddress(`${address}, Lithuania`);
        if (coords) {
          userLat = coords.lat;
          userLng = coords.lng;
          geoCache = { address, lat: coords.lat, lng: coords.lng };
        }
      }
    }
  } catch { /* settings or geocode failure, continue without location */ }

  const result = await compareGroceryList(items, language, userLat, userLng, travelCostPerKm);
  return NextResponse.json(result);
}
