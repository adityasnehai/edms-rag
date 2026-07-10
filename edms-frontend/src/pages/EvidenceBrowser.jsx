import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchApi } from "../api/config";
import { fetchStats } from "../api/stats";
import EvidenceItem from "../components/EvidenceItem";
import WorkspaceShell from "../components/WorkspaceShell";
import usePageTitle from "../hooks/usePageTitle";
import { FolderIcon, SearchIcon, SparkleIcon } from "../components/AppIcons";

const FILTERS = [
  { value: "all", label: "All Evidence", statKey: null },
  { value: "adrs", label: "ADRs", statKey: "adrs" },
  { value: "rfcs", label: "RFCs", statKey: "rfcs" },
  { value: "meeting_notes", label: "Meeting Notes", statKey: "meeting_notes" },
  { value: "postmortems", label: "Postmortems", statKey: "postmortems" },
  { value: "tickets", label: "Tickets", statKey: "tickets" },
  { value: "images", label: "Images", statKey: "images" },
];

const FILTER_ACTIVE = {
  all: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
  adrs: "bg-[#f48d16]/80 text-[#251f19] border-transparent shadow-sm",
  rfcs: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
  meeting_notes: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
  postmortems: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
  tickets: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
  images: "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm",
};

const SORT_OPTIONS = [
  { value: "latest", label: "Latest updated" },
  { value: "oldest", label: "Oldest updated" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "type_asc", label: "Type" },
];

function itemTimestamp(item) {
  if (!item?.updated_at) return 0;
  return typeof item.updated_at === "number"
    ? item.updated_at
    : new Date(item.updated_at).getTime() / 1000 || 0;
}

export default function EvidenceBrowser() {
  usePageTitle("Evidence");
  const token = localStorage.getItem("access_token");
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [sortBy, setSortBy] = useState("latest");
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const loadEvidence = useCallback(
    async (type = "all", keyword = "") => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (type !== "all") {
          params.set("data_type", type);
        }
        const trimmedKeyword = keyword.trim();
        if (trimmedKeyword) {
          params.set("q", trimmedKeyword);
        }
        const qs = `?${params.toString()}`;
        const res = await fetchApi(`/evidence${qs}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Failed to load evidence");
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        setError("Unable to load evidence.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

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
    function handleWorkspaceUpdate() { loadEvidence(filter, normalizedSearch); loadStats(); }
    loadStats();
    window.addEventListener("edms:data-updated", handleWorkspaceUpdate);
    return () => { cancelled = true; window.removeEventListener("edms:data-updated", handleWorkspaceUpdate); };
  }, [filter, loadEvidence, normalizedSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadEvidence(filter, normalizedSearch);
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [filter, loadEvidence, normalizedSearch]);

  const visibleItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === "oldest") {
        return itemTimestamp(a) - itemTimestamp(b);
      }
      if (sortBy === "name_asc") {
        return String(a.doc_id || "").localeCompare(String(b.doc_id || ""));
      }
      if (sortBy === "name_desc") {
        return String(b.doc_id || "").localeCompare(String(a.doc_id || ""));
      }
      if (sortBy === "type_asc") {
        return String(a.data_type || "").localeCompare(String(b.data_type || ""));
      }
      return itemTimestamp(b) - itemTimestamp(a);
    });
  }, [items, sortBy]);

  const totalVisible = visibleItems.length;
  const sortOptions = useMemo(
    () => (filter === "all" ? SORT_OPTIONS : SORT_OPTIONS.filter((option) => option.value !== "type_asc")),
    [filter],
  );

  useEffect(() => {
    if (filter !== "all" && sortBy === "type_asc") {
      setSortBy("latest");
    }
  }, [filter, sortBy]);

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container space-y-6 py-8 lg:py-10">

        {/* Header */}
        <div className="animate-fade-up">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            Evidence Library
          </p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-[1.75rem]">
                Browse workspace evidence
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Review uploaded records by type and verify what the index can retrieve.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Index status
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground capitalize">
                  {stats?.index_status || "—"}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Showing
                </p>
                <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                  {loading ? "—" : totalVisible}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search + filters */}
        <section
          className="animate-fade-up rounded-[24px] border border-border bg-white/80 p-4 shadow-card backdrop-blur-sm"
          style={{ animationDelay: "60ms" }}
        >
          <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10">
              <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, section, or keyword…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-xs text-muted-foreground transition hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            <label className="block">
              <span className="sr-only">Sort current evidence view</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-full min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => {
              const active = filter === option.value;
              const count = option.statKey ? (stats?.[option.statKey] ?? null) : null;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                    active
                      ? FILTER_ACTIVE[option.value]
                      : "border-border bg-secondary text-muted-foreground hover:border-[#f48d16]/22 hover:bg-[#fff4e1] hover:text-primary"
                  }`}
                >
                  {option.label}
                  {count !== null && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? "bg-white/60 text-[#a76311]" : "bg-background text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </section>

        {/* Loading */}
        {loading && (
          <section className="rounded-[24px] border border-[#f48d16]/18 bg-[#fff4e1]/70 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
                <SparkleIcon className="h-4 w-4 animate-pulse-soft text-[#a76311]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Loading evidence…</p>
                <p className="text-xs text-muted-foreground">Fetching records from the workspace index</p>
              </div>
            </div>
            <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-[#f4eee4]">
              <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,rgba(244,141,22,0),rgba(244,141,22,0.45),rgba(244,141,22,0))] bg-[length:200%_100%] animate-line-flow" />
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-[20px] border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && visibleItems.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-border bg-white/60 px-6 py-14 text-center backdrop-blur-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4e1] text-primary">
              <FolderIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {normalizedSearch ? "No evidence matched that keyword" : "No evidence found"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {normalizedSearch
                ? "Try a different keyword or clear the search."
                : "Upload records for this category or switch to another filter."}
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && visibleItems.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleItems.map((item, index) => (
              <EvidenceItem
                key={`${item.doc_id}-${item.section_type}-${index}`}
                item={item}
                highlightQuery={normalizedSearch}
                showMetaBadges={filter === "all"}
              />
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
