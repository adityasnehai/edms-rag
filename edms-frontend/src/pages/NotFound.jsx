import { useNavigate } from "react-router-dom";
import usePageTitle from "../hooks/usePageTitle";
import { getAuthPayload } from "../utils/auth";

export default function NotFound() {
  usePageTitle("Page Not Found");
  const navigate = useNavigate();
  const payload = getAuthPayload();

  function goHome() {
    if (payload) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center overflow-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-dot-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,143,24,0.14),transparent_55%)]" />
      </div>

      <div className="relative">
        <p className="text-[7rem] font-bold leading-none tracking-tighter text-primary/10 select-none">
          404
        </p>
        <div className="-mt-8 flex h-20 w-20 mx-auto items-center justify-center rounded-3xl border border-border bg-card shadow-card">
          <svg className="h-9 w-9 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <button
          type="button"
          onClick={goHome}
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-6 py-2.5 text-sm font-semibold text-[#251f19] shadow-sm transition hover:border-[#f48d16]/35 hover:bg-[#ffeed2]"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
