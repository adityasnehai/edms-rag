import Link from "@/memostack/compat/link";
import { AtSign, Mail, X } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Grounded answers", href: "#grounded" },
      { label: "Hybrid search", href: "#product" },
      { label: "Decision pipeline", href: "#pipeline" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Who it's for", href: "#use-cases" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Early access", href: "#cta" },
      { label: "Contact", href: "mailto:adityasneh09@gmail.com" },
    ],
  },
];

const SOCIALS = [
  { icon: X, label: "X" },
  { icon: AtSign, label: "Threads" },
  { icon: LinkedInGlyph, label: "LinkedIn" },
];

function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.4-2.16 2.96V21h-4V9Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-secondary/40">
      <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-heading text-lg font-semibold tracking-normal">
            MemoStack
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Social media</span>
            <div className="flex items-center gap-2">
              {SOCIALS.map((s) => (
                <span
                  key={s.label}
                  className="flex size-8 items-center justify-center rounded-md bg-card text-foreground"
                  aria-label={s.label}
                >
                  <s.icon className="size-4" />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-dashed border-border" />

        <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="text-sm text-muted-foreground">
              Grounded search over your team&apos;s engineering memory — ADRs,
              RFCs, meeting notes, postmortems, tickets — with every answer
              cited.
            </p>

            <p className="mt-8 text-sm font-semibold">Contact</p>
            <a
              href="mailto:adityasneh09@gmail.com"
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium text-foreground shadow-sm transition hover:border-[#f48d16]/28 hover:bg-[#fff4e1]"
            >
              <Mail className="size-4 text-accent" />
              adityasneh09@gmail.com
            </a>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Email for access, demos, and product questions.
            </p>
          </div>

          <div className="flex flex-wrap gap-12">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="size-1.5 rounded-[2px] bg-accent" />
                  {col.title}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-4 h-[clamp(80px,16vw,180px)] select-none overflow-hidden">
          <p
            aria-hidden
            className="absolute -bottom-[0.15em] left-0 font-heading text-[clamp(80px,20vw,220px)] leading-none font-semibold whitespace-nowrap text-foreground/[0.06]"
          >
            MemoStack
          </p>
        </div>

        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MemoStack.</p>
          <a href="mailto:adityasneh09@gmail.com" className="hover:text-foreground">
            adityasneh09@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}
