const DOTS = [
  { x: 62, y: 8, size: 10, opacity: 1 },
  { x: 40, y: 28, size: 8, opacity: 0.5 },
  { x: 68, y: 34, size: 7, opacity: 0.35 },
  { x: 30, y: 55, size: 9, opacity: 0.85 },
  { x: 8, y: 78, size: 8, opacity: 0.6 },
];

export function MosaicDots({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
    >
      {DOTS.map((dot, i) => (
        <span
          key={i}
          className="absolute rounded-[3px] bg-accent"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            opacity: dot.opacity,
          }}
        />
      ))}
    </div>
  );
}
