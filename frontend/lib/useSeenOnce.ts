"use client";
import { useEffect, useState } from "react";

// One-time hint gating. Returns true once the hint identified by `key` has been
// seen before. First render returns false (show it); on mount we read
// localStorage and, if unseen, mark it so subsequent visits hide it. SSR-safe:
// defaults to "not seen" until mounted to avoid a hydration mismatch. An empty
// key is a no-op that always shows the hint.
export function useSeenOnce(key: string): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!key) return;
    const storageKey = `ss_seen_${key}`;
    try {
      if (localStorage.getItem(storageKey)) {
        setSeen(true);
      } else {
        localStorage.setItem(storageKey, "1");
      }
    } catch {
      // localStorage unavailable — always show the hint
    }
  }, [key]);
  return seen;
}
