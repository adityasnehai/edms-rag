import { useEffect, useState } from "react";

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

const INPUT_CLASS = `
  mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground
  outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10
`;

const AUTH_INPUT_CLASS = `
  mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground
  outline-none transition focus:border-primary/30 focus:ring-4 focus:ring-primary/10
`;

const FEATURES = [
  {
    title: "Evidence-backed search",
    body: "Find the right answer quickly, with the source attached to every result.",
    Icon: SearchIcon,
  },
  {
    title: "Persistent team chat",
    body: "Keep follow-up questions in the same context instead of starting over each time.",
    Icon: ChatIcon,
  },
  {
    title: "Invite-based access",
    body: "Admins create the workspace, share invite codes, and control who can join.",
    Icon: ShieldIcon,
  },
  {
    title: "Automatic indexing",
    body: "New uploads are processed automatically so the latest records stay searchable.",
    Icon: UploadIcon,
  },
];

const TRUST_ITEMS = [
  "Engineering",
  "Platform",
  "Operations",
  "Security",
  "Product",
  "Support",
];

const WORKFLOW_INPUTS = [
  {
    title: "ADRs",
    caption: "Architecture decisions",
    Icon: LibraryIcon,
    cardClass:
      "border-violet-200/75 bg-[rgba(246,241,255,0.96)] text-violet-950",
    iconClass: "bg-violet-700 text-white",
  },
  {
    title: "RFCs",
    caption: "Change proposals",
    Icon: FolderIcon,
    cardClass:
      "border-sky-200/75 bg-[rgba(238,247,255,0.97)] text-sky-950",
    iconClass: "bg-sky-700 text-white",
  },
  {
    title: "Meeting Notes",
    caption: "Team context",
    Icon: DocumentIcon,
    cardClass:
      "border-emerald-200/75 bg-[rgba(238,250,246,0.98)] text-emerald-950",
    iconClass: "bg-emerald-700 text-white",
  },
  {
    title: "Images",
    caption: "Diagrams",
    Icon: ImageIcon,
    cardClass:
      "border-amber-200/75 bg-[rgba(255,247,236,0.97)] text-amber-950",
    iconClass: "bg-amber-600 text-white",
  },
  {
    title: "Incident Reviews",
    caption: "Postmortems",
    Icon: ChatIcon,
    cardClass:
      "border-rose-200/75 bg-[rgba(255,241,244,0.97)] text-rose-950",
    iconClass: "bg-rose-600 text-white",
  },
  {
    title: "Docs",
    caption: "Policies and guides",
    Icon: CopyIcon,
    cardClass:
      "border-indigo-200/75 bg-[rgba(238,242,255,0.97)] text-indigo-950",
    iconClass: "bg-indigo-700 text-white",
  },
];

const WORKFLOW_ENGINE_STEPS = [
  {
    title: "Extract",
    caption: "Text + metadata",
    Icon: DocumentIcon,
  },
  {
    title: "Chunk",
    caption: "Retrieval units",
    Icon: FolderIcon,
  },
  {
    title: "Indexing",
    caption: "Search index",
    Icon: RotateIcon,
  },
  {
    title: "Retriever",
    caption: "Best matches",
    Icon: SearchIcon,
  },
];

const WORKFLOW_OUTCOMES = [
  {
    title: "Grounded answers",
    value: "Answers include linked evidence",
  },
  {
    title: "Persistent chat",
    value: "Follow-ups keep previous context",
  },
  {
    title: "Workspace isolation",
    value: "Search stays inside the correct workspace",
  },
];

const FAQS = [
  {
    question: "How are companies separated in EDMS?",
    answer:
      "Each admin creates a workspace for their company, and users join with the invite code tied to that workspace. Search, chat, uploads, and evidence stay inside that company workspace.",
  },
  {
    question: "Who can create invite codes?",
    answer:
      "Admins create and rotate invite codes. Users cannot create separate company workspaces.",
  },
  {
    question: "What happens after an upload?",
    answer:
      "Files stay inside the admin's workspace and indexing runs automatically so the new evidence becomes searchable right away.",
  },
];

const HERO_TEAMS = ["EN", "OP", "PD", "SC"];

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

  const isRegister = mode === "register";
  const isAdminSignup = isRegister && accountType === "admin";
  const isUserSignup = isRegister && accountType === "user";

  useEffect(() => {
    const overlayActive = authOpen || Boolean(signupResult);
    const previousOverflow = document.body.style.overflow;

    if (overlayActive) {
      document.body.style.overflow = "hidden";
    }

    function handleEscape(event) {
      if (event.key === "Escape" && authOpen) {
        setAuthOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [authOpen, signupResult]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setInviteCode("");
    setOrganizationName("");
    setCopyStatus("");
    setShowPassword(false);
  }

  function openAuth(nextMode) {
    switchMode(nextMode);
    setAuthOpen(true);
  }

  function closeAuth() {
    setAuthOpen(false);
    setError("");
    setShowPassword(false);
  }

  async function copyInviteCode() {
    if (!signupResult?.inviteCode) return;

    try {
      await navigator.clipboard.writeText(signupResult.inviteCode);
      setCopyStatus("Invite code copied.");
    } catch {
      setCopyStatus("Copy failed. Select and copy the code manually.");
    }
  }

  function finishAdminSignup() {
    setSignupResult(null);
    setCopyStatus("");
    window.location.href = "/dashboard";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedOrganizationName = organizationName.trim();
    const trimmedInviteCode = inviteCode.trim().toUpperCase();

    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    if (!trimmedPassword) {
      setError("Password is required.");
      return;
    }

    if (isAdminSignup && !trimmedOrganizationName) {
      setError("Company name is required for admin signup.");
      return;
    }

    if (isUserSignup && !trimmedInviteCode) {
      setError("Invite code is required for user signup.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

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
        setAuthOpen(false);
        setSignupResult({
          inviteCode: data.invite_code,
          organizationName: data.organization_name || trimmedOrganizationName,
        });
        setCopyStatus("");
        return;
      }

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message || "Unable to complete authentication.");
      clearSession();
    } finally {
      setLoading(false);
    }
  }

  const authTitle = isRegister
    ? accountType === "admin"
      ? "Create a company workspace"
      : "Join an existing workspace"
    : "Sign in to your workspace";

  const authDescription = isRegister
    ? accountType === "admin"
      ? "Create your company workspace and receive the invite code."
      : "Use the invite code from your admin to join the right workspace."
    : "Use your saved email and password to continue.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {signupResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[34px] border border-border bg-card p-6 shadow-[0_32px_120px_-35px_rgba(51,65,85,0.45)]">
            <div className="flex items-center gap-3">
              <LogoMark className="h-12 w-12" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-primary">
                  Workspace Created
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  Share the invite code
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              Send this code to users so they can join{" "}
              <span className="font-semibold text-foreground">
                {signupResult.organizationName}
              </span>{" "}
              without creating another workspace.
            </p>

            <div className="mt-5 rounded-[28px] border border-primary/15 bg-accent px-5 py-6 text-center">
              <p className="text-3xl font-semibold tracking-[0.3em] text-primary">
                {signupResult.inviteCode}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copyInviteCode}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-95"
              >
                <CopyIcon className="h-4 w-4" />
                Copy Code
              </button>
              <button
                type="button"
                onClick={finishAdminSignup}
                className="flex-1 rounded-2xl border border-border bg-card px-4 py-3 font-semibold text-foreground shadow-card transition hover:bg-secondary"
              >
                Continue
              </button>
            </div>

            {copyStatus ? (
              <p className="mt-3 text-sm text-success">{copyStatus}</p>
            ) : null}
          </div>
        </div>
      )}

      {authOpen && (
        <div
          className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeAuth();
            }
          }}
        >
          <div className="mx-auto flex min-h-screen items-center justify-center px-3 py-3 sm:px-4 sm:py-5">
            <div className="w-full max-w-[540px] max-h-[calc(100vh-1.5rem)] overflow-y-auto overscroll-contain rounded-[28px] border border-border bg-card shadow-[0_18px_40px_-24px_rgba(15,23,42,0.3)] sm:max-h-[calc(100vh-2rem)]">
              <div className="sticky top-0 z-10 border-b border-border bg-card px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <LogoMark className="h-10 w-10" />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
                        {isRegister
                          ? accountType === "admin"
                            ? "Admin Signup"
                            : "User Signup"
                          : "Sign In"}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-[1.55rem]">
                        {authTitle}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeAuth}
                    className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    Close
                  </button>
                </div>

                <p className="mt-3 max-w-[420px] text-sm leading-5 text-muted-foreground">
                  {authDescription}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      !isRegister
                        ? "bg-background text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      isRegister
                        ? "bg-background text-foreground shadow-card"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {isRegister ? (
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountType("admin");
                        setError("");
                        setInviteCode("");
                      }}
                      className={`rounded-[20px] border px-4 py-3 text-left transition ${
                        accountType === "admin"
                          ? "border-primary/20 bg-secondary text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-semibold">Admin</span>
                      <span className="mt-1 block text-[11px] leading-4.5 opacity-80">
                        Creates the company workspace.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountType("user");
                        setError("");
                        setOrganizationName("");
                      }}
                      className={`rounded-[20px] border px-4 py-3 text-left transition ${
                        accountType === "user"
                          ? "border-primary/20 bg-secondary text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-semibold">User</span>
                      <span className="mt-1 block text-[11px] leading-4.5 opacity-80">
                        Joins with the invite code.
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="px-4 py-4 sm:px-5">
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {isAdminSignup ? (
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        required
                        placeholder="Enter company name"
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>
                  ) : null}

                  {isUserSignup ? (
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                        required
                        placeholder="ABCD-1234"
                        className={`${AUTH_INPUT_CLASS} uppercase tracking-[0.18em]`}
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      placeholder="Enter email address"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name={isRegister ? "new-password" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={6}
                        autoComplete={isRegister ? "new-password" : "current-password"}
                        placeholder="Enter password"
                        className={`${AUTH_INPUT_CLASS} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute inset-y-0 right-4 flex items-center text-muted-foreground transition hover:text-primary"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? (
                          <EyeOffIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isRegister ? (
                    <div>
                      <label className="text-sm font-medium text-foreground">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirm-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      loading
                        ? "cursor-not-allowed bg-primary/55 text-primary-foreground"
                        : "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
                    }`}
                  >
                    {loading
                      ? isRegister
                        ? "Creating account..."
                        : "Authenticating..."
                      : isRegister
                        ? isAdminSignup
                          ? "Create Workspace"
                          : "Join Workspace"
                        : "Continue"}
                  </button>

                  {error ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3 text-left"
          >
            <LogoMark className="h-11 w-11" />
            <div>
              <p className="text-sm font-semibold text-foreground">EDMS</p>
              <p className="text-xs text-muted-foreground">
                Evidence-backed company search
              </p>
            </div>
          </button>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition hover:text-foreground">
              Features
            </a>
            <a href="#how" className="text-sm text-muted-foreground transition hover:text-foreground">
              How it works
            </a>
            <a href="#faq" className="text-sm text-muted-foreground transition hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="hidden rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
            >
              Create Workspace
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-mesh opacity-90" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />

          <div className="container relative pt-8 pb-24 md:pt-10 md:pb-28">
            <div className="relative mx-auto max-w-7xl">
              <HeroFloatingCards>
                <div className="relative mx-auto max-w-[760px] px-4 pt-3 text-center animate-fade-up md:pt-4 xl:max-w-[800px]">
                  <HeroAmbientGlow />

                  <div className="inline-flex max-w-full items-center rounded-full border border-border/80 bg-white/80 p-[3px] shadow-[0_14px_32px_-24px_rgba(15,23,42,0.24)] backdrop-blur">
                    <span className="rounded-full bg-slate-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white sm:text-[0.69rem]">
                      Company Records Search
                    </span>
                    <span className="flex items-center gap-2 px-3.5 py-2 text-[0.72rem] font-medium text-muted-foreground sm:px-4 sm:text-[0.78rem]">
                      Answers with evidence
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <h1 className="mx-auto mt-6 max-w-[720px] text-[2.9rem] font-semibold leading-[0.97] tracking-[-0.045em] sm:text-[3.35rem] md:text-[3.7rem] xl:text-[4rem]">
                    Search company records
                    <br />
                    <span className="text-gradient">with linked evidence</span>
                  </h1>

                  <p className="mx-auto mt-5 max-w-[46rem] text-lg leading-relaxed text-muted-foreground md:text-[1.08rem]">
                    Bring ADRs, RFCs, meeting notes, incident reviews, and images into one
                    secure workspace. EDMS returns grounded answers, keeps chat context,
                    and keeps access scoped to the correct workspace.
                  </p>

                  <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => openAuth("register")}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-[0.95rem] font-semibold text-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.5)] transition hover:bg-slate-800"
                    >
                      Create workspace
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                    <a
                      href="#how"
                      className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/70 px-6 text-[0.95rem] font-semibold text-foreground backdrop-blur transition hover:bg-secondary"
                    >
                      See how it works
                    </a>
                  </div>

                  <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                    <div className="flex -space-x-3">
                      {HERO_TEAMS.map((team, index) => (
                        <div
                          key={team}
                          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-background text-xs font-semibold shadow-sm ${
                            index === 0
                              ? "bg-sky-100 text-sky-700"
                              : index === 1
                                ? "bg-emerald-100 text-emerald-700"
                                : index === 2
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {team}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <SparkleIcon key={index} className="h-4 w-4" />
                      ))}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Built for engineering, product, and operations teams
                    </p>
                  </div>
                </div>
              </HeroFloatingCards>

              <HeroRagVisual />
            </div>
          </div>
        </section>

        <TrustBar />

        <section id="features" className="py-24 md:py-32">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">Features</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Everything needed to make company records searchable.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Upload records once. EDMS handles indexing, evidence, access control,
                and follow-up chat in the same workspace.
              </p>
            </div>

            <div className="mt-16 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {FEATURES.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  title={feature.title}
                  body={feature.body}
                  Icon={feature.Icon}
                  delay={index * 60}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="relative border-y border-border bg-gradient-soft py-24 md:py-32">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium text-primary">How it works</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                How records become evidence-backed answers.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Upload ADRs, RFCs, meeting notes, incident reviews, and images. EDMS
                extracts the content, updates indexing automatically, and retrieves
                answers inside the correct company workspace.
              </p>
            </div>

            <WorkflowDiagram />
          </div>
        </section>

        <section id="faq" className="py-24 md:py-32">
          <div className="container max-w-3xl">
            <div className="text-center">
              <p className="text-sm font-medium text-primary">FAQ</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                Common questions.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Clear answers on access, workspace separation, and how uploads become searchable.
              </p>
            </div>

            <div className="mt-12 space-y-3">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
                >
                  <summary className="cursor-pointer list-none text-base font-semibold text-foreground">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <CTASection openAuth={openAuth} />
      </main>

      <footer className="border-t border-border bg-background">
        <div className="container grid gap-8 py-12 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10" />
              <div>
                <p className="text-sm font-semibold text-foreground">EDMS</p>
                <p className="text-xs text-muted-foreground">
                  Evidence-backed company search
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Search company records with evidence, persistent chat, and invite-based access.
            </p>
          </div>

          {[
            {
              title: "Product",
              links: [
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how" },
                { label: "FAQ", href: "#faq" },
              ],
            },
            {
              title: "Access",
              links: [
                { label: "Sign in", action: () => openAuth("login") },
                { label: "Create workspace", action: () => openAuth("register") },
              ],
            },
            {
              title: "Platform",
              links: [
                { label: "Invite-based access", href: "#faq" },
                { label: "Evidence-backed search", href: "#features" },
              ],
            },
          ].map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold text-foreground">{column.title}</h4>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"href" in link ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={link.action}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border">
          <div className="container flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} EDMS. All rights reserved.</span>
            <span>Workspace-scoped search, evidence, and chat.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LogoMark({ className = "h-11 w-11" }) {
  return (
    <div className={`relative rounded-[22px] bg-gradient-primary shadow-glow ${className}`.trim()}>
      <span className="absolute left-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-white/90" />
      <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-white/65" />
      <span className="absolute left-2.5 bottom-2.5 h-2.5 w-2.5 rounded-full bg-white/65" />
      <span className="absolute right-2.5 bottom-2.5 h-2.5 w-2.5 rounded-full bg-white/90" />
      <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      <span className="absolute left-[10px] right-[10px] top-1/2 h-px -translate-y-1/2 bg-white/55" />
      <span className="absolute top-[10px] bottom-[10px] left-1/2 w-px -translate-x-1/2 bg-white/35" />
    </div>
  );
}

function HeroAmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[280px] md:block" aria-hidden>
      <div className="absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-pulse-soft" />
      <div className="absolute left-[10%] top-12 h-28 w-28 rounded-full bg-sky-200/40 blur-3xl animate-float-slow" />
      <div className="absolute right-[12%] top-16 h-24 w-24 rounded-full bg-emerald-200/35 blur-3xl animate-float-delay" />
    </div>
  );
}

function HeroFloatingCards({ children }) {
  const floatingCards = [
    {
      title: "ADRs & RFCs",
      meta: "Decisions and change proposals",
      Icon: LibraryIcon,
      side: "left",
      className:
        "w-[142px] -rotate-[8deg] border-violet-200/75 bg-[rgba(246,241,255,0.96)] text-violet-950 animate-float-slow xl:mr-2",
      iconWrapClass: "bg-violet-700 text-white shadow-[0_10px_24px_-14px_rgba(109,40,217,0.8)]",
    },
    {
      title: "Meeting Notes",
      meta: "Decisions, handoffs, and context",
      Icon: DocumentIcon,
      side: "right",
      className:
        "w-[142px] rotate-[8deg] border-sky-200/75 bg-[rgba(238,247,255,0.97)] text-sky-950 animate-float-delay xl:ml-2",
      iconWrapClass: "bg-sky-700 text-white shadow-[0_10px_24px_-14px_rgba(3,105,161,0.78)]",
    },
    {
      title: "Incident Reviews",
      meta: "Postmortems, fixes, and learnings",
      Icon: ChatIcon,
      side: "left",
      className:
        "mt-12 w-[150px] -rotate-[6deg] border-orange-200/75 bg-[rgba(255,243,236,0.97)] text-orange-950 animate-float-fast xl:mr-8",
      iconWrapClass: "bg-orange-600 text-white shadow-[0_10px_24px_-14px_rgba(234,88,12,0.78)]",
    },
    {
      title: "Invite-Based Access",
      meta: "Scoped search for each workspace",
      Icon: ShieldIcon,
      side: "right",
      className:
        "mt-14 w-[150px] rotate-[6deg] border-emerald-200/75 bg-[rgba(238,250,246,0.98)] text-emerald-950 animate-float-delay xl:ml-8",
      iconWrapClass: "bg-emerald-700 text-white shadow-[0_10px_24px_-14px_rgba(4,120,87,0.78)]",
    },
  ];

  const leftCards = floatingCards.filter((card) => card.side === "left");
  const rightCards = floatingCards.filter((card) => card.side === "right");

  return (
    <>
      <div className="lg:hidden">{children}</div>

      <div className="hidden lg:grid lg:grid-cols-[160px_minmax(0,1fr)_160px] lg:items-start lg:gap-7 xl:grid-cols-[180px_minmax(0,1fr)_180px] xl:gap-10">
        <div className="pointer-events-none flex flex-col items-end pt-4" aria-hidden>
          {leftCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-[24px] border px-3.5 py-3.5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] ${card.className}`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${card.iconWrapClass}`}>
                <card.Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 text-[0.9rem] font-semibold leading-5">{card.title}</p>
              <p className="mt-1.5 text-[0.78rem] font-medium leading-5 opacity-80">{card.meta}</p>
            </div>
          ))}
        </div>

        <div className="min-w-0">{children}</div>

        <div className="pointer-events-none flex flex-col items-start pt-5" aria-hidden>
          {rightCards.map((card) => (
            <div
              key={card.title}
              className={`rounded-[24px] border px-3.5 py-3.5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.22)] ${card.className}`}
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${card.iconWrapClass}`}>
                <card.Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 text-[0.9rem] font-semibold leading-5">{card.title}</p>
              <p className="mt-1.5 text-[0.78rem] font-medium leading-5 opacity-80">{card.meta}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function HeroRagVisual() {
  return (
    <div className="relative mx-auto mt-8 max-w-6xl px-4 md:mt-12" aria-hidden>
      <div className="mx-auto w-full max-w-[860px]">
        <HeroPreview />
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card/90 shadow-[0_36px_90px_-42px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border bg-background/85 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 text-xs font-medium text-muted-foreground">
          edms.app/search
        </span>
      </div>

      <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="border-b border-border bg-secondary/55 p-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Recent searches
          </p>

          <div className="mt-4 space-y-2">
            {[
              "Incident review",
              "ADR rollout policy",
              "Deployment notes",
            ].map((item, index) => (
              <div
                key={item}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  index === 0
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <ChatIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Workspace Scope
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Invite-based access
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Search, chat, and evidence stay inside the same workspace.
            </p>
          </div>
        </div>

        <div className="bg-[linear-gradient(180deg,rgba(249,250,255,0.88),rgba(255,255,255,0.98))] p-5">
          <div className="rounded-[24px] border border-border bg-background/90 p-4 shadow-sm">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
              <SearchIcon className="h-4 w-4 text-primary" />
              <span className="text-sm text-foreground">
                What changed after the incident review?
              </span>
              <span className="ml-auto hidden rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-primary sm:inline-flex">
                Search
              </span>
            </div>

            <div className="relative mt-4 rounded-[22px] border border-primary/15 bg-accent/50 px-4 py-4">
              <div
                className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(99,102,241,0),rgba(99,102,241,0.75),rgba(99,102,241,0))] bg-[length:200%_100%] animate-line-flow"
                aria-hidden
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Grounded answer
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                Release ownership and rollback checks were standardized, and the remediation ADR was linked directly to the incident notes for future retrieval.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {["ADR-024", "Incident review"].map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground"
                  >
                    <LibraryIcon className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                { label: "Isolation", value: "Workspace only" },
                { label: "Evidence", value: "Sources linked" },
                { label: "Chat", value: "Context saved" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[18px] border border-border bg-card px-3 py-3 shadow-sm"
                >
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustBar() {
  return (
    <section className="border-y border-border bg-background">
      <div className="container py-10">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
          Built for teams managing decisions, docs, and evidence
        </p>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3 md:grid-cols-6">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item}
              className="flex items-center justify-center text-base font-semibold tracking-tight text-muted-foreground/60"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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
            <SparkleIcon className="h-3.5 w-3.5 text-primary" />
            How EDMS processes each upload
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-[0.98rem]">
            ADRs, RFCs, meeting notes, incident reviews, images, and docs are
            extracted, indexed, and retrieved inside the correct company workspace.
          </p>
        </div>

        <div className="mt-8 lg:hidden">
          <div className="grid grid-cols-2 gap-3">
            {WORKFLOW_INPUTS.map((item, index) => (
              <WorkflowSourceChip key={item.title} {...item} delay={index * 70} />
            ))}
          </div>

          <div className="mt-5 px-6">
            <WorkflowFlowLine />
          </div>

          <div className="mt-5">
            <WorkflowSystemCard />
          </div>

          <div className="mt-5 px-6">
            <WorkflowFlowLine delay={0.8} />
          </div>

          <div className="mt-5">
            <WorkflowOutputCard />
          </div>
        </div>

        <div className="mt-10 hidden lg:grid lg:grid-cols-[220px_84px_minmax(0,1fr)_84px_270px] lg:items-center lg:gap-4">
          <div className="space-y-3">
            {WORKFLOW_INPUTS.map((item, index) => (
              <WorkflowSourceChip key={item.title} {...item} delay={index * 80} />
            ))}
          </div>

          <div className="space-y-3">
            {WORKFLOW_INPUTS.map((item, index) => (
              <div key={item.title} className="flex h-[70px] items-center">
                <WorkflowFlowLine delay={index * 0.22} />
              </div>
            ))}
          </div>

          <WorkflowSystemCard />

          <div className="flex items-center">
            <WorkflowFlowLine delay={1} />
          </div>

          <WorkflowOutputCard />
        </div>
      </div>
    </div>
  );
}

function WorkflowSourceChip(props) {
  const { title, caption, cardClass, iconClass, delay = 0 } = props;

  return (
    <div
      className={`animate-fade-up flex h-[70px] items-center gap-3 rounded-[22px] border px-3.5 py-3 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.18)] ${cardClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconClass}`}>
        <props.Icon className="h-4 w-4" />
      </div>

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
      <div
        className="absolute inset-y-0 left-0 flex w-full items-center animate-flow-dot"
        style={{ animationDelay: `${delay}s` }}
      >
        <span className="block h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_6px_rgba(99,102,241,0.14)]" />
      </div>
    </div>
  );
}

function WorkflowSystemCard() {
  const [extractStep, chunkStep, indexingStep, retrieverStep] = WORKFLOW_ENGINE_STEPS;

  return (
    <div className="overflow-hidden rounded-[30px] border border-border/80 bg-white/94 p-4 shadow-[0_28px_72px_-42px_rgba(15,23,42,0.26)] lg:p-5">
      <div className="flex items-start gap-4">
        <div className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[20px] border border-border bg-white shadow-sm">
          <div className="absolute inset-0 rounded-[20px] bg-gradient-primary opacity-10" />
          <div className="relative rounded-[16px]">
            <LogoMark className="h-10 w-10" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Processing Pipeline
          </p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-foreground lg:text-xl">
            Extraction, indexing, and retrieval.
          </h3>
          <p className="mt-1.5 text-[0.82rem] leading-5 text-muted-foreground lg:text-sm lg:leading-6">
            After each admin upload, EDMS extracts content, builds retrieval-ready
            chunks, refreshes indexing, and returns the best evidence in the same
            workspace.
          </p>
        </div>
      </div>

      <div className="relative mt-4 rounded-[24px] border border-border bg-[linear-gradient(180deg,rgba(249,250,255,0.92),rgba(255,255,255,0.98))] p-3.5 lg:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-3">
          <WorkflowStepCard {...extractStep} />
          <div className="flex items-center justify-center text-primary" aria-hidden>
            <ArrowRightIcon className="h-4 w-4" />
          </div>
          <WorkflowStepCard {...chunkStep} />

          <div />
          <div />
          <div className="flex items-center justify-center text-primary" aria-hidden>
            <ArrowRightIcon className="h-4 w-4 rotate-90" />
          </div>

          <WorkflowStepCard {...retrieverStep} />
          <div className="flex items-center justify-center text-primary" aria-hidden>
            <ArrowRightIcon className="h-4 w-4 rotate-180" />
          </div>
          <WorkflowStepCard {...indexingStep} />
        </div>
      </div>

      <div className="mt-3.5 rounded-[18px] border border-primary/15 bg-accent/55 px-4 py-3.5">
        <p className="text-[0.78rem] font-semibold text-foreground">
          Every upload triggers processing, indexing refresh, and workspace-scoped retrieval.
        </p>
      </div>
    </div>
  );
}

function WorkflowStepCard(props) {
  const { title, caption } = props;

  return (
    <div className="rounded-[18px] border border-border bg-white px-2.5 py-3 text-center shadow-sm">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
        <props.Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2.5 text-[0.79rem] font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[0.69rem] leading-4 text-muted-foreground">{caption}</p>
    </div>
  );
}

function WorkflowOutputCard() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-border/80 bg-white/94 p-5 shadow-[0_28px_72px_-42px_rgba(15,23,42,0.24)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <SearchIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Search Result
          </p>
          <p className="text-sm font-semibold text-foreground">
            Grounded answer with linked evidence
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-border bg-background/82 px-4 py-3">
        <p className="text-[0.82rem] font-medium text-foreground">
          Query: What changed after the incident review?
        </p>
      </div>

      <div className="relative mt-4 rounded-[22px] border border-primary/15 bg-accent/45 px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Answer
        </p>
        <p className="mt-2 text-[0.86rem] leading-6 text-slate-700">
          Rollback checks were added to the operations checklist, the remediation ADR
          was linked to the incident review, and retrieval now surfaces both records
          together.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {["Incident review", "ADR-024", "Ops checklist"].map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-[11px] text-muted-foreground"
            >
              <LibraryIcon className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {WORKFLOW_OUTCOMES.map((item) => (
          <div
            key={item.title}
            className="rounded-[18px] border border-border bg-white px-3 py-3 shadow-sm"
          >
            <p className="text-[0.79rem] font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-[0.75rem] leading-5 text-muted-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CTASection({ openAuth }) {
  return (
    <section className="py-24 md:py-32">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-10 text-center shadow-glow md:p-16">
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: "radial-gradient(circle at 30% 0%, white, transparent 50%)" }}
            aria-hidden
          />

          <h2 className="relative text-3xl font-semibold tracking-tight text-primary-foreground md:text-5xl">
            Make company records searchable in one secure workspace.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Create the workspace, invite your team, upload records, and start answering
            questions with linked evidence.
          </p>

          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-foreground transition hover:bg-white/95"
            >
              Create workspace
              <ArrowRightIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold text-primary-foreground transition hover:bg-white/10"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard(props) {
  const { title, body, delay } = props;

  return (
    <div
      className="group relative h-full rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
        <props.Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
