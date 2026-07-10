"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

const METRICS = [
  {
    value: 3,
    suffix: "s",
    label: "answer latency target",
  },
  {
    value: 40,
    suffix: "",
    label: "candidate passages reranked",
  },
  {
    value: 30,
    suffix: "s",
    label: "time until uploads are searchable",
  },
  {
    value: 4,
    suffix: "",
    label: "layers of caching",
  },
] as const;

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 900;
    const start = performance.now();
    let frame = 0;

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
    <span
      ref={ref}
      className="font-heading text-[2.2rem] leading-none font-semibold tracking-normal text-foreground sm:text-[2.7rem]"
    >
      {display}
      {suffix}
    </span>
  );
}

export function TechStrip() {
  return (
    <section aria-label="Product metrics" className="py-12 sm:py-16">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Retrieval snapshot
          </p>
          <h2 className="mt-3 font-heading text-2xl font-semibold tracking-normal text-balance text-foreground sm:text-3xl">
            Built around the path from upload to cited answer.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            A compact view of the product targets that matter for team
            knowledge search: speed, retrieval quality, and searchable uploads.
          </p>
        </div>

        <div className="mt-8 grid gap-6 text-center sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/60">
          {METRICS.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
              className="flex flex-col items-center gap-2 lg:px-6"
            >
              <div className="flex items-end justify-center gap-1">
                <CountUp value={metric.value} suffix={metric.suffix} />
                {index === 0 ? (
                  <span className="pb-2 text-xs font-medium tracking-wide text-accent">
                    p95
                  </span>
                ) : null}
              </div>
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{
                  duration: 0.55,
                  delay: 0.15 + index * 0.08,
                  ease: "easeOut",
                }}
                className="h-px w-14 origin-center bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,153,24,0.9)_50%,rgba(255,255,255,0)_100%)]"
              />
              <p className="max-w-[14rem] text-sm font-medium leading-snug text-muted-foreground">
                {metric.label}
              </p>
            </motion.div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground/75">
          Tuned for retrieval speed, evidence quality, and fast indexing.
        </p>
      </div>
    </section>
  );
}
