import FormattedContent from "./FormattedContent";
import { SparkleIcon } from "./AppIcons";
import { sanitizeChatContent } from "../utils/chatSanitizer";

function TypingDots({ isUser }) {
  return (
    <span className="inline-flex items-center gap-1.5 py-1">
      {[0, 120, 240].map((delay) => (
        <span
          key={delay}
          className={[
            "h-2 w-2 rounded-full animate-pulse",
            isUser ? "bg-white/70" : "bg-primary/70",
          ].join(" ")}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

export default function ChatBubble({ role, text, isLoading = false }) {
  const isUser = role === "user";
  const content = sanitizeChatContent(text);

  if (!content && !isLoading) {
    return null;
  }

  return (
    <div className={`flex items-end gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-white shadow-glow">
          <SparkleIcon className="h-4 w-4" />
        </div>
      )}

      <div
        className={[
          "max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-gradient-primary text-white shadow-glow/40"
            : "rounded-bl-sm border border-border bg-white text-foreground shadow-sm",
        ].join(" ")}
      >
        <p
          className={[
            "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]",
            isUser ? "text-white/70" : "text-primary",
          ].join(" ")}
        >
          {isUser ? "You" : "EDMS"}
        </p>

        {content ? (
          <FormattedContent
            text={content}
            paragraphClassName={isUser ? "text-sm leading-7 text-white/95" : "text-sm leading-7 text-slate-700"}
            listClassName={isUser ? "space-y-1.5 pl-4 text-sm leading-7 text-white/95" : "space-y-1.5 pl-4 text-sm leading-7 text-slate-700"}
            headingClassName={isUser ? "text-white font-semibold" : "text-slate-900 font-semibold"}
            strongClassName={isUser ? "text-white font-semibold" : "text-slate-900 font-semibold"}
          />
        ) : (
          <TypingDots isUser={isUser} />
        )}
      </div>

      {isUser && <div className="mb-1 h-8 w-8 shrink-0" />}
    </div>
  );
}
