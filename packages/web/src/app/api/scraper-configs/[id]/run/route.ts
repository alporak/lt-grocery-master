import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

function parsePrice(raw: string): number | null {
  // Handle various price formats: "1,99 €", "€1.99", "1.99", "1,99"
  const cleaned = raw
    .replace(/[^\d,.]/g, "")
    .replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeForIndex(text: string): string {
  const LT_MAP: Record<string, string> = {
    ą: "a", č: "c", ę: "e", ė: "e", į: "i",
    š: "s", ų: "u", ū: "u", ž: "z",
  };
  return text
    .toLowerCase()
    .split("")
    .map((c) => LT_MAP[c] || c)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * POST /api/scraper-configs/[id]/run
 * Scrapes the URL and imports products into the database.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = await prisma.scraperConfig.findUnique({
    where: { id: parseInt(id, 10) },
  });

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  // Find or create the custom store
  let store = await prisma.store.findFirst({
    where: { slug: `custom-${config.id}` },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        slug: `custom-${config.id}`,
        name: config.storeName,
        chain: config.chain,
        url: config.url,
        enabled: true,
      },
    });
  }

  try {
    let allItems: Array<{
      name: string;
      price: number;
      link: string | null;
      image: string | null;
      category: string | null;
    }> = [];

    let currentUrl: string | null = config.url;
    let pageCount = 0;
    const maxPages = 10; // Safety limit

    while (currentUrl && pageCount < maxPages) {
      const res = await fetch(currentUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) break;

      const html = await res.text();
      const $ = cheerio.load(html);
      const containers = $(config.containerSel);

      containers.each((_, el) => {
        const container = $(el);
        const name = container.find(config.nameSel).first().text().trim();
        const priceRaw = container.find(config.priceSel).first().text().trim();
        const price = parsePrice(priceRaw);

        if (!name || price === null) return;

        const link = config.linkSel
          ? container.find(config.linkSel).first().attr("href") || null
          : null;
        const image = config.imageSel
          ? container.find(config.imageSel).first().attr("src") || null
          : null;
        const category = config.categorySel
          ? container.find(config.categorySel).first().text().trim() || null
          : null;

        // Resolve relative URLs
        const baseUrl = new URL(currentUrl!);
        const fullLink = link ? new URL(link, baseUrl).href : null;
        const fullImage = image ? new URL(image, baseUrl).href : null;

        allItems.push({ name, price, link: fullLink, image: fullImage, category });
      });

      // Check for next page
      if (config.paginationSel) {
        const nextHref = $(config.paginationSel).attr("href");
        if (nextHref && nextHref !== currentUrl) {
          currentUrl = new URL(nextHref, new URL(currentUrl)).href;
          pageCount++;
        } else {
          currentUrl = null;
        }
      } else {
        currentUrl = null;
      }
    }

    // Import items into database
    let imported = 0;
    for (const item of allItems) {
      const externalId = `custom-${normalizeForIndex(item.name).replace(/\s+/g, "-").slice(0, 100)}`;

      await prisma.product.upsert({
        where: {
          storeId_externalId: { storeId: store.id, externalId },
        },
        update: {
          nameLt: item.name,
          categoryLt: item.category,
          imageUrl: item.image,
          productUrl: item.link,
          searchIndex: normalizeForIndex(item.name),
          priceRecords: {
            create: { regularPrice: item.price },
          },
        },
        create: {
          storeId: store.id,
          externalId,
          nameLt: item.name,
          categoryLt: item.category,
          imageUrl: item.image,
          productUrl: item.link,
          searchIndex: normalizeForIndex(item.name),
          priceRecords: {
            create: { regularPrice: item.price },
          },
        },
      });
      imported++;
    }

    // Update config stats
    await prisma.scraperConfig.update({
      where: { id: config.id },
      data: {
        lastRunAt: new Date(),
        lastRunCount: imported,
      },
    });

    // Update store last scraped
    await prisma.store.update({
      where: { id: store.id },
      data: { lastScrapedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      imported,
      storeId: store.id,
      storeName: store.name,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
