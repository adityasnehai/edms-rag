import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import {
  fetchOrganizationDetails,
  rotateOrganizationInviteCode,
} from "../api/admin";
import WorkspaceShell from "../components/WorkspaceShell";
import { getAuthPayload } from "../utils/auth";
import {
  CopyIcon,
  RotateIcon,
  ShieldIcon,
} from "../components/AppIcons";

export default function AdminAccess() {
  const token = localStorage.getItem("access_token");
  const payload = getAuthPayload();

  const [organization, setOrganization] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadOrganization() {
      try {
        const data = await fetchOrganizationDetails();
        setOrganization(data.organization);
        setInviteCode(data.invite_code);
        setError("");
      } catch {
        setError("Unable to load organization invite code.");
      } finally {
        setLoading(false);
      }
    }

    loadOrganization();
  }, []);

  if (!token || !payload) {
    return <Navigate to="/" replace />;
  }

  if (payload.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleRotateCode() {
    setError("");
    setSuccess("");

    try {
      setLoading(true);
      const data = await rotateOrganizationInviteCode();
      setOrganization(data.organization);
      setInviteCode(data.invite_code);
      setSuccess("Invite code rotated successfully.");
    } catch {
      setError("Unable to rotate invite code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!inviteCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteCode);
      setSuccess("Invite code copied.");
      setError("");
    } catch {
      setError("Copy failed. Please copy the invite code manually.");
    }
  }

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-5xl space-y-6 py-6 lg:py-8">
        <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                Organization
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                Manage company access
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Share this employee invite code with teammates so they join this
                company instead of creating a separate workspace.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-secondary px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Active Workspace
              </p>
              <p className="mt-1 text-base font-semibold text-secondary-foreground">
                {organization?.name || payload.org_name}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-border bg-card p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Employee Invite Code
              </p>
              <h2 className="mt-2 text-xl font-semibold text-foreground">
                Invite teammates into this workspace
              </h2>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCopyCode}
                disabled={!inviteCode}
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition hover:bg-secondary disabled:opacity-60"
              >
                <CopyIcon className="h-4 w-4" />
                Copy Code
              </button>
              <button
                type="button"
                onClick={handleRotateCode}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 disabled:opacity-60"
              >
                <RotateIcon className="h-4 w-4" />
                {loading ? "Loading..." : "Rotate Code"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="rounded-[26px] border border-primary/15 bg-accent p-6">
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Current Invite
              </p>
              <p className="mt-4 break-all text-3xl font-semibold tracking-[0.3em] text-primary">
                {inviteCode || "---- ---- ----"}
              </p>
            </div>

            <div className="rounded-[26px] border border-border bg-secondary p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-primary shadow-card">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">
                Workspace isolation stays intact
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Users joining with this code are attached only to this organization.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[26px] border border-border bg-secondary px-5 py-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Share the code with employees who need access. Rotate it anytime if
              you need to invalidate a previously shared invite.
            </p>
          </div>

          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="mt-4 text-sm text-success">{success}</p> : null}
        </section>
      </div>
    </WorkspaceShell>
  );
}
