/**
 * Compute the total line cost for a matched product.
 *
 * - matchType "pack" → the product IS a multi-pack; price already covers the quantity.
 * - matchType "unit" or undefined → single item; multiply by quantity.
 *
 * This module is safe to import from client components (no Prisma dependency).
 */
export function computeLineCost(
  match: {
    price: number;
    salePrice?: number;
    loyaltyPrice?: number;
    matchType?: "pack" | "unit";
  },
  quantity: number
): number {
  const bestPrice = Math.min(
    match.price,
    match.salePrice ?? Infinity,
    match.loyaltyPrice ?? Infinity
  );
  return match.matchType === "pack" ? bestPrice : bestPrice * quantity;
}
