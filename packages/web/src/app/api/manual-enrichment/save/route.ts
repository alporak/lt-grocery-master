import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ENRICH_VERSION, normalizeBrand, validateCategory } from "@/lib/enrichmentPrompt";
import type { EnrichmentItem } from "@/lib/enrichmentPrompt";

export const dynamic = "force-dynamic";

interface SaveEntry {
  id: number;
  enrichment: EnrichmentItem;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { entries: SaveEntry[] };

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: "No entries to save" }, { status: 400 });
  }

  const results = { saved: 0, skipped: 0, errors: [] as string[] };

  for (const entry of body.entries) {
    const { id, enrichment } = entry;
    if (!id || !enrichment) {
      results.skipped++;
      continue;
    }

    // Replicate Python _db_save_batch logic exactly
    const nameEn = enrichment.name_clean || null;
    const brand = normalizeBrand(enrichment.brand);
    const canonicalCategory = validateCategory(enrichment.canonical_category);
    const subcategory = enrichment.subcategory || null;

    try {
      // COALESCE(NULLIF(new, ''), existing) logic: only overwrite if new value is non-null
      await prisma.product.update({
        where: { id },
        data: {
          enrichment: JSON.stringify(enrichment),
          enrichedAt: new Date(),
          enrichmentVersion: ENRICH_VERSION,
          // Only overwrite nameEn/brand/category if LLM provided a value
          ...(nameEn ? { nameEn } : {}),
          ...(brand ? { brand } : {}),
          ...(canonicalCategory ? { canonicalCategory } : {}),
          ...(subcategory ? { subcategory } : {}),
        },
      });
      results.saved++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.errors.push(`Product ${id}: ${msg}`);
      results.skipped++;
    }
  }

  return NextResponse.json(results);
}
