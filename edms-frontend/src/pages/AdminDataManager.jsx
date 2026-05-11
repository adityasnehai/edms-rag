import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import {
  deleteDataFile,
  fetchIngestionJob,
  listDataFiles,
  previewDataFile,
  replaceDataFile,
} from "../api/admin";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
import {
  CheckIcon,
  DocumentIcon,
  FolderIcon,
  ImageIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "../components/AppIcons";

const DATA_TYPES = [
  { value: "", label: "All data", accept: ".md,.png,.jpg,.jpeg" },
  { value: "adrs", label: "ADR", accept: ".md" },
  { value: "rfcs", label: "RFC", accept: ".md" },
  { value: "meeting_notes", label: "Meeting Notes", accept: ".md" },
  { value: "postmortems", label: "Postmortems", accept: ".md" },
  { value: "tickets", label: "Tickets", accept: ".md" },
  { value: "images", label: "Images", accept: ".png,.jpg,.jpeg" },
];

const TYPE_LABELS = DATA_TYPES.reduce((labels, type) => {
  if (type.value) {
    labels[type.value] = type.label;
  }
  return labels;
}, {});

const SORT_OPTIONS = [
  { value: "latest", label: "Latest updated" },
  { value: "oldest", label: "Oldest updated" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
  { value: "size_desc", label: "Largest file" },
  { value: "size_asc", label: "Smallest file" },
  { value: "type_asc", label: "Type" },
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

  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function expectedExtension(dataType) {
  return dataType === "images" ? "PNG/JPG/JPEG" : "MD";
}

function itemTimestamp(item) {
  if (!item?.updated_at) return 0;
  return typeof item.updated_at === "number"
    ? item.updated_at
    : new Date(item.updated_at).getTime() / 1000 || 0;
}

export default function AdminDataManager() {
  const token = localStorage.getItem("access_token");
  const payload = getAuthPayload();
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  const [items, setItems] = useState([]);
  const [dataType, setDataType] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [jobStatus, setJobStatus] = useState(null);
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const totals = useMemo(() => {
    const totalBytes = items.reduce((total, item) => total + (item.size_bytes || 0), 0);
    return {
      files: items.length,
      bytes: totalBytes,
      types: new Set(items.map((item) => item.data_type)).size,
    };
  }, [items]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === "oldest") {
        return itemTimestamp(a) - itemTimestamp(b);
      }
      if (sortBy === "name_asc") {
        return String(a.filename || "").localeCompare(String(b.filename || ""));
      }
      if (sortBy === "name_desc") {
        return String(b.filename || "").localeCompare(String(a.filename || ""));
      }
      if (sortBy === "size_desc") {
        return (b.size_bytes || 0) - (a.size_bytes || 0);
      }
      if (sortBy === "size_asc") {
        return (a.size_bytes || 0) - (b.size_bytes || 0);
      }
      if (sortBy === "type_asc") {
        return String(a.data_type || "").localeCompare(String(b.data_type || ""));
      }
      return itemTimestamp(b) - itemTimestamp(a);
    });
  }, [items, sortBy]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const timeoutId = window.setTimeout(() => {
      listDataFiles({ dataType, query })
        .then((data) => {
          if (!cancelled && mountedRef.current) {
            setItems(data?.items || []);
          }
        })
        .catch((err) => {
          if (!cancelled && mountedRef.current) {
            setError(err.message || "Could not load workspace files.");
          }
        })
        .finally(() => {
          if (!cancelled && mountedRef.current) {
            setLoading(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [dataType, query]);

  if (!token || !payload) {
    return <Navigate to="/" replace />;
  }

  if (payload.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  async function refreshFiles() {
    const data = await listDataFiles({ dataType, query });
    if (mountedRef.current) {
      setItems(data?.items || []);
    }
  }

  async function waitForIngestionJob(jobId, messagePrefix) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const job = await fetchIngestionJob(jobId);
      if (!mountedRef.current) {
        return;
      }

      setJobStatus(job);

      if (job.status === "completed") {
        const result = job.result || {};
        const isDeleteMessage = messagePrefix.toLowerCase().includes("deleted");
        const isReplaceMessage = messagePrefix.toLowerCase().includes("replaced");
        const fileDeltaLabel = isDeleteMessage ? "Removed files" : "Changed files";
        const fileDeltaValue = isDeleteMessage
          ? result.removed_files ?? 0
          : result.changed_files ?? 0;
        const noContentChangeNote =
          isReplaceMessage &&
          (result.changed_files ?? 0) === 0 &&
          (result.new_embeddings ?? 0) === 0
            ? " No content change was detected in the replacement file."
            : "";
        setSuccess(
          `${messagePrefix}. Index status: ${result.status || "ready"}. ${fileDeltaLabel}: ${fileDeltaValue}. New embeddings: ${result.new_embeddings ?? 0}.${noContentChangeNote}`
        );
        window.dispatchEvent(new CustomEvent("edms:data-updated"));
        await refreshFiles();
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error_text || "Indexing failed.");
      }

      setSuccess(`${messagePrefix}. Processing is ${job.status}.`);
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    if (mountedRef.current) {
      setSuccess(`${messagePrefix}. Processing is still running in the background.`);
    }
  }

  function openReplacePicker(item) {
    setReplaceTarget(item);
    setError("");
    setSuccess("");
    setJobStatus(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function openPreview(item) {
    try {
      setPreviewLoading(true);
      setPreviewError("");
      setPreview({
        file: item,
        preview_type: item.data_type === "images" ? "image" : "text",
        content: "",
      });
      const data = await previewDataFile({
        dataType: item.data_type,
        filename: item.filename,
      });
      if (mountedRef.current) {
        setPreview(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setPreviewError(err.message || "Could not open file preview.");
      }
    } finally {
      if (mountedRef.current) {
        setPreviewLoading(false);
      }
    }
  }

  async function handleReplacement(file) {
    if (!replaceTarget || !file) {
      return;
    }

    if (file.name.toLowerCase() !== replaceTarget.filename.toLowerCase()) {
      setError("Replacement file must use the same filename.");
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setJobStatus(null);
      const result = await replaceDataFile({
        dataType: replaceTarget.data_type,
        filename: replaceTarget.filename,
        file,
      });
      const message = `${replaceTarget.filename} replaced and queued for re-indexing`;
      setSuccess(message);
      setJobStatus(result.job || null);
      if (result.job?.id) {
        await waitForIngestionJob(result.job.id, message);
      } else {
        await refreshFiles();
      }
    } catch (err) {
      setError(err.message || "File replacement failed.");
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
        setReplaceTarget(null);
      }
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete ${item.filename}? This removes it from this workspace and refreshes the index.`
    );
    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");
      setJobStatus(null);
      const result = await deleteDataFile({
        dataType: item.data_type,
        filename: item.filename,
      });
      const message = `${item.filename} deleted and queued for index refresh`;
      setSuccess(message);
      setJobStatus(result.job || null);
      if (result.job?.id) {
        await waitForIngestionJob(result.job.id, message);
      } else {
        await refreshFiles();
      }
    } catch (err) {
      setError(err.message || "File deletion failed.");
    } finally {
      if (mountedRef.current) {
        setActionLoading(false);
      }
    }
  }

  const selectedType = DATA_TYPES.find((type) => type.value === dataType) || DATA_TYPES[0];

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-6xl space-y-6 py-8 lg:py-10">
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-primary" />
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Data Manager
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground lg:text-[1.65rem]">
                Manage indexed workspace files
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                Replace outdated files or delete stale records. Every change queues a workspace-safe index refresh.
              </p>
            </div>

            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-secondary/50 text-center">
              <div className="px-4 py-3">
                <p className="text-lg font-bold text-foreground">{totals.files}</p>
                <p className="text-[11px] text-muted-foreground">Files</p>
              </div>
              <div className="border-x border-border px-4 py-3">
                <p className="text-lg font-bold text-foreground">{totals.types}</p>
                <p className="text-[11px] text-muted-foreground">Types</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-lg font-bold text-foreground">{formatFileSize(totals.bytes)}</p>
                <p className="text-[11px] text-muted-foreground">Stored</p>
              </div>
            </div>
          </div>
        </div>

        <section className="animate-fade-up rounded-2xl border border-border bg-white p-4 shadow-sm lg:p-5" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {DATA_TYPES.map((type) => (
                <button
                  key={type.value || "all"}
                  type="button"
                  onClick={() => setDataType(type.value)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    dataType === type.value
                      ? "border-primary bg-primary text-white shadow-sm shadow-primary/20"
                      : "border-border bg-white text-muted-foreground hover:border-primary/20 hover:text-primary"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_190px] lg:w-[31rem]">
              <label className="relative block">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search files"
                  className="h-11 w-full rounded-2xl border border-border bg-secondary/50 pl-9 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
                />
              </label>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-secondary/50 px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <input
          ref={fileInputRef}
          type="file"
          accept={selectedType.accept}
          className="hidden"
          onChange={(event) => handleReplacement(event.target.files?.[0])}
        />

        {(error || success || jobStatus) && (
          <section className="animate-fade-up space-y-3" style={{ animationDelay: "90ms" }}>
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
                <span className={`h-2 w-2 rounded-full ${jobStatus.status === "completed" ? "bg-emerald-500" : jobStatus.status === "failed" ? "bg-destructive" : "animate-pulse bg-amber-400"}`} />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Index refresh:</span> {jobStatus.status}
                </p>
              </div>
            )}
          </section>
        )}

        <section className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm" style={{ animationDelay: "120ms" }}>
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                <FolderIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Workspace files</h2>
                <p className="text-xs text-muted-foreground">
                  Replace keeps the same file identity. Delete removes the source and refreshes retrieval.
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading files...</div>
          ) : sortedItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <DocumentIcon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">No files found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload data first, or clear the current filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sortedItems.map((item) => {
                const isImage = item.data_type === "images";
                const Icon = isImage ? ImageIcon : DocumentIcon;
                return (
                  <div
                    key={item.id}
                    className="grid gap-4 px-5 py-4 transition hover:bg-secondary/40 lg:grid-cols-[minmax(0,1fr)_160px_170px_190px] lg:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => openPreview(item)}
                      className="flex min-w-0 items-start gap-3 rounded-xl text-left outline-none transition focus:ring-4 focus:ring-primary/10"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground transition hover:text-primary">
                          {item.filename}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Click to preview · {expectedExtension(item.data_type)} source file
                        </p>
                      </div>
                    </button>

                    <div>
                      <span className="inline-flex rounded-full border border-primary/15 bg-accent px-2.5 py-1 text-xs font-semibold text-primary">
                        {TYPE_LABELS[item.data_type] || item.data_type}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{formatFileSize(item.size_bytes)}</p>
                      <p>{formatTimestamp(item.updated_at)}</p>
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => openReplacePicker(item)}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/20 hover:bg-accent hover:text-primary disabled:opacity-60"
                      >
                        <UploadIcon className="h-3.5 w-3.5" />
                        Replace
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive hover:text-white disabled:opacity-60"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreview(null);
              setPreviewError("");
            }
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                  File Preview
                </p>
                <h3 className="mt-1 truncate text-lg font-bold text-foreground">
                  {preview.file?.filename}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {TYPE_LABELS[preview.file?.data_type] || preview.file?.data_type} · {formatFileSize(preview.file?.size_bytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPreviewError("");
                }}
                className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/20 hover:bg-accent hover:text-primary"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5">
              {previewLoading ? (
                <div className="rounded-2xl border border-border bg-white p-5 text-sm text-muted-foreground">
                  Loading preview...
                </div>
              ) : previewError ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
                  {previewError}
                </div>
              ) : preview.preview_type === "image" ? (
                <div className="flex justify-center rounded-2xl border border-border bg-white p-4">
                  <img
                    src={`data:${preview.mime_type};base64,${preview.content}`}
                    alt={preview.file?.filename || "Preview"}
                    className="max-h-[64vh] max-w-full rounded-xl object-contain"
                  />
                </div>
              ) : (
                <pre className="max-h-[64vh] overflow-auto whitespace-pre-wrap rounded-2xl border border-border bg-white p-5 text-sm leading-6 text-slate-800 shadow-sm">
                  <code>{preview.content}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
