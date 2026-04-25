import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { fetchEvalMetrics, runEvalMetrics } from "../api/eval";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
import { ChartIcon, SparkleIcon } from "../components/AppIcons";

function formatTimestamp(value) {
  if (!value) {
    return "Not run yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function AdminEvaluation() {
  const token = localStorage.getItem("access_token");
  const payload = getAuthPayload();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function loadEvaluation() {
    try {
      const metrics = await fetchEvalMetrics();
      setData(metrics);
      setError("");
    } catch (err) {
      if ((err.message || "").includes("No evaluation has been run yet")) {
        setData(null);
        setError("");
        return;
      }

      setError(err.message || "Failed to load evaluation metrics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvaluation();
  }, []);

  async function handleRunEvaluation() {
    setRunning(true);
    setError("");

    try {
      const metrics = await runEvalMetrics();
      setData(metrics);
    } catch (err) {
      setError(err.message || "Unable to run evaluation.");
    } finally {
      setRunning(false);
      setLoading(false);
    }
  }

  if (!token || !payload) {
    return <Navigate to="/" replace />;
  }

  if (payload.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container space-y-6 py-6 lg:py-8">
        <section className="rounded-[30px] border border-border bg-card px-7 py-7 shadow-card">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-primary">
                Evaluation
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Run retrieval evaluation for this workspace
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                This runs the current evaluation dataset against the active
                organization index and stores the latest metrics for this admin workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunEvaluation}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ChartIcon className="h-4 w-4" />
              {running ? "Running Evaluation..." : "Run Evaluation"}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-[28px] border border-border bg-card px-5 py-10 text-sm text-primary shadow-card">
            <div className="flex items-center gap-3">
              <SparkleIcon className="h-5 w-5" />
              <span>Loading evaluation metrics...</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[28px] border border-destructive/20 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && !error && !data ? (
          <div className="rounded-[30px] border border-dashed border-border bg-card px-6 py-12 text-center text-sm leading-7 text-muted-foreground shadow-card">
            No evaluation has been run yet for this workspace.
          </div>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              <MetricCard label={`Precision@${data.k}`} value={data.precision_at_k} />
              <MetricCard label={`Recall@${data.k}`} value={data.recall_at_k} />
              <MetricCard label="MRR" value={data.mrr} />
            </section>

            <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailCard label="Organization" value={data.organization || payload.org_name} />
                <DetailCard label="Evaluated Queries" value={data.evaluated_queries} />
                <DetailCard label="Last Run" value={formatTimestamp(data.evaluated_at)} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[28px] border border-border bg-card p-6 shadow-card">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-primary">{Number(value).toFixed(3)}</p>
    </div>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-[24px] border border-border bg-secondary px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-secondary-foreground">{value}</p>
    </div>
  );
}
