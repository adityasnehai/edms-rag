import { useState } from "react";
import { SendIcon } from "./AppIcons";

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-background/95 px-4 py-4 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-4xl items-end gap-3 rounded-[24px] border border-border bg-card px-3 py-3 shadow-card">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Ask about ADRs, RFCs, notes, postmortems, tickets, or diagrams..."
          disabled={disabled}
          className="h-12 flex-1 rounded-2xl border-0 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
        />

        <button
          type="submit"
          disabled={disabled}
          className={[
            "inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground transition",
            disabled
              ? "bg-primary/55 cursor-not-allowed"
              : "bg-gradient-primary shadow-glow hover:opacity-95",
          ].join(" ")}
          aria-label="Send message"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
