import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { fetchDataTypeSummary, fetchIngestionJob, uploadDocument } from "../api/admin";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
import {
  CheckIcon,
  DocumentIcon,
  FolderIcon,
  UploadIcon,
} from "../components/AppIcons";

const DOC_TYPES = [
  {
    value: "adrs",
    label: "ADR",
    fullLabel: "Architecture Decision Record",
    accept: ".md",
    summary: "Use for durable engineering or product decisions.",
    sections: ["Context", "Decision", "Rationale", "Consequences", "Considered Options"],
    sample: `# ADR-001: Adopt Hybrid Search

## Context
Users need reliable search across company records.

## Decision
Use vector search with BM25 and reranking.

## Rationale
This gives lexical + semantic recall with better precision after reranking.

## Consequences
Search quality improves, but indexing must run after upload.`,
  },
  {
    value: "rfcs",
    label: "RFC",
    fullLabel: "Request for Comments",
    accept: ".md",
    summary: "Use for proposals that need review before implementation.",
    sections: ["Problem Statement", "Proposed Solution", "Alternatives Considered", "Trade Offs"],
    sample: `# RFC-001: Workspace-Level Retrieval

## Problem Statement
Teams need search isolated by organization.

## Proposed Solution
Scope every vector, keyword, and chat request by org.

## Alternatives Considered
Global index with metadata filtering.

## Trade Offs
Isolation is stronger, with more index management work.`,
  },
  {
    value: "meeting_notes",
    label: "Meeting Notes",
    fullLabel: "Decision and discussion notes",
    accept: ".md",
    summary: "Use for team discussions, actions, owners, and outcomes.",
    sections: ["Discussion Summary", "Decisions Made", "Action Items"],
    sample: `# Platform Review - 2026-05-06

## Discussion Summary
Reviewed ingestion status, search quality, and dashboard flow.

## Decisions Made
Show job progress and latest upload time per data type.

## Action Items
- Admin validates sample files.
- Engineering monitors failed jobs.`,
  },
  {
    value: "postmortems",
    label: "Postmortems",
    fullLabel: "Incident reviews",
    accept: ".md",
    summary: "Use for incidents, causes, fixes, and follow-up learning.",
    sections: ["Incident Summary", "Root Cause", "Resolution", "Lessons Learned"],
    sample: `# Postmortem-001: Queued Ingestion Job

## Incident Summary
An upload appeared stuck at queued in the UI.

## Root Cause
Frontend polling stopped before the backend completed indexing.

## Resolution
Fixed polling state and displayed live job status.

## Lessons Learned
Always show backend job state, not only upload state.`,
  },
  {
    value: "tickets",
    label: "Tickets",
    fullLabel: "Support, ops, or implementation notes",
    accept: ".md",
    summary: "Use for operational work, bugs, requests, and resolutions.",
    sections: ["Description", "Discussion", "Resolution"],
    sample: `# TICKET-001: Add Multi-Image Upload

## Description
Admins need to upload multiple architecture diagrams.

## Discussion
Each image should be validated, saved, extracted, and indexed.

## Resolution
Allow multiple PNG/JPEG files in one upload job.`,
  },
  {
    value: "images",
    label: "Images",
    fullLabel: "Diagrams and screenshots",
    accept: ".png,.jpg,.jpeg",
    summary: "Use for architecture diagrams, workflows, screenshots, and visual evidence.",
    sections: ["PNG/JPG/JPEG only", "Readable text in image", "One diagram or screenshot per file"],
    sample: `Recommended image input:

- File type: PNG, JPG, or JPEG
- Content: architecture diagrams, process flows, dashboards, screenshots
- Text labels should be readable
- Avoid blurry or compressed images`,
  },
];

function formatFileSize(size) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function AdminUpload() {
  const token = localStorage.getItem("access_token");
  const payload = getAuthPayload();
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  const [docType, setDocType] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [jobStatus, setJobStatus] = useState(null);
  const [typeSummary, setTypeSummary] = useState({});
  const [activeGuideType, setActiveGuideType] = useState(null);

  const currentType = DOC_TYPES.find((type) => type.value === docType);
  const isImageType = docType === "images";

  useEffect(() => {
    mountedRef.current = true;
    fetchDataTypeSummary()
      .then((data) => {
        if (mountedRef.current) {
          setTypeSummary(data?.items || {});
        }
      })
      .catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!token || !payload) {
    return <Navigate to="/" replace />;
  }

  if (payload.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  async function waitForIngestionJob(jobId, uploadSummary) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const job = await fetchIngestionJob(jobId);
      if (!mountedRef.current) {
        return;
      }

      setJobStatus(job);

      if (job.status === "completed") {
        const result = job.result || {};
        setSuccess(
          `${uploadSummary.uploadedCount} file(s) saved for ${
            uploadSummary.organization
          }. Index status: ${result.status || "ready"}. Changed files: ${
            result.changed_files ?? 0
          }. New embeddings: ${result.new_embeddings ?? 0}. Cached embeddings: ${
            result.cached_embeddings ?? 0
          }. Last rebuild: ${formatTimestamp(result.last_rebuild)}.`
        );
        window.dispatchEvent(
          new CustomEvent("edms:data-updated", {
            detail: {
              dataType: uploadSummary.dataType,
              organization: uploadSummary.organization,
              uploadedCount: uploadSummary.uploadedCount,
            },
          })
        );
        fetchDataTypeSummary()
          .then((data) => {
            if (mountedRef.current) {
              setTypeSummary(data?.items || {});
            }
          })
          .catch(() => {});
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error_text || "Indexing failed after upload.");
      }

      setSuccess(
        `${uploadSummary.uploadedCount} file(s) saved for ${uploadSummary.organization}. Processing is ${job.status}.`
      );
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    if (mountedRef.current) {
      setSuccess(
        `${uploadSummary.uploadedCount} file(s) saved for ${uploadSummary.organization}. Processing is still running in the background.`
      );
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setJobStatus(null);

    if (!docType) {
      setError("Please select a content type first.");
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one file to upload.");
      return;
    }

    if (isImageType) {
      const invalidFile = files.find((file) => {
        const name = file.name.toLowerCase();
        return (
          !file.type.startsWith("image/") &&
          !name.endsWith(".png") &&
          !name.endsWith(".jpg") &&
          !name.endsWith(".jpeg")
        );
      });
      if (invalidFile) {
        setError("Only PNG and JPEG image files are allowed.");
        return;
      }
    } else {
      const invalidFile = files.find(
        (file) => !file.name.toLowerCase().endsWith(".md")
      );
      if (invalidFile) {
        setError("Only markdown (.md) files are allowed for this data type.");
        return;
      }
    }

    try {
      setLoading(true);
      const result = await uploadDocument(files, docType);
      const uploadSummary = {
        dataType: docType,
        organization: result.organization,
        uploadedCount: result.uploaded_count ?? files.length,
      };
      setSuccess(
        `${uploadSummary.uploadedCount} file(s) saved for ${
          uploadSummary.organization
        }. Indexing started. Current status: queued.`
      );
      setJobStatus(result.job || null);
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (result.job?.id) {
        await waitForIngestionJob(result.job.id, uploadSummary);
      }
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }

  function handleSelectDocType(nextType) {
    setDocType(nextType);
    setFiles([]);
    setError("");
    setSuccess("");
    setActiveGuideType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-5xl space-y-6 py-8 lg:py-10">
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-primary" />
          <div className="p-5 lg:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
              Upload Data
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground lg:text-[1.65rem]">
              Add company knowledge to this workspace
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Files are stored and indexed exclusively for this organization — nothing is shared across workspaces.
            </p>
          </div>
        </div>

        <section className="animate-fade-up rounded-2xl border border-border bg-white p-5 shadow-sm lg:p-6" style={{ animationDelay: "60ms" }}>
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Select content type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DOC_TYPES.map((type) => {
                  const lastUpload = typeSummary[type.value]?.uploaded_at;
                  return (
                  <label
                    key={type.value}
                    className={`rounded-xl border p-4 cursor-pointer transition ${
                      docType === type.value
                        ? "border-primary/25 bg-accent ring-1 ring-primary/20 text-accent-foreground"
                        : "border-border bg-secondary/50 text-foreground hover:border-primary/15 hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={docType === type.value}
                      onChange={() => handleSelectDocType(type.value)}
                    />
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-sm font-semibold">
                          {type.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {type.fullLabel}
                        </span>
                      </span>
                      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                        <button
                          type="button"
                          aria-label={`Show ${type.label} input guide`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setActiveGuideType((current) =>
                              current === type.value ? null : type.value
                            );
                          }}
                          className={`h-full w-full rounded-full border text-xs font-bold shadow-sm transition ${
                            activeGuideType === type.value
                              ? "border-primary bg-primary text-white"
                              : "border-primary/15 bg-white text-primary hover:bg-primary hover:text-white"
                          }`}
                        >
                          i
                        </button>
                        {activeGuideType === type.value && (
                          <span
                            className="absolute right-0 top-9 z-30 block w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-primary/15 bg-white p-4 text-left text-slate-700 shadow-xl"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span>
                                <span className="block text-sm font-semibold text-foreground">
                                  {type.label} input structure
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                  Recommended sections for best retrieval and cleaner evidence.
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setActiveGuideType(null);
                                }}
                                className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/20 hover:text-primary"
                              >
                                Close
                              </button>
                            </span>
                            <span className="mt-3 flex flex-wrap gap-2">
                              {type.sections.map((section) => (
                                <span
                                  key={section}
                                  className="rounded-full border border-primary/15 bg-accent px-2.5 py-1 text-[11px] font-medium text-primary"
                                >
                                  {section}
                                </span>
                              ))}
                            </span>
                            <pre className="mt-3 max-h-60 overflow-y-auto overflow-x-hidden whitespace-pre-wrap rounded-xl border border-border bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                              <code>{type.sample}</code>
                            </pre>
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="mt-3 block text-xs leading-5 text-muted-foreground">
                      {type.summary}
                    </span>
                    <span className="mt-3 block rounded-lg border border-border/70 bg-white/70 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                      Last uploaded: {lastUpload ? formatTimestamp(lastUpload) : "Not uploaded yet"}
                    </span>
                  </label>
                );
                })}
              </div>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={currentType?.accept || ""}
                multiple
                className="hidden"
                onChange={(e) => {
                  setFiles(Array.from(e.target.files || []));
                  setError("");
                  setSuccess("");
                }}
              />
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                <UploadIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                <p>
                  Select a content type to open the file picker. Files are stored and indexed only for{" "}
                  <span className="font-medium text-foreground">{payload.org_name}</span>.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-4">
                {files.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {files.length} file(s) selected
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(
                            files.reduce((total, file) => total + file.size, 0)
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setFiles([]);
                          setError("");
                          setSuccess("");
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-background"
                      >
                        Remove All
                      </button>
                    </div>

                    <div className="space-y-2">
                      {files.map((file) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <DocumentIcon className="h-4 w-4 shrink-0 text-primary" />
                            <p className="truncate text-sm font-medium text-foreground">
                              {file.name}
                            </p>
                          </div>
                          <p className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No files selected yet.
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={loading || !docType}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? (
                "Uploading..."
              ) : (
                <>
                  <CheckIcon className="h-4 w-4" />
                  Upload
                </>
              )}
            </button>
          </form>

          {(error || success || jobStatus) && (
            <div className="mt-5 space-y-3">
              {error && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              )}
              {jobStatus && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-accent px-4 py-3">
                  <span className={`h-2 w-2 rounded-full ${jobStatus.status === "completed" ? "bg-emerald-500" : jobStatus.status === "failed" ? "bg-destructive" : "bg-amber-400 animate-pulse"}`} />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Processing:</span> {jobStatus.status}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
