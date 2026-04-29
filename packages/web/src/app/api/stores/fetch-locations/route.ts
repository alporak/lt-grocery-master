/**
 * POST /api/stores/fetch-locations
 * Fetches real store locations from chain websites and saves to DB.
 *
 * Body: { chain: "IKI" | "RIMI" | "MAXIMA" | "LIDL" | "PROMO" }
 * Returns: { saved: number, skipped: number, errors: string[] }
 *
 * IKI: https://www.iki.lt/parduotuves — store list page with JSON-LD or API
 * RIMI: https://www.rimi.lt/parduotuves
 * MAXIMA: https://www.maxima.lt/parduotuves
 * LIDL: https://www.lidl.lt/parduotuves
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ScrapedLocation {
  name: string;
  address: string;
  city: string;
  lat: number | null;
  lng: number | null;
  sizeCategory: string;
  openingHours: string | null;
}

async function geocode(address: string, city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = encodeURIComponent(`${address}, ${city}, Lithuania`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=lt`,
      { headers: { "User-Agent": "krepza/2.0" } }
    );
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Fetch IKI store locations from their website.
 * IKI store list: https://www.iki.lt/lt/parduotuves-ir-valandos
 * They render a page with store data — try the JSON API endpoint first,
 * then fall back to parsing the HTML.
 */
async function fetchIkiLocations(): Promise<ScrapedLocation[]> {
  const locations: ScrapedLocation[] = [];

  // IKI exposes store data via their web app API
  const apiAttempts = [
    "https://www.iki.lt/api/stores",
    "https://www.iki.lt/lt/api/stores",
    "https://www.iki.lt/store-locator/data",
  ];

  for (const url of apiAttempts) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const stores = Array.isArray(data) ? data : data.stores ?? data.data ?? [];
        for (const s of stores) {
          const address = s.address ?? s.street ?? s.addr ?? "";
          const city = s.city ?? s.town ?? "Lithuania";
          const lat = s.lat ?? s.latitude ?? null;
          const lng = s.lng ?? s.lon ?? s.longitude ?? null;
          const hours = s.hours ?? s.openingHours ?? s.working_hours ?? null;
          const name = s.name ?? s.title ?? address;
          if (address) {
            locations.push({
              name,
              address,
              city,
              lat: lat ? parseFloat(lat) : null,
              lng: lng ? parseFloat(lng) : null,
              sizeCategory: inferSize(name),
              openingHours: hours,
            });
          }
        }
        if (locations.length > 0) return locations;
      }
    } catch { /* try next */ }
  }

  // Fallback: scrape the store-list HTML page
  try {
    const res = await fetch("https://www.iki.lt/lt/parduotuves-ir-valandos", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const html = await res.text();
      // Extract JSON-LD structured data if present
      const jsonLdMatches = html.matchAll(
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
      );
      for (const match of jsonLdMatches) {
        try {
          const json = JSON.parse(match[1]);
          const items = Array.isArray(json) ? json : [json];
          for (const item of items) {
            if (item["@type"] === "GroceryStore" || item["@type"] === "Store") {
              const addr = item.address;
              if (addr) {
                locations.push({
                  name: item.name ?? "",
                  address: addr.streetAddress ?? addr,
                  city: addr.addressLocality ?? "Lithuania",
                  lat: item.geo?.latitude ?? null,
                  lng: item.geo?.longitude ?? null,
                  sizeCategory: inferSize(item.name ?? ""),
                  openingHours: item.openingHours ?? null,
                });
              }
            }
          }
        } catch { /* skip malformed */ }
      }

      // Also try extracting from embedded __NEXT_DATA__ or window.__data
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const stores =
            nextData?.props?.pageProps?.stores ??
            nextData?.props?.pageProps?.data?.stores ??
            [];
          for (const s of stores) {
            const address = s.address ?? s.street ?? "";
            if (address) {
              locations.push({
                name: s.name ?? address,
                address,
                city: s.city ?? "Lithuania",
                lat: s.lat ?? s.latitude ?? null,
                lng: s.lng ?? s.lon ?? s.longitude ?? null,
                sizeCategory: inferSize(s.name ?? ""),
                openingHours: s.openingHours ?? s.hours ?? null,
              });
            }
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* ignore */ }

  return locations;
}

/**
 * Fetch RIMI store locations.
 */
async function fetchRimiLocations(): Promise<ScrapedLocation[]> {
  const locations: ScrapedLocation[] = [];
  try {
    const res = await fetch("https://www.rimi.lt/parduotuves", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const html = await res.text();
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        const nextData = JSON.parse(nextDataMatch[1]);
        const stores =
          nextData?.props?.pageProps?.stores ??
          nextData?.props?.pageProps?.data?.stores ??
          [];
        for (const s of stores) {
          const address = s.address ?? s.street ?? "";
          if (address) {
            locations.push({
              name: s.name ?? address,
              address,
              city: s.city ?? "Lithuania",
              lat: s.lat ?? null,
              lng: s.lng ?? null,
              sizeCategory: inferSize(s.name ?? ""),
              openingHours: s.openingHours ?? null,
            });
          }
        }
      }
    }
  } catch { /* ignore */ }
  return locations;
}

/**
 * Fetch MAXIMA store locations.
 */
async function fetchMaximaLocations(): Promise<ScrapedLocation[]> {
  const locations: ScrapedLocation[] = [];
  const apiUrls = [
    "https://www.maxima.lt/api/stores",
    "https://api.maxima.lt/stores",
  ];
  for (const url of apiUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        const stores = Array.isArray(data) ? data : data.stores ?? data.data ?? [];
        for (const s of stores) {
          const address = s.address ?? s.street ?? "";
          if (address) {
            locations.push({
              name: s.name ?? address,
              address,
              city: s.city ?? "Lithuania",
              lat: s.lat ?? s.latitude ?? null,
              lng: s.lng ?? s.lon ?? s.longitude ?? null,
              sizeCategory: inferSizeMaxima(s.name ?? ""),
              openingHours: s.openingHours ?? s.hours ?? null,
            });
          }
        }
        if (locations.length > 0) return locations;
      }
    } catch { /* try next */ }
  }
  return locations;
}

/**
 * Fetch LIDL store locations.
 */
async function fetchLidlLocations(): Promise<ScrapedLocation[]> {
  const locations: ScrapedLocation[] = [];
  try {
    // LIDL has an official store finder API
    const res = await fetch(
      "https://www.lidl.lt/api/stores?country=LT&lang=lt",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const stores = Array.isArray(data) ? data : data.stores ?? data.data ?? [];
      for (const s of stores) {
        const address = s.address ?? s.street ?? "";
        if (address) {
          locations.push({
            name: s.name ?? address,
            address,
            city: s.city ?? "Lithuania",
            lat: s.lat ?? s.latitude ?? null,
            lng: s.lng ?? s.lon ?? s.longitude ?? null,
            sizeCategory: "LARGE",
            openingHours: s.openingHours ?? null,
          });
        }
      }
    }
  } catch { /* ignore */ }
  return locations;
}

function inferSize(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("MEGA") || n.includes("HYPER") || n.includes("XXX")) return "HYPERMARKET";
  if (n.includes("SUPER") || n.includes("XX")) return "LARGE";
  if (n.includes("EXPRESS") || n.includes("MINI") || n.includes(" X ") || n.endsWith(" X")) return "SMALL";
  return "MEDIUM";
}

function inferSizeMaxima(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("XXX")) return "HYPERMARKET";
  if (n.includes("XX")) return "LARGE";
  if (n.match(/ X$/)) return "MEDIUM";
  return "MEDIUM";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const chain = (body.chain as string)?.toUpperCase();

  if (!chain) {
    return NextResponse.json({ error: "chain is required" }, { status: 400 });
  }

  // Find the store in DB
  const store = await prisma.store.findFirst({ where: { chain } });
  if (!store) {
    return NextResponse.json(
      { error: `No store found with chain=${chain}` },
      { status: 404 }
    );
  }

  let scraped: ScrapedLocation[] = [];
  const errors: string[] = [];

  try {
    switch (chain) {
      case "IKI":
        scraped = await fetchIkiLocations();
        break;
      case "RIMI":
        scraped = await fetchRimiLocations();
        break;
      case "MAXIMA":
      case "BARBORA":
        scraped = await fetchMaximaLocations();
        break;
      case "LIDL":
        scraped = await fetchLidlLocations();
        break;
      default:
        return NextResponse.json(
          { error: `Fetcher not implemented for chain=${chain}` },
          { status: 400 }
        );
    }
  } catch (e) {
    errors.push(String(e));
  }

  if (scraped.length === 0) {
    return NextResponse.json({
      success: false,
      saved: 0,
      skipped: 0,
      errors: [...errors, "No locations found from source — site structure may have changed"],
    });
  }

  // Geocode missing coordinates (rate-limited: 1 req/sec for Nominatim)
  let geocoded = 0;
  for (const loc of scraped) {
    if (loc.lat == null || loc.lng == null) {
      await new Promise((r) => setTimeout(r, 1100));
      const coords = await geocode(loc.address, loc.city);
      if (coords) {
        loc.lat = coords.lat;
        loc.lng = coords.lng;
        geocoded++;
      }
    }
  }

  // Upsert into DB — delete old, insert new
  await prisma.storeLocation.deleteMany({ where: { storeId: store.id } });

  let saved = 0;
  let skipped = 0;
  for (const loc of scraped) {
    try {
      await prisma.storeLocation.create({
        data: {
          storeId: store.id,
          address: loc.address,
          city: loc.city,
          lat: loc.lat,
          lng: loc.lng,
          sizeCategory: loc.sizeCategory,
          openingHours: loc.openingHours,
        },
      });
      saved++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    chain,
    saved,
    skipped,
    geocoded,
    errors,
  });
}
