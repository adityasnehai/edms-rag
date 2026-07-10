"use client";

import Link from "@/memostack/compat/link";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

import { Button } from "@/memostack/components/ui/button";

const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

export function DarkCtaButton({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  function handleClick(event: React.MouseEvent) {
    if (href === "#auth-login" || href === "#auth-register") {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("memostack:auth", {
          detail: { mode: href === "#auth-register" ? "register" : "login" },
        })
      );
    }
    onClick?.();
  }

  return (
    <motion.div
      className="inline-flex rounded-[7px]"
      initial="rest"
      whileHover="hover"
      whileTap={{ scale: 0.985, y: 0 }}
      variants={{
        rest: { y: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.18)" },
        hover: { y: -1, boxShadow: "0 8px 18px -10px rgba(0,0,0,0.55)" },
      }}
      transition={SPRING}
    >
      <Button
        render={<Link href={href} onClick={handleClick} />}
        className={`h-10 w-fit gap-0 rounded-[7px] border-0 bg-[#251f19] p-1 pr-3 text-[#f1ebe3] transition-colors hover:bg-[#251f19] ${className ?? ""}`}
      >
        <span className="flex h-8 w-9 items-center justify-center rounded-[4px] bg-[#ff9818] text-[#251f19]">
          <motion.span
            variants={{ rest: { x: 0 }, hover: { x: 1.5 } }}
            transition={SPRING}
            className="flex"
          >
            <ChevronRight className="size-3.5" strokeWidth={2.4} />
          </motion.span>
        </span>
        <span className="ml-3 text-sm font-semibold leading-none tracking-normal">
          {children}
        </span>
      </Button>
    </motion.div>
  );
}
