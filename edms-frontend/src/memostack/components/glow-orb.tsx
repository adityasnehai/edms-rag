import { cn } from "@/memostack/lib/utils";

export function GlowOrb({
  className,
  color = "accent",
}: {
  className?: string;
  color?: "accent" | "foreground" | "destructive";
}) {
  const colorClass =
    color === "accent"
      ? "bg-accent/25"
      : color === "destructive"
      ? "bg-destructive/15"
      : "bg-foreground/10";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-[100px]",
        "animate-orb-drift",
        colorClass,
        className
      )}
    />
  );
}
