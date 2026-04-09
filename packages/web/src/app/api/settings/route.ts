import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSetting } from "@/lib/settings";
import { geocodeAddress } from "@/lib/distance";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  for (const [key, value] of Object.entries(body)) {
    await setSetting(key, value);
  }

  // If address changed, geocode it
  if (body.address && typeof body.address === "string" && body.address.trim()) {
    const coords = await geocodeAddress(body.address);
    if (coords) {
      await setSetting("lat", coords.lat);
      await setSetting("lng", coords.lng);
    }
  }

  const settings = await getSettings();
  return NextResponse.json(settings);
}
