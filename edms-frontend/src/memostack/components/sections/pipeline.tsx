"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BadgeCheck,
  ChevronRight,
  FileText,
  FolderKanban,
  MessagesSquare,
} from "lucide-react";

import { AmbientMicroIcons } from "@/memostack/components/ambient-micro-icons";
import { AmbientSky } from "@/memostack/components/ambient-sky";
import { HeadingGlow } from "@/memostack/components/heading-glow";
import { PixelParticleField } from "@/memostack/components/pixel-particle-field";
import { Reveal } from "@/memostack/components/reveal";
import { PixelCluster } from "@/memostack/components/pixel-cluster";
import { cn } from "@/memostack/lib/utils";

const QUERY = "Why did we move off Kafka for order events?";

const STAGES = [
  {
    title: "Ask in plain language",
    detail:
      "Ask the question the way your team remembers it. No folder path, ticket ID, or search syntax required.",
    eyebrow: "Question intake",
    status: "decision lookup · order events",
  },
  {
    title: "Search every source",
    detail:
      "MemoStack checks ADRs, RFCs, postmortems, tickets, and notes together instead of making the team hunt across tools.",
    eyebrow: "Source retrieval",
    status: "5 knowledge lanes searched",
  },
  {
    title: "Rank the evidence",
    detail:
      "The best passages are fused and reranked so the answer starts from the strongest decision trail.",
    eyebrow: "Evidence ranking",
    status: "top passages promoted",
  },
  {
    title: "Answer with citations",
    detail:
      "You get a direct answer with linked sources, plus a clear stop when the docs do not support a claim.",
    eyebrow: "Grounded answer",
    status: "3 linked sources",
  },
] as const;

const SOURCE_GROUPS = [
  {
    name: "ADRs",
    docs: ["ADR-014 · Event bus migration", "ADR-009 · Ordering guarantees"],
  },
  {
    name: "RFCs",
    docs: ["RFC-031 · Replacement bus", "RFC-018 · Retry semantics"],
  },
  {
    name: "Incidents",
    docs: ["INC-2023-11 · Kafka replay", "PM-220 · Ordering postmortem"],
  },
] as const;

const RANKED = [
  {
    id: "ADR-014",
    label: "Event bus migration decision",
    score: "0.94",
  },
  {
    id: "RFC-031",
    label: "Replacement event bus design",
    score: "0.89",
  },
  {
    id: "INC-2023-11",
    label: "Kafka replay failure review",
    score: "0.81",
  },
] as const;

const CLOUDS = [
  {
    className: "left-[30%] top-[-8px] hidden lg:block",
    delay: 0,
    duration: 20,
    scale: 1.06,
    opacity: 0.92,
    pattern: [
      "000001111100000000",
      "000111111111000000",
      "001111111111110000",
      "011111111111111000",
      "111111111111111100",
      "111111111111111110",
      "011111111111111100",
      "001111111111110000",
      "000111111111000000",
      "000001111100000000",
    ],
  },
  {
    className: "right-[6%] top-0 hidden lg:block",
    delay: 1.1,
    duration: 22,
    scale: 0.95,
    opacity: 0.88,
    pattern: [
      "000011111000000",
      "000111111110000",
      "001111111111000",
      "011111111111100",
      "111111111111110",
      "111111111111100",
      "011111111111000",
      "001111111110000",
      "000011111000000",
    ],
  },
  {
    className: "left-[48%] top-8 hidden xl:block",
    delay: 0.6,
    duration: 18,
    scale: 0.78,
    opacity: 0.8,
    pattern: [
      "000111110000",
      "001111111000",
      "011111111100",
      "111111111110",
      "011111111100",
      "001111111000",
      "000111110000",
    ],
  },
] as const;

function PixelCloud({
  pattern,
  className,
  delay,
  duration,
  scale,
  opacity,
}: {
  pattern: readonly string[];
  className?: string;
  delay: number;
  duration: number;
  scale: number;
  opacity: number;
}) {
  const cellSize = 8;
  const columns = pattern[0].length;

  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute", className)}
      initial={{ opacity: 0, x: -8 }}
      animate={{
        opacity: [opacity * 0.82, opacity, opacity * 0.9],
        x: [-18, 24, -18],
        y: [0, -6, 0],
      }}
      transition={{
        duration,
        delay,
        ease: "easeInOut",
        repeat: Number.POSITIVE_INFINITY,
      }}
      style={{ scale }}
    >
      <div
        className="grid drop-shadow-[0_12px_20px_rgba(244,141,22,0.16)]"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: 2,
        }}
      >
        {pattern.flatMap((row, rowIndex) =>
          row.split("").map((cell, columnIndex) => (
            <span
              key={`${rowIndex}-${columnIndex}`}
              className={cn(
                "rounded-[2px]",
                cell === "1" ? "opacity-100" : "opacity-0"
              )}
              style={{
                width: cellSize,
                height: cellSize,
                background:
                  rowIndex <= 1
                    ? "rgba(255, 242, 220, 0.98)"
                    : rowIndex <= 3
                      ? "rgba(255, 220, 176, 0.92)"
                      : "rgba(244, 141, 22, 0.52)",
              }}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function IntakePanel() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["decision lookup", "Kafka migration", "order events"].map((item) => (
          <span
            key={item}
            className="rounded-full border border-[#eadfce] bg-[#fff8ee] px-3 py-1 text-xs font-medium text-[#50443a]"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {["No doc title needed", "No folder path needed", "No ticket number needed", "No query syntax needed"].map(
          (item) => (
            <div
              key={item}
              className="rounded-xl border border-[#eee5d9] bg-[#fffdf8] px-3 py-2.5 text-sm text-[#4d4036]"
            >
              {item}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SearchPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {SOURCE_GROUPS.map((group) => (
        <div key={group.name} className="rounded-xl border border-[#eee5d9] bg-[#fffdf8] p-3">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9b8974] uppercase">
            {group.name}
          </p>
          <div className="mt-3 space-y-2">
            {group.docs.map((doc, index) => (
              <motion.div
                key={doc}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-xs leading-snug",
                  index === 0
                    ? "bg-accent/12 text-[#332820]"
                    : "bg-[#f7f2ea] text-[#756858]"
                )}
              >
                {doc}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RankPanel() {
  return (
    <div className="space-y-2">
      {RANKED.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "rounded-xl border px-3 py-3",
            index === 0
              ? "border-accent/40 bg-[#fff8ee]"
              : "border-[#eee5d9] bg-[#fffdf8]"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f4eee4] font-mono text-xs text-[#81705f]">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#30261f]">{item.label}</p>
              <p className="font-mono text-xs text-accent">{item.id}</p>
            </div>
            <span className="font-mono text-xs text-[#766755]">{item.score}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnswerPanel() {
  return (
    <div className="rounded-xl border border-[#eee5d9] bg-[#fffdf8] p-4">
      <p className="text-sm leading-relaxed text-[#332820]">
        The team moved off Kafka after the ordering incident exposed replay risk
        and higher operational load for order events.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eee5d9] pt-3">
        <span className="text-[11px] font-semibold tracking-[0.16em] text-[#9b8974] uppercase">
          Sources
        </span>
        {["ADR-014", "RFC-031", "INC-2023-11"].map((source) => (
          <span
            key={source}
            className="rounded-full bg-accent/12 px-2.5 py-1 font-mono text-xs font-medium text-accent"
          >
            {source}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-[#2f855a]">
          <BadgeCheck className="size-3.5" /> grounded
        </span>
      </div>
    </div>
  );
}

const PANELS = [IntakePanel, SearchPanel, RankPanel, AnswerPanel] as const;

function ProductMockup({ active }: { active: number }) {
  const stage = STAGES[active];
  const ActivePanel = PANELS[active];

  return (
    <div className="relative min-h-[500px] overflow-hidden rounded-[22px] bg-[#f3f0e8] pt-8">
      <PixelCluster
        pattern="corner"
        cellSize={4}
        className="top-5 right-5"
        cellClassName="bg-[#c8baa6]/55"
      />
      <div className="absolute inset-x-0 top-0 h-12 bg-[#f3f0e8]" />

      <div className="mx-auto w-[94%] overflow-hidden rounded-t-[24px] border border-[#e5ded3] bg-white shadow-[0_24px_60px_rgba(33,26,20,0.08)]">
        <div className="flex h-12 items-center gap-2 border-b border-[#eee8df] bg-[#fffdf9] px-5">
          <span className="size-3 rounded-full bg-[#ff6258]" />
          <span className="size-3 rounded-full bg-[#ffbc35]" />
          <span className="size-3 rounded-full bg-[#2fc85f]" />
        </div>

        <div className="grid min-h-[428px] grid-cols-[192px_minmax(0,1fr)]">
          <aside className="border-r border-[#eee8df] bg-[#f8f5ee] p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#221b16] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(34,27,22,0.18)]">
                M
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2f261f]">MemoStack</p>
                <p className="text-xs text-[#948675]">Team knowledge</p>
              </div>
            </div>

            <div className="mt-5 space-y-1.5">
              {[
                { label: "New answer", icon: MessagesSquare, active: true },
                { label: "Decisions", icon: FolderKanban, count: "148" },
                { label: "Sources", icon: FileText, count: "842" },
                { label: "Verified", icon: BadgeCheck, count: "24" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                    item.active ? "bg-[#eee9df] text-[#2f261f]" : "text-[#7f7163]"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.count ? (
                    <span className="font-mono text-xs text-[#9a8c7b]">{item.count}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          <div className="relative min-w-0 overflow-hidden bg-white">
            <div className="pointer-events-none absolute inset-0 bg-scanlines animate-scanlines opacity-[0.18]" />
            <div className="border-b border-[#eee8df] px-5 py-4">
              <div className="flex items-center gap-2 text-sm text-[#9a8c7b]">
                <span>Pipeline</span>
                <span>/</span>
                <span className="font-semibold text-[#2f261f]">{stage.eyebrow}</span>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-[18px] border border-[#e8dfd2] bg-[#fffaf4] px-4 py-3.5">
                <ChevronRight className="size-4 shrink-0 text-accent" />
                <p className="min-w-0 text-[15px] font-medium leading-snug text-[#30261f]">
                  {QUERY}
                </p>
              </div>

              <p className="mt-3 text-sm font-medium text-[#756858]">
                {stage.status}
              </p>
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stage.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <ActivePanel />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Pipeline() {
  const [active, setActive] = useState(0);

  return (
    <section id="pipeline" className="relative overflow-hidden py-20 sm:py-28">
      <AmbientSky className="top-0 h-[46%]" warm />
      <PixelParticleField
        className="top-0 hidden h-[34%] lg:block"
        colorClassName="bg-[#f48d16]/18"
      />
      <div className="relative mx-auto max-w-[1320px] px-4 sm:px-6">
        <Reveal className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="relative">
            <HeadingGlow className="-top-6 -left-8 h-36 w-72" warm />
            <p className="text-sm font-semibold text-accent">Decision Pipeline</p>
            <h2 className="mt-3 max-w-[13ch] font-heading text-[3.25rem] leading-[1.02] font-medium tracking-normal text-balance max-lg:text-5xl max-sm:text-4xl">
              Ask MemoStack once.
              <br />
              <em className="text-muted-foreground italic">It finds the proof.</em>
            </h2>
          </div>

          <p className="text-[16px] leading-snug text-muted-foreground lg:pt-16">
            Describe a decision in plain language and MemoStack searches the
            records, ranks the evidence, and returns an answer with sources.
          </p>
        </Reveal>

        <div className="relative mt-3 hidden h-24 overflow-hidden lg:block">
          <div className="absolute inset-x-[28%] top-1 h-16 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,222,178,0.52)_0%,rgba(255,222,178,0.18)_52%,rgba(255,222,178,0)_76%)] blur-2xl" />
          <AmbientMicroIcons className="opacity-90" />
          {CLOUDS.map((cloud, index) => (
            <PixelCloud
              key={index}
              pattern={cloud.pattern}
              className={cloud.className}
              delay={cloud.delay}
              duration={cloud.duration}
              scale={cloud.scale}
              opacity={cloud.opacity}
            />
          ))}
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[470px_minmax(0,1fr)] lg:items-start">
          <Reveal className="space-y-7 pt-4 lg:pt-8">
            {STAGES.map((stage, index) => {
              const isActive = index === active;

              return (
                <button
                  key={stage.title}
                  type="button"
                  onClick={() => setActive(index)}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  className="group block w-full text-left"
                >
                  <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-4 py-1">
                    <span
                      className={cn(
                        "mt-1 flex size-7 items-center justify-center transition-colors",
                        isActive ? "text-accent" : "text-transparent"
                      )}
                    >
                      <ChevronRight className="size-5" />
                    </span>

                    <div>
                      <p
                        className={cn(
                        "font-heading text-[1.55rem] leading-tight font-medium tracking-normal transition-colors max-sm:text-2xl",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {stage.title}
                      </p>
                      <p
                        className={cn(
                          "mt-2 max-w-[390px] text-[14px] leading-snug transition-opacity",
                          isActive ? "text-muted-foreground opacity-100" : "opacity-0"
                        )}
                      >
                        {stage.detail}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </Reveal>

          <Reveal delay={0.08} className="lg:pt-6">
            <ProductMockup active={active} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
