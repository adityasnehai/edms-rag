"use client";

import { motion } from "motion/react";
import { FileText, FolderOpen, RadioTower, ReceiptText, SearchCheck } from "lucide-react";
import { cn } from "@/memostack/lib/utils";

const ICONS = [
  { Icon: FileText, left: "4%", top: "22%", delay: 0.1, rotate: -8 },
  { Icon: ReceiptText, left: "16%", top: "62%", delay: 0.6, rotate: 4 },
  { Icon: FolderOpen, left: "78%", top: "18%", delay: 0.2, rotate: 6 },
  { Icon: SearchCheck, left: "86%", top: "58%", delay: 0.9, rotate: -5 },
  { Icon: RadioTower, left: "52%", top: "8%", delay: 0.4, rotate: 3 },
] as const;

export function AmbientMicroIcons({
  className,
}: {
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {ICONS.map(({ Icon, left, top, delay, rotate }, index) => (
        <motion.div
          key={index}
          className="absolute text-[#c79b61]/20"
          style={{ left, top, rotate: `${rotate}deg` }}
          animate={{ y: [0, -6, 0], opacity: [0.12, 0.24, 0.12] }}
          transition={{
            duration: 8.5 + index,
            delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          <Icon className="size-4" />
        </motion.div>
      ))}
    </div>
  );
}
