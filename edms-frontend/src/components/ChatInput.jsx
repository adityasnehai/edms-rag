import { useState } from "react";
import { SendIcon } from "./AppIcons";

export default function ChatInput({ onSend, disabled, embedded = false }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  }

  const canSend = text.trim().length > 0 && !disabled;
  const form = (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl items-end gap-3">
      <div
        className={`flex flex-1 items-end gap-3 rounded-2xl border bg-background px-4 py-3 transition-all ${
          disabled
            ? "border-border opacity-60"
            : "border-border shadow-sm focus-within:border-primary/30 focus-within:ring-2 focus-within:ring-primary/10"
        }`}
      >
        <textarea
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask about ADRs, RFCs, notes, postmortems, tickets, or diagrams…"
          disabled={disabled}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none border-0 bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        />
      </div>

      <button
        type="submit"
        disabled={!canSend}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
          canSend
            ? "bg-gradient-primary text-white shadow-glow hover:opacity-95"
            : "bg-secondary text-muted-foreground cursor-not-allowed"
        }`}
        aria-label="Send message"
      >
        <SendIcon className="h-4 w-4" />
      </button>
    </form>
  );

  if (embedded) {
    return (
      <div className="border-t border-border bg-white/85 px-4 py-4">
        {form}
        <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-white/90 backdrop-blur-xl px-4 py-4">
      {form}
      <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
