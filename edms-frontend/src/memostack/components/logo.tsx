import { Layers } from "lucide-react";

import { cn } from "@/memostack/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center",
        className
      )}
    >
      <Layers className="size-6 text-accent" />
    </span>
  );
}
