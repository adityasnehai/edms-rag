"use client";

import { motion } from "motion/react";
import { BadgeCheck, FileText, ShieldAlert } from "lucide-react";

import { AmbientMicroIcons } from "@/memostack/components/ambient-micro-icons";
import { HeadingGlow } from "@/memostack/components/heading-glow";
import { Reveal } from "@/memostack/components/reveal";

const PRINCIPLES = [
  {
    title: "Cited by default",
    body: "Answers point back to the records they came from.",
    icon: FileText,
  },
  {
    title: "No evidence, no answer",
    body: "If the source is missing, MemoStack stops instead of guessing.",
    icon: ShieldAlert,
  },
  {
    title: "Built for decisions",
    body: "The goal is trustworthy context, not confident-looking filler.",
    icon: BadgeCheck,
  },
] as const;

export function Grounded() {
  return (
    <section id="grounded" className="py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#e3ddd4] bg-[#f6f2eb] px-6 py-8 sm:px-8 sm:py-10">
          <AmbientMicroIcons className="hidden sm:block" />
          <div className="pointer-events-none absolute inset-0 bg-scanlines animate-scanlines opacity-[0.08]" />
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Reveal className="relative">
              <HeadingGlow className="-top-6 -left-6 h-32 w-56" />
              <p className="text-sm font-medium text-accent">Grounded by design</p>
              <h2 className="mt-3 max-w-[11ch] font-heading text-3xl font-medium tracking-normal text-[#251f19] sm:text-5xl">
                No source.
                <br />
                <em className="text-[#756b60] italic">No answer.</em>
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#68615a]">
                MemoStack is for questions your team will act on. It cites the
                record, refuses unsupported claims, and keeps the answer tied
                to what your docs actually say.
              </p>
            </Reveal>

            <Reveal delay={0.06}>
              <div className="grid gap-3">
                {PRINCIPLES.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
                      className="flex items-start gap-3 rounded-2xl border border-[#e3ddd4] bg-white px-4 py-4 shadow-sm"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#fff1df] text-accent">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <h3 className="font-heading text-[16px] font-medium tracking-normal text-[#251f19]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-snug text-[#68615a]">
                          {item.body}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
