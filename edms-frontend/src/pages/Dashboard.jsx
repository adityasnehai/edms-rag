import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { searchQuery } from "../api/search";
import { fetchStats } from "../api/stats";
import DashboardHeader from "../components/DashboardHeader";
import EvidenceItem from "../components/EvidenceItem";
import FormattedContent from "../components/FormattedContent";
import WorkspaceShell from "../components/WorkspaceShell";
import useRecentSearches from "../hooks/useRecentSearches";
import usePageTitle from "../hooks/usePageTitle";
import { getAuthPayload } from "../utils/auth";
import { SearchIcon, SparkleIcon } from "../components/AppIcons";

const EXAMPLE_QUERIES = [
  "What changed before the outage?",
  "Which ADR explains the current auth flow?",
];

export default function Dashboard() {
  const payload = getAuthPayload();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addRecent, recent, loaded: recentLoaded } = useRecentSearches();
  const lastSyncedRouteQuery = useRef("");
  const queryRef = useRef("");
  const inputRef = useRef(null);

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
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled) setStats(null);
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
    if (!recentLoaded) return;

    const queryFromRoute = searchParams.get("query") || "";
    if (!queryFromRoute.trim()) {
      if (queryRef.current) setQuery("");
      setLoading(false);
      setError("");
      setResult(null);
      return;
    }

    if (queryFromRoute === lastSyncedRouteQuery.current) {
      lastSyncedRouteQuery.current = "";
      if (queryFromRoute !== queryRef.current) setQuery(queryFromRoute);
      return;
    }

    if (queryFromRoute !== queryRef.current) setQuery(queryFromRoute);

    const cachedRecent = recent.find((e) => e.query === queryFromRoute) || null;
    if (cachedRecent?.result) {
      setLoading(false);
      setError("");
      setResult(cachedRecent.result);
      return;
    }

    async function runRouteSearch() {
      const cleanedQuery = queryFromRoute.trim();
      if (!cleanedQuery) return;
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
    if (!cleanedQuery) return;

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

  const evidence = useMemo(() => result?.evidence ?? [], [result]);
  const relatedEvidence = useMemo(() => result?.related_evidence ?? [], [result]);
  usePageTitle("Search");

  // "/" shortcut focuses the search input
  useEffect(() => {
    function handleKey(e) {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!payload) return null;

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-6xl space-y-4 py-5 lg:py-6">

        {/* Stats grid */}
        <div className="animate-fade-up" style={{ animationDelay: "55ms" }}>
          <DashboardHeader stats={stats} />
        </div>

        {/* Search card */}
        <section
          className="animate-fade-up rounded-2xl border border-border bg-card shadow-sm"
          style={{ animationDelay: "110ms" }}
        >
          <div className="p-4 lg:p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
                  <SparkleIcon className="h-4 w-4 text-[#a76311]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Search incident and decision history
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{payload?.org_name || "MemoStack"}</p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div
              className={`flex items-center gap-3 rounded-xl border bg-background px-4 py-3 transition-all ${
                loading
                  ? "border-primary/30 ring-2 ring-primary/10"
                  : "border-border shadow-sm hover:border-primary/25 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10"
              }`}
            >
              <SearchIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Ask about incidents, ADRs, RFCs, tickets, and postmortems… (press / to focus)"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={loading || !query.trim()}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-4 py-2 text-sm font-semibold text-[#251f19] shadow-sm transition hover:border-[#f48d16]/35 hover:bg-[#ffeed2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SearchIcon className="h-4 w-4" />
                {loading ? "Searching" : "Search"}
              </button>
            </div>

            {/* Example queries + actions */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => { setQuery(q); handleSearch(q); }}
                    className="rounded-full border border-border bg-secondary/55 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[#f48d16]/22 hover:bg-[#fff4e1] hover:text-primary"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                {(result || query) && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        </section>

        {/* Loading state */}
        {loading && (
          <section className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
                <SparkleIcon className="h-5 w-5 animate-pulse-soft text-[#a76311]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Analyzing workspace evidence
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Searching across ADRs, RFCs, meeting notes, postmortems, tickets, and images
                </p>
              </div>
            </div>
            <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-[#f4eee4]">
              <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,rgba(244,141,22,0),rgba(244,141,22,0.45),rgba(244,141,22,0))] bg-[length:200%_100%] animate-line-flow" />
            </div>
          </section>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Answer card */}
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a76311]">
                    Answer
                  </span>
                  <h2 className="mt-3 text-lg font-semibold text-foreground">
                    {result.query || query}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evidence.length} supporting record{evidence.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {evidence.length === 0 && (
                <p className="mt-4 text-sm italic text-muted-foreground">
                  Try asking about specific documents or decision types available in this workspace.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-border bg-secondary/55 p-4">
                <FormattedContent
                  text={result.answer}
                  paragraphClassName="text-[15px] leading-8 text-stone-700"
                  listClassName="space-y-2 pl-5 text-[15px] leading-8 text-stone-700"
                  headingClassName="text-stone-950"
                  strongClassName="text-stone-950"
                />
              </div>
            </section>

            {/* Evidence cards */}
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Supporting records
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {evidence.length} result{evidence.length !== 1 ? "s" : ""}
                </p>
              </div>

              {evidence.length > 0 ? (
                <>
                  {/* Mobile: vertical stack */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {evidence.map((item, idx) => (
                      <EvidenceItem
                        key={`${item.doc_id}-${item.section_type}-${idx}`}
                        item={item}
                        variant="search"
                      />
                    ))}
                  </div>
                  {/* Desktop: horizontal scroll */}
                  <div className="-mx-1 hidden overflow-x-auto pb-3 sm:block">
                    <div className="flex snap-x snap-mandatory gap-4 px-1">
                      {evidence.map((item, idx) => (
                        <EvidenceItem
                          key={`${item.doc_id}-${item.section_type}-${idx}`}
                          item={item}
                          variant="search"
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/50 px-5 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No supporting evidence retrieved for this search.
                  </p>
                </div>
              )}
            </section>

            {relatedEvidence.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      Related evidence
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Heuristically linked by service, document family, and query overlap.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {relatedEvidence.length} item{relatedEvidence.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:hidden">
                  {relatedEvidence.map((item, idx) => (
                    <EvidenceItem
                      key={`${item.doc_id}-${item.section_type}-related-${idx}`}
                      item={item}
                      variant="search"
                    />
                  ))}
                </div>

                <div className="-mx-1 hidden overflow-x-auto pb-3 sm:block">
                  <div className="flex snap-x snap-mandatory gap-4 px-1">
                    {relatedEvidence.map((item, idx) => (
                      <EvidenceItem
                        key={`${item.doc_id}-${item.section_type}-related-${idx}`}
                        item={item}
                        variant="search"
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
