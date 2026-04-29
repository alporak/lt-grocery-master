"use client";

import { useEffect, useRef, useCallback } from "react";

interface ListMeta {
  version: number;
  updatedAt: string;
}

export function useListSync(
  listId: number | null,
  currentVersion: number,
  onStale: () => void
) {
  const onStaleRef = useRef(onStale);
  onStaleRef.current = onStale;

  const pollRef = useRef<number | null>(null);

  const cleanupSSERef = useRef<(() => void) | null>(null);

  const startSSE = useCallback(() => {
    if (listId == null) return;

    const eventSource = new EventSource(`/api/grocery-lists/${listId}/stream`);
    const handler = (event: MessageEvent) => {
      try {
        const meta: ListMeta = JSON.parse(event.data);
        if (meta.version !== currentVersion) {
          onStaleRef.current();
        }
      } catch {
        // parse error, ignore
      }
    };
    eventSource.addEventListener("message", handler);

    return () => {
      eventSource.removeEventListener("message", handler);
      eventSource.close();
    };
  }, [listId, currentVersion]);

  useEffect(() => {
    cleanupSSERef.current?.();
    const cleanup = startSSE();
    cleanupSSERef.current = cleanup ?? null;
    return () => cleanup?.();
  }, [startSSE]);

  useEffect(() => {
    if (listId == null) return;

    pollRef.current = window.setInterval(() => {
      fetch(`/api/grocery-lists/${listId}`)
        .then((r) => r.json())
        .then((list: { version: number }) => {
          if (list.version !== currentVersion) {
            onStaleRef.current();
          }
        })
        .catch(() => {});
    }, 5000);

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
      }
    };
  }, [listId, currentVersion]);
}
