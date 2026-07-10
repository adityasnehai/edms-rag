import { cn } from "@/memostack/lib/utils";

export function HeadingGlow({
  className,
  warm = false,
}: {
  className?: string;
  warm?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl animate-heading-glow",
        warm
          ? "bg-[radial-gradient(circle,rgba(255,216,161,0.56)_0%,rgba(255,216,161,0.2)_48%,rgba(255,216,161,0)_78%)]"
          : "bg-[radial-gradient(circle,rgba(255,246,228,0.62)_0%,rgba(255,246,228,0.24)_48%,rgba(255,246,228,0)_78%)]",
        className
      )}
    />
  );
}
