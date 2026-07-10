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
            isUser ? "bg-[#a76311]/70" : "bg-[#a76311]/70",
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
        <div className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
          <SparkleIcon className="h-4 w-4 text-[#a76311]" />
        </div>
      )}

      <div
        className={[
          "max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm border border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm"
            : "rounded-bl-sm border border-border bg-white text-foreground shadow-sm",
        ].join(" ")}
      >
        <p
          className={[
            "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]",
            isUser ? "text-[#a76311]" : "text-primary",
          ].join(" ")}
        >
          {isUser ? "You" : "MemoStack"}
        </p>

        {content ? (
          <FormattedContent
            text={content}
            paragraphClassName={isUser ? "text-sm leading-7 text-[#251f19]" : "text-sm leading-7 text-stone-700"}
            listClassName={isUser ? "space-y-1.5 pl-4 text-sm leading-7 text-[#251f19]" : "space-y-1.5 pl-4 text-sm leading-7 text-stone-700"}
            headingClassName={isUser ? "text-[#251f19] font-semibold" : "text-stone-950 font-semibold"}
            strongClassName={isUser ? "text-[#251f19] font-semibold" : "text-stone-950 font-semibold"}
          />
        ) : (
          <TypingDots isUser={isUser} />
        )}
      </div>

      {isUser && <div className="mb-1 h-8 w-8 shrink-0" />}
    </div>
  );
}
