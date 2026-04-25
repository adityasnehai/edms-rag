import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { fetchIngestionJob, uploadDocument } from "../api/admin";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
import {
  CheckIcon,
  DocumentIcon,
  FolderIcon,
  UploadIcon,
} from "../components/AppIcons";

const DOC_TYPES = [
  { value: "adrs", label: "ADR (Architecture Decision Record)", accept: ".md" },
  { value: "rfcs", label: "RFC (Request for Comments)", accept: ".md" },
  { value: "meeting_notes", label: "Meeting Notes", accept: ".md" },
  { value: "postmortems", label: "Postmortem", accept: ".md" },
  { value: "tickets", label: "Ticket / Ops Note", accept: ".md" },
  {
    value: "images",
    label: "Images / Diagrams (Multimodal)",
    accept: ".png,.jpg,.jpeg",
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

  const [docType, setDocType] = useState("adrs");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [jobStatus, setJobStatus] = useState(null);

  const currentType = DOC_TYPES.find((type) => type.value === docType);
  const isImageType = docType === "images";

  useEffect(() => {
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
        return;
      }

      if (job.status === "failed") {
        throw new Error(job.error_text || "Indexing failed after upload.");
      }

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

    if (files.length === 0) {
      setError("Please select at least one file to upload.");
      return;
    }

    if (isImageType) {
      if (files.length !== 1) {
        setError("Upload one image at a time.");
        return;
      }

      if (!files[0].type.startsWith("image/")) {
        setError("Please upload a valid image file.");
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
        }. Processing is queued now.`
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

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-5xl space-y-6 py-6 lg:py-8">
        <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
              Upload Data
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Add company knowledge to this workspace
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Files are stored only inside this organization and indexed only
              for this company.
            </p>
          </div>
        </section>

        <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Select content type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DOC_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`rounded-[24px] border p-4 cursor-pointer transition ${
                      docType === type.value
                        ? "border-primary/20 bg-accent text-accent-foreground"
                        : "border-border bg-background text-foreground hover:bg-secondary"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      checked={docType === type.value}
                      onChange={() => {
                        setDocType(type.value);
                        setFiles([]);
                        setError("");
                        setSuccess("");
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    />
                    <span className="block text-sm font-semibold">
                      {type.label}
                    </span>
                    <span className="block text-xs text-muted-foreground mt-2">
                      {type.accept === ".md"
                        ? "Markdown document"
                        : "PNG or JPEG image"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                {isImageType ? "Choose file" : "Choose files"}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={currentType.accept}
                  multiple={!isImageType}
                  className="hidden"
                  onChange={(e) => {
                    setFiles(Array.from(e.target.files || []));
                    setError("");
                    setSuccess("");
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-[28px] border-2 border-dashed border-primary/20 bg-gradient-soft px-6 py-10 text-left transition hover:border-primary/35 hover:bg-accent"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
                      <UploadIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-base font-semibold text-foreground">
                        {files.length > 0
                          ? `Replace selected ${isImageType ? "file" : "files"}`
                          : `Select ${isImageType ? "a file" : "files"} to upload`}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                        {isImageType
                          ? "Accepted formats: PNG, JPG, JPEG"
                          : "Accepted format: Markdown (.md), multi-select enabled"}
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="rounded-[28px] border border-border bg-secondary px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
                    <FolderIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Upload scope
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Files are stored and indexed only for {payload.org_name}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border bg-secondary px-4 py-4">
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
              disabled={loading}
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

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-success">{success}</p> : null}
          {jobStatus ? (
            <div className="mt-4 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm text-foreground">
              <span className="font-semibold">Processing status:</span>{" "}
              {jobStatus.status}
            </div>
          ) : null}
        </section>
      </div>
    </WorkspaceShell>
  );
}
