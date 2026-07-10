import { useMemo, useState } from "react";
import { X } from "lucide-react";

import { loginUser, registerUser } from "@/api/auth";
import { clearSession, getAuthPayload, setSession } from "@/utils/auth";
import { DarkCtaButton } from "@/memostack/components/dark-cta-button";

export function MemoStackAuthModal({ mode, onClose }) {
  const [authMode, setAuthMode] = useState(mode || "login");
  const [accountType, setAccountType] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupResult, setSignupResult] = useState(null);

  const isRegister = authMode === "register";
  const isAdminSignup = isRegister && accountType === "admin";
  const isUserSignup = isRegister && accountType === "user";

  const copy = useMemo(() => {
    if (isRegister && accountType === "admin") {
      return {
        eyebrow: "Create workspace",
        title: "Create your MemoStack workspace",
        body: "Start a company workspace, upload team records, and invite your team with a workspace code.",
      };
    }

    if (isRegister) {
      return {
        eyebrow: "Join workspace",
        title: "Join your team workspace",
        body: "Use the invite code from your admin to join the right MemoStack workspace.",
      };
    }

    return {
      eyebrow: "Sign in",
      title: "Open your MemoStack workspace",
      body: "Continue to your cited team knowledge search, uploads, and workspace history.",
    };
  }, [accountType, isRegister]);

  function switchMode(nextMode) {
    setAuthMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  function destinationAfterAuth() {
    const payload = getAuthPayload();
    return payload?.role === "admin" ? "/admin" : "/dashboard";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedOrganizationName = organizationName.trim();
    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedEmail) return setError("Email is required.");
    if (!trimmedPassword) return setError("Password is required.");
    if (isAdminSignup && !trimmedOrganizationName) return setError("Company name is required.");
    if (isUserSignup && !trimmedInviteCode) return setError("Invite code is required.");
    if (isRegister && trimmedPassword.length < 10) return setError("Password must be at least 10 characters.");
    if (isRegister && !/[A-Za-z]/.test(trimmedPassword)) return setError("Password must include at least one letter.");
    if (isRegister && !/\d/.test(trimmedPassword)) return setError("Password must include at least one number.");
    if (isRegister && password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    setError("");

    try {
      const data = isRegister
        ? await registerUser({
            email: trimmedEmail,
            password: trimmedPassword,
            role: accountType,
            organization_name: isAdminSignup ? trimmedOrganizationName : undefined,
            invite_code: isUserSignup ? trimmedInviteCode : undefined,
          })
        : await loginUser(trimmedEmail, trimmedPassword);

      setSession(data.access_token, data.refresh_token);

      if (isAdminSignup && data.invite_code) {
        setSignupResult({
          inviteCode: data.invite_code,
          organizationName: data.organization_name || trimmedOrganizationName,
        });
        return;
      }

      window.location.href = destinationAfterAuth();
    } catch (err) {
      clearSession();
      setError(err.message || "Unable to complete authentication.");
    } finally {
      setLoading(false);
    }
  }

  if (signupResult) {
    return (
      <AuthShell onClose={onClose}>
        <p className="text-sm font-semibold text-[#f48d16]">Workspace created</p>
        <h2 className="mt-3 font-heading text-3xl font-medium tracking-normal text-[#251f19]">
          Share this invite code.
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#68615a]">
          Send this code to teammates so they can join {signupResult.organizationName}.
        </p>
        <div className="mt-6 rounded-2xl border border-[#f48d16]/30 bg-[#fff3e1] px-5 py-6 text-center">
          <p className="font-mono text-3xl font-semibold tracking-[0.28em] text-[#251f19]">
            {signupResult.inviteCode}
          </p>
        </div>
        <div className="mt-6 flex justify-center">
          <DarkCtaButton href="/admin">Open Workspace</DarkCtaButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell onClose={onClose}>
      <p className="text-sm font-semibold text-[#f48d16]">{copy.eyebrow}</p>
      <h2 className="mt-3 font-heading text-3xl font-medium tracking-normal text-[#251f19]">
        {copy.title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#68615a]">{copy.body}</p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-[#eeede6] p-1">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            !isRegister ? "bg-white text-[#251f19] shadow-sm" : "text-[#68615a] hover:text-[#251f19]"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            isRegister ? "bg-white text-[#251f19] shadow-sm" : "text-[#68615a] hover:text-[#251f19]"
          }`}
        >
          Create Workspace
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {isRegister && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAccountType("admin")}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                accountType === "admin"
                  ? "border-[#f48d16] bg-[#fff3e1] text-[#251f19]"
                  : "border-[#e4e0dd] text-[#68615a]"
              }`}
            >
              New company
            </button>
            <button
              type="button"
              onClick={() => setAccountType("user")}
              className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                accountType === "user"
                  ? "border-[#f48d16] bg-[#fff3e1] text-[#251f19]"
                  : "border-[#e4e0dd] text-[#68615a]"
              }`}
            >
              Join team
            </button>
          </div>
        )}

        {isAdminSignup && (
          <Field label="Company name">
            <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
          </Field>
        )}

        {isUserSignup && (
          <Field label="Invite code">
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          </Field>
        )}

        <Field label="Email">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>

        <Field label="Password">
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>

        {isRegister && (
          <Field label="Confirm password">
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </Field>
        )}

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-[#251f19] px-5 text-sm font-semibold text-[#f7f7f4] transition hover:bg-[#251f19]/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Please wait..." : isRegister ? "Create Workspace" : "Sign In"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#251f19]/55 px-4 py-6 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full max-w-[520px] items-center">
        <div className="relative w-full rounded-[1.75rem] border border-[#e4e0dd] bg-[#f7f7f4] p-6 shadow-[0_28px_90px_-36px_rgba(37,31,25,0.55)] sm:p-7">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-xl bg-white text-[#68615a] transition hover:text-[#251f19]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#68615a]">{label}</span>
      <div className="mt-2 [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#e4e0dd] [&_input]:bg-white [&_input]:px-3 [&_input]:text-sm [&_input]:outline-none [&_input]:transition [&_input]:focus:border-[#f48d16]">
        {children}
      </div>
    </label>
  );
}
