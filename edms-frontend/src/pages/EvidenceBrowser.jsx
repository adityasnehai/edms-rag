import { useCallback, useEffect, useState } from "react";

import { fetchApi } from "../api/config";
import { fetchStats } from "../api/stats";
import EvidenceItem from "../components/EvidenceItem";
import WorkspaceShell from "../components/WorkspaceShell";
import { FolderIcon, SearchIcon, SparkleIcon } from "../components/AppIcons";

const FILTERS = [
  { value: "all", label: "All Evidence", statKey: null },
  { value: "adrs", label: "ADRs", statKey: "adrs" },
  { value: "rfcs", label: "RFCs", statKey: "rfcs" },
  { value: "meeting_notes", label: "Meeting Notes", statKey: "meeting_notes" },
  { value: "postmortems", label: "Postmortems", statKey: "postmortems" },
  { value: "tickets", label: "Tickets", statKey: "tickets" },
  { value: "images", label: "Diagrams", statKey: "images" },
];

export default function EvidenceBrowser() {
  const token = localStorage.getItem("access_token");
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  const loadEvidence = useCallback(async (type = "all") => {
    setLoading(true);
    setError("");

    try {
      const qs = type === "all" ? "" : `?data_type=${encodeURIComponent(type)}`;
      const res = await fetchApi(`/evidence${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load evidence");
      }

      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setError("Unable to load evidence.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

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
      loadEvidence(filter);
      loadStats();
    }

    loadStats();
    window.addEventListener("edms:data-updated", handleWorkspaceUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener("edms:data-updated", handleWorkspaceUpdate);
    };
  }, [filter, loadEvidence]);

  useEffect(() => {
    loadEvidence(filter);
  }, [filter, loadEvidence]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleItems = !normalizedSearch
    ? items
    : items.filter((item) => {
        const haystack = [
          item.doc_id,
          item.data_type,
          item.section_type,
          item.text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      });

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container space-y-6 py-6 lg:py-8">
        <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.28em] text-primary">
                Evidence Library
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Browse the workspace evidence base
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                Review uploaded records by type, inspect original content, and
                verify exactly what the workspace index can retrieve.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary px-4 py-3 lg:min-w-[180px]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Index Status
              </p>
              <p className="mt-1 text-base font-semibold text-secondary-foreground">
                {stats?.index_status || "unknown"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-border bg-card p-4 shadow-card">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search evidence by title, section, or keyword..."
                className="w-full border-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-2xl border px-4 py-2.5 text-left text-sm font-medium transition ${
                    filter === option.value
                      ? "border-primary/20 bg-accent text-accent-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[28px] border border-border bg-card px-5 py-10 text-sm text-primary shadow-card">
            <div className="flex items-center gap-3">
              <SparkleIcon className="h-5 w-5" />
              <span>Loading evidence...</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[28px] border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && visibleItems.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-border bg-card px-6 py-14 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-accent text-primary">
              <FolderIcon className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold text-foreground">
              {normalizedSearch
                ? "No evidence matched that keyword"
                : "No evidence found for this filter"}
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {normalizedSearch
                ? "Try another keyword or switch filters to search a different set of workspace material."
                : "Upload records for this category or switch filters to inspect other workspace material."}
            </p>
          </div>
        ) : null}

        <div className="space-y-5">
          {visibleItems.map((item, index) => (
            <EvidenceItem
              key={`${item.doc_id}-${item.section_type}-${index}`}
              item={item}
            />
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
