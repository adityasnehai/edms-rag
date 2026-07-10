"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

import { Reveal, RevealGroup, RevealItem } from "@/memostack/components/reveal";
import { GlowOrb } from "@/memostack/components/glow-orb";

const STATS = [
  {
    value: 3,
    suffix: "s",
    label: "p95 latency, question to cited answer",
    body: "Retrieval, reranking, and generation complete end-to-end in under three seconds for 95% of queries — citations included, not bolted on after.",
  },
  {
    value: 40,
    suffix: "",
    label: "candidates reranked before citing the top passages",
    body: "The retriever casts a wide net of forty candidate passages; a reranker scores each against your exact question before the top few reach the answer.",
  },
  {
    value: 30,
    suffix: "s",
    label: "median time until a new upload is searchable",
    body: "Documents are chunked, embedded, and indexed the moment they land — no nightly batch job, no waiting for the next sync.",
  },
  {
    value: 4,
    suffix: "",
    label: "layers of caching, from embeddings to full answers",
    body: "From document embeddings (kept 30 days) down to full answers (minutes) — repeat questions come back effectively instantly.",
  },
];

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = 1100;
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value]);

  return (
    <p
      ref={ref}
      className="font-heading text-5xl font-semibold tracking-normal text-accent"
    >
      {display}
      {suffix}
    </p>
  );
}

export function Proof() {
  return (
    <section id="numbers" className="relative overflow-hidden py-20 sm:py-28">
      <GlowOrb className="top-1/2 left-0 size-72" color="destructive" />
      <div className="relative mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-accent">Retrieval snapshot</p>
          <h2 className="mt-3 font-heading text-3xl font-medium tracking-normal text-balance sm:text-5xl">
            Honest math,{" "}
            <em className="text-muted-foreground italic">
              not marketing math.
            </em>
          </h2>
          <p className="mt-4 text-balance text-lg text-muted-foreground">
            No cherry-picked benchmark run once and forgotten. These four
            numbers describe how MemoStack is actually engineered.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <RevealItem key={stat.label}>
              <div className="flex h-full flex-col rounded-2xl bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-black/[0.06]">
                <CountUp value={stat.value} suffix={stat.suffix} />
                <p className="mt-2 font-heading text-[15px] font-medium leading-snug">
                  {stat.label}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  {stat.body}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground/70">
            These are engineering targets and architecture properties, not a
            benchmark suite — verifiable by reading how the pipeline works,
            not by trusting a chart.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
