"use client";

import { useRef } from "react";
import Image from "@/memostack/compat/image";
import { motion, useScroll, useTransform } from "motion/react";

import { cn } from "@/memostack/lib/utils";

/**
 * Shared backdrop used behind the hero, final CTA, and how-it-works
 * banner, with a darkening overlay for text legibility.
 *
 * `zoomOnScroll` ties an extra subtle zoom to scroll position: the image
 * grows slightly as the banner scrolls up and out of view, and eases back
 * to its resting size when scrolling back up toward it.
 */
export function PainterlyBanner({
  className,
  zoomOnScroll = false,
  src = "/e.jpg",
}: {
  className?: string;
  zoomOnScroll?: boolean;
  src?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scrollScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);

  return (
    <div ref={ref} className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <motion.div
        className="absolute inset-0"
        style={zoomOnScroll ? { scale: scrollScale } : undefined}
      >
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-150 object-cover object-[center_0%]"
        />
      </motion.div>
      <div className="absolute inset-0 bg-noise opacity-[0.06] mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/42 via-black/28 to-black/46" />
    </div>
  );
}
