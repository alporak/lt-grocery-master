import { NextRequest, NextResponse } from "next/server";
import { findSimilarByProduct } from "@/lib/compare";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/similar
 * Body: { productId: number }
 *
 * Given a reference product chosen in one store, returns the best matching
 * products in all other enabled stores, filtered by canonicalCategory.
 *
 * Response: { [storeId]: StoreMatch[] }
 */
export async function POST(req: NextRequest) {
  try {
    const { productId } = await req.json();
    if (!productId || typeof productId !== "number") {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }
    const results = await findSimilarByProduct(productId);
    return NextResponse.json(results);
  } catch (err) {
    console.error("[/api/products/similar]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
