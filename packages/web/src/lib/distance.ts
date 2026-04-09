/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate a weighted score combining distance and store size.
 * Lower is better. Bigger stores get a slight bonus (subtracted distance).
 */
export function storeScore(distanceKm: number, sizeCategory: string): number {
  const sizeBonus: Record<string, number> = {
    HYPERMARKET: 1.5,
    LARGE: 1.0,
    MEDIUM: 0.5,
    SMALL: 0,
  };
  return distanceKm - (sizeBonus[sizeCategory] || 0);
}

/**
 * Geocode an address using OpenStreetMap Nominatim.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "lt");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "LTGroceryApp/1.0" },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
}
