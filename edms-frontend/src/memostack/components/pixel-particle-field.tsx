"use client";

import { motion } from "motion/react";
import { cn } from "@/memostack/lib/utils";

const PARTICLES = [
  { x: "8%", y: "18%", size: 5, delay: 0.1, duration: 9.5 },
  { x: "18%", y: "34%", size: 4, delay: 0.8, duration: 8.2 },
  { x: "31%", y: "12%", size: 6, delay: 0.3, duration: 10.4 },
  { x: "46%", y: "28%", size: 4, delay: 1.1, duration: 7.8 },
  { x: "62%", y: "16%", size: 5, delay: 0.5, duration: 9.8 },
  { x: "74%", y: "30%", size: 4, delay: 1.4, duration: 8.9 },
  { x: "88%", y: "20%", size: 6, delay: 0.7, duration: 10.2 },
];

export function PixelParticleField({
  className,
  colorClassName = "bg-accent/28",
}: {
  className?: string;
  colorClassName?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {PARTICLES.map((particle, index) => (
        <motion.span
          key={index}
          className={cn("absolute rounded-[2px]", colorClassName)}
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -8, 0],
            opacity: [0.18, 0.42, 0.18],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
