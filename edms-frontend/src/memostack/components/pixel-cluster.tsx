"use client";

import { cn } from "@/memostack/lib/utils";

const PATTERNS = {
  spark: [
    "1001000",
    "0010001",
    "0001100",
    "0100010",
    "0010000",
  ],
  corner: [
    "1110000",
    "1010000",
    "1111000",
    "0011000",
    "0001111",
  ],
  trail: [
    "1000001",
    "0010010",
    "0001000",
    "0100000",
    "0000010",
  ],
} as const;

type PatternName = keyof typeof PATTERNS;

export function PixelCluster({
  pattern = "spark",
  className,
  cellClassName,
  cellSize = 6,
}: {
  pattern?: PatternName;
  className?: string;
  cellClassName?: string;
  cellSize?: number;
}) {
  const rows = PATTERNS[pattern];
  const columns = rows[0].length;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute grid opacity-80", className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gap: 2,
      }}
    >
      {rows.flatMap((row, rowIndex) =>
        row.split("").map((cell, columnIndex) => (
          <span
            key={`${pattern}-${rowIndex}-${columnIndex}`}
            className={cn(
              "rounded-[2px] bg-accent/70",
              cell === "1" ? "opacity-100" : "opacity-0",
              cellClassName
            )}
            style={{ width: cellSize, height: cellSize }}
          />
        ))
      )}
    </div>
  );
}
