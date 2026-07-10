import { useNavigate, useLocation } from "react-router-dom";
import useRecentSearches from "../hooks/useRecentSearches";
import { logoutSession } from "../api/auth";
import { clearSession, getAuthPayload, getRefreshToken } from "../utils/auth";
import { Logo } from "../memostack/components/logo";
import {
  BuildingIcon,
  ChatIcon,
  FolderIcon,
  LibraryIcon,
  LogoutIcon,
  SearchIcon,
  SidebarCollapseIcon,
  UploadIcon,
} from "./AppIcons";

export default function Sidebar({ onHide }) {
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
      } catch {
        /* ignore */
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
    { path: "/admin/data", label: "Data Manager", Icon: FolderIcon },
  ];

  function navButtonClass(active) {
    return [
      "group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all duration-150",
      active
        ? "border border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm"
        : "text-sidebar-foreground hover:bg-[#fff4e1] hover:text-foreground hover:shadow-sm",
    ].join(" ");
  }

  return (
    <aside className="relative z-20 w-full shrink-0 border-b border-sidebar-border bg-white/95 text-foreground shadow-[0_18px_60px_-42px_rgba(15,23,42,0.35)] backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-b-0 lg:border-r">
      {/* Header / Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-3 text-left"
        >
          <Logo className="size-9" />
          <div>
            <p className="font-heading text-base font-semibold tracking-normal text-foreground">MemoStack</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
              adminUser
                ? "border border-[#f48d16]/22 bg-[#fff4e1] text-[#a76311]"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {adminUser ? "Admin" : "User"}
          </span>
          <button
            type="button"
            onClick={onHide}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground transition hover:border-[#f48d16]/25 hover:bg-[#fff4e1] hover:text-primary"
            aria-label="Hide sidebar"
            title="Hide sidebar"
          >
            <SidebarCollapseIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Workspace / User card */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#f48d16]/20 bg-[#fff4e1]/75 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {payload?.org_name || "Enterprise Memory"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {payload?.sub || "workspace@memostack.ai"}
            </p>
          </div>
        </div>
      </div>

      {/* Primary navigation */}
      <div className="px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground/70">
          Navigation
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {primaryItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={navButtonClass(isActive(item.path))}
            >
              <item.Icon
                className={`h-4 w-4 shrink-0 ${isActive(item.path) ? "text-[#a76311]" : "text-muted-foreground group-hover:text-foreground"}`}
              />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Admin navigation */}
      {adminUser && (
        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground/70">
            Admin Tools
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
            {adminItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={navButtonClass(isActive(item.path))}
              >
                <item.Icon
                  className={`h-4 w-4 shrink-0 ${isActive(item.path) ? "text-[#a76311]" : "text-muted-foreground group-hover:text-foreground"}`}
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent searches */}
      {recent.length > 0 && (
        <div className="hidden border-t border-sidebar-border px-4 py-4 lg:block">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground/70">
              Recent
            </span>
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs text-muted-foreground transition hover:text-destructive"
            >
              Clear
            </button>
          </div>

          <div className="space-y-0.5">
            {recent.slice(0, 5).map((entry, i) => (
              <button
                key={`${entry.query}-${i}`}
                type="button"
                onClick={() =>
                  navigate(`/dashboard?query=${encodeURIComponent(entry.query)}`)
                }
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-secondary"
              >
                <SearchIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">{entry.query}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="mt-auto border-t border-sidebar-border p-4">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
        >
          <LogoutIcon className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
