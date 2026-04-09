import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

/**
 * POST /api/scraper-configs/[id]/test
 * Fetches the URL and tests the CSS selectors, returning matched items.
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

  try {
    const res = await fetch(config.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const containers = $(config.containerSel);

    const items: Array<{
      name: string;
      price: string;
      link: string | null;
      image: string | null;
      category: string | null;
    }> = [];

    containers.each((_, el) => {
      const container = $(el);
      const name = container.find(config.nameSel).first().text().trim();
      const priceRaw = container.find(config.priceSel).first().text().trim();

      if (!name) return;

      const link = config.linkSel
        ? container.find(config.linkSel).first().attr("href") || null
        : null;
      const image = config.imageSel
        ? container.find(config.imageSel).first().attr("src") || null
        : null;
      const category = config.categorySel
        ? container.find(config.categorySel).first().text().trim() || null
        : null;

      items.push({ name, price: priceRaw, link, image, category });
    });

    return NextResponse.json({
      url: config.url,
      totalContainers: containers.length,
      items: items.slice(0, 20), // Show first 20 for preview
      totalMatched: items.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
