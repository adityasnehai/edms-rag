import { useEffect, useState } from "react";

import Sidebar from "./Sidebar";
import { SidebarExpandIcon } from "./AppIcons";

const SIDEBAR_HIDDEN_KEY = "edms:sidebar-hidden";

export default function WorkspaceShell({ children, mainClassName = "" }) {
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SIDEBAR_HIDDEN_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_HIDDEN_KEY, sidebarHidden ? "1" : "0");
  }, [sidebarHidden]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-foreground lg:flex-row">
      {!sidebarHidden && <Sidebar onHide={() => setSidebarHidden(true)} />}
      {sidebarHidden && (
        <button
          type="button"
          onClick={() => setSidebarHidden(false)}
          className="fixed left-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-white/95 text-primary shadow-lg shadow-slate-900/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent"
          aria-label="Show sidebar"
          title="Show sidebar"
        >
          <SidebarExpandIcon className="h-5 w-5" />
        </button>
      )}
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.98))]" />
          <div className="absolute inset-0 bg-dot-grid opacity-35" />
        </div>
        <main className={`relative z-10 min-w-0 ${mainClassName}`.trim()}>{children}</main>
      </div>
    </div>
  );
}
