"use client";

const CACHE_PREFIX = "grocery-list-cache:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedList {
  data: unknown;
  cachedAt: number;
}

export function cacheList(listId: number, data: unknown): void {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${listId}`,
      JSON.stringify({ data, cachedAt: Date.now() })
    );
  } catch {
    // localStorage full or unavailable
  }
}

export function getCachedList(listId: number): unknown | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${listId}`);
    if (!raw) return null;
    const cached: CachedList = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_PREFIX}${listId}`);
      return null;
    }
    return cached.data;
  } catch {
    return null;
  }
}

export function clearListCache(listId?: number): void {
  if (listId !== undefined) {
    localStorage.removeItem(`${CACHE_PREFIX}${listId}`);
  } else {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // best effort
    }
  }
}
