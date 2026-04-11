// Brand preferences stored in localStorage keyed by canonical category ID
const STORAGE_KEY = "grocery_brand_preferences";

export interface BrandPreferences {
  [categoryId: string]: string; // categoryId → brand name
}

export function getBrandPreferences(): BrandPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getPreferredBrand(categoryId: string): string | null {
  return getBrandPreferences()[categoryId] ?? null;
}

export function setPreferredBrand(categoryId: string, brand: string): void {
  if (typeof window === "undefined") return;
  const prefs = getBrandPreferences();
  prefs[categoryId] = brand;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clearPreferredBrand(categoryId: string): void {
  if (typeof window === "undefined") return;
  const prefs = getBrandPreferences();
  delete prefs[categoryId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
