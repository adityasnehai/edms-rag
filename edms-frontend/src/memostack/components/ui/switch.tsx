import * as React from "react";

import { cn } from "@/memostack/lib/utils";

function Switch({
  className,
  checked,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label
      className={cn(
        "relative inline-flex h-6 w-10 cursor-pointer items-center rounded-full bg-muted transition-colors has-[:checked]:bg-primary",
        className
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} {...props} />
      <span className="ml-1 size-4 rounded-full bg-background transition-transform peer-checked:translate-x-4" />
    </label>
  );
}

export { Switch };
