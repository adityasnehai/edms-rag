function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderHighlightedSegments(text, highlightQuery) {
  const query = (highlightQuery || "").trim();
  if (!query) {
    return [text];
  }
  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
  return text.split(regex).map((part, index) => {
    if (!part) return null;
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark
          key={`hl-${index}`}
          className="rounded bg-amber-200/80 px-0.5 text-slate-900"
        >
          {part}
        </mark>
      );
    }
    return <span key={`tx-${index}`}>{part}</span>;
  });
}

function renderInlineText(value, strongClassName, highlightQuery) {
  const cleanValue = value.replace(/^#{1,6}\s+/, "");
  const parts = cleanValue.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className={`font-semibold ${strongClassName}`.trim()}>
          {renderHighlightedSegments(part.slice(2, -2), highlightQuery)}
        </strong>
      );
    }

    const withBreaks = part.split("\n");
    return withBreaks.map((segment, segmentIndex) => (
      <span key={`${index}-${segmentIndex}`}>
        {renderHighlightedSegments(segment, highlightQuery)}
        {segmentIndex < withBreaks.length - 1 ? <br /> : null}
      </span>
    ));
  });
}

function Heading({ level, children, className }) {
  const baseClassName =
    level === 1
      ? "text-xl font-semibold"
      : level === 2
        ? "text-lg font-semibold"
        : level === 3
          ? "text-base font-semibold"
          : "text-sm font-semibold uppercase tracking-[0.08em]";
  const resolvedClassName = `${baseClassName} ${className}`.trim();

  if (level === 1) return <h2 className={resolvedClassName}>{children}</h2>;
  if (level === 2) return <h3 className={resolvedClassName}>{children}</h3>;
  return <h4 className={resolvedClassName}>{children}</h4>;
}

export default function FormattedContent({
  text,
  highlightQuery = "",
  className = "",
  paragraphClassName = "text-sm leading-7 text-slate-700",
  listClassName = "space-y-2 pl-5 text-sm leading-7 text-slate-700",
  headingClassName = "text-slate-900",
  strongClassName = "text-slate-900",
}) {
  if (!text) {
    return null;
  }

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {blocks.map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trimEnd())
          .filter((line) => line.trim().length > 0);

        if (lines.length === 0) {
          return null;
        }

        const headingMatch = lines[0].match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const body = lines.slice(1).join("\n");

          return (
            <div key={index} className="space-y-2">
              <Heading level={level} className={headingClassName}>
                {renderInlineText(headingMatch[2], strongClassName, highlightQuery)}
              </Heading>
              {body ? (
                <p className={paragraphClassName}>{renderInlineText(body, strongClassName, highlightQuery)}</p>
              ) : null}
            </div>
          );
        }

        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul key={index} className={listClassName}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-disc marker:text-primary">
                  {renderInlineText(line.replace(/^[-*]\s+/, ""), strongClassName, highlightQuery)}
                </li>
              ))}
            </ul>
          );
        }

        if (lines.every((line) => /^\d+\.\s+/.test(line))) {
          return (
            <ol key={index} className={listClassName}>
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="list-decimal marker:text-primary">
                  {renderInlineText(line.replace(/^\d+\.\s+/, ""), strongClassName, highlightQuery)}
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={index} className={paragraphClassName}>
            {renderInlineText(lines.join("\n"), strongClassName, highlightQuery)}
          </p>
        );
      })}
    </div>
  );
}
