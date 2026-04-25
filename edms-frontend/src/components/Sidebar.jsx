import { useNavigate, useLocation } from "react-router-dom";
import useRecentSearches from "../hooks/useRecentSearches";
import { logoutSession } from "../api/auth";
import { clearSession, getAuthPayload, getRefreshToken } from "../utils/auth";
import {
  BuildingIcon,
  ChartIcon,
  ChatIcon,
  LibraryIcon,
  LogoutIcon,
  SearchIcon,
  ShieldIcon,
  UploadIcon,
} from "./AppIcons";

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { recent, clearRecent } = useRecentSearches();

  const payload = getAuthPayload();
  const adminUser = payload?.role === "admin";

  async function logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await logoutSession(refreshToken);
      } catch (error) {
        void error;
      }
    }
    clearSession();
    navigate("/", { replace: true });
  }

  function isActive(path) {
    return location.pathname === path;
  }

  const primaryItems = [
    { path: "/dashboard", label: "Search", Icon: SearchIcon },
    { path: "/chat", label: "Chat", Icon: ChatIcon },
    { path: "/evidence", label: "Evidence", Icon: LibraryIcon },
  ];

  const adminItems = [
    { path: "/admin/access", label: "Company Access", Icon: BuildingIcon },
    { path: "/admin", label: "Upload Data", Icon: UploadIcon },
    { path: "/admin/eval", label: "Evaluation", Icon: ChartIcon },
  ];

  function navButtonClass(active) {
    return [
      "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition",
      active
        ? "border-primary/20 bg-accent text-accent-foreground shadow-sm"
        : "border-transparent text-sidebar-foreground hover:border-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    ].join(" ");
  }

  return (
    <aside className="w-full shrink-0 border-b border-sidebar-border bg-sidebar lg:flex lg:min-h-screen lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <ShieldIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">EDMS</p>
            <p className="text-xs text-muted-foreground">Enterprise memory</p>
          </div>
        </button>

        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {adminUser ? "Admin" : "User"}
        </span>
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Workspace
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {payload?.org_name || "Enterprise Decision Memory"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {payload?.sub || "workspace@edms.ai"}
          </p>
        </div>
      </div>

      <div className="px-3 py-4">
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {primaryItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={navButtonClass(isActive(item.path))}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {adminUser && (
        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Admin Tools
          </p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {adminItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={navButtonClass(isActive(item.path))}
              >
                <item.Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="hidden border-t border-sidebar-border px-4 py-4 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Recent Searches
            </span>
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs text-muted-foreground transition hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="space-y-2">
            {recent.map((entry, i) => (
              <button
                key={`${entry.query}-${i}`}
                type="button"
                onClick={() =>
                  navigate(`/dashboard?query=${encodeURIComponent(entry.query)}`)
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-sidebar-foreground shadow-sm transition hover:border-primary/20 hover:bg-accent hover:text-accent-foreground"
              >
                <div className="truncate">{entry.query}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-sidebar-border p-4">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-card transition hover:border-destructive/20 hover:text-destructive"
        >
          <LogoutIcon className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
