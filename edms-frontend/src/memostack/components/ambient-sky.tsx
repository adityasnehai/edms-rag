"use client";

import { cn } from "@/memostack/lib/utils";

export function AmbientSky({
  className,
  warm = false,
}: {
  className?: string;
  warm?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className={cn(
          "absolute inset-0",
          warm
            ? "bg-[linear-gradient(180deg,rgba(255,244,225,0.82)_0%,rgba(255,234,204,0.52)_36%,rgba(255,241,226,0)_78%)]"
            : "bg-[linear-gradient(180deg,rgba(255,247,235,0.75)_0%,rgba(255,247,235,0.34)_38%,rgba(255,247,235,0)_78%)]"
        )}
      />
      <div
        className={cn(
          "animate-sky-drift absolute -top-16 left-[8%] h-52 w-72 rounded-full blur-3xl",
          warm ? "bg-[#ffd7a7]/46" : "bg-[#fff2dc]/54"
        )}
      />
      <div
        className={cn(
          "animate-sky-drift-reverse absolute top-0 right-[10%] h-44 w-64 rounded-full blur-3xl",
          warm ? "bg-[#ffb85e]/28" : "bg-[#ffe5bf]/34"
        )}
      />
      <div
        className={cn(
          "animate-sky-drift absolute top-10 left-1/2 h-36 w-80 -translate-x-1/2 rounded-full blur-3xl",
          warm ? "bg-[#fff0cb]/38" : "bg-[#fff6e7]/44"
        )}
        style={{ animationDuration: "26s" }}
      />
    </div>
  );
}
