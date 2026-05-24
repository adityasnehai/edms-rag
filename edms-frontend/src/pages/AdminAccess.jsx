import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import {
  fetchOrganizationDetails,
  rotateOrganizationInviteCode,
} from "../api/admin";
import WorkspaceShell from "../components/WorkspaceShell";
import usePageTitle from "../hooks/usePageTitle";
import { getAuthPayload } from "../utils/auth";
import { CopyIcon, RotateIcon, ShieldIcon, CheckIcon } from "../components/AppIcons";

export default function AdminAccess() {
  usePageTitle("Company Access");
  const token = localStorage.getItem("access_token");
  const payload = getAuthPayload();

  const [organization, setOrganization] = useState(null);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

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

  if (!token || !payload) return <Navigate to="/" replace />;
  if (payload.role !== "admin") return <Navigate to="/dashboard" replace />;

  async function handleRotateCode() {
    setError("");
    setSuccess("");
    try {
      setLoading(true);
      const data = await rotateOrganizationInviteCode();
      setOrganization(data.organization);
      setInviteCode(data.invite_code);
      setSuccess("Invite code rotated. Share the new code with teammates.");
    } catch {
      setError("Unable to rotate invite code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setSuccess("Invite code copied to clipboard.");
      setError("");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — please copy the code manually.");
    }
  }

  return (
    <WorkspaceShell mainClassName="overflow-x-hidden">
      <div className="container max-w-5xl space-y-6 py-8 lg:py-10">

        {/* Header */}
        <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-primary" />
          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
                Organization
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground lg:text-[1.65rem]">
                Manage company access
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Share the invite code with teammates so they join this workspace instead of creating a separate one.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-border bg-secondary px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Active Workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {organization?.name || payload.org_name}
              </p>
            </div>
          </div>
        </div>

        {/* Invite code card */}
        <section className="animate-fade-up rounded-2xl border border-border bg-white shadow-sm" style={{ animationDelay: "60ms" }}>
          <div className="border-b border-border p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-accent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Employee Invite Code
                </span>
                <h2 className="mt-2.5 text-lg font-semibold tracking-tight text-foreground">
                  Invite teammates into this workspace
                </h2>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!inviteCode}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/20 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                >
                  {copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <CopyIcon className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy Code"}
                </button>
                <button
                  type="button"
                  onClick={handleRotateCode}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:opacity-95 disabled:opacity-60"
                >
                  <RotateIcon className="h-4 w-4" />
                  {loading ? "Loading…" : "Rotate Code"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_220px] lg:p-6">
            {/* Invite code display */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-accent p-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Current Invite
              </p>
              {loading ? (
                <div className="mt-4 h-10 w-48 animate-pulse rounded-xl bg-primary/10" />
              ) : (
                <p className="mt-4 break-all font-mono text-3xl font-bold tracking-[0.35em] text-primary">
                  {inviteCode || "— — —"}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Case-sensitive. Share exactly as shown.
              </p>
            </div>

            {/* Info card */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-secondary/60 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-glow">
                <ShieldIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Workspace isolation</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Users joining with this code are scoped exclusively to this organization. No data is shared across workspaces.
                </p>
              </div>
              <div className="mt-auto rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
                Rotate the code anytime to invalidate previously shared invites.
              </div>
            </div>
          </div>

          {/* Alerts */}
          {(error || success) && (
            <div className="px-5 pb-5 lg:px-6 lg:pb-6">
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
            </div>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}
