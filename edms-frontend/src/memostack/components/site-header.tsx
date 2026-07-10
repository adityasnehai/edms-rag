"use client";

import { useEffect, useState } from "react";
import Link from "@/memostack/compat/link";
import { Menu } from "lucide-react";

import { cn } from "@/memostack/lib/utils";

import { Button } from "@/memostack/components/ui/button";
import { DarkCtaButton } from "@/memostack/components/dark-cta-button";
import { Logo } from "@/memostack/components/logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/memostack/components/ui/sheet";

const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/80 shadow-sm shadow-black/[0.03] backdrop-blur-md"
          : "bg-background"
      )}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="font-heading text-lg font-semibold tracking-normal">
            MemoStack
          </span>
        </Link>

        <nav className="hidden items-center gap-2.5 text-sm font-medium md:flex">
          {NAV_LINKS.map((link, i) => (
            <div key={link.href} className="flex items-center gap-2.5">
              {i > 0 && <span className="size-1 rounded-full bg-foreground/40" />}
              <Link
                href={link.href}
                className="rounded-full px-2.5 py-1.5 text-foreground transition-colors hover:bg-[#fff4e1] hover:text-accent"
              >
                {link.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="hidden md:block">
          <DarkCtaButton href="#auth-login">Sign In</DarkCtaButton>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="top" className="rounded-b-3xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5 font-heading">
              <Logo />
              MemoStack
            </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4 pb-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-2">
                <DarkCtaButton href="#auth-login" onClick={() => setOpen(false)}>
                  Sign In
                </DarkCtaButton>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
