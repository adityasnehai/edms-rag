"use client";

import { motion } from "motion/react";
import Image from "@/memostack/compat/image";
import {
  FileText,
  GitPullRequest,
  NotebookPen,
  Siren,
  Ticket,
} from "lucide-react";

import { DarkCtaButton } from "@/memostack/components/dark-cta-button";
import { HeadingGlow } from "@/memostack/components/heading-glow";
import { PixelCluster } from "@/memostack/components/pixel-cluster";

const EASE = [0.16, 1, 0.3, 1] as const;

const DOC_TYPES = [
  { name: "ADRs", icon: FileText },
  { name: "RFCs", icon: GitPullRequest },
  { name: "Meeting notes", icon: NotebookPen },
  { name: "Postmortems", icon: Siren },
  { name: "Tickets", icon: Ticket },
];

const HERO_POSTER_SRC = "/hero-pixel-v6.png";

export function Hero() {
  return (
    <section className="pt-1 pb-4 sm:pt-2 sm:pb-6">
      <div className="mx-auto max-w-[1260px] px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative overflow-hidden rounded-[1.6rem] bg-[#c7834b] text-center shadow-[0_28px_70px_-38px_rgba(37,31,25,0.45)] sm:rounded-[1.8rem]"
        >
          <PixelCluster
            pattern="corner"
            cellSize={5}
            className="top-5 left-5 z-20 hidden rotate-[-6deg] sm:grid"
            cellClassName="bg-[#fff1d8]/60"
          />
          <PixelCluster
            pattern="trail"
            cellSize={4}
            className="right-6 bottom-6 z-20 hidden sm:grid"
            cellClassName="bg-[#251f19]/22"
          />
          <div className="relative aspect-[1672/900] w-full">
            <Image
              src={HERO_POSTER_SRC}
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 1260px, calc(100vw - 32px)"
              className="object-cover object-top"
            />
          </div>
          <div className="absolute inset-0 z-10 flex flex-col items-center px-4 pt-[5.5%] sm:px-8 sm:pt-[6%]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,15,10,0.08)_0%,rgba(23,15,10,0.12)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-[18%] bg-[linear-gradient(180deg,rgba(20,13,8,0.18)_0%,rgba(20,13,8,0)_100%)]" />
            <div className="absolute top-[8%] left-1/2 h-[52%] w-[56%] -translate-x-1/2 rounded-[4rem] bg-[radial-gradient(circle_at_center,rgba(255,233,193,0.84)_0%,rgba(255,225,170,0.58)_54%,rgba(255,225,170,0.14)_76%,rgba(255,225,170,0)_100%)] blur-xl" />
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
              className="relative mb-3 flex items-center gap-2 rounded-full border border-[#251f19]/10 bg-[#251f19] px-3 py-1.5 text-[11px] font-semibold text-[#f8efe3] shadow-[0_6px_20px_rgba(37,31,25,0.18)] sm:mb-4 sm:px-3.5 sm:text-xs"
            >
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff9818]/80" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#ff9818]" />
              </span>
              Early access — free while in beta
            </motion.span>

            <div className="relative">
              <HeadingGlow className="-inset-x-8 -inset-y-5" warm />
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
                className="relative max-w-2xl font-heading text-3xl font-semibold text-balance text-[#120c08] drop-shadow-[0_2px_0_rgba(255,232,187,0.72)] sm:text-[3.2rem] sm:leading-[1.06]"
              >
                Every decision your team made.
                <br />
                <em className="italic">Now searchable.</em>
              </motion.h1>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.38, ease: EASE }}
              className="relative mt-3 max-w-md text-balance text-sm font-semibold text-[#1f160f] drop-shadow-[0_1px_0_rgba(255,232,187,0.55)] sm:mt-4 sm:text-[15px]"
            >
              No more digging through ADRs, RFCs, postmortems, and tickets by
              hand. MemoStack finds the answer and shows the source records.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="relative mt-4 drop-shadow-[0_10px_22px_rgba(37,31,25,0.26)] sm:mt-5"
            >
              <DarkCtaButton href="#auth-register">Create Workspace</DarkCtaButton>
            </motion.div>
            <PixelCluster
              pattern="spark"
              cellSize={4}
              className="top-[18%] right-[16%] z-20 hidden sm:grid"
              cellClassName="bg-[#f48d16]/38"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground"
        >
          <span className="font-medium text-foreground/60">
            One search across
          </span>
          {DOC_TYPES.map((doc) => (
            <span key={doc.name} className="flex items-center gap-1.5">
              <doc.icon className="size-3.5 text-accent" />
              {doc.name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
