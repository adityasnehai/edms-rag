import { useEffect, useState } from "react";

import {
  clearRecentSearches,
  fetchRecentSearches,
  saveRecentSearch,
} from "../api/state";

const RECENT_UPDATED_EVENT = "edms:recent-updated";

export default function useRecentSearches() {
  const [recent, setRecent] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function syncRecent() {
      try {
        const data = await fetchRecentSearches();
        if (!cancelled) {
          setRecent(Array.isArray(data?.items) ? data.items : []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRecent([]);
          setLoaded(true);
        }
      }
    }

    syncRecent();
    window.addEventListener(RECENT_UPDATED_EVENT, syncRecent);
    return () => {
      cancelled = true;
      window.removeEventListener(RECENT_UPDATED_EVENT, syncRecent);
    };
  }, []);

  async function addRecent(query, result = null) {
    const cleanedQuery = (query || "").trim();
    if (!cleanedQuery) {
      return;
    }
    await saveRecentSearch(cleanedQuery, result);
    window.dispatchEvent(new Event(RECENT_UPDATED_EVENT));
  }

  function getRecent(query) {
    const cleanedQuery = (query || "").trim();
    if (!cleanedQuery) {
      return null;
    }
    return recent.find((entry) => entry.query === cleanedQuery) || null;
  }

  async function clearRecent() {
    await clearRecentSearches();
    setRecent([]);
    window.dispatchEvent(new Event(RECENT_UPDATED_EVENT));
  }

  return { recent, loaded, addRecent, getRecent, clearRecent };
}
