import Image from "@/memostack/compat/image";

import { Reveal } from "@/memostack/components/reveal";

const AUDIENCES = [
  {
    name: "Staff engineers",
    content: "Bring the original tradeoffs into design reviews without hunting through old ADRs.",
    image: "/staff-engineer-pixel.png",
  },
  {
    name: "Engineering managers",
    content: "Answer why something changed without pulling senior engineers out of focus time.",
    image: "/engineering-manager-pixel.png",
  },
  {
    name: "Platform teams",
    content: "Find runbooks, RFCs, ownership notes, and migration context from one place.",
    image: "/platform-engineer-pixel.png",
  },
  {
    name: "SRE and on-call",
    content: "Search incidents by symptom and get the remediation notes with sources attached.",
    image: "/sre-oncall-pixel.png",
  },
  {
    name: "Product managers",
    content: "Trace what engineering committed to across tickets, meeting notes, and planning docs.",
    image: "/product-manager-pixel.png",
  },
  {
    name: "Support engineers",
    content: "Find known issues and escalation history before asking product or engineering.",
    image: "/support-engineer-pixel.png",
  },
  {
    name: "CTO and VP Eng",
    content: "Review decisions, risk, and stale context across teams without asking for a recap.",
    image: "/cto-vp-eng-pixel.png",
  },
] as const;

const MARQUEE_ITEMS = [...AUDIENCES, ...AUDIENCES] as const;

export function UseCases() {
  return (
    <section id="use-cases" className="overflow-hidden py-16 sm:py-20">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-accent">Who it&apos;s for</p>
          <h2 className="mt-3 font-heading text-3xl font-medium tracking-normal text-balance sm:text-5xl">
            Teams that need the answer
            <br />
            <em className="text-muted-foreground italic">without asking around.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Built for the people who carry decisions, incidents, planning, and
            customer context across team records.
          </p>
        </Reveal>
      </div>

      <Reveal delay={0.08} className="mx-auto mt-10 max-w-[1240px] px-4 sm:px-6">
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent sm:w-28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent sm:w-28" />

          <div className="flex w-max animate-audience-marquee gap-4 will-change-transform">
            {MARQUEE_ITEMS.map((item, index) => {
              const hasImage = "image" in item;

              return (
                <article
                  key={`${item.name}-${index}`}
                  className={
                    hasImage
                      ? "grid h-[320px] w-[520px] shrink-0 grid-cols-[minmax(0,260px)_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:w-[580px] sm:grid-cols-[minmax(0,300px)_minmax(0,1fr)]"
                      : "relative flex h-[320px] w-[250px] shrink-0 flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm sm:w-[280px]"
                  }
                >
                  <div className={hasImage ? "flex flex-col justify-center p-6" : "relative z-10"}>
                    <p className="font-heading text-xl font-medium tracking-normal text-foreground">
                      {item.name}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {item.content}
                    </p>
                  </div>

                  {hasImage ? (
                    <div className="relative min-h-0 overflow-hidden border-l border-border bg-[#fff3e1]">
                      <Image
                        src={item.image}
                        alt=""
                        width={300}
                        height={300}
                        className="absolute right-[-58px] bottom-[-8px] h-auto w-[300px] object-contain [image-rendering:pixelated]"
                        priority={index === 0}
                      />
                    </div>
                  ) : (
                    <div className="h-28 overflow-hidden rounded-lg border border-dashed border-border bg-secondary/35" />
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
