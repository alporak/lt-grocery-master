import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EMBEDDER_URL = process.env.EMBEDDER_URL || "http://embedder:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${EMBEDDER_URL}/bulk-enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET() {
  const res = await fetch(`${EMBEDDER_URL}/bulk-enrich/status`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });

  const data = await res.json();
  return NextResponse.json(data);
}

export async function DELETE() {
  const res = await fetch(`${EMBEDDER_URL}/bulk-enrich/stop`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
