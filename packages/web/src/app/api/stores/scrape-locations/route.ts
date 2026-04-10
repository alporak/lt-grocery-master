import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface LocationEntry {
  chain: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  size: string;
  hours: string | null;
}

/**
 * POST /api/stores/scrape-locations
 * Imports store locations from the bundled dataset (data/store-locations.json).
 * No external scraping needed — the dataset has real coordinates for all major chains.
 */
export async function POST() {
  const results: Record<string, number> = {};

  // Load location data — try Docker path, then dev paths
  let locations: LocationEntry[] = [];
  const tryPaths = [
    join(process.cwd(), "store-locations.json"),
    join(process.cwd(), "data", "store-locations.json"),
    join(process.cwd(), "..", "..", "data", "store-locations.json"),
  ];
  let loaded = false;
  for (const p of tryPaths) {
    try {
      locations = JSON.parse(readFileSync(p, "utf-8"));
      loaded = true;
      break;
    } catch { /* try next */ }
  }
  if (!loaded) {
    return NextResponse.json(
      { success: false, error: "store-locations.json not found" },
      { status: 500 }
    );
  }

  // Group locations by chain
  const byChain = new Map<string, LocationEntry[]>();
  for (const loc of locations) {
    const list = byChain.get(loc.chain) || [];
    list.push(loc);
    byChain.set(loc.chain, list);
  }

  // Find stores in DB and save locations
  for (const [chain, chainLocations] of byChain) {
    try {
      // BARBORA uses Maxima stores
      const store = await prisma.store.findFirst({
        where: chain === "MAXIMA"
          ? { OR: [{ chain: "MAXIMA" }, { chain: "BARBORA" }] }
          : { chain },
      });

      if (!store) {
        results[chain.toLowerCase()] = 0;
        continue;
      }

      // Delete existing locations for fresh import
      await prisma.storeLocation.deleteMany({ where: { storeId: store.id } });

      let saved = 0;
      for (const loc of chainLocations) {
        await prisma.storeLocation.create({
          data: {
            storeId: store.id,
            address: loc.address,
            city: loc.city,
            lat: loc.lat,
            lng: loc.lng,
            sizeCategory: loc.size,
            openingHours: loc.hours,
          },
        });
        saved++;
      }
      results[chain.toLowerCase()] = saved;
    } catch (e) {
      console.error(`[ImportLocations] ${chain} error:`, e);
      results[chain.toLowerCase()] = -1;
    }
  }

  return NextResponse.json({
    success: true,
    locationsImported: results,
  });
}
