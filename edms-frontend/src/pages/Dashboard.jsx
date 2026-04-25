import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { searchQuery } from "../api/search";
import { fetchStats } from "../api/stats";
import DashboardHeader from "../components/DashboardHeader";
import EvidenceItem from "../components/EvidenceItem";
import FormattedContent from "../components/FormattedContent";
import WorkspaceShell from "../components/WorkspaceShell";
import useRecentSearches from "../hooks/useRecentSearches";
import { getAuthPayload } from "../utils/auth";
import { SearchIcon, SparkleIcon } from "../components/AppIcons";

export default function Dashboard() {
  const payload = getAuthPayload();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addRecent, recent, loaded: recentLoaded } = useRecentSearches();
  const lastSyncedRouteQuery = useRef("");
  const queryRef = useRef("");

  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const data = await fetchStats();
        if (!cancelled) {
          setStats(data);
        }
      } catch {
        if (!cancelled) {
          setStats(null);
        }
      }
    }

    function handleWorkspaceUpdate() {
      loadStats();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadStats();
      }
    }

    loadStats();
    window.addEventListener("edms:data-updated", handleWorkspaceUpdate);
    window.addEventListener("focus", handleWorkspaceUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("edms:data-updated", handleWorkspaceUpdate);
      window.removeEventListener("focus", handleWorkspaceUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!recentLoaded) {
      return;
    }

    const queryFromRoute = searchParams.get("query") || "";
    if (!queryFromRoute.trim()) {
      if (queryRef.current) {
        setQuery("");
      }
      setLoading(false);
      setError("");
      setResult(null);
      return;
    }

    if (queryFromRoute === lastSyncedRouteQuery.current) {
      lastSyncedRouteQuery.current = "";
      if (queryFromRoute !== queryRef.current) {
        setQuery(queryFromRoute);
      }
      return;
    }

    if (queryFromRoute !== queryRef.current) {
      setQuery(queryFromRoute);
    }

    const cachedRecent =
      recent.find((entry) => entry.query === queryFromRoute) || null;
    if (cachedRecent?.result) {
      setLoading(false);
      setError("");
      setResult(cachedRecent.result);
      return;
    }

    async function runRouteSearch() {
      const cleanedQuery = queryFromRoute.trim();
      if (!cleanedQuery) {
        return;
      }

      setLoading(true);
      setError("");
      setResult(null);

      try {
        const data = await searchQuery(cleanedQuery);
        setResult(data);
        addRecent(cleanedQuery, data);
      } catch {
        setError("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }

    runRouteSearch();
  }, [addRecent, recent, recentLoaded, searchParams]);

  async function handleSearch(nextQuery = query, options = {}) {
    const cleanedQuery = (nextQuery || "").trim();
    if (!cleanedQuery) {
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    if (options.syncRoute !== false) {
      lastSyncedRouteQuery.current = cleanedQuery;
      setSearchParams({ query: cleanedQuery });
    }

    try {
      const data = await searchQuery(cleanedQuery);
      setResult(data);
      addRecent(cleanedQuery, data);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResult(null);
    setError("");
    setSearchParams({});
  }

  if (!payload) {
    return null;
  }

  const evidence = result?.evidence ?? [];

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container space-y-6 py-6 lg:py-8">
        <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
          <div className="mb-4">
            <DashboardHeader stats={stats} />
          </div>

          <div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Search
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Ask one question. Get a grounded answer.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                EDMS searches the indexed workspace and returns concise answers
                backed by the evidence stored in your organization.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-border bg-background p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl bg-card px-4 py-3">
                <SearchIcon className="h-5 w-5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask about ADRs, RFCs, notes, tickets, postmortems, or diagrams..."
                  className="w-full border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Searching..." : "Search"}
                </button>

                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>

        {loading && (
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-card">
            <div className="flex items-center gap-3 text-sm text-primary">
              <SparkleIcon className="h-5 w-5" />
              <p>EDMS is analyzing the workspace evidence...</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                    Answer
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {result.query || query}
                  </h2>
                </div>

                <div className="rounded-2xl border border-border bg-secondary px-4 py-3 text-right">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Evidence Used
                  </p>
                  <p className="mt-1 text-xl font-semibold text-secondary-foreground">
                    {evidence.length}
                  </p>
                </div>
              </div>

              {evidence.length === 0 && (
                <p className="mt-4 text-sm italic text-muted-foreground">
                  Tip: Ask about the documents or data types available in this workspace.
                </p>
              )}

              <div className="mt-5 rounded-[24px] border border-border bg-secondary p-5">
                <FormattedContent
                  text={result.answer}
                  paragraphClassName="text-[15px] leading-8 text-slate-700"
                  listClassName="space-y-2 pl-5 text-[15px] leading-8 text-slate-700"
                  headingClassName="text-slate-900"
                  strongClassName="text-slate-900"
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                    Evidence
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    Supporting records
                  </h3>
                </div>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Returned for this query
                </p>
              </div>

              {evidence.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {evidence.map((item, idx) => (
                    <EvidenceItem
                      key={`${item.doc_id}-${item.section_type}-${idx}`}
                      item={item}
                      variant="search"
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-3xl border border-dashed border-border bg-secondary px-5 py-10 text-center text-sm text-muted-foreground">
                  No supporting evidence was retrieved for this search.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
