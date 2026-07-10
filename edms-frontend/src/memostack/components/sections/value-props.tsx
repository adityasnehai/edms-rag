"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CircleAlert } from "lucide-react";

import { Reveal } from "@/memostack/components/reveal";
import { GlowOrb } from "@/memostack/components/glow-orb";
import { PixelCluster } from "@/memostack/components/pixel-cluster";
import { cn } from "@/memostack/lib/utils";

const PILLARS = [
  {
    number: "01",
    title: "Answers with receipts",
    body: "Every answer links to the passages it used, so your team can verify the decision instead of trusting a summary blindly.",
  },
  {
    number: "02",
    title: "Find it your way",
    body: "Search by meaning, keyword, doc ID, or team shorthand and still land on the right ADR, RFC, ticket, or incident note.",
  },
  {
    number: "03",
    title: "Fast by default",
    body: "Simple lookups stay quick. Harder questions use deeper retrieval and ranking only when the source material needs it.",
  },
  {
    number: "04",
    title: "Clear when docs are silent",
    body: "If the decision is not in your docs, MemoStack says so clearly instead of filling the gap.",
  },
];

function NumberBadge({
  number,
  isActive,
}: {
  number: string;
  isActive: boolean;
}) {
  return (
    <span
      className={cn(
        "relative mb-auto self-start font-heading text-3xl leading-none font-bold transition-colors duration-300",
        isActive ? "text-accent" : "text-foreground/20"
      )}
    >
      {number}
    </span>
  );
}

function PreviewReceipts() {
  const items = [
    { label: "ADR-014 · Kafka migration", done: true },
    { label: "RFC-031 · Event bus design", done: true },
    { label: "INC-2023-11 · Incident review", done: true },
    { label: "Answer drafted · 3 citations", done: false },
  ];
  return (
    <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Evidence found
      </p>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                "size-2 shrink-0 rounded-[3px]",
                item.done ? "bg-accent" : "border border-border"
              )}
            />
            <span className={item.done ? "text-foreground" : "text-muted-foreground"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewHybridSearch() {
  const queries = [
    { label: "ADR-014", kind: "Doc ID" },
    { label: "event ordering", kind: "Keyword" },
    { label: "why did we move off Kafka?", kind: "Meaning" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-[#1f1a15] shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="size-2 rounded-full bg-destructive/70" />
        <span className="size-2 rounded-full bg-accent/70" />
        <span className="size-2 rounded-full bg-white/20" />
        <span className="ml-1.5 text-[10px] font-medium tracking-wide text-white/40 uppercase">
          Search inputs
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {queries.map((q, i) => (
          <motion.div
            key={q.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3 text-[13px]"
          >
            <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wide text-white/40 uppercase">
              {q.kind}
            </span>
            <span className="truncate font-mono text-xs text-white/90">
              {q.label}
            </span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-1 flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          One decision trail, many ways in
        </motion.div>
      </div>
    </div>
  );
}

function PreviewCost() {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Query routing
      </p>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-[13px]">
          <span className="w-20 shrink-0 text-foreground">Small model</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "18%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-accent"
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-xs text-accent">
            fast
          </span>
        </div>
        <div className="flex items-center gap-3 text-[13px]">
          <span className="w-20 shrink-0 text-muted-foreground">Large model</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-muted-foreground/40"
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-xs text-muted-foreground">
            deeper
          </span>
        </div>
      </div>
      <p className="text-[13px] font-medium text-accent">
        Simple questions stay fast. Hard ones escalate automatically.
      </p>
    </div>
  );
}

function PreviewHonesty() {
  return (
    <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4">
      <p className="mb-3 text-[10px] font-semibold tracking-wide text-accent uppercase">
        No answer found
      </p>
      <p className="mb-3 font-mono text-xs text-muted-foreground">
        &quot;Did we approve a Rust rewrite for billing?&quot;
      </p>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-3 text-[13px] text-foreground"
      >
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <span>
          Not in your documents.{" "}
          <span className="text-muted-foreground">
            Closest match: RFC-052 · Billing service.
          </span>
        </span>
      </motion.div>
    </div>
  );
}

const PREVIEWS = [PreviewReceipts, PreviewHybridSearch, PreviewCost, PreviewHonesty];

const FLASHCARD_ICONS = [
  [
    "0001111111000",
    "0011111111100",
    "0011000001100",
    "0011011101100",
    "0011000001100",
    "0011011111100",
    "0011000001100",
    "0011011001100",
    "0011001111100",
    "0011000111000",
    "0011111110000",
    "0001111100000",
    "0000000000000",
  ],
  [
    "0000111110000",
    "0001111111000",
    "0011100011100",
    "0011000001100",
    "0011000001100",
    "0011100011100",
    "0001111111000",
    "0000111110000",
    "0000001100000",
    "0000001110000",
    "0000000111000",
    "0000000011100",
    "0000000000000",
  ],
  [
    "0000001110000",
    "0000011110000",
    "0000111100000",
    "0001111000000",
    "0011111111000",
    "0111111110000",
    "0000111100000",
    "0001111000000",
    "0011110000000",
    "0111100000000",
    "0111000000000",
    "0010000000000",
    "0000000000000",
  ],
  [
    "0000111110000",
    "0001111111000",
    "0011111111100",
    "0111100011110",
    "0111000001110",
    "0111000001110",
    "0011100011100",
    "0001110111000",
    "0000111110000",
    "0000011100000",
    "0000001000000",
    "0000000000000",
    "0000000000000",
  ],
] as const;

function FlashcardPixelIcon({
  icon,
  contained,
}: {
  icon: (typeof FLASHCARD_ICONS)[number];
  contained?: boolean;
}) {
  const cellSize = contained ? 6 : 10;
  const gap = contained ? 1 : 2;
  const columns = icon[0].length;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute grid transition-[top,right,transform] duration-300",
        contained
          ? "top-7 right-7"
          : "top-14 left-1/2 -translate-x-1/2"
      )}
      style={{
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gap,
      }}
    >
      {icon.flatMap((row, ri) =>
        row.split("").map((cell, ci) => (
          <motion.span
            key={`${ri}-${ci}`}
            initial={{ opacity: 0, scale: 0.45 }}
            animate={{ opacity: cell === "0" ? 0 : 1, scale: 1 }}
            transition={{
              duration: 0.25,
              delay: (ri * columns + ci) * 0.006,
              ease: "easeOut",
            }}
            className="rounded-[2px] bg-accent"
            style={{ width: cellSize, height: cellSize }}
          />
        ))
      )}
    </div>
  );
}

export function ValueProps() {
  const [active, setActive] = useState(0);

  return (
    <section id="product" className="relative overflow-hidden py-20 sm:py-28">
      <GlowOrb className="top-20 -left-32 size-72" />
      <GlowOrb className="bottom-0 -right-24 size-64" color="foreground" />
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="relative">
            <PixelCluster
              pattern="spark"
              cellSize={4}
              className="-top-3 right-2 hidden sm:grid"
              cellClassName="bg-accent/45"
            />
            <p className="text-sm font-medium text-accent">Why MemoStack</p>
            <h2 className="mt-3 max-w-md font-heading text-3xl font-medium tracking-normal text-balance sm:text-5xl">
              Find the decision. See the proof.
            </h2>
          </div>
          <p className="max-w-sm text-[15px] text-muted-foreground sm:pt-2">
            MemoStack searches your ADRs, RFCs, postmortems, tickets, and
            notes, then shows the sources behind every answer.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-4">
          {PILLARS.map((pillar, i) => {
            const isActive = i === active;
            const Preview = PREVIEWS[i];
            return (
              <button
                key={pillar.title}
                onMouseEnter={() => setActive(i)}
                onClick={() => setActive(i)}
                className={cn(
                  "group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl p-6 text-left transition-all duration-300",
                  isActive
                    ? "bg-card shadow-xl shadow-black/[0.06] sm:-my-3 sm:min-h-[320px] sm:scale-[1.03]"
                    : "bg-secondary/60 hover:bg-secondary"
                )}
              >
                {!isActive ? (
                  <PixelCluster
                    pattern="trail"
                    cellSize={3}
                    className="top-5 right-5"
                    cellClassName="bg-accent/22"
                  />
                ) : null}
                <FlashcardPixelIcon
                  icon={FLASHCARD_ICONS[i]}
                  contained={isActive}
                />

                <NumberBadge number={pillar.number} isActive={isActive} />

                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="relative mt-8 mb-6"
                    >
                      <Preview />
                    </motion.div>
                  )}
                </AnimatePresence>

                <h3 className="relative font-heading text-lg font-medium tracking-normal">
                  {pillar.title}
                </h3>
                {isActive && (
                  <p className="relative mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {pillar.body}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
