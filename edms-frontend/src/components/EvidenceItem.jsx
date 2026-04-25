import { useEffect, useState } from "react";

import { fetchApi } from "../api/config";
import FormattedContent from "./FormattedContent";

const TYPE_LABELS = {
  adrs: "ADR",
  rfcs: "RFC",
  meeting_notes: "Meeting Note",
  postmortems: "Postmortem",
  tickets: "Ticket",
  images: "Diagram",
};

function prettifyLabel(value) {
  if (!value) {
    return "Content";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function EvidenceItem({ item, variant = "library" }) {
  const isImage = item.is_image === true;
  const [imageSrc, setImageSrc] = useState("");
  const [imageError, setImageError] = useState("");
  const compact = variant === "search";
  const typeLabel = TYPE_LABELS[item.data_type] || prettifyLabel(item.data_type);
  const sectionLabel = prettifyLabel(item.section_type);
  const shellClassName = compact
    ? "rounded-[26px] border border-border bg-card p-5 shadow-card"
    : "rounded-[30px] border border-border bg-card p-6 shadow-card";

  useEffect(() => {
    if (!isImage || !item.image_path) {
      setImageSrc("");
      setImageError("");
      return undefined;
    }

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

        if (!res.ok) {
          throw new Error("Unable to load image");
        }

        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
      } catch (error) {
        if (error.name !== "AbortError") {
          setImageError("Unable to load protected image.");
          setImageSrc("");
        }
      }
    }

    loadImage();

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isImage, item.image_path]);

  return (
    <article className={`${shellClassName} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-primary/20 bg-accent px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-primary">
              {typeLabel}
            </span>
            <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {sectionLabel}
            </span>
          </div>

          <div>
            <h3 className={`${compact ? "text-base" : "text-xl"} font-semibold text-foreground`}>
              {item.doc_id}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isImage ? "Protected visual evidence" : "Workspace evidence excerpt"}
            </p>
          </div>
        </div>

        {!compact && (
          <div className="rounded-[24px] border border-border bg-secondary px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Source Type
            </p>
            <p className="mt-1 text-sm font-medium text-secondary-foreground">{typeLabel}</p>
          </div>
        )}
      </div>

      {isImage && item.image_path && (
        <div className="space-y-3">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={item.doc_id}
              className="
                w-full
                rounded-[24px]
                border border-border
                max-h-80
                object-contain
                bg-secondary
              "
            />
          ) : (
            <div className="rounded-[24px] border border-dashed border-border bg-secondary px-4 py-10 text-sm text-muted-foreground">
              {imageError || "Loading protected image..."}
            </div>
          )}

          <p className="text-xs uppercase tracking-[0.24em] text-primary">
            Diagram analyzed using vision extraction
          </p>
        </div>
      )}

      {item.text && (
        <div className="rounded-[24px] border border-border bg-secondary px-5 py-5">
          <FormattedContent
            text={item.text}
            paragraphClassName={compact ? "text-sm leading-7 text-slate-700" : "text-[15px] leading-8 text-slate-700"}
            listClassName={compact ? "space-y-2 pl-5 text-sm leading-7 text-slate-700" : "space-y-2 pl-5 text-[15px] leading-8 text-slate-700"}
            headingClassName="text-slate-900"
            strongClassName="text-slate-900"
          />
        </div>
      )}
    </article>
  );
}
