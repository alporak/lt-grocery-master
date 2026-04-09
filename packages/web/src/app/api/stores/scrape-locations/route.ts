import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";
import { geocodeAddress } from "@/lib/distance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ParsedLocation {
  name: string;
  address: string;
  city: string;
  hours: string | null;
  type: string | null;
}

/**
 * POST /api/stores/scrape-locations
 * Scrapes real store locations from chain websites and geocodes them.
 */
export async function POST() {
  const results: Record<string, number> = {};

  // --- RIMI ---
  try {
    const rimiLocations = await scrapeRimi();
    const rimiStore = await prisma.store.findFirst({ where: { chain: "RIMI" } });
    if (rimiStore) {
      const count = await saveLocations(rimiStore.id, rimiLocations);
      results.rimi = count;
    }
  } catch (e) {
    console.error("[ScrapeLocations] Rimi error:", e);
    results.rimi = -1;
  }

  // --- PROMO ---
  try {
    const promoLocations = await scrapePromo();
    const promoStore = await prisma.store.findFirst({ where: { chain: "PROMO" } });
    if (promoStore) {
      const count = await saveLocations(promoStore.id, promoLocations);
      results.promo = count;
    }
  } catch (e) {
    console.error("[ScrapeLocations] PROMO error:", e);
    results.promo = -1;
  }

  // --- IKI ---
  try {
    const ikiLocations = await scrapeIki();
    const ikiStore = await prisma.store.findFirst({ where: { chain: "IKI" } });
    if (ikiStore) {
      const count = await saveLocations(ikiStore.id, ikiLocations);
      results.iki = count;
    }
  } catch (e) {
    console.error("[ScrapeLocations] IKI error:", e);
    results.iki = -1;
  }

  // --- MAXIMA (Barbora) ---
  try {
    const maximaLocations = await scrapeMaxima();
    const maximaStore = await prisma.store.findFirst({
      where: { OR: [{ chain: "MAXIMA" }, { chain: "BARBORA" }] },
    });
    if (maximaStore) {
      const count = await saveLocations(maximaStore.id, maximaLocations);
      results.maxima = count;
    }
  } catch (e) {
    console.error("[ScrapeLocations] Maxima error:", e);
    results.maxima = -1;
  }

  return NextResponse.json({
    success: true,
    locationsImported: results,
  });
}

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(15000),
  });
  return res.text();
}

// --------------- RIMI ---------------
async function scrapeRimi(): Promise<ParsedLocation[]> {
  const html = await fetchHTML("https://www.rimi.lt/parduotuves");
  const $ = cheerio.load(html);
  const locations: ParsedLocation[] = [];

  // Each store card has the pattern: name, address, hours
  // Looking at the HTML structure from the fetched content
  $('[class*="store"]').each((_, el) => {
    const text = $(el).text();
    // Try to extract data from text
    const nameMatch = text.match(/„(.+?)"/);
    if (nameMatch) {
      const name = nameMatch[1];
      // Extract address from the text after the name
      const afterName = text.substring(text.indexOf(nameMatch[0]) + nameMatch[0].length);
      const addressMatch = afterName.match(/Žiūrėti žemėlapyje\s*(.+?)\s*Šiandien/);
      if (addressMatch) {
        const fullAddress = addressMatch[1].trim();
        const city = extractCity(fullAddress);
        const hoursMatch = afterName.match(/Šiandien dirba\s*([\d:]+\s*-\s*[\d:]+)/);
        locations.push({
          name: `Rimi ${name.replace("Rimi ", "")}`,
          address: fullAddress,
          city,
          hours: hoursMatch ? hoursMatch[1] : null,
          type: name.includes("Hyper") ? "HYPERMARKET" : name.includes("Express") || name.includes("EXP") ? "SMALL" : "LARGE",
        });
      }
    }
  });

  // Fallback: parse from the full text content directly
  if (locations.length === 0) {
    const fullText = $("body").text();
    const storeRegex = /„(Rimi[^"]+)"\s*Žiūrėti žemėlapyje\s*([^Š]+?)\s*Šiandien dirba\s*([\d:]+\s*-\s*[\d:]+)/g;
    let match;
    while ((match = storeRegex.exec(fullText)) !== null) {
      const name = match[1].trim();
      const address = match[2].trim();
      const hours = match[3].trim();
      const city = extractCity(address);
      locations.push({
        name,
        address,
        city,
        hours,
        type: name.includes("Hyper") ? "HYPERMARKET" : name.includes("Express") || name.includes("EXP") ? "SMALL" : "LARGE",
      });
    }
  }

  return locations;
}

// --------------- PROMO ---------------
async function scrapePromo(): Promise<ParsedLocation[]> {
  const html = await fetchHTML("https://epromo.lt/promo-cash-carry");
  const $ = cheerio.load(html);
  const locations: ParsedLocation[] = [];

  // PROMO stores appear as text like "Vilnius (Ukmergės g. 250)"
  // Only Lithuanian stores (filter out Latvian/Estonian)
  const ltCities = new Set([
    "Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys",
    "Alytus", "Utena", "Sudmantai",
  ]);

  const fullText = $("body").text();
  // Pattern: "City (Address)" followed by phone number
  const storeRegex = /([A-ZĄ-Ža-ząčęėįšųūž]+(?:\s+[a-ząčęėįšųūž]+)?)\s*\(([^)]+)\)/g;
  let match;
  while ((match = storeRegex.exec(fullText)) !== null) {
    const city = match[1].trim();
    const address = match[2].trim();
    if (ltCities.has(city) || address.includes(", Sudmantai")) {
      const actualCity = address.includes("Sudmantai") ? "Klaipėda" : city;
      locations.push({
        name: `PROMO C&C ${actualCity}`,
        address: address,
        city: actualCity,
        hours: null,
        type: "HYPERMARKET",
      });
    }
  }

  return locations;
}

// --------------- IKI ---------------
// IKI uses Google Maps JS rendering, so we scrape from their store list page
async function scrapeIki(): Promise<ParsedLocation[]> {
  // IKI stores page loads data via JavaScript, try alternative endpoint
  let locations: ParsedLocation[] = [];

  try {
    // Try the lastmile.lt API which IKI uses for e-commerce
    const res = await fetch("https://www.lastmile.lt/api/locate/shops?chain=IKI&limit=500", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const shop of data) {
          locations.push({
            name: shop.name || `IKI ${shop.city || ""}`,
            address: shop.address || "",
            city: shop.city || "",
            hours: shop.workingHours || null,
            type: (shop.name || "").toLowerCase().includes("express") ? "SMALL" : "LARGE",
          });
        }
      }
    }
  } catch {
    // Fallback: try scraping HTML
  }

  // Fallback: scrape HTML (limited, since JS-rendered)
  if (locations.length === 0) {
    try {
      const html = await fetchHTML("https://iki.lt/iki-parduotuviu-tinklas/");
      const $ = cheerio.load(html);
      // Look for store data in scripts or structured data
      $("script").each((_, el) => {
        const text = $(el).html() || "";
        if (text.includes("stores") || text.includes("parduotuv")) {
          // Try to find JSON data
          const jsonMatch = text.match(/\[[\s\S]*?{[\s\S]*?"address"[\s\S]*?}[\s\S]*?\]/);
          if (jsonMatch) {
            try {
              const stores = JSON.parse(jsonMatch[0]);
              for (const s of stores) {
                locations.push({
                  name: s.name || s.title || "IKI",
                  address: s.address || "",
                  city: s.city || "",
                  hours: s.hours || s.workingHours || null,
                  type: "LARGE",
                });
              }
            } catch { /* ignore parse errors */ }
          }
        }
      });
    } catch { /* ignore */ }
  }

  return locations;
}

// --------------- MAXIMA ---------------
async function scrapeMaxima(): Promise<ParsedLocation[]> {
  const locations: ParsedLocation[] = [];

  // Maxima has an API for their store locator
  try {
    const res = await fetch("https://www.maxima.lt/api/stores?country=lt&limit=500", {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      const stores = data.stores || data.data || data;
      if (Array.isArray(stores)) {
        for (const shop of stores) {
          locations.push({
            name: shop.name || shop.title || "Maxima",
            address: shop.address || "",
            city: shop.city || "",
            hours: shop.working_hours || shop.workingHours || null,
            type: (shop.name || "").toLowerCase().includes("xx") ? "HYPERMARKET" :
                  (shop.name || "").toLowerCase().includes("x") ? "LARGE" : "MEDIUM",
          });
        }
      }
    }
  } catch { /* API not available */ }

  return locations;
}

// --------------- Helpers ---------------

function extractCity(address: string): string {
  // Lithuanian addresses usually end with the city name
  // e.g. "Ozo g. 25, Vilnius" or "Naujoji g. 7E / Ūdrijos g. 1, Alytus"
  const parts = address.split(",").map((s) => s.trim());
  // The last part is usually the city
  const lastPart = parts[parts.length - 1];
  // Clean up district references
  const cityClean = lastPart
    .replace(/\s*(raj\.|r\.).*$/, "")
    .replace(/\s*km\..*$/, "")
    .trim();
  return cityClean || "Unknown";
}

function classifySize(name: string, type: string | null): string {
  if (type) return type;
  const n = name.toLowerCase();
  if (n.includes("hyper") || n.includes("xx")) return "HYPERMARKET";
  if (n.includes("express") || n.includes("mini") || n.includes("exp")) return "SMALL";
  if (n.includes("super")) return "LARGE";
  return "MEDIUM";
}

async function saveLocations(storeId: number, locations: ParsedLocation[]): Promise<number> {
  if (locations.length === 0) return 0;

  // Delete existing locations for this store (fresh import)
  await prisma.storeLocation.deleteMany({ where: { storeId } });

  let saved = 0;
  for (const loc of locations) {
    // Skip if no address
    if (!loc.address || loc.address.length < 3) continue;

    // Try to geocode - with rate limiting
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      // Add country for better geocoding
      const searchAddr = `${loc.address}, ${loc.city}, Lithuania`;
      const coords = await geocodeAddress(searchAddr);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
      // Respectful rate limiting for Nominatim
      await new Promise((r) => setTimeout(r, 1100));
    } catch { /* geocoding failed, skip coords */ }

    await prisma.storeLocation.create({
      data: {
        storeId,
        address: loc.address,
        city: loc.city,
        lat,
        lng,
        sizeCategory: classifySize(loc.name, loc.type),
        openingHours: loc.hours,
      },
    });
    saved++;
  }

  return saved;
}
