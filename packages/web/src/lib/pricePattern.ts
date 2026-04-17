export interface PriceRecord {
  regularPrice: number;
  salePrice: number | null;
  loyaltyPrice: number | null;
  scrapedAt: string;
}

export interface PricePatternResult {
  onSaleNow: boolean;
  saleDates: Date[];
  avgSaleCycleDays: number | null;
  daysSinceLastSale: number | null;
  estimatedDaysUntilNextSale: number | null;
  minSalePrice: number | null;
  avgSalePrice: number | null;
  currentVsMin: "at_min" | "above_min" | "no_data";
  recommendation: "buy_now" | "wait" | "neutral";
  recommendationReason: string;
}

export function analyzePricePattern(records: PriceRecord[]): PricePatternResult {
  if (records.length === 0) {
    return {
      onSaleNow: false, saleDates: [], avgSaleCycleDays: null,
      daysSinceLastSale: null, estimatedDaysUntilNextSale: null,
      minSalePrice: null, avgSalePrice: null, currentVsMin: "no_data",
      recommendation: "neutral", recommendationReason: "Not enough data",
    };
  }

  // Sort oldest first
  const sorted = [...records].sort((a, b) => new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime());
  const latest = sorted[sorted.length - 1];
  const now = new Date();

  // Effective price per record
  const effectivePrice = (r: PriceRecord) =>
    Math.min(r.regularPrice, r.salePrice ?? Infinity, r.loyaltyPrice ?? Infinity);

  const currentEffective = effectivePrice(latest);
  const onSaleNow = latest.salePrice != null && latest.salePrice < latest.regularPrice;

  // Find sale occurrences (deduplicated by day)
  const saleDaySet = new Set<string>();
  const salePrices: number[] = [];
  for (const r of sorted) {
    if (r.salePrice != null && r.salePrice < r.regularPrice) {
      const day = r.scrapedAt.substring(0, 10);
      if (!saleDaySet.has(day)) {
        saleDaySet.add(day);
        salePrices.push(r.salePrice);
      }
    }
  }
  const saleDates = [...saleDaySet].map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());

  // Compute sale cycle from gaps between separate sale runs
  const saleRuns: Date[] = [];
  let inRun = false;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const isOnSale = r.salePrice != null && r.salePrice < r.regularPrice;
    if (isOnSale && !inRun) {
      saleRuns.push(new Date(r.scrapedAt));
      inRun = true;
    } else if (!isOnSale) {
      inRun = false;
    }
  }

  let avgSaleCycleDays: number | null = null;
  if (saleRuns.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < saleRuns.length; i++) {
      const gap = (saleRuns[i].getTime() - saleRuns[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    avgSaleCycleDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }

  const lastSaleDate = saleDates[saleDates.length - 1] ?? null;
  const daysSinceLastSale = lastSaleDate
    ? Math.floor((now.getTime() - lastSaleDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let estimatedDaysUntilNextSale: number | null = null;
  if (avgSaleCycleDays !== null && daysSinceLastSale !== null && !onSaleNow) {
    estimatedDaysUntilNextSale = Math.max(0, avgSaleCycleDays - daysSinceLastSale);
  }

  const minSalePrice = salePrices.length > 0 ? Math.min(...salePrices) : null;
  const avgSalePrice = salePrices.length > 0
    ? Math.round(salePrices.reduce((a, b) => a + b, 0) / salePrices.length * 100) / 100
    : null;

  const currentVsMin: PricePatternResult["currentVsMin"] = minSalePrice === null
    ? "no_data"
    : currentEffective <= minSalePrice * 1.02 ? "at_min" : "above_min";

  let recommendation: PricePatternResult["recommendation"] = "neutral";
  let recommendationReason = "";

  if (onSaleNow) {
    if (currentVsMin === "at_min") {
      recommendation = "buy_now";
      recommendationReason = `At historic low (${minSalePrice?.toFixed(2)}€). Buy now.`;
    } else {
      recommendation = "buy_now";
      recommendationReason = "Currently on sale.";
    }
  } else if (estimatedDaysUntilNextSale !== null && estimatedDaysUntilNextSale <= 7) {
    recommendation = "wait";
    recommendationReason = `Sale expected in ~${estimatedDaysUntilNextSale}d (avg cycle: ${avgSaleCycleDays}d).`;
  } else if (avgSaleCycleDays !== null && saleDates.length >= 3) {
    recommendation = "neutral";
    recommendationReason = `Goes on sale every ~${avgSaleCycleDays}d. Last sale ${daysSinceLastSale}d ago.`;
  } else {
    recommendation = "neutral";
    recommendationReason = saleDates.length === 0 ? "No sale history." : "Insufficient pattern data.";
  }

  return {
    onSaleNow, saleDates, avgSaleCycleDays, daysSinceLastSale,
    estimatedDaysUntilNextSale, minSalePrice, avgSalePrice,
    currentVsMin, recommendation, recommendationReason,
  };
}
