import { useEffect, useRef, useState } from "react";

import { loginUser, registerUser } from "../api/auth";
import { clearSession, setSession } from "../utils/auth";
import {
  ArrowRightIcon,
  ChatIcon,
  CopyIcon,
  DocumentIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  ImageIcon,
  LibraryIcon,
  RotateIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  UploadIcon,
} from "../components/AppIcons";

/* ─── constants ──────────────────────────────────────────────── */

const AUTH_INPUT_CLASS = `
  mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground
  outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10
`;

const FEATURES = [
  {
    title: "Evidence-backed search",
    body: "Every answer ships with linked source records. No guessing, no hallucinations — just grounded truth.",
    Icon: SearchIcon,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    hoverBorder: "hover:border-violet-200/80",
    hoverShadow: "hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.2)]",
  },
  {
    title: "Persistent team chat",
    body: "Follow-up questions inherit full context. Stop re-explaining the same background each time.",
    Icon: ChatIcon,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    hoverBorder: "hover:border-sky-200/80",
    hoverShadow: "hover:shadow-[0_8px_32px_-8px_rgba(14,165,233,0.2)]",
  },
  {
    title: "Invite-based access",
    body: "Admins own the workspace. Users join with a code. Search always stays inside the right boundary.",
    Icon: ShieldIcon,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    hoverBorder: "hover:border-emerald-200/80",
    hoverShadow: "hover:shadow-[0_8px_32px_-8px_rgba(16,185,129,0.2)]",
  },
  {
    title: "Automatic indexing",
    body: "Upload once. EDMS extracts, chunks, and refreshes the index automatically on each new file.",
    Icon: UploadIcon,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    hoverBorder: "hover:border-amber-200/80",
    hoverShadow: "hover:shadow-[0_8px_32px_-8px_rgba(245,158,11,0.2)]",
  },
];

const TRUST_ITEMS = [
  "Engineering", "Platform", "Operations", "Security", "Product",
  "Support", "DevOps", "Architecture", "Compliance", "Infrastructure",
];

const TEAM_SCENARIOS = [
  {
    team: "Engineering",
    color: "violet",
    headline: "Find the decision that caused the outage",
    items: [
      "Search ADRs that touched a specific service",
      "Surface the RFC that changed deployment flow",
      "Link postmortems to the responsible ADR",
    ],
  },
  {
    team: "Product",
    color: "sky",
    headline: "Trace every decision back to its source",
    items: [
      "Find all decisions made in Q3 planning",
      "Surface meeting notes from stakeholder reviews",
      "See what changed and why in one search",
    ],
  },
  {
    team: "Operations",
    color: "emerald",
    headline: "Compliance answers in seconds, not weeks",
    items: [
      "Pull policy documents with linked evidence",
      "Find postmortems by date or service",
      "Answer auditor questions with source-linked responses",
    ],
  },
];

const TESTIMONIALS = [
  {
    quote: "We cut incident resolution time in half. Engineers instantly find the relevant ADR and postmortem without digging through Notion for hours.",
    name: "Sarah Chen",
    role: "VP Engineering",
    company: "Dataflow Systems",
    initials: "SC",
    color: "bg-violet-100 text-violet-700",
  },
  {
    quote: "EDMS is the first tool that keeps our architecture decisions connected to our incident history. The evidence linking is a genuine game changer for our team.",
    name: "Marcus Webb",
    role: "Platform Lead",
    company: "Orbix Cloud",
    initials: "MW",
    color: "bg-sky-100 text-sky-700",
  },
  {
    quote: "Compliance reviews used to take weeks of document hunting. Now we get grounded answers with source links in seconds. Our auditors love it.",
    name: "Priya Nair",
    role: "Head of Operations",
    company: "Meridian Finance",
    initials: "PN",
    color: "bg-emerald-100 text-emerald-700",
  },
];

const WORKFLOW_INPUTS = [
  { title: "ADRs", caption: "Architecture decisions", Icon: LibraryIcon, cardClass: "border-violet-200/75 bg-[rgba(246,241,255,0.96)] text-violet-950", iconClass: "bg-violet-700 text-white" },
  { title: "RFCs", caption: "Change proposals", Icon: FolderIcon, cardClass: "border-sky-200/75 bg-[rgba(238,247,255,0.97)] text-sky-950", iconClass: "bg-sky-700 text-white" },
  { title: "Meeting Notes", caption: "Team decisions", Icon: DocumentIcon, cardClass: "border-emerald-200/75 bg-[rgba(238,250,246,0.98)] text-emerald-950", iconClass: "bg-emerald-700 text-white" },
  { title: "Postmortems", caption: "Incident learnings", Icon: ChatIcon, cardClass: "border-rose-200/75 bg-[rgba(255,241,244,0.97)] text-rose-950", iconClass: "bg-rose-600 text-white" },
  { title: "Tickets", caption: "Ops and support context", Icon: CopyIcon, cardClass: "border-indigo-200/75 bg-[rgba(238,242,255,0.97)] text-indigo-950", iconClass: "bg-indigo-700 text-white" },
  { title: "Images", caption: "Diagrams and screenshots", Icon: ImageIcon, cardClass: "border-amber-200/75 bg-[rgba(255,247,236,0.97)] text-amber-950", iconClass: "bg-amber-600 text-white" },
];

const WORKFLOW_ENGINE_STEPS = [
  { title: "Extract", caption: "Text + metadata", Icon: DocumentIcon },
  { title: "Chunk", caption: "Retrieval units", Icon: FolderIcon },
  { title: "Indexing", caption: "Search index", Icon: RotateIcon },
  { title: "Retriever", caption: "Best matches", Icon: SearchIcon },
];

const WORKFLOW_OUTCOMES = [
  { title: "Grounded answers", value: "Answers include linked evidence" },
  { title: "Persistent chat", value: "Follow-ups keep previous context" },
  { title: "Workspace isolation", value: "Search stays inside the correct workspace" },
];

const FAQS = [
  { question: "How are companies separated in EDMS?", answer: "Each admin creates a workspace for their company, and users join with the invite code tied to that workspace. Search, chat, uploads, and evidence stay inside that company workspace." },
  { question: "Who can create invite codes?", answer: "Admins create and rotate invite codes. Users cannot create separate company workspaces." },
  { question: "What happens after an upload?", answer: "Files stay inside the admin's workspace and indexing runs automatically so the new evidence becomes searchable right away." },
];

const HERO_TEAMS = ["EN", "OP", "PD", "SC"];

const HERO_QUERIES = [
  "What changed after the postmortem?",
  "Who approved the database migration?",
  "Find postmortems for the auth service",
];

const HERO_ANSWERS = [
  {
    text: "Rollback checks were standardized and ADR-024 was linked to the incident notes for future retrieval.",
    tags: ["ADR-024", "Postmortem"],
  },
  {
    text: "RFC-112 was approved by the Platform team with a staged rollout plan and rollback checkpoints.",
    tags: ["RFC-112", "Platform review"],
  },
  {
    text: "Three postmortems: PM-014 (token expiry), PM-019 (OAuth redirect), PM-027 (rate limit). All link to ADR-018.",
    tags: ["PM-014", "ADR-018"],
  },
];

/* ─── custom hook: typewriter ────────────────────────────────── */

function useTypewriter(queries, { typeSpeed = 52, deleteSpeed = 28, pauseMs = 2200 } = {}) {
  const [display, setDisplay] = useState("");
  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState("typing");

  useEffect(() => {
    const query = queries[qIdx];
    let t;
    if (phase === "typing") {
      if (display.length < query.length) {
        t = setTimeout(() => setDisplay(query.slice(0, display.length + 1)), typeSpeed);
      } else {
        t = setTimeout(() => setPhase("deleting"), pauseMs);
      }
    } else {
      if (display.length > 0) {
        t = setTimeout(() => setDisplay(display.slice(0, -1)), deleteSpeed);
      } else {
        t = setTimeout(() => {
          setQIdx((i) => (i + 1) % queries.length);
          setPhase("typing");
        }, 0);
      }
    }
    return () => clearTimeout(t);
  }, [display, phase, qIdx, queries, typeSpeed, deleteSpeed, pauseMs]);

  return { text: display, answerIdx: qIdx };
}

/* ─── small icon helpers ─────────────────────────────────────── */

function ChevronDownIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HamburgerIcon({ open, className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </>
      ) : (
        <>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </>
      )}
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ─── main page ──────────────────────────────────────────────── */

export default function Login() {
  const [mode, setMode] = useState("login");
  const [accountType, setAccountType] = useState("admin");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupResult, setSignupResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = "EDMS — Company Knowledge Search";
  }, []);

  // Show banner if session expired
  useEffect(() => {
    if (sessionStorage.getItem("edms:session-expired")) {
      sessionStorage.removeItem("edms:session-expired");
      setSessionExpiredBanner(true);
    }
  }, []);

  const isRegister = mode === "register";
  const isAdminSignup = isRegister && accountType === "admin";
  const isUserSignup = isRegister && accountType === "user";

  useEffect(() => {
    const overlayActive = authOpen || Boolean(signupResult) || mobileMenuOpen;
    const prev = document.body.style.overflow;
    if (overlayActive) document.body.style.overflow = "hidden";
    function handleEscape(e) {
      if (e.key === "Escape") {
        if (authOpen) setAuthOpen(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [authOpen, signupResult, mobileMenuOpen]);

  function switchMode(nextMode) {
    setMode(nextMode); setError(""); setPassword(""); setConfirmPassword("");
    setInviteCode(""); setOrganizationName(""); setCopyStatus(""); setShowPassword(false);
  }
  function openAuth(nextMode) { switchMode(nextMode); setAuthOpen(true); }
  function closeAuth() { setAuthOpen(false); setError(""); setShowPassword(false); }

  async function copyInviteCode() {
    if (!signupResult?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(signupResult.inviteCode);
      setCopyStatus("Invite code copied.");
    } catch { setCopyStatus("Copy failed. Select and copy manually."); }
  }

  function finishAdminSignup() { setSignupResult(null); setCopyStatus(""); window.location.href = "/dashboard"; }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedOrganizationName = organizationName.trim();
    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedEmail) { setError("Email is required."); return; }
    if (!trimmedPassword) { setError("Password is required."); return; }
    if (isAdminSignup && !trimmedOrganizationName) { setError("Company name is required."); return; }
    if (isUserSignup && !trimmedInviteCode) { setError("Invite code is required."); return; }
    if (isRegister && trimmedPassword.length < 10) { setError("Password must be at least 10 characters."); return; }
    if (isRegister && !/[A-Za-z]/.test(trimmedPassword)) { setError("Password must include at least one letter."); return; }
    if (isRegister && !/\d/.test(trimmedPassword)) { setError("Password must include at least one number."); return; }
    if (isRegister && password !== confirmPassword) { setError("Passwords do not match."); return; }

    setError(""); setLoading(true);
    try {
      const data = isRegister
        ? await registerUser({ email: trimmedEmail, password: trimmedPassword, role: accountType, organization_name: isAdminSignup ? trimmedOrganizationName : undefined, invite_code: isUserSignup ? trimmedInviteCode : undefined })
        : await loginUser(trimmedEmail, trimmedPassword);
      setSession(data.access_token, data.refresh_token);
      if (isAdminSignup && data.invite_code) {
        setAuthOpen(false);
        setSignupResult({ inviteCode: data.invite_code, organizationName: data.organization_name || trimmedOrganizationName });
        setCopyStatus(""); return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Unable to complete authentication.");
      clearSession();
    } finally { setLoading(false); }
  }

  const authTitle = isRegister
    ? accountType === "admin" ? "Create a company workspace" : "Join an existing workspace"
    : "Sign in to your workspace";
  const authDescription = isRegister
    ? accountType === "admin" ? "Create your company workspace and receive the invite code." : "Use the invite code from your admin to join the right workspace."
    : "Use your saved email and password to continue.";

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <PageBackground />

      {/* Session expired notification */}
      {sessionExpiredBanner && (
        <div className="fixed left-1/2 top-4 z-[80] w-full max-w-sm -translate-x-1/2 px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
            <svg className="h-4 w-4 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4m0 4h.01" />
            </svg>
            <p className="flex-1 text-sm font-medium text-amber-800">Session expired — please sign in again.</p>
            <button type="button" onClick={() => setSessionExpiredBanner(false)} className="text-amber-600 transition hover:text-amber-900" aria-label="Dismiss">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Signup result modal */}
      {signupResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[34px] border border-border bg-card p-6 shadow-[0_32px_120px_-35px_rgba(51,65,85,0.45)]">
            <div className="flex items-center gap-3">
              <LogoMark className="h-12 w-12" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Workspace Created</p>
                  <h2 className="mt-1 text-2xl font-semibold">Share the invite code</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              Send this code to users so they can join{" "}
              <span className="font-semibold text-foreground">{signupResult.organizationName}</span>{" "}
              without creating another workspace.
            </p>
            <div className="mt-5 rounded-[28px] border border-primary/15 bg-accent px-5 py-6 text-center">
              <p className="text-3xl font-semibold tracking-[0.3em] text-primary">{signupResult.inviteCode}</p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={copyInviteCode} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-95">
                <CopyIcon className="h-4 w-4" /> Copy Code
              </button>
              <button type="button" onClick={finishAdminSignup} className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-foreground shadow-card transition hover:bg-secondary">
                Continue
              </button>
            </div>
            {copyStatus && <p className="mt-3 text-sm text-success">{copyStatus}</p>}
          </div>
        </div>
      )}

      {/* Auth modal */}
      {authOpen && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) closeAuth(); }}>
          <div className="mx-auto flex min-h-screen items-center justify-center px-3 py-3 sm:px-4 sm:py-5">
            <div className="w-full max-w-[540px] max-h-[calc(100vh-1.5rem)] overflow-y-auto overscroll-contain rounded-[28px] border border-border bg-card shadow-[0_18px_40px_-24px_rgba(15,23,42,0.3)]">
              <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LogoMark className="h-10 w-10" />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                        {isRegister ? (accountType === "admin" ? "Admin Signup" : "User Signup") : "Sign In"}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold sm:text-[1.55rem]">{authTitle}</h2>
                    </div>
                  </div>
                  <button type="button" onClick={closeAuth} className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                    Close
                  </button>
                </div>
                <p className="mt-3 max-w-[420px] text-sm leading-5 text-muted-foreground">{authDescription}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
                  <button type="button" onClick={() => switchMode("login")} className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${!isRegister ? "bg-background text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>Sign In</button>
                  <button type="button" onClick={() => switchMode("register")} className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${isRegister ? "bg-background text-foreground shadow-card" : "text-muted-foreground hover:text-foreground"}`}>Create Account</button>
                </div>
                {isRegister && (
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => { setAccountType("admin"); setError(""); setInviteCode(""); }} className={`rounded-[20px] border px-4 py-3 text-left transition ${accountType === "admin" ? "border-primary/20 bg-secondary text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>
                      <span className="block text-sm font-semibold">Admin</span>
                      <span className="mt-1 block text-[11px] leading-4 opacity-80">Creates the company workspace.</span>
                    </button>
                    <button type="button" onClick={() => { setAccountType("user"); setError(""); setOrganizationName(""); }} className={`rounded-[20px] border px-4 py-3 text-left transition ${accountType === "user" ? "border-primary/20 bg-secondary text-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground"}`}>
                      <span className="block text-sm font-semibold">User</span>
                      <span className="mt-1 block text-[11px] leading-4 opacity-80">Joins with the invite code.</span>
                    </button>
                  </div>
                )}
              </div>
              <div className="px-4 py-4 sm:px-5">
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {isAdminSignup && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Company Name</label>
                      <input type="text" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required placeholder="Enter company name" className={AUTH_INPUT_CLASS} />
                    </div>
                  )}
                  {isUserSignup && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Invite Code</label>
                      <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} required placeholder="ABCD-1234" className={`${AUTH_INPUT_CLASS} uppercase tracking-[0.18em]`} />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Enter email address" className={AUTH_INPUT_CLASS} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} name={isRegister ? "new-password" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={isRegister ? 10 : 1} autoComplete={isRegister ? "new-password" : "current-password"} placeholder="Enter password" className={`${AUTH_INPUT_CLASS} pr-12`} />
                      <button type="button" onClick={() => setShowPassword((c) => !c)} className="absolute inset-y-0 right-4 flex items-center text-muted-foreground transition hover:text-primary" aria-label="Toggle password visibility">
                        {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  {isRegister && (
                    <div>
                      <label className="text-sm font-medium text-foreground">Confirm Password</label>
                      <input type={showPassword ? "text" : "password"} name="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={10} autoComplete="new-password" placeholder="Confirm password" className={AUTH_INPUT_CLASS} />
                    </div>
                  )}
                  <button type="submit" disabled={loading} className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${loading ? "cursor-not-allowed bg-primary/55 text-primary-foreground" : "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"}`}>
                    {loading ? (isRegister ? "Creating account..." : "Authenticating...") : isRegister ? (isAdminSignup ? "Create workspace" : "Join workspace") : "Continue"}
                  </button>
                  {error && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">{error}</div>}
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} openAuth={openAuth} />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/75 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3 text-left">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-sm font-bold text-foreground">EDMS</p>
                <p className="text-xs text-muted-foreground">Company knowledge search</p>
              </div>
            </button>

            <nav className="hidden items-center gap-7 md:flex">
              {[{ label: "Features", href: "#features" }, { label: "How it works", href: "#how" }, { label: "FAQ", href: "#faq" }].map((item) => (
                <a key={item.label} href={item.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">{item.label}</a>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => openAuth("login")} className="hidden rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex">
                Sign In
              </button>
              <button type="button" onClick={() => openAuth("register")} className="hidden items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-95 sm:inline-flex">
                Create workspace <ArrowRightIcon className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setMobileMenuOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-secondary md:hidden" aria-label="Open menu">
                <HamburgerIcon open={false} className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main>
          {/* Hero */}
          <section className="relative overflow-hidden pb-14 pt-6 md:pb-20 md:pt-8">
            <HeroSectionBg />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(79,70,229,0.14),transparent_35%),radial-gradient(circle_at_85%_10%,rgba(6,182,212,0.15),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.11),transparent_40%)]" aria-hidden />
            <div className="container relative">
              <HeroFloatingCards>
                <div className="relative mx-auto max-w-[780px] px-4 pt-3 text-center animate-fade-up xl:max-w-[820px]">
                  <HeroAmbientGlow />
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-gradient-to-r from-accent via-white/90 to-accent px-1.5 py-1.5 shadow-[0_4px_24px_-8px_rgba(99,102,241,0.25)] backdrop-blur">
                    <span className="flex items-center gap-1.5 rounded-full bg-gradient-primary px-3.5 py-1.5 text-[0.63rem] font-bold uppercase tracking-[0.18em] text-white">
                      <SparkleIcon className="h-3 w-3" /> RAG-Powered
                    </span>
                    <span className="flex items-center gap-1.5 pr-2 text-[0.74rem] font-medium text-foreground">
                      Evidence-backed answers <ArrowRightIcon className="h-3 w-3 text-muted-foreground" />
                    </span>
                  </div>

                  <h1 className="mx-auto mt-7 max-w-[740px] bg-gradient-to-br from-slate-950 via-indigo-700 to-cyan-600 bg-clip-text text-[2.45rem] font-bold leading-[1.02] text-transparent sm:text-[3.35rem] md:text-[3.95rem] xl:text-[4.25rem]">
                    <span className="sm:hidden">
                      Search company
                      <br />
                      records with
                      <br />
                      linked evidence
                    </span>
                    <span className="hidden sm:inline">
                      Search company records
                      <br />
                      <span className="animate-shimmer-text">with linked evidence</span>
                    </span>
                  </h1>

                  <p className="mx-auto mt-6 max-w-[46rem] text-[1.06rem] leading-relaxed text-muted-foreground md:text-lg">
                    Bring ADRs, RFCs, meeting notes, postmortems, tickets, and images into one
                    secure workspace. EDMS returns grounded answers, keeps chat context,
                    and scopes access to the correct workspace.
                  </p>

                  <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={() => openAuth("register")} className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-primary px-7 text-[0.95rem] font-semibold text-white shadow-glow transition hover:opacity-95">
                      Create workspace <ArrowRightIcon className="h-4 w-4" />
                    </button>
                    <a href="#demo" className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-white/70 px-7 text-[0.95rem] font-semibold text-foreground backdrop-blur transition hover:bg-white hover:shadow-sm">
                      See it in action
                    </a>
                  </div>

                  <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
                    <div className="flex -space-x-2.5">
                      {HERO_TEAMS.map((team, i) => (
                        <div key={team} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold shadow-sm ${i === 0 ? "bg-sky-100 text-sky-700" : i === 1 ? "bg-emerald-100 text-emerald-700" : i === 2 ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700"}`}>{team}</div>
                      ))}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">For teams that need trusted answers from internal records</p>
                  </div>
                </div>
              </HeroFloatingCards>

              <div id="demo" className="relative mx-auto mt-9 scroll-mt-24 max-w-6xl px-4 md:mt-10">
                <div className="mx-auto w-full max-w-[860px]">
                  <HeroAnimatedPreview />
                </div>
              </div>
            </div>
          </section>

          {/* Trust bar */}
          <TrustBar />

          {/* Features grid */}
          <section id="features" className="relative py-14 md:py-20 animate-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_100%,rgba(34,197,94,0.12),transparent_40%),radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.09),transparent_42%)]" aria-hidden />
            <div className="container">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-block rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Features</span>
                <h2 className="mt-4 text-3xl font-bold md:text-4xl">Everything needed to make company records searchable</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">Upload records once. EDMS handles indexing, evidence, access control, and follow-up chat in the same workspace.</p>
              </div>
              <div className="mt-14 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 60} />)}
              </div>
            </div>
          </section>

          {/* How teams use it */}
          <TeamScenariosSection />

          {/* How it works */}
          <section id="how" className="relative border-y border-border/60 bg-gradient-soft py-14 md:py-20 animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(245,158,11,0.12),transparent_33%),radial-gradient(circle_at_90%_85%,rgba(249,115,22,0.12),transparent_38%),radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.09),transparent_42%)]" aria-hidden />
            <div className="container">
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-block rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">How it works</span>
                <h2 className="mt-4 text-3xl font-bold md:text-4xl">How records become evidence-backed answers.</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">Upload ADRs, RFCs, meeting notes, postmortems, tickets, and images. EDMS extracts content, updates indexing automatically, and retrieves answers inside the correct company workspace.</p>
              </div>
              <WorkflowDiagram />
            </div>
          </section>

          {/* Testimonials */}
          <TestimonialsSection />

          {/* FAQ */}
          <section id="faq" className="relative py-14 md:py-20 animate-fade-up" style={{ animationDelay: "180ms" }}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(236,72,153,0.1),transparent_36%),radial-gradient(circle_at_95%_0%,rgba(168,85,247,0.12),transparent_35%),radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.09),transparent_45%)]" aria-hidden />
            <div className="container max-w-3xl">
              <div className="text-center">
                <span className="inline-block rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">FAQ</span>
                <h2 className="mt-4 text-3xl font-bold md:text-4xl">Common questions.</h2>
                <p className="mt-4 leading-relaxed text-muted-foreground">Clear answers on access, workspace separation, and how uploads become searchable.</p>
              </div>
              <div className="mt-12 space-y-3">
                {FAQS.map((faq) => <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />)}
              </div>
            </div>
          </section>

          <CTASection openAuth={openAuth} />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-slate-950">
          <div className="container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <div>
              <div className="flex items-center gap-3">
                <LogoMark className="h-9 w-9" />
                <div>
                  <p className="text-sm font-bold text-white">EDMS</p>
                  <p className="text-xs text-slate-400">Company knowledge search</p>
                </div>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">Search company records with evidence, persistent chat, and invite-based workspace access.</p>
            </div>
            {[
              { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "How it works", href: "#how" }, { label: "FAQ", href: "#faq" }] },
              { title: "Access", links: [{ label: "Sign in", action: () => openAuth("login") }, { label: "Create workspace", action: () => openAuth("register") }] },
              { title: "Platform", links: [{ label: "Invite-based access", href: "#faq" }, { label: "Evidence search", href: "#features" }, { label: "RAG pipeline", href: "#how" }] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white">{col.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      {"href" in link
                        ? <a href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">{link.label}</a>
                        : <button type="button" onClick={link.action} className="text-sm text-slate-400 transition-colors hover:text-white">{link.label}</button>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800">
            <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-slate-500 sm:flex-row">
              <span>© {new Date().getFullYear()} EDMS. All rights reserved.</span>
              <span>Workspace-scoped search, evidence, and chat.</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ─── sub-components ─────────────────────────────────────────── */

function MobileMenu({ isOpen, onClose, openAuth }) {
  return (
    <div className={`fixed inset-0 z-[60] transition-all duration-300 md:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      {/* Panel */}
      <div className={`absolute inset-y-0 right-0 w-[300px] bg-card shadow-2xl transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <p className="text-sm font-bold text-foreground">EDMS</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:text-foreground" aria-label="Close menu">
            <HamburgerIcon open className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {[{ label: "Features", href: "#features" }, { label: "How it works", href: "#how" }, { label: "FAQ", href: "#faq" }].map((item) => (
            <a key={item.label} href={item.href} onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">{item.label}</a>
          ))}
        </nav>
        <div className="border-t border-border p-4 space-y-2.5">
          <button type="button" onClick={() => { onClose(); openAuth("login"); }} className="w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-secondary">Sign In</button>
          <button type="button" onClick={() => { onClose(); openAuth("register"); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-glow transition hover:opacity-95">
            Create workspace <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))]" />
      <div className="absolute inset-0 bg-dot-grid opacity-45" />
      <div className="absolute inset-0 bg-[radial-gradient(at_18%_8%,rgba(99,102,241,0.12),transparent_36%),radial-gradient(at_82%_4%,rgba(14,165,233,0.1),transparent_32%),radial-gradient(at_50%_100%,rgba(16,185,129,0.08),transparent_40%)]" />
    </div>
  );
}

function LogoMark({ className = "h-11 w-11" }) {
  return (
    <img
      src="/edms-favicon.png"
      alt="EDMS"
      className={`rounded-[22px] border border-border/60 object-cover shadow-glow ${className}`.trim()}
      loading="eager"
    />
  );
}

function HeroAmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-20 -z-10 hidden h-[380px] md:block" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(at_50%_0%,rgba(99,102,241,0.14),transparent_48%),radial-gradient(at_18%_30%,rgba(14,165,233,0.12),transparent_34%),radial-gradient(at_82%_34%,rgba(16,185,129,0.1),transparent_35%)] animate-pulse-soft" />
    </div>
  );
}

function HeroFloatingCards({ children }) {
  const floatingCards = [
    { title: "ADRs & RFCs", meta: "Decisions and change proposals", Icon: LibraryIcon, side: "left", className: "w-[148px] -rotate-[8deg] border-violet-200/75 bg-[rgba(246,241,255,0.96)] text-violet-950 animate-float-slow xl:mr-2", iconWrapClass: "bg-violet-700 text-white shadow-[0_10px_24px_-14px_rgba(109,40,217,0.8)]" },
    { title: "Meeting Notes", meta: "Decisions and team context", Icon: DocumentIcon, side: "right", className: "w-[148px] rotate-[8deg] border-sky-200/75 bg-[rgba(238,247,255,0.97)] text-sky-950 animate-float-delay xl:ml-2", iconWrapClass: "bg-sky-700 text-white shadow-[0_10px_24px_-14px_rgba(3,105,161,0.78)]" },
    { title: "Postmortems", meta: "Incident learnings and fixes", Icon: ChatIcon, side: "left", className: "mt-12 w-[156px] -rotate-[6deg] border-orange-200/75 bg-[rgba(255,243,236,0.97)] text-orange-950 animate-float-fast xl:mr-8", iconWrapClass: "bg-orange-600 text-white shadow-[0_10px_24px_-14px_rgba(234,88,12,0.78)]" },
    { title: "Invite-Based Access", meta: "Scoped search for each workspace", Icon: ShieldIcon, side: "right", className: "mt-14 w-[156px] rotate-[6deg] border-emerald-200/75 bg-[rgba(238,250,246,0.98)] text-emerald-950 animate-float-delay xl:ml-8", iconWrapClass: "bg-emerald-700 text-white shadow-[0_10px_24px_-14px_rgba(4,120,87,0.78)]" },
  ];
  const leftCards = floatingCards.filter((c) => c.side === "left");
  const rightCards = floatingCards.filter((c) => c.side === "right");

  return (
    <>
      <div className="lg:hidden">{children}</div>
      <div className="hidden lg:grid lg:grid-cols-[170px_minmax(0,1fr)_170px] lg:items-start lg:gap-7 xl:grid-cols-[190px_minmax(0,1fr)_190px] xl:gap-10">
        <div className="pointer-events-none flex flex-col items-end pt-4" aria-hidden>
          {leftCards.map((card) => (
            <div key={card.title} className={`rounded-[24px] border px-3.5 py-3.5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] backdrop-blur-sm ${card.className}`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconWrapClass}`}><card.Icon className="h-4 w-4" /></div>
              <p className="mt-4 text-[0.9rem] font-semibold leading-5">{card.title}</p>
              <p className="mt-1.5 text-[0.78rem] font-medium leading-5 opacity-80">{card.meta}</p>
            </div>
          ))}
        </div>
        <div className="min-w-0">{children}</div>
        <div className="pointer-events-none flex flex-col items-start pt-5" aria-hidden>
          {rightCards.map((card) => (
            <div key={card.title} className={`rounded-[24px] border px-3.5 py-3.5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] backdrop-blur-sm ${card.className}`}>
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconWrapClass}`}><card.Icon className="h-4 w-4" /></div>
              <p className="mt-4 text-[0.9rem] font-semibold leading-5">{card.title}</p>
              <p className="mt-1.5 text-[0.78rem] font-medium leading-5 opacity-80">{card.meta}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── hero section background: rotating rings + beam ──────── */
function HeroSectionBg() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Outer rotating dashed ring */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className="h-[700px] w-[700px] animate-spin-slow rounded-full border border-dashed border-primary/7" />
      </div>
      {/* Inner counter-rotating ring */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className="h-[480px] w-[480px] animate-spin-slow-reverse rounded-full border border-dashed border-violet-300/10" />
      </div>
      <div className="absolute inset-x-0 top-[18%] h-[360px] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.1),transparent_62%)] animate-pulse-soft" />
      {/* Horizontal scan beam */}
      <div className="absolute left-0 right-0 top-[45%] h-px bg-gradient-to-r from-transparent via-primary/18 to-transparent animate-beam-scan" />
    </div>
  );
}

/* ─── hero animated preview ─────────────────────────────────── */
function HeroAnimatedPreview() {
  const { text, answerIdx } = useTypewriter(HERO_QUERIES, {
    typeSpeed: 50,
    deleteSpeed: 24,
    pauseMs: 3000,
  });
  const isComplete = text === HERO_QUERIES[answerIdx];
  const [showSearching, setShowSearching] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!isComplete) {
      const resetTimer = setTimeout(() => {
        setShowSearching(false);
        setShowAnswer(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    const t1 = setTimeout(() => setShowSearching(true), 150);
    const t2 = setTimeout(() => {
      setShowSearching(false);
      setShowAnswer(true);
    }, 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isComplete]);

  const answer = HERO_ANSWERS[answerIdx];

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card/95 shadow-[0_40px_100px_-48px_rgba(15,23,42,0.42)] backdrop-blur">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-background/90 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3 flex-1 text-xs font-medium text-muted-foreground">edms.app/search</span>
      </div>

      <div className="grid gap-0 md:grid-cols-[210px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="border-b border-border bg-secondary/55 p-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent searches</p>
          <div className="mt-4 space-y-1.5">
            {HERO_QUERIES.map((q, i) => (
              <div
                key={q}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-300 ${
                  i === answerIdx
                    ? "bg-card text-foreground shadow-sm ring-1 ring-primary/10"
                    : "text-muted-foreground"
                }`}
              >
                <ChatIcon className={`h-3.5 w-3.5 shrink-0 transition-colors ${i === answerIdx ? "text-primary" : ""}`} />
                <span className="truncate text-xs">{q.substring(0, 24)}…</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">Invite-based access</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-xs text-muted-foreground">Scoped to your workspace</p>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="bg-[linear-gradient(180deg,rgba(249,250,255,0.9),rgba(255,255,255,1))] p-5">
          <div className="rounded-[24px] border border-border bg-background/90 p-4 shadow-sm">
            {/* Search bar */}
            <div
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all duration-300 ${
                showSearching
                  ? "border-primary/30 bg-accent/40 ring-2 ring-primary/8"
                  : "border-border bg-card"
              }`}
            >
              <SearchIcon
                className={`h-4 w-4 shrink-0 transition-colors duration-300 ${showSearching ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className="flex-1 text-sm text-foreground" style={{ minHeight: "1.25rem" }}>
                {text}
                <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] rounded-sm bg-primary animate-blink" />
              </span>
              {showSearching ? (
                <span className="flex shrink-0 items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-pulse-soft"
                      style={{ animationDelay: `${i * 180}ms` }}
                    />
                  ))}
                </span>
              ) : (
                <span className="hidden shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-primary sm:inline-flex">
                  Search
                </span>
              )}
            </div>

            {/* Answer area — fixed height prevents preview jitter */}
            <div className="mt-4 h-[248px]">
              {showSearching && (
                <div className="flex h-full items-center justify-center gap-3 rounded-[22px] border border-primary/10 bg-accent/20">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full bg-primary/40 animate-pulse-soft"
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Searching workspace…</p>
                </div>
              )}

              {showAnswer && (
                <div key={answerIdx} className="h-full overflow-y-auto pr-1 animate-answer-in">
                  <div className="relative rounded-[22px] border border-primary/15 bg-accent/50 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Grounded answer
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{answer.text}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {answer.tags.map((tag, i) => (
                        <span
                          key={tag}
                          className="animate-tag-in inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground"
                          style={{ animationDelay: `${i * 80}ms` }}
                        >
                          <LibraryIcon className="h-3 w-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { l: "Isolation", v: "Workspace only" },
                      { l: "Evidence", v: "Sources linked" },
                      { l: "Chat", v: "Context saved" },
                    ].map((item, i) => (
                      <div
                        key={item.l}
                        className="animate-tag-in rounded-[14px] border border-border bg-card px-3 py-2.5 shadow-sm"
                        style={{ animationDelay: `${160 + i * 55}ms` }}
                      >
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.l}</p>
                        <p className="mt-1 text-xs font-semibold text-foreground">{item.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!showAnswer && !showSearching && (
                <div className="flex h-full items-center justify-center rounded-[22px] border border-dashed border-border/50">
                  <p className="text-xs text-muted-foreground/40">Ask a question to see grounded answers…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="overflow-hidden border-b border-border/60 bg-background py-8">
      <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55">
        Built for teams managing decisions, docs, and evidence
      </p>
      <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex animate-marquee gap-10 whitespace-nowrap">
          {[...TRUST_ITEMS, ...TRUST_ITEMS, ...TRUST_ITEMS, ...TRUST_ITEMS].map((item, i) => (
            <div key={i} className="flex shrink-0 items-center gap-2.5 text-sm font-semibold text-muted-foreground/50">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/40" />{item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard(props) {
  const { title, body, iconBg, iconColor, hoverBorder, hoverShadow, delay } = props;
  return (
    <div
      className={`group relative h-full rounded-2xl border border-border bg-[linear-gradient(150deg,rgba(255,255,255,0.97),rgba(244,247,255,0.95),rgba(236,252,255,0.92))] p-6 shadow-card transition-all duration-300 hover:-translate-y-1 animate-fade-up ${hoverBorder} ${hoverShadow}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
        <props.Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <h3 className="mt-5 text-[0.95rem] font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function TeamScenariosSection() {
  const colorMap = {
    violet: { badge: "bg-violet-50 text-violet-700 border-violet-200", check: "text-violet-600" },
    sky: { badge: "bg-sky-50 text-sky-700 border-sky-200", check: "text-sky-600" },
    emerald: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", check: "text-emerald-600" },
  };

  return (
    <section className="border-t border-border/60 py-14 md:py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Use cases</span>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">Built for teams that manage decisions</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">Different teams, same problem: company knowledge is scattered. EDMS brings it together.</p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TEAM_SCENARIOS.map((scenario) => {
            const c = colorMap[scenario.color];
            return (
              <div key={scenario.team} className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-block rounded-full border px-3 py-1 text-xs font-bold ${c.badge}`}>{scenario.team}</span>
                </div>
                <h3 className="text-base font-semibold text-foreground leading-snug">{scenario.headline}</h3>
                <ul className="mt-4 space-y-2.5">
                  {scenario.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckIcon className={`mt-0.5 h-4 w-4 shrink-0 ${c.check}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="border-t border-border/60 py-14 md:py-20">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Testimonials</span>
          <h2 className="mt-4 text-3xl font-bold md:text-4xl">What teams are saying.</h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
              <p className="flex-1 text-sm leading-7 text-muted-foreground">"{t.quote}"</p>
              <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${t.color}`}>{t.initials}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · {t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border transition-all duration-200 ${open ? "border-primary/20 bg-accent/30 shadow-sm" : "border-border bg-card hover:border-border/80"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="pr-4 text-[0.95rem] font-semibold text-foreground">{question}</span>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180 text-primary" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${open ? "max-h-60" : "max-h-0"}`}>
        <div className="px-6 pb-5">
          <p className="text-sm leading-7 text-muted-foreground">{answer}</p>
        </div>
      </div>
    </div>
  );
}

function CTASection({ openAuth }) {
  return (
    <section className="py-14 md:py-20">
      <div className="container">
        <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(30,27,75,1),rgba(79,70,229,0.94),rgba(8,145,178,0.9))] px-8 py-14 text-center shadow-[0_32px_80px_-48px_rgba(15,23,42,0.72)] md:px-14 md:py-20">
          <div className="absolute inset-0 bg-[radial-gradient(at_20%_0%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(at_80%_100%,rgba(125,211,252,0.18),transparent_38%)]" aria-hidden />
          <div className="absolute inset-0 bg-dot-grid opacity-[0.07]" aria-hidden />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight text-white md:text-5xl">
              Make company records searchable{" "}
              <span className="text-gradient" style={{ "--gradient-text": "linear-gradient(135deg,#a78bfa,#60a5fa)" }}>
                in one secure workspace.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-white/80">Create the workspace, invite your team, upload records, and start answering questions with linked evidence.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => openAuth("register")} className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-primary px-7 text-sm font-semibold text-white shadow-glow transition hover:opacity-95">
                Create workspace <ArrowRightIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => openAuth("login")} className="inline-flex h-12 items-center rounded-xl border border-white/20 px-7 text-sm font-semibold text-white transition hover:bg-white/10">
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── workflow (preserved) ───────────────────────────────────── */

function WorkflowDiagram() {
  return (
    <div className="relative mx-auto mt-16 max-w-6xl overflow-hidden rounded-[36px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,250,255,0.96))] p-5 shadow-[0_36px_90px_-48px_rgba(15,23,42,0.26)] md:p-8">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-[8%] top-10 h-28 w-28 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute right-[10%] top-12 h-32 w-32 rounded-full bg-violet-200/30 blur-3xl" />
        <div className="absolute bottom-8 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>
      <div className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white/78 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground shadow-sm">
            <SparkleIcon className="h-3.5 w-3.5 text-primary" />Upload → answer flow
          </div>
        </div>
        <div className="mt-8 lg:hidden">
          <div className="grid grid-cols-2 gap-3">
            {WORKFLOW_INPUTS.map((item, i) => <WorkflowSourceChip key={item.title} {...item} delay={i * 70} />)}
          </div>
          <div className="mt-5 px-6"><WorkflowFlowLine /></div>
          <div className="mt-5"><WorkflowSystemCard /></div>
          <div className="mt-5 px-6"><WorkflowFlowLine delay={0.8} /></div>
          <div className="mt-5"><WorkflowOutputCard /></div>
        </div>
        <div className="mt-10 hidden lg:grid lg:grid-cols-[220px_84px_minmax(0,1fr)_84px_270px] lg:items-center lg:gap-4">
          <div className="space-y-3">{WORKFLOW_INPUTS.map((item, i) => <WorkflowSourceChip key={item.title} {...item} delay={i * 80} />)}</div>
          <div className="space-y-3">{WORKFLOW_INPUTS.map((item, i) => <div key={item.title} className="flex h-[70px] items-center"><WorkflowFlowLine delay={i * 0.22} /></div>)}</div>
          <WorkflowSystemCard />
          <div className="flex items-center"><WorkflowFlowLine delay={1} /></div>
          <WorkflowOutputCard />
        </div>
      </div>
    </div>
  );
}

function WorkflowSourceChip(props) {
  const { title, caption, cardClass, iconClass, delay = 0 } = props;
  return (
    <div className={`animate-fade-up flex h-[70px] items-center gap-3 rounded-[22px] border px-3.5 py-3 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)] ${cardClass}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}><props.Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <p className="text-[0.92rem] font-semibold leading-5">{title}</p>
        <p className="mt-0.5 text-[0.76rem] leading-4 opacity-75">{caption}</p>
      </div>
    </div>
  );
}

function WorkflowFlowLine({ delay = 0 }) {
  return (
    <div className="relative h-[2px] w-full overflow-hidden rounded-full bg-slate-200/80" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(99,102,241,0),rgba(99,102,241,0.6),rgba(99,102,241,0))] bg-[length:200%_100%] animate-line-flow" />
      <div className="absolute inset-y-0 left-0 flex w-full items-center animate-flow-dot" style={{ animationDelay: `${delay}s` }}>
        <span className="block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_rgba(99,102,241,0.14)]" />
      </div>
    </div>
  );
}

function WorkflowSystemCard() {
  const [e, ch, idx, ret] = WORKFLOW_ENGINE_STEPS;
  return (
    <div className="overflow-hidden rounded-[30px] border border-border/80 bg-white/94 p-4 shadow-[0_28px_72px_-42px_rgba(15,23,42,0.26)] lg:p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] border border-border bg-white shadow-sm">
          <div className="absolute inset-0 rounded-[20px] bg-gradient-primary opacity-10" />
          <LogoMark className="h-10 w-10" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Processing Pipeline</p>
          <h3 className="mt-1.5 text-lg font-semibold text-foreground lg:text-xl">Extraction, indexing, and retrieval.</h3>
          <p className="mt-1.5 text-[0.82rem] leading-5 text-muted-foreground lg:text-sm lg:leading-6">After each admin upload, EDMS extracts content, builds retrieval-ready chunks, refreshes indexing, and returns the best evidence.</p>
        </div>
      </div>
      <div className="relative mt-4 rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(249,250,255,0.92),rgba(255,255,255,0.98))] p-3.5 lg:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-3">
          <WorkflowStepCard {...e} />
          <div className="flex items-center justify-center text-primary" aria-hidden><ArrowRightIcon className="h-4 w-4" /></div>
          <WorkflowStepCard {...ch} />
          <div /><div />
          <div className="flex items-center justify-center text-primary" aria-hidden><ArrowRightIcon className="h-4 w-4 rotate-90" /></div>
          <WorkflowStepCard {...ret} />
          <div className="flex items-center justify-center text-primary" aria-hidden><ArrowRightIcon className="h-4 w-4 rotate-180" /></div>
          <WorkflowStepCard {...idx} />
        </div>
      </div>
      <div className="mt-3.5 rounded-[18px] border border-primary/15 bg-accent/55 px-4 py-3.5">
        <p className="text-[0.78rem] font-semibold text-foreground">Every upload triggers processing, indexing refresh, and workspace-scoped retrieval.</p>
      </div>
    </div>
  );
}

function WorkflowStepCard(props) {
  const { title, caption } = props;
  return (
    <div className="rounded-[18px] border border-border bg-white px-2.5 py-3 text-center shadow-sm">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary"><props.Icon className="h-3.5 w-3.5" /></div>
      <p className="mt-2.5 text-[0.79rem] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[0.69rem] leading-4 text-muted-foreground">{caption}</p>
    </div>
  );
}

function WorkflowOutputCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-border/80 bg-white/94 p-5 shadow-[0_28px_72px_-42px_rgba(15,23,42,0.24)]">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <SearchIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Answer</p>
          <p className="mt-1 text-[0.92rem] font-semibold leading-6 text-foreground">Grounded result with evidence</p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-border bg-background/82 px-4 py-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Query</p>
        <p className="mt-1.5 text-[0.84rem] font-medium text-foreground">What changed after the postmortem?</p>
      </div>

      <div className="relative mt-3.5 rounded-[22px] border border-primary/15 bg-accent/45 px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Answer</p>
        <p className="mt-2 text-[0.84rem] leading-6 text-slate-700">Rollback checks were added, ADR-024 was linked to the postmortem, and both records now surface together.</p>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {["Postmortem", "ADR-024", "Ops checklist"].map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[11px] text-muted-foreground">
              <LibraryIcon className="h-3 w-3" />{tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3.5 grid gap-2">
        {WORKFLOW_OUTCOMES.map((item) => (
          <div key={item.title} className="rounded-[16px] border border-border bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[0.76rem] font-semibold text-foreground">{item.title}</p>
            <p className="mt-0.5 text-[0.72rem] leading-5 text-muted-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
