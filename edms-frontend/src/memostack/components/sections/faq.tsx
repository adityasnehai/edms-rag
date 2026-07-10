import { Plus } from "lucide-react";

import { PixelCluster } from "@/memostack/components/pixel-cluster";
import { Reveal } from "@/memostack/components/reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/memostack/components/ui/accordion";

const FAQS = [
  {
    q: "How is MemoStack different from ChatGPT or a generic RAG bot?",
    a: "MemoStack is built for internal decision history, not open-ended chat. It retrieves from uploaded ADRs, RFCs, postmortems, tickets, and notes, then answers with exact citations. If the record is missing, it stops instead of improvising.",
  },
  {
    q: "What happens when the answer is not in our docs?",
    a: "You get a clear not-found response, plus the closest supporting records when available. The system is designed to avoid unsupported output, so missing evidence means no fabricated answer.",
  },
  {
    q: "What documents can we upload?",
    a: "Team knowledge that usually gets buried: ADRs, RFCs, postmortems, tickets, meeting notes, and supporting images. Each workspace supports up to 5,000 files or 1 GB, and newly uploaded content is indexed within moments.",
  },
  {
    q: "Is workspace data isolated?",
    a: "Yes. Each organization has its own storage, vector index, and usage boundaries. One tenant cannot query another tenant's records, and authentication uses hashed passwords, short-lived sessions, and login lockouts.",
  },
  {
    q: "How does MemoStack control LLM cost?",
    a: "Routine questions can use the smaller model path, and repeated retrieval or answer patterns benefit from caching. The expensive path is reserved for questions that actually need deeper reasoning.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12">
          <Reveal className="relative">
            <PixelCluster
              pattern="trail"
              cellSize={5}
              className="right-10 bottom-2 hidden sm:grid"
              cellClassName="bg-accent/32"
            />
            <p className="text-sm font-medium text-accent">FAQ</p>
            <h2 className="mt-3 max-w-[10ch] font-heading text-3xl font-medium tracking-normal text-[#251f19] sm:text-5xl">
              The practical
              <br />
              questions.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#68615a]">
              The usual concerns before a team trusts a system with internal
              knowledge. Clear answers, no vague platform claims.
            </p>
          </Reveal>

          <Reveal delay={0.05}>
            <Accordion className="flex flex-col gap-3">
              {FAQS.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`item-${i}`}
                  className="rounded-2xl border border-[#e4ddd3] bg-[#fbfaf6] px-5 shadow-sm transition-colors hover:border-accent/35 hover:bg-white"
                >
                  <AccordionTrigger className="py-4 text-left font-heading text-[16px] font-medium text-[#251f19] hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden">
                    {item.q}
                    <Plus className="ml-auto size-4 shrink-0 text-accent transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-45" />
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pr-7 text-[15px] leading-relaxed text-[#68615a]">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
