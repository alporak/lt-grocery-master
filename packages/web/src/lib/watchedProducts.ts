const STORAGE_KEY = "lt_grocery_watched";

export interface WatchedProduct {
  id: number;
  name: string;
  store: string;
  watchedAt: string;
  lastSeenPrice: number;
}

function load(): WatchedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(items: WatchedProduct[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getWatchedProducts(): WatchedProduct[] {
  return load();
}

export function isWatched(id: number): boolean {
  return load().some((p) => p.id === id);
}

export function watchProduct(product: { id: number; name: string; store: string; price: number }) {
  const items = load();
  const existing = items.findIndex((p) => p.id === product.id);
  const entry: WatchedProduct = {
    id: product.id,
    name: product.name,
    store: product.store,
    watchedAt: new Date().toISOString(),
    lastSeenPrice: product.price,
  };
  if (existing >= 0) {
    items[existing] = entry;
  } else {
    items.push(entry);
  }
  save(items);
}

export function unwatchProduct(id: number) {
  save(load().filter((p) => p.id !== id));
}

export function updateLastSeenPrice(id: number, price: number) {
  const items = load();
  const i = items.findIndex((p) => p.id === id);
  if (i >= 0) {
    items[i].lastSeenPrice = price;
    save(items);
  }
}
