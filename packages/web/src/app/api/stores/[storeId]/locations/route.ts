import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/stores/[storeId]/locations — list locations for a store
export async function GET(
  _req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const storeId = parseInt(params.storeId, 10);
  if (isNaN(storeId)) {
    return NextResponse.json({ error: "Invalid storeId" }, { status: 400 });
  }

  const locations = await prisma.storeLocation.findMany({
    where: { storeId },
    orderBy: { city: "asc" },
  });

  return NextResponse.json(locations);
}

// POST /api/stores/[storeId]/locations — add a location manually
export async function POST(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const storeId = parseInt(params.storeId, 10);
  if (isNaN(storeId)) {
    return NextResponse.json({ error: "Invalid storeId" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const body = await req.json();
  const { address, city, lat, lng, sizeCategory, openingHours } = body;

  if (!address || !city || !sizeCategory) {
    return NextResponse.json(
      { error: "address, city, and sizeCategory are required" },
      { status: 400 }
    );
  }

  // If lat/lng not provided, try to geocode via Nominatim
  let resolvedLat: number | null = lat ?? null;
  let resolvedLng: number | null = lng ?? null;

  if (resolvedLat == null || resolvedLng == null) {
    try {
      const query = encodeURIComponent(`${address}, ${city}, Lithuania`);
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        {
          headers: { "User-Agent": "lt-grocery-master/1.0" },
        }
      );
      const geoData = await geo.json();
      if (geoData?.[0]) {
        resolvedLat = parseFloat(geoData[0].lat);
        resolvedLng = parseFloat(geoData[0].lon);
      }
    } catch {
      // Geocoding failed — save without coordinates
    }
  }

  const location = await prisma.storeLocation.create({
    data: {
      storeId,
      address,
      city,
      lat: resolvedLat,
      lng: resolvedLng,
      sizeCategory,
      openingHours: openingHours || null,
    },
  });

  return NextResponse.json(location, { status: 201 });
}

// DELETE /api/stores/[storeId]/locations?locationId=N — remove a location
export async function DELETE(
  req: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const storeId = parseInt(params.storeId, 10);
  const locationId = parseInt(
    new URL(req.url).searchParams.get("locationId") ?? "",
    10
  );

  if (isNaN(storeId) || isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  await prisma.storeLocation.deleteMany({
    where: { id: locationId, storeId },
  });

  return NextResponse.json({ success: true });
}
