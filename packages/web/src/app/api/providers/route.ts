import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
  try {
    const res = await fetch(`${embedderUrl}/providers`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({ providers: [] }, { status: 502 });
  } catch {
    return NextResponse.json({ providers: [] }, { status: 503 });
  }
}
