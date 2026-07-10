"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
  ChatIcon,
  CheckIcon,
  LibraryIcon,
  SearchIcon,
  SparkleIcon,
} from "@/components/AppIcons";
import { Reveal } from "@/memostack/components/reveal";
import { cn } from "@/memostack/lib/utils";

const MODE_MS = 4800;

const PIXEL_BIRD = [
  "0000100",
  "0001110",
  "0111111",
  "0011110",
  "0001100",
  "0000100",
] as const;

const PIXEL_TRAIL = [
  "10",
  "11",
  "01",
] as const;

const MODES = [
  {
    id: "search",
    label: "Search",
    eyebrow: "Ask in plain language",
    title: "Find the answer fast.",
    body: "Search scans workspace records and returns a cited answer.",
    bullets: ["Plain-language query", "Ranked evidence", "Linked sources"],
    icon: SearchIcon,
    preview: {
      kicker: "Search workspace memory",
      prompt: "Why did we move off Kafka for order events?",
      answer:
        "The team moved off Kafka after replay risk and ordering incidents made recovery too expensive. The accepted path was the event gateway rollout.",
      chips: ["ADR-024", "RFC-118", "PM-042"],
    },
  },
  {
    id: "chat",
    label: "Chat",
    eyebrow: "Keep the thread alive",
    title: "Follow up without losing context.",
    body: "Chat keeps the same thread tied to the same records.",
    bullets: ["Context persists", "Follow-up answers", "Source refs stay attached"],
    icon: ChatIcon,
    preview: {
      kicker: "Conversation with receipts",
      prompt: "What tradeoffs did we accept?",
      answer:
        "We accepted slower rollout checks and more explicit ownership so the recovery path stayed safer and easier to audit.",
      chips: ["Thread kept", "Evidence-linked", "No reset"],
    },
  },
  {
    id: "evidence",
    label: "Evidence",
    eyebrow: "Open the records",
    title: "Verify before you trust it.",
    body: "Evidence keeps the source trail visible and inspectable.",
    bullets: ["Filter by type", "Open source context", "Confirm the citation"],
    icon: LibraryIcon,
    preview: {
      kicker: "Source browser",
      prompt: "Workspace evidence",
      answer:
        "Browse the underlying records directly, then compare the selected source against the answer MemoStack returned.",
      chips: ["ADRs", "RFCs", "Incidents"],
    },
  },
] as const;

function PixelFigure({
  pattern,
  className,
  color,
  size = 6,
  delay = 0,
  duration = 16,
  drift = { x: [0, 18, 0], y: [0, -10, 0], rotate: [0, 4, 0] },
}: {
  pattern: readonly string[];
  className?: string;
  color: string;
  size?: number;
  delay?: number;
  duration?: number;
  drift?: {
    x?: number[];
    y?: number[];
    rotate?: number[];
  };
}) {
  const columns = pattern[0].length;

  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{
        opacity: [0.45, 0.95, 0.58],
        x: drift.x,
        y: drift.y,
        rotate: drift.rotate,
        scale: [0.96, 1, 0.98],
      }}
      transition={{
        delay,
        duration,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${size}px)`,
          gap: 1,
        }}
      >
        {pattern.flatMap((row, rowIndex) =>
          row.split("").map((cell, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className="rounded-[1px]"
              style={{
                width: size,
                height: size,
                opacity: cell === "1" ? 1 : 0,
                background: color,
                boxShadow: cell === "1" ? "0 0 0 1px rgba(0,0,0,0.02)" : "none",
              }}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

export function WorkspaceModes() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeMode = MODES[activeIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % MODES.length);
    }, MODE_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  return (
    <section id="workspace-modes" className="py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-accent">Workspace modes</p>
          <h2 className="mt-3 font-heading text-3xl font-medium tracking-normal text-balance sm:text-5xl">
            Search. Chat. Evidence.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            One interface. Three actions. Search finds answers, chat continues the thread, and
            evidence proves the source.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="relative mt-10 overflow-hidden rounded-[2rem] border border-[#e3ddd4] bg-[#f6f2eb] px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-8 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(244,141,22,0.2),rgba(244,141,22,0.06)_40%,transparent_72%)] blur-3xl"
            animate={{ x: [0, 16, 0], y: [0, -10, 0], scale: [1, 1.06, 1] }}
            transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,214,164,0.24),rgba(255,214,164,0.08)_40%,transparent_72%)] blur-3xl"
            animate={{ x: [0, -14, 0], y: [0, 8, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          />
          <PixelFigure
            pattern={PIXEL_BIRD}
            className="right-6 top-10 hidden lg:block"
            color="rgba(244, 141, 22, 0.92)"
            size={5}
            delay={0.2}
            duration={15}
            drift={{ x: [0, -10, 0], y: [0, 8, 0], rotate: [0, -3, 0] }}
          />
          <PixelFigure
            pattern={PIXEL_TRAIL}
            className="right-28 top-16 hidden lg:block"
            color="rgba(255, 209, 150, 0.78)"
            size={4}
            delay={0.6}
            duration={12}
            drift={{ x: [0, -8, 0], y: [0, 5, 0], rotate: [0, 1, 0] }}
          />
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
            <div className="relative grid gap-3">
              {MODES.map((mode, index) => {
                const Icon = mode.icon;
                const selected = index === activeIndex;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "group relative overflow-hidden rounded-[1.4rem] border px-4 py-3.5 text-left transition-all duration-300",
                      selected
                        ? "border-[#f48d16]/28 bg-white shadow-[0_12px_30px_-20px_rgba(37,31,25,0.35)]"
                        : "border-border/80 bg-white/70 hover:border-[#f48d16]/18 hover:bg-white"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                          selected
                            ? "border-[#f48d16]/22 bg-[#fff4e1] text-[#a76311]"
                            : "border-border bg-secondary/55 text-muted-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
                              {mode.eyebrow}
                            </p>
                            <h3 className="mt-1 font-heading text-[1.2rem] font-medium tracking-normal text-foreground">
                              {mode.label}
                            </h3>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors",
                              selected
                                ? "bg-[#fff4e1] text-[#a76311]"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </span>
                        </div>

                        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
                          {mode.body}
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {mode.bullets.map((bullet) => (
                            <span
                              key={bullet}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium",
                                selected
                                  ? "border-[#f48d16]/18 bg-[#fff4e1] text-[#5f5145]"
                                  : "border-border bg-white text-muted-foreground"
                              )}
                            >
                              <CheckIcon className="h-3 w-3 text-[#a76311]" />
                              {bullet}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {selected && (
                      <motion.div
                        layoutId="workspace-mode-accent"
                        className="absolute inset-x-0 bottom-0 h-1 bg-[linear-gradient(90deg,rgba(244,141,22,0),rgba(244,141,22,0.6),rgba(244,141,22,0))]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative overflow-hidden rounded-[1.8rem] border border-border bg-white shadow-card">
              <div className="absolute inset-0 bg-dot-grid opacity-30" aria-hidden />
              <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,244,225,0.95)_0%,rgba(255,244,225,0.12)_70%,transparent_100%)]" />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeMode.id}
                  initial={{ opacity: 0, y: 10, filter: "blur(1px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(1px)" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="relative z-10 flex h-full min-h-[430px] flex-col p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-2xl border border-[#f48d16]/18 bg-[#fff4e1] text-[#a76311]">
                        <SparkleIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                          {activeMode.preview.kicker}
                        </p>
                        <h3 className="mt-1 font-heading text-xl font-semibold tracking-normal text-foreground">
                          {activeMode.title}
                        </h3>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-1 text-[11px] font-semibold text-[#a76311]">
                      {String(activeIndex + 1).padStart(2, "0")}/{String(MODES.length).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-1 flex-col gap-4">
                    <div className="rounded-[1.4rem] border border-border bg-secondary/25 p-4 sm:p-5">
                      <div className="flex items-center gap-2 rounded-2xl border border-[#f48d16]/18 bg-white px-3 py-2.5 shadow-sm">
                        {activeMode.id === "search" ? (
                          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : activeMode.id === "chat" ? (
                          <ChatIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <LibraryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <motion.p
                          key={`${activeMode.id}-prompt`}
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: "100%", opacity: 1 }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                          className="truncate text-sm text-foreground"
                        >
                          {activeMode.preview.prompt}
                        </motion.p>
                      </div>

                      <div className="mt-4 rounded-[1.3rem] border border-border bg-white p-4 shadow-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                          Result
                        </p>
                        <p className="mt-2 text-sm leading-7 text-stone-700">
                          {activeMode.preview.answer}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {activeMode.preview.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>

                    <div className="rounded-[1.2rem] border border-[#f48d16]/18 bg-[#fffaf1] px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                        What it does
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Search finds it, chat continues it, evidence proves it.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
