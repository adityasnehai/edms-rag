import { useEffect, useState } from "react";
import { fetchApi } from "../api/config";
import FormattedContent from "./FormattedContent";

const TYPE_LABELS = {
  adrs: "ADR",
  rfcs: "RFC",
  meeting_notes: "Meeting Note",
  postmortems: "Postmortem",
  tickets: "Ticket",
  images: "Image",
};

const TYPE_STYLES = {
  adrs: { badge: "bg-[#fff4e1] text-[#a76311] border-[#f48d16]/22", bar: "bg-[#f48d16]/75" },
  rfcs: { badge: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  meeting_notes: { badge: "bg-stone-50 text-stone-700 border-stone-200", bar: "bg-stone-500" },
  postmortems: { badge: "bg-red-50 text-red-700 border-red-200", bar: "bg-red-500" },
  tickets: { badge: "bg-yellow-50 text-yellow-800 border-yellow-200", bar: "bg-yellow-500" },
  images: { badge: "bg-neutral-50 text-neutral-700 border-neutral-200", bar: "bg-neutral-500" },
};

const DEFAULT_STYLE = { badge: "bg-[#fff4e1] text-[#a76311] border-[#f48d16]/22", bar: "bg-[#f48d16]/75" };

function prettifyLabel(value) {
  if (!value) return "Content";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSnippet(text, maxLength = 180) {
  const normalized = (text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s+/, "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatTimestamp(value) {
  if (!value) return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const millis = numeric > 1e12 ? numeric : numeric * 1000;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(millis));
}

function HighlightedSnippet({ text, query }) {
  const snippet = getSnippet(text) || "No extracted text available for this record.";
  const safeQuery = (query || "").trim();
  if (!safeQuery) {
    return <>{snippet}</>;
  }
  const regex = new RegExp(`(${escapeRegExp(safeQuery)})`, "gi");
  return snippet.split(regex).map((part, index) => {
    if (!part) return null;
    if (part.toLowerCase() === safeQuery.toLowerCase()) {
      return (
        <mark
          key={`snippet-hl-${index}`}
          className="rounded bg-[#ffd7a7] px-0.5 text-stone-950"
        >
          {part}
        </mark>
      );
    }
    return <span key={`snippet-tx-${index}`}>{part}</span>;
  });
}

export default function EvidenceItem({
  item,
  variant = "library",
  highlightQuery = "",
  showMetaBadges = true,
}) {
  const isImage = item.is_image === true;
  const [imageSrc, setImageSrc] = useState("");
  const [imageError, setImageError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const compact = variant === "search";
  const typeLabel = TYPE_LABELS[item.data_type] || prettifyLabel(item.data_type);
  const sectionLabel = prettifyLabel(item.section_type);
  const style = TYPE_STYLES[item.data_type] || DEFAULT_STYLE;
  const serviceLabel = item.service || item.metadata?.service || "";
  const updatedLabel = formatTimestamp(item.source_updated_at || item.updated_at);
  const relatedLabel = item.related_reason
    ? `${item.related_reason}${item.related_score ? ` · ${Math.round(Number(item.related_score) * 100) / 100}` : ""}`
    : "";

  useEffect(() => {
    if (!isImage || !item.image_path) { setImageSrc(""); setImageError(""); return undefined; }
    const token = localStorage.getItem("access_token");
    const controller = new AbortController();
    let objectUrl = "";
    async function loadImage() {
      try {
        setImageError("");
        const res = await fetchApi(item.image_path, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Unable to load image");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (error) {
        if (error.name !== "AbortError") { setImageError("Unable to load protected image."); setImageSrc(""); }
      }
    }
    loadImage();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [isImage, item.image_path]);

  if (compact) {
    return (
      <article className="relative flex h-full min-w-[18rem] max-w-[18rem] snap-start flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md sm:min-w-[21rem] sm:max-w-[21rem]">
        <div className={`h-1.5 w-full ${style.bar}`} />

        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {showMetaBadges && (
                <div className="flex flex-wrap gap-1.5">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}>
                    {typeLabel}
                  </span>
                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {sectionLabel}
                  </span>
                  {serviceLabel && (
                    <span className="rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#a76311]">
                      {serviceLabel}
                    </span>
                  )}
                </div>
              )}
              <h3 className="mt-3 line-clamp-1 text-sm font-semibold text-foreground">
                {item.doc_id}
              </h3>
            </div>
          </div>

          {isImage && item.image_path && (
            <div className="mt-3">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={item.doc_id}
                  className="h-32 w-full rounded-xl border border-border bg-secondary object-contain"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-secondary px-4 text-center text-xs text-muted-foreground">
                  {imageError || "Loading image..."}
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex-1 rounded-xl border border-border bg-secondary/55 p-3">
            {expanded ? (
              <div className="max-h-80 overflow-y-auto pr-1">
                <FormattedContent
                  text={item.text || "No extracted text available for this record."}
                  paragraphClassName="text-sm leading-7 text-stone-600"
                  listClassName="space-y-1.5 pl-4 text-sm leading-7 text-stone-600"
                  headingClassName="text-stone-800 font-semibold"
                  strongClassName="text-stone-800"
                />
              </div>
            ) : (
              <p className="line-clamp-5 text-sm leading-6 text-stone-600">
                <HighlightedSnippet text={item.text} query={highlightQuery} />
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-3 inline-flex items-center justify-center rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-2 text-xs font-semibold text-primary transition hover:border-[#f48d16]/35 hover:bg-[#ffeed2]"
          >
            {expanded ? "Collapse" : "View full record"}
          </button>
          {(serviceLabel || updatedLabel) && (
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {serviceLabel && <span>{serviceLabel}</span>}
              {serviceLabel && updatedLabel && <span>•</span>}
              {updatedLabel && <span>Updated {updatedLabel}</span>}
            </div>
          )}
          {relatedLabel && (
            <p className="mt-1 text-[11px] text-primary/80">
              Related by {relatedLabel}
            </p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {/* colored left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} />

      <div className={`${compact ? "p-4 pl-5" : "p-5 pl-6"} space-y-4`}>
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              {showMetaBadges && (
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${style.badge}`}>
                    {typeLabel}
                  </span>
                  <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                    {sectionLabel}
                  </span>
                  {serviceLabel && (
                    <span className="rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-0.5 text-[10px] font-semibold uppercase text-[#a76311]">
                      {serviceLabel}
                    </span>
                  )}
                </div>
              )}
              <div>
                <h3 className={`${compact ? "text-sm" : "text-base"} font-semibold text-foreground`}>
                  {item.doc_id}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {isImage ? "Protected visual evidence" : "Workspace evidence excerpt"}
              </p>
            </div>
          </div>

          {!compact && showMetaBadges && (
            <div className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Source</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{typeLabel}</p>
            </div>
          )}
        </div>

        {/* Image */}
        {isImage && item.image_path && (
          <div>
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={item.doc_id}
                className="w-full rounded-xl border border-border max-h-72 object-contain bg-secondary"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-secondary px-4 py-8 text-sm text-muted-foreground text-center">
                {imageError || "Loading protected image…"}
              </div>
            )}
            <p className="mt-2 text-[10px] font-semibold uppercase text-primary">
              Image analyzed via vision extraction
            </p>
          </div>
        )}

        {/* Text content */}
        {item.text && (
          <div className="rounded-xl border border-border bg-secondary/55 px-4 py-4">
            {expanded ? (
              <div className="max-h-[22rem] overflow-y-auto pr-1">
                <FormattedContent
                  text={item.text}
                  highlightQuery={highlightQuery}
                  paragraphClassName={compact ? "text-sm leading-7 text-stone-600" : "text-[15px] leading-8 text-stone-600"}
                  listClassName={compact ? "space-y-1.5 pl-4 text-sm leading-7 text-stone-600" : "space-y-2 pl-5 text-[15px] leading-8 text-stone-600"}
                  headingClassName="text-stone-800 font-semibold"
                  strongClassName="text-stone-800"
                />
              </div>
            ) : (
              <p className="line-clamp-4 text-sm leading-6 text-stone-600">
                <HighlightedSnippet text={item.text} query={highlightQuery} />
              </p>
            )}
          </div>
        )}

        {(serviceLabel || updatedLabel) && (
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {serviceLabel && <span>{serviceLabel}</span>}
            {serviceLabel && updatedLabel && <span>•</span>}
            {updatedLabel && <span>Updated {updatedLabel}</span>}
          </div>
        )}
        {relatedLabel && (
          <p className="text-[11px] text-primary/80">
            Related by {relatedLabel}
          </p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center justify-center rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-2 text-xs font-semibold text-primary transition hover:border-[#f48d16]/35 hover:bg-[#ffeed2]"
        >
          {expanded ? "Collapse" : "Expand record"}
        </button>
      </div>
    </article>
  );
}
