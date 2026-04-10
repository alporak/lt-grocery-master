import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  // Try canonical categories first (from embedder)
  const canonicalCats = await prisma.product.findMany({
    select: { canonicalCategory: true },
    distinct: ["canonicalCategory"],
    where: { canonicalCategory: { not: null } },
  });

  if (canonicalCats.length > 0) {
    // Load the canonical category definitions from embedder
    try {
      const embedderUrl = process.env.EMBEDDER_URL || "http://embedder:8000";
      const res = await fetch(`${embedderUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const health = await res.json();
        // The categories are embedded in the health response indirectly;
        // we use the raw canonical IDs and provide bilingual labels
        const CATEGORY_LABELS: Record<string, { lt: string; en: string }> = {
          "poultry": { lt: "Paukštiena", en: "Poultry" },
          "beef": { lt: "Jautiena", en: "Beef" },
          "pork": { lt: "Kiauliena", en: "Pork" },
          "lamb": { lt: "Aviena", en: "Lamb" },
          "minced-meat": { lt: "Faršas", en: "Minced Meat" },
          "deli-meat": { lt: "Mėsos gaminiai", en: "Deli Meat & Sausages" },
          "fish-seafood": { lt: "Žuvis ir jūros gėrybės", en: "Fish & Seafood" },
          "milk": { lt: "Pienas", en: "Milk" },
          "cheese": { lt: "Sūris", en: "Cheese" },
          "yogurt": { lt: "Jogurtas", en: "Yogurt" },
          "butter-cream": { lt: "Sviestas ir grietinė", en: "Butter & Cream" },
          "cottage-cheese": { lt: "Varškė", en: "Cottage Cheese & Curd" },
          "eggs": { lt: "Kiaušiniai", en: "Eggs" },
          "bread": { lt: "Duona", en: "Bread" },
          "bakery": { lt: "Kepiniai", en: "Bakery & Pastry" },
          "fruits": { lt: "Vaisiai", en: "Fruits" },
          "vegetables": { lt: "Daržovės", en: "Vegetables" },
          "salads-herbs": { lt: "Salotos ir prieskoniai", en: "Salads & Herbs" },
          "mushrooms": { lt: "Grybai", en: "Mushrooms" },
          "frozen-food": { lt: "Šaldyti produktai", en: "Frozen Food" },
          "rice-grains": { lt: "Ryžiai ir kruopos", en: "Rice & Grains" },
          "pasta": { lt: "Makaronai", en: "Pasta & Noodles" },
          "flour-baking": { lt: "Miltai ir kepimo reikmenys", en: "Flour & Baking" },
          "oil-vinegar": { lt: "Aliejus ir actas", en: "Oil & Vinegar" },
          "canned-food": { lt: "Konservai", en: "Canned Food" },
          "sauces-condiments": { lt: "Padažai ir prieskoniai", en: "Sauces & Condiments" },
          "snacks": { lt: "Užkandžiai", en: "Snacks" },
          "sweets-chocolate": { lt: "Saldumynai", en: "Sweets & Chocolate" },
          "cereals": { lt: "Dribsniai ir granola", en: "Cereals & Granola" },
          "honey-jam": { lt: "Medus ir džemas", en: "Honey & Jam" },
          "tea": { lt: "Arbata", en: "Tea" },
          "coffee": { lt: "Kava", en: "Coffee" },
          "juice": { lt: "Sultys", en: "Juice" },
          "water": { lt: "Vanduo", en: "Water" },
          "soda-soft-drinks": { lt: "Gaivieji gėrimai", en: "Soft Drinks" },
          "beer": { lt: "Alus", en: "Beer" },
          "wine": { lt: "Vynas", en: "Wine" },
          "spirits": { lt: "Stiprieji alkoholiniai gėrimai", en: "Spirits" },
          "baby-food": { lt: "Kūdikių maistas", en: "Baby Food" },
          "pet-food": { lt: "Gyvūnų maistas", en: "Pet Food" },
          "cleaning": { lt: "Valymo priemonės", en: "Cleaning Products" },
          "laundry": { lt: "Skalbimo priemonės", en: "Laundry" },
          "paper-products": { lt: "Popieriniai gaminiai", en: "Paper Products" },
          "personal-care": { lt: "Asmens higiena", en: "Personal Care" },
          "health": { lt: "Sveikata", en: "Health & Wellness" },
          "ready-meals": { lt: "Paruošti patiekalai", en: "Ready Meals" },
          "spices": { lt: "Prieskoniai", en: "Spices & Seasonings" },
          "other": { lt: "Kita", en: "Other" },
        };

        return NextResponse.json(
          canonicalCats
            .filter(c => c.canonicalCategory)
            .map(c => {
              const id = c.canonicalCategory!;
              const labels = CATEGORY_LABELS[id];
              return {
                id,
                lt: labels?.lt || id,
                en: labels?.en || id,
              };
            })
            .sort((a, b) => a.en.localeCompare(b.en))
        );
      }
    } catch {
      // Fall through to raw categories
    }
  }

  // Fallback: raw scraped categories
  const categories = await prisma.product.findMany({
    select: { categoryLt: true, categoryEn: true },
    distinct: ["categoryLt"],
    where: { categoryLt: { not: null } },
  });

  return NextResponse.json(
    categories
      .filter((c) => c.categoryLt)
      .map((c) => ({
        lt: c.categoryLt,
        en: c.categoryEn || c.categoryLt,
      }))
  );
}
