import { useCallback, useEffect, useRef, useState } from "react";

import { ToastContext } from "../context/ToastContext";

const ICONS = {
  success: (
    <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4 shrink-0 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
    </svg>
  ),
};

function ToastItem({ id, type = "info", message, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(show);
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(() => onDismiss(id), 250);
  }

  return (
    <div
      className={`flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.18)] transition-all duration-250 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      {ICONS[type]}
      <p className="flex-1 text-sm font-medium text-foreground leading-snug">{message}</p>
      <button
        type="button"
        onClick={dismiss}
        className="ml-1 -mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ type = "info", message, duration = 4000 }) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

