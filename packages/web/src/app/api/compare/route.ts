import { NextRequest, NextResponse } from "next/server";
import { compareGroceryList } from "@/lib/compare";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = body.items;
  const language = body.language || "lt";

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 }
    );
  }

  const result = await compareGroceryList(items, language);
  return NextResponse.json(result);
}
