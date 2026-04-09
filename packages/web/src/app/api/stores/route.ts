import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { haversineDistance, storeScore } from "@/lib/distance";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");

  const stores = await prisma.store.findMany({
    where: {
      enabled: true,
      ...(chain ? { chain } : {}),
    },
    include: {
      locations: true,
      _count: { select: { products: true } },
    },
  });

  // Get user coordinates
  const latStr = await getSetting("lat");
  const lngStr = await getSetting("lng");
  const userLat = latStr ? parseFloat(String(latStr)) : 0;
  const userLng = lngStr ? parseFloat(String(lngStr)) : 0;

  const result = stores.map((store) => {
    const locations = store.locations.map((loc) => {
      const distance =
        userLat && userLng && loc.lat && loc.lng
          ? haversineDistance(userLat, userLng, loc.lat, loc.lng)
          : null;
      const score =
        distance !== null ? storeScore(distance, loc.sizeCategory) : null;

      return {
        id: loc.id,
        address: loc.address,
        city: loc.city,
        lat: loc.lat,
        lng: loc.lng,
        sizeCategory: loc.sizeCategory,
        openingHours: loc.openingHours,
        distance: distance ? Math.round(distance * 100) / 100 : null,
        score,
      };
    });

    // Sort locations by score (distance adjusted for size)
    locations.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));

    return {
      id: store.id,
      slug: store.slug,
      name: store.name,
      chain: store.chain,
      url: store.url,
      lastScrapedAt: store.lastScrapedAt,
      productCount: store._count.products,
      locations,
      nearestDistance: locations[0]?.distance ?? null,
    };
  });

  // Sort stores by nearest location
  result.sort((a, b) => (a.nearestDistance ?? 999) - (b.nearestDistance ?? 999));

  return NextResponse.json(result);
}
