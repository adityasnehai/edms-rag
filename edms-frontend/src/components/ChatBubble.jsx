import FormattedContent from "./FormattedContent";
import { SparkleIcon } from "./AppIcons";

export default function ChatBubble({ role, text }) {
  const isUser = role === "user";
  const content = text || "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-3 mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow sm:flex">
          <SparkleIcon className="h-4 w-4" />
        </div>
      )}

      <div
        className={[
          "max-w-[88%] rounded-[22px] px-5 py-4 text-sm leading-relaxed shadow-card",
          isUser
            ? "rounded-tr-md bg-secondary text-secondary-foreground"
            : "rounded-tl-md border border-border bg-card text-foreground",
        ].join(" ")}
      >
        <div
          className={[
            "mb-2 text-[11px] uppercase tracking-[0.28em]",
            isUser ? "text-muted-foreground" : "text-primary",
          ].join(" ")}
        >
          {isUser ? "You" : "EDMS"}
        </div>
        {content ? (
          <FormattedContent
            text={content}
            paragraphClassName={isUser ? "text-sm leading-7 text-secondary-foreground" : "text-sm leading-7 text-slate-700"}
            listClassName={isUser ? "space-y-2 pl-5 text-sm leading-7 text-secondary-foreground" : "space-y-2 pl-5 text-sm leading-7 text-slate-700"}
            headingClassName={isUser ? "text-slate-900" : "text-slate-900"}
            strongClassName={isUser ? "text-slate-900" : "text-slate-900"}
          />
        ) : (
          <span className="text-muted-foreground">…</span>
        )}
      </div>
    </div>
  );
}
