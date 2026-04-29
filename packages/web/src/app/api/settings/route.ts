import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings, setSettingsForUser } from "@/lib/settings";
import { geocodeAddress } from "@/lib/distance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const settings = await getSettings(session?.user?.id ?? null);
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await setSettingsForUser(session.user.id, body);

  if (body.address && typeof body.address === "string" && body.address.trim()) {
    const coords = await geocodeAddress(body.address);
    if (coords) {
      await setSettingsForUser(session.user.id, {
        lat: coords.lat,
        lng: coords.lng,
      });
    }
  }

  const settings = await getSettings(session.user.id);
  return NextResponse.json(settings);
}
