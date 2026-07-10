"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MousePointer2 } from "lucide-react";

import {
  ChatIcon,
  CheckIcon,
  DocumentIcon,
  FolderIcon,
  LibraryIcon,
  SearchIcon,
  SparkleIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/AppIcons";
import { Logo } from "@/memostack/components/logo";
import { Reveal } from "@/memostack/components/reveal";
import { cn } from "@/memostack/lib/utils";

const FRAME_MS = 3400;
const QUESTION = "Why did we move off Kafka for order events?";
const FOLLOW_UP = "What tradeoffs did we accept?";

const JOURNEY = [
  {
    id: "upload-nav",
    screen: "upload-nav",
    nav: "Search",
    label: "Open Upload Data",
    copy: "Start from the real dashboard and move into the upload workflow.",
    origin: "left center",
    zoom: 1.006,
    cursor: {
      label: "Upload Data",
      gesture: "click",
      path: [
        { x: "18%", y: "42%" },
        { x: "15%", y: "50%" },
        { x: "12.4%", y: "56.5%" },
        { x: "11.8%", y: "58%" },
      ],
    },
  },
  {
    id: "upload-start",
    screen: "upload-start",
    nav: "Upload Data",
    label: "Choose the source type",
    copy: "Start in Upload Data and choose ADRs before adding a decision record.",
    origin: "38% 38%",
    zoom: 1.014,
    cursor: {
      label: "ADRs",
      gesture: "click",
      path: [
        { x: "16%", y: "56%" },
        { x: "24%", y: "48%" },
        { x: "31%", y: "40%" },
        { x: "35%", y: "38%" },
      ],
    },
  },
  {
    id: "upload-files",
    screen: "upload-files",
    nav: "Upload Data",
    label: "Upload 5 ADR files",
    copy: "Select a small batch of decision records and send them into indexing.",
    origin: "62% 63%",
    zoom: 1.016,
    cursor: {
      label: "Choose files",
      gesture: "click",
      path: [
        { x: "60%", y: "55%" },
        { x: "63%", y: "60%" },
        { x: "65.5%", y: "65.5%" },
        { x: "66%", y: "67%" },
      ],
    },
  },
  {
    id: "upload-indexing",
    screen: "upload-indexing",
    nav: "Upload Data",
    label: "Index the upload",
    copy: "Files save, queue, process, and become searchable for this workspace.",
    origin: "62% 68%",
    zoom: 1.014,
    cursor: {
      label: "Upload",
      gesture: "click",
      path: [
        { x: "62%", y: "69%" },
        { x: "58%", y: "73%" },
        { x: "54%", y: "75%" },
        { x: "52%", y: "75%" },
      ],
    },
  },
  {
    id: "search-nav",
    screen: "upload-indexing",
    nav: "Upload Data",
    label: "Move to Search",
    copy: "After indexing, the user opens Search to ask the decision question.",
    origin: "left center",
    zoom: 1.006,
    cursor: {
      label: "Search",
      gesture: "click",
      path: [
        { x: "52%", y: "75%" },
        { x: "38%", y: "66%" },
        { x: "20%", y: "42%" },
        { x: "12.2%", y: "29.5%" },
      ],
    },
  },
  {
    id: "search-query",
    screen: "search-query",
    nav: "Search",
    label: "Search the decision",
    copy: "Ask the question in plain language without a path, title, or syntax.",
    origin: "54% 33%",
    zoom: 1.014,
    cursor: {
      label: "Type query",
      gesture: "type",
      path: [
        { x: "12%", y: "26%" },
        { x: "25%", y: "31%" },
        { x: "42%", y: "35%" },
        { x: "82%", y: "36%" },
      ],
    },
  },
  {
    id: "answer",
    screen: "answer",
    nav: "Search",
    label: "Get a cited answer",
    copy: "MemoStack answers from retrieved evidence and keeps the supporting records visible.",
    origin: "55% 58%",
    zoom: 1.018,
    cursor: {
      label: "Open source",
      gesture: "click",
      path: [
        { x: "64%", y: "55%" },
        { x: "58%", y: "64%" },
        { x: "52%", y: "72%" },
        { x: "51%", y: "76%" },
      ],
    },
  },
  {
    id: "chat-nav",
    screen: "answer",
    nav: "Search",
    label: "Open Chat",
    copy: "The user switches to chat for a follow-up on the same evidence trail.",
    origin: "left center",
    zoom: 1.006,
    cursor: {
      label: "Chat",
      gesture: "click",
      path: [
        { x: "51%", y: "76%" },
        { x: "35%", y: "65%" },
        { x: "20%", y: "48%" },
        { x: "12.2%", y: "35.2%" },
      ],
    },
  },
  {
    id: "chat",
    screen: "chat",
    nav: "Chat",
    label: "Ask a follow-up",
    copy: "The same workspace memory continues in chat for deeper investigation.",
    origin: "54% 76%",
    zoom: 1.014,
    cursor: {
      label: "Send",
      gesture: "type",
      path: [
        { x: "13%", y: "32%" },
        { x: "28%", y: "48%" },
        { x: "49%", y: "76%" },
        { x: "84%", y: "84%" },
      ],
    },
  },
  {
    id: "evidence-nav",
    screen: "chat",
    nav: "Chat",
    label: "Open Evidence",
    copy: "The user verifies the source records instead of trusting a black-box answer.",
    origin: "left center",
    zoom: 1.006,
    cursor: {
      label: "Evidence",
      gesture: "click",
      path: [
        { x: "84%", y: "84%" },
        { x: "56%", y: "72%" },
        { x: "28%", y: "54%" },
        { x: "12.2%", y: "40.2%" },
      ],
    },
  },
  {
    id: "evidence",
    screen: "evidence",
    nav: "Evidence",
    label: "Verify evidence",
    copy: "Browse the ADR evidence directly and confirm what the index can retrieve.",
    origin: "50% 53%",
    zoom: 1.014,
    cursor: {
      label: "ADRs",
      gesture: "click",
      path: [
        { x: "13%", y: "39%" },
        { x: "22%", y: "42%" },
        { x: "30%", y: "46%" },
        { x: "32%", y: "51%" },
      ],
    },
  },
  {
    id: "manager-nav",
    screen: "evidence",
    nav: "Evidence",
    label: "Open Data Manager",
    copy: "After verification, the user opens Data Manager to clean stale records.",
    origin: "left center",
    zoom: 1.006,
    cursor: {
      label: "Data Manager",
      gesture: "click",
      path: [
        { x: "32%", y: "51%" },
        { x: "24%", y: "55%" },
        { x: "18%", y: "60%" },
        { x: "12.2%", y: "63.2%" },
      ],
    },
  },
  {
    id: "manager-delete",
    screen: "manager-delete",
    nav: "Data Manager",
    label: "Clean stale records",
    copy: "Delete an outdated file and queue an index refresh so future answers stay current.",
    origin: "76% 72%",
    zoom: 1.014,
    cursor: {
      label: "Delete",
      gesture: "click",
      path: [
        { x: "13%", y: "62%" },
        { x: "50%", y: "67%" },
        { x: "74%", y: "70%" },
        { x: "88%", y: "70%" },
      ],
    },
  },
  {
    id: "manager-update",
    screen: "manager-delete",
    nav: "Data Manager",
    label: "Replace with a new version",
    copy: "Upload the corrected source so the next answer uses fresh evidence.",
    origin: "74% 70%",
    zoom: 1.014,
    cursor: {
      label: "Replace",
      gesture: "click",
      path: [
        { x: "84%", y: "70%" },
        { x: "82%", y: "70%" },
        { x: "78%", y: "70%" },
        { x: "77%", y: "70%" },
      ],
    },
  },
  {
    id: "manager-complete",
    screen: "manager-update",
    nav: "Data Manager",
    label: "Workspace refreshed",
    copy: "The stale record is replaced and the next answer uses the updated evidence.",
    origin: "62% 43%",
    zoom: 1.01,
    cursor: {
      label: "Updated",
      gesture: "idle",
      path: [
        { x: "77%", y: "70%" },
        { x: "72%", y: "60%" },
        { x: "66%", y: "50%" },
        { x: "62%", y: "42%" },
      ],
    },
  },
] as const;

const STATS = [
  ["ADRs", "11", "border-violet-200/70 bg-violet-50 text-violet-700"],
  ["RFCs", "10", "border-sky-200/70 bg-sky-50 text-sky-700"],
  ["Meeting Notes", "10", "border-emerald-200/70 bg-emerald-50 text-emerald-700"],
  ["Postmortems", "10", "border-rose-200/70 bg-rose-50 text-rose-700"],
  ["Tickets", "10", "border-amber-200/70 bg-amber-50 text-amber-700"],
  ["Images", "10", "border-indigo-200/70 bg-indigo-50 text-indigo-700"],
] as const;

const RECEIPTS = [
  {
    id: "ADR-024",
    title: "Move order events off Kafka",
    snippet: "Decision: use the event gateway after replay risk made recovery expensive.",
  },
  {
    id: "RFC-118",
    title: "Event gateway rollout",
    snippet: "Keep ordering inside the order service boundary during recovery.",
  },
  {
    id: "PM-042",
    title: "Order replay incident",
    snippet: "Duplicate dispatches appeared during consumer-group recovery.",
  },
] as const;

const NAV_ITEMS = [
  { label: "Search", Icon: SearchIcon, group: "Navigation" },
  { label: "Chat", Icon: ChatIcon, group: "Navigation" },
  { label: "Evidence", Icon: LibraryIcon, group: "Navigation" },
  { label: "Company Access", Icon: FolderIcon, group: "Admin Tools" },
  { label: "Upload Data", Icon: UploadIcon, group: "Admin Tools" },
  { label: "Data Manager", Icon: FolderIcon, group: "Admin Tools" },
] as const;

function SidebarMock({ active }: { active: string }) {
  const groups = ["Navigation", "Admin Tools"] as const;

  return (
    <aside className="flex h-full w-[11.5rem] shrink-0 flex-col border-r border-sidebar-border bg-white/95 text-foreground">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        <div className="flex items-center gap-2.5">
          <Logo className="size-7" />
          <p className="font-heading text-[13px] font-semibold tracking-normal text-foreground">
            MemoStack
          </p>
        </div>
        </div>

      <div className="px-2.5 pt-3">
        <div className="rounded-2xl border border-[#f48d16]/20 bg-[#fff4e1]/75 p-2.5">
          <p className="truncate text-sm font-semibold text-foreground">AcmeTech</p>
          <p className="truncate text-xs text-muted-foreground">admin@example.com</p>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group} className="px-2.5 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground/70">
            {group}
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const selected = item.label === active;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-[13px] font-medium",
                    selected
                      ? "border-[#f48d16]/22 bg-[#fff4e1] text-[#251f19] shadow-sm"
                      : "text-sidebar-foreground"
                  )}
                >
                  <item.Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected ? "text-[#a76311]" : "text-muted-foreground"
                    )}
                  />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-auto border-t border-sidebar-border p-3">
        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground">
          Sign out
        </div>
      </div>
    </aside>
  );
}

function PageHeader({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="h-1 w-full bg-[#f48d16]/24" />
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <h3 className="mt-1.5 text-xl font-bold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function StatsStrip() {
  return (
    <div className="rounded-2xl border border-border bg-white px-3 py-2.5 shadow-sm">
      <div className="flex gap-2 overflow-hidden">
        {STATS.map(([label, value, className]) => (
          <div
            key={label}
            className={cn(
              "flex min-w-[8rem] items-center justify-between gap-3 rounded-2xl border px-3 py-2",
              className
            )}
          >
            <p className="truncate text-xs font-semibold leading-tight">{label}</p>
            <p className="min-w-6 text-right text-xs font-bold tabular-nums text-stone-950">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeCards() {
  const cards = [
    ["ADRs", "Architecture decision records", true],
    ["RFCs", "Request for comments", false],
    ["Meeting Notes", "Reviews and summaries", false],
    ["Tickets", "Support and project tickets", false],
  ] as const;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Select content type</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map(([label, summary, active]) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border p-3",
              active
                ? "border-[#f48d16]/32 bg-[#fff4e1] ring-1 ring-[#f48d16]/18"
                : "border-border bg-secondary/50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
              </div>
              <span className="flex size-6 items-center justify-center rounded-full border border-[#f48d16]/18 bg-white text-xs font-bold text-primary">
                i
              </span>
            </div>
            <p className="mt-2 rounded-lg border border-border/70 bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
              Last uploaded: {active ? "Today" : "Not uploaded yet"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadStartView() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageHeader
        eyebrow="Upload Data"
        title="Add company knowledge"
        copy="Files are stored and indexed only for this workspace."
      />
      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <TypeCards />
          <UploadPanel selected={false} />
        </div>
      </section>
    </div>
  );
}

function UploadFilesView() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageHeader
        eyebrow="Upload Data"
        title="Add company knowledge"
        copy="Five ADRs are selected and ready to upload."
      />
      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <TypeCards />
          <UploadPanel selected status="selected" />
        </div>
      </section>
    </div>
  );
}

function UploadIndexingView() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <PageHeader
        eyebrow="Upload Data"
        title="Indexing new decisions"
        copy="MemoStack saves, chunks, embeds, and queues retrieval refresh for this workspace."
      />
      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
          <TypeCards />
          <UploadPanel selected status="indexing" />
        </div>
      </section>
    </div>
  );
}

function UploadPanel({
  selected,
  status = "empty",
}: {
  selected: boolean;
  status?: "empty" | "selected" | "indexing";
}) {
  const files = [
    "ADR-024-kafka-order-events.md",
    "ADR-025-event-gateway-rollout.md",
    "ADR-026-order-replay-guard.md",
    "ADR-027-service-boundary.md",
    "ADR-028-rollback-checks.md",
  ];

  return (
    <section className="flex min-h-[18rem] flex-col rounded-2xl border border-border bg-secondary/35 p-3">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
          <UploadIcon className="h-4 w-4 text-[#a76311]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-foreground">Upload workspace records</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ADRs, RFCs, notes, postmortems, tickets, and images.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/50 p-3">
        {selected ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">5 ADR files selected</p>
              <p className="mt-1 text-xs text-muted-foreground">211 KB total</p>
            </div>
            <div className="space-y-1.5">
              {files.map((file, index) => (
                <motion.div
                  key={file}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <DocumentIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="truncate text-xs font-medium text-foreground">{file}</p>
                  </div>
                  <p className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {index === 0 ? "42 KB" : `${38 + index * 3} KB`}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No files selected yet.</p>
        )}
      </div>

      <button
        type="button"
        className="mt-3 inline-flex w-fit items-center justify-center gap-2 rounded-2xl border border-[#f48d16]/22 bg-[#fff4e1] px-5 py-3 text-sm font-semibold text-[#251f19] shadow-sm"
      >
        {selected && <CheckIcon className="h-4 w-4" />}
        Upload
      </button>

      {selected && (
        <div className="mt-3 space-y-2">
          {status === "indexing" ? (
            <>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                5 files saved. Workspace index refresh queued.
              </div>
              <div className="rounded-xl border border-[#f48d16]/18 bg-[#fff4e1] px-4 py-3">
                <div className="mb-2 flex items-center gap-3">
                  <span className="size-2 animate-pulse rounded-full bg-amber-400" />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Processing:</span> chunking and embedding ADRs
                  </p>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/70">
                  <motion.div
                    initial={{ width: "18%" }}
                    animate={{ width: "92%" }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-[#f48d16]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[#f48d16]/18 bg-[#fff4e1] px-4 py-3 text-sm text-[#5f5145]">
              Ready to upload and index for AcmeTech only.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SearchCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
          <SparkleIcon className="h-4 w-4 text-[#a76311]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-foreground">
            Search incident and decision history
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">AcmeTech</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-background px-4 py-3 shadow-sm ring-2 ring-primary/10">
        <SearchIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <motion.p
            initial={{ maxWidth: 0 }}
            animate={{ maxWidth: 540 }}
            transition={{ duration: 0.72, ease: "easeOut" }}
            className="overflow-hidden whitespace-nowrap text-sm text-foreground"
          >
            {QUESTION}
          </motion.p>
        </div>
        <button className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-4 py-2 text-sm font-semibold text-[#251f19] shadow-sm">
          <SearchIcon className="h-4 w-4" />
          Search
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {["What changed before the outage?", "Which ADR explains the auth flow?"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-border bg-secondary/55 px-3 py-1.5 text-xs text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}

function SearchView() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <StatsStrip />
      <SearchCard />
      <section className="rounded-2xl border border-primary/10 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#f48d16]/18 bg-[#fff4e1]">
            <SparkleIcon className="h-5 w-5 animate-pulse-soft text-[#a76311]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Analyzing workspace evidence</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Searching ADRs, RFCs, notes, postmortems, tickets, and images.
            </p>
          </div>
        </div>
        <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-[#f4eee4]">
          <div className="h-full w-full animate-line-flow rounded-full bg-[linear-gradient(90deg,rgba(244,141,22,0),rgba(244,141,22,0.45),rgba(244,141,22,0))] bg-[length:200%_100%]" />
        </div>
      </section>
    </div>
  );
}

function AnswerView() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <StatsStrip />
      <SearchCard />
      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="inline-flex items-center rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a76311]">
            Answer
          </span>
          <h4 className="mt-3 text-base font-semibold text-foreground">{QUESTION}</h4>
          <p className="mt-1 text-xs text-muted-foreground">3 supporting records</p>
          <div className="mt-4 rounded-xl border border-border bg-secondary/55 p-4">
            <p className="text-sm leading-7 text-stone-700">
              The team moved order events off Kafka after replay risk and ordering incidents made
              recovery expensive. The accepted path was the event gateway rollout, with rollback
              checks added after the postmortem.
            </p>
          </div>
        </section>
        <EvidenceCards compact />
      </div>
    </div>
  );
}

function ChatView() {
  return (
    <div className="mx-auto max-w-4xl rounded-[28px] border border-border bg-white/85 shadow-card backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border bg-white/70 px-4 py-3">
        <div>
          <span className="inline-flex items-center rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a76311]">
            Active Chat
          </span>
          <h4 className="mt-2 text-base font-semibold text-foreground">Kafka decision follow-up</h4>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium text-foreground">
          <ChatIcon className="h-4 w-4 text-primary" />
          Conversations
        </button>
      </div>
      <div className="space-y-4 bg-white/55 p-4">
        <div className="ml-auto max-w-[72%] rounded-2xl bg-[#fff4e1] px-4 py-3 text-sm font-medium leading-6 text-stone-900">
          What changed after ADR-024?
        </div>
        <div className="max-w-[82%] rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-7 text-stone-700 shadow-sm">
          ADR-024 moved order events to the event gateway after replay risk and ordering recovery
          created too much operational overhead. The rollout added rollback checks from PM-042.
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SparkleIcon className="h-3.5 w-3.5 animate-pulse-soft text-primary" />
          MemoStack is analyzing evidence...
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="ml-auto max-w-[72%] rounded-2xl bg-[#fff4e1] px-4 py-3 text-sm font-medium leading-6 text-stone-900"
        >
          {FOLLOW_UP}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="max-w-[82%] rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-7 text-stone-700 shadow-sm"
        >
          The team accepted more explicit service ownership and slower rollout checks in exchange
          for safer recovery and clearer rollback evidence.
          <div className="mt-3 flex flex-wrap gap-2">
            {["ADR-024", "RFC-118"].map((source) => (
              <span
                key={source}
                className="rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-1 text-[11px] font-semibold text-[#a76311]"
              >
                {source}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
      <div className="border-t border-border bg-white p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/55 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-foreground">
            {FOLLOW_UP}
          </p>
          <button className="rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-4 py-2 text-sm font-semibold text-[#251f19]">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidenceCards({ compact = false }: { compact?: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-base font-semibold text-foreground">Supporting records</h4>
        <p className="text-xs text-muted-foreground">3 results</p>
      </div>
      <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-3"}>
        {RECEIPTS.map((item, index) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="rounded-2xl border border-border bg-background p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#a76311]">
                {item.id}
              </span>
              <span className="text-[11px] text-muted-foreground">ADR</span>
            </div>
            <h5 className="mt-3 line-clamp-1 text-sm font-semibold text-foreground">
              {item.title}
            </h5>
            <p className="mt-2 line-clamp-2 text-xs leading-6 text-muted-foreground">
              {item.snippet}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function EvidenceView() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
            Evidence Library
          </p>
          <h3 className="mt-1.5 text-xl font-bold tracking-tight text-foreground">
            Browse workspace evidence
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review uploaded records by type and verify retrieved context.
          </p>
        </div>
        <div className="hidden rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Index status
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">Ready</p>
        </div>
      </div>

      <section className="rounded-[24px] border border-border bg-white/80 p-4 shadow-card backdrop-blur-sm">
        <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Search by title, section, or keyword...
            </p>
          </div>
          <div className="flex h-11 items-center rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground">
            Latest first
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "ADRs", "RFCs", "Meeting Notes", "Postmortems", "Tickets"].map((filter) => (
            <span
              key={filter}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium",
                filter === "ADRs"
                  ? "border-[#f48d16]/28 bg-[#fff4e1] text-[#251f19]"
                  : "border-border bg-secondary text-muted-foreground"
              )}
            >
              {filter}
              {filter === "ADRs" && (
                <span className="rounded-full bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#a76311]">
                  11
                </span>
              )}
            </span>
          ))}
        </div>
      </section>

      <EvidenceCards />
    </div>
  );
}

function DataManagerDeleteView() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <PageHeader
        eyebrow="Data Manager"
        title="Manage indexed workspace files"
        copy="Replace outdated files or delete stale records."
      />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["All", "ADRs", "RFCs", "Meeting Notes", "Tickets"].map((type) => (
              <span
                key={type}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold",
                  type === "ADRs"
                    ? "border-[#f48d16]/28 bg-[#fff4e1] text-[#251f19] shadow-sm"
                    : "border-border bg-white text-muted-foreground"
                )}
              >
                {type}
              </span>
            ))}
          </div>
          <div className="flex h-10 items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 text-sm text-muted-foreground">
            <SearchIcon className="h-4 w-4" />
            Search files
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        ADR-001-old-cache-policy.md deleted. Index refresh queued.
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#fff4e1] text-primary">
              <FolderIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Workspace files</h4>
              <p className="text-xs text-muted-foreground">
                Delete removes the source and refreshes retrieval.
              </p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {[
            ["ADR-024-kafka-order-events.md", "42 KB", "Today", false],
            ["ADR-001-old-cache-policy.md", "19 KB", "Jan 12", true],
          ].map(([filename, size, time, deleting]) => (
            <div
              key={String(filename)}
              className={cn(
                "grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_110px_170px] md:items-center",
                deleting && "bg-destructive/5"
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff4e1] text-primary">
                  <DocumentIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{filename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">.md source file</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{size}</p>
                <p>{time}</p>
              </div>
              <div className="flex gap-2 lg:justify-end">
                <button className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground">
                  <UploadIcon className="h-3.5 w-3.5" />
                  Replace
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function DataManagerUpdateView() {
  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <PageHeader
        eyebrow="Data Manager"
        title="Refresh stale workspace files"
        copy="Replace old evidence and keep retrieval aligned with the current decision record."
      />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {["All", "ADRs", "RFCs", "Meeting Notes", "Tickets"].map((type) => (
              <span
                key={type}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-semibold",
                  type === "ADRs"
                    ? "border-[#f48d16]/28 bg-[#fff4e1] text-[#251f19] shadow-sm"
                    : "border-border bg-white text-muted-foreground"
                )}
              >
                {type}
              </span>
            ))}
          </div>
          <div className="flex h-10 items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-3 text-sm text-muted-foreground">
            <SearchIcon className="h-4 w-4" />
            Search files
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        ADR-001-cache-policy-v2.md uploaded. Index refresh complete.
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#fff4e1] text-primary">
              <FolderIcon className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Workspace files</h4>
              <p className="text-xs text-muted-foreground">
                Updated sources are immediately available for future cited answers.
              </p>
            </div>
          </div>
        </div>
        <div className="divide-y divide-border">
          {[
            ["ADR-024-kafka-order-events.md", "42 KB", "Today", false],
            ["ADR-001-cache-policy-v2.md", "24 KB", "Just now", true],
          ].map(([filename, size, time, updated]) => (
            <div
              key={String(filename)}
              className={cn(
                "grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_110px_170px] md:items-center",
                updated && "bg-emerald-50/60"
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff4e1] text-primary">
                  <DocumentIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{filename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">.md source file</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{size}</p>
                <p>{time}</p>
              </div>
              <div className="flex gap-2 lg:justify-end">
                <button className="inline-flex items-center gap-2 rounded-xl border border-[#f48d16]/22 bg-[#fff4e1] px-3 py-2 text-xs font-semibold text-[#251f19]">
                  <UploadIcon className="h-3.5 w-3.5" />
                  Replace
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                  <TrashIcon className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const SCREENS = {
  "upload-nav": SearchView,
  "upload-start": UploadStartView,
  "upload-files": UploadFilesView,
  "upload-indexing": UploadIndexingView,
  "search-query": SearchView,
  answer: AnswerView,
  chat: ChatView,
  evidence: EvidenceView,
  "manager-delete": DataManagerDeleteView,
  "manager-update": DataManagerUpdateView,
} as const;

type CursorPoint = {
  x: string;
  y: string;
};

function parsePercent(value: string) {
  return Number.parseFloat(value.replace("%", ""));
}

function distanceBetween(a: CursorPoint, b: CursorPoint) {
  const dx = parsePercent(b.x) - parsePercent(a.x);
  const dy = parsePercent(b.y) - parsePercent(a.y);
  return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildCursorMotion(fromPoint: CursorPoint, path: readonly CursorPoint[]) {
  const points = [fromPoint, ...path];
  const distances = points.slice(1).map((point, index) => distanceBetween(points[index], point));
  const totalDistance = distances.reduce((sum, value) => sum + value, 0);

  const cumulative = [0];
  for (const distance of distances) {
    cumulative.push(cumulative[cumulative.length - 1] + distance);
  }

  const normalizer = totalDistance > 0.001 ? totalDistance : 1;
  const times = cumulative.map((value) => value / normalizer);

  let arrivalIndex = points.length - 1;
  for (let index = distances.length - 1; index >= 0; index -= 1) {
    if (distances[index] > 0.001) {
      arrivalIndex = index + 1;
      break;
    }
  }

  const travelDuration = clamp(0.95 + totalDistance / 200, 1.05, 1.95);

  return {
    left: points.map((point) => point.x),
    top: points.map((point) => point.y),
    times,
    travelDuration,
    arrivalDelay: travelDuration * (times[arrivalIndex] ?? 1),
    arrivalPoint: points[arrivalIndex],
  };
}

function WorkflowCursor({
  stepIndex,
  fromPoint,
}: {
  stepIndex: number;
  fromPoint: CursorPoint;
}) {
  const step = JOURNEY[stepIndex];
  const cursorMotion = useMemo(() => buildCursorMotion(fromPoint, step.cursor.path), [fromPoint, step]);
  const clickLead = step.cursor.gesture === "click" ? Math.max(0.18, cursorMotion.travelDuration - 0.22) : 0;
  const typeLead = step.cursor.gesture === "type" ? Math.max(0.15, cursorMotion.travelDuration - 0.2) : 0;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 hidden sm:block"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        key={step.id}
        initial={{ left: fromPoint.x, top: fromPoint.y, opacity: 0, scale: 0.94 }}
        animate={{
          left: cursorMotion.left,
          top: cursorMotion.top,
          opacity: 1,
          scale: [0.94, 1.02, 1],
        }}
        transition={{
          left: { duration: cursorMotion.travelDuration, times: cursorMotion.times, ease: [0.16, 1, 0.3, 1] },
          top: { duration: cursorMotion.travelDuration, times: cursorMotion.times, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: cursorMotion.travelDuration, times: [0, 0.14, 1], ease: "easeOut" },
          opacity: { duration: 0.18 },
        }}
        className="absolute"
      >
        {step.cursor.gesture === "click" && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.9, 2.7], opacity: [0, 0.28, 0] }}
            transition={{ delay: clickLead, duration: 0.7, ease: "easeOut" }}
            className="absolute -left-2.5 -top-2.5 size-8 rounded-full border border-[#f48d16]/50 bg-[#f48d16]/18"
          />
        )}
        {step.cursor.gesture === "type" && (
          <motion.span
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: [0, 22, 22, 0], opacity: [0, 1, 1, 0] }}
            transition={{ delay: typeLead, duration: 1, ease: "easeOut" }}
            className="absolute -top-5 left-2 w-px bg-[#251f19]"
          />
        )}
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: [0, 0.25, 0], scale: [0.92, 1, 1.15] }}
          transition={{
            delay: cursorMotion.arrivalDelay - 0.12,
            duration: 0.56,
            ease: "easeOut",
          }}
          className="absolute -left-1.5 -top-1.5 size-6 rounded-full border border-[#f48d16]/35 bg-[#fff4e1]/40 blur-[0.5px]"
        />
        <motion.div
          animate={{ y: [0, 1.5, 0], rotate: [-1, 0.5, -1] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.2 }}
          className="relative"
        >
          <MousePointer2 className="size-5 -translate-x-0.5 -translate-y-0.5 fill-[#251f19] text-[#251f19] drop-shadow-[0_4px_8px_rgba(37,31,25,0.25)]" />
          <span className="absolute left-4 top-4 whitespace-nowrap rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold text-[#5f5145] shadow-[0_10px_24px_rgba(37,31,25,0.1)]">
            {step.cursor.label}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function WorkflowVideo({ stepIndex }: { stepIndex: number }) {
  const step = JOURNEY[stepIndex];
  const previousStep = JOURNEY[(stepIndex - 1 + JOURNEY.length) % JOURNEY.length];
  const ActiveScreen = SCREENS[step.screen];
  const previousPoint = previousStep.cursor.path[previousStep.cursor.path.length - 1];

  return (
    <div className="relative mx-auto h-[500px] w-full overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_24px_60px_rgba(33,26,20,0.08)] sm:h-[530px]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(244,141,22,0.22),rgba(244,141,22,0.06)_42%,transparent_72%)] blur-3xl"
        animate={{ x: [0, 18, 0], y: [0, -12, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 14, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,216,166,0.26),rgba(255,216,166,0.08)_38%,transparent_70%)] blur-3xl"
        animate={{ x: [0, -16, 0], y: [0, 10, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 16, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,248,237,0.85)_0%,rgba(255,255,255,0.72)_34%,rgba(255,244,225,0.18)_64%,rgba(255,255,255,0)_100%)]"
      />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-35" aria-hidden />
      <WorkflowCursor stepIndex={stepIndex} fromPoint={previousPoint} />

      <div className="relative z-10 flex h-full">
        <SidebarMock active={step.nav} />
        <main className="relative min-w-0 flex-1 overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-35" aria-hidden />
          <motion.div
            key={`${step.id}-focus`}
            className="pointer-events-none absolute inset-0 z-[1]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.45] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(circle at var(--focus-origin), rgba(244,141,22,0.13), rgba(255,244,225,0.06) 24%, transparent 48%)",
              ["--focus-origin" as string]: step.origin,
            }}
            aria-hidden
          />

          <div className="absolute right-4 top-4 z-20 hidden max-w-sm rounded-2xl border border-border bg-white/92 px-4 py-3 shadow-lg shadow-stone-900/5 backdrop-blur-md sm:block">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                  {step.label}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {step.copy}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-[#f48d16]/22 bg-[#fff4e1] px-2.5 py-1 text-[11px] font-semibold text-[#a76311]">
                {String(stepIndex + 1).padStart(2, "0")}/{String(JOURNEY.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="relative z-10 h-full overflow-hidden">
            <AnimatePresence initial={false}>
              <motion.div
                key={step.id}
                initial={{ opacity: 0, scale: 0.996, y: 4, filter: "blur(1px)" }}
                animate={{
                  opacity: 1,
                  scale: [0.998, step.zoom, 1.004],
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{ opacity: 0, scale: 1.002, y: -3, filter: "blur(0.5px)" }}
                transition={{
                  opacity: { duration: 0.42, ease: "easeOut" },
                  scale: { duration: 2.15, times: [0, 0.58, 1], ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.42, ease: "easeOut" },
                  filter: { duration: 0.32, ease: "easeOut" },
                }}
                className="absolute inset-3 top-16 origin-top overflow-hidden sm:inset-4 sm:top-20 md:inset-5 lg:inset-5"
                style={{ transformOrigin: step.origin }}
              >
                <ActiveScreen />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export function HowItWorks() {
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = useMemo(() => JOURNEY[stepIndex], [stepIndex]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setStepIndex((current) => (current + 1) % JOURNEY.length);
    }, FRAME_MS);

    return () => window.clearTimeout(id);
  }, [stepIndex]);

  return (
    <section id="how-it-works" className="py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="mx-auto mb-8 flex max-w-[1240px] flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center">
            <p className="text-sm font-medium text-accent">How it works</p>
            <h2 className="mt-3 max-w-2xl font-heading text-[3rem] leading-[1.04] font-medium tracking-normal text-balance max-sm:text-4xl sm:text-[3.25rem] sm:leading-[1.02]">
              Upload docs. Ask questions.
              <br />
              <em className="text-muted-foreground italic">Get cited answers.</em>
            </h2>
          </div>
          <p className="max-w-md text-[16px] leading-snug text-muted-foreground">
            One continuous dashboard replay: upload, search, chat, verify evidence, and clean up
            stale records.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto max-w-[1240px]">
          <WorkflowVideo stepIndex={stepIndex} />
        </Reveal>

        <div className="sr-only" aria-live="polite">
          Current workflow step: {activeStep.label}.
        </div>
      </div>
    </section>
  );
}
