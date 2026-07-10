import { useEffect, useState } from "react";

import { SiteHeader } from "@/memostack/components/site-header";
import { SiteFooter } from "@/memostack/components/site-footer";
import { Hero } from "@/memostack/components/sections/hero";
import { TechStrip } from "@/memostack/components/sections/tech-strip";
import { Pipeline } from "@/memostack/components/sections/pipeline";
import { ValueProps } from "@/memostack/components/sections/value-props";
import { Grounded } from "@/memostack/components/sections/grounded";
import { HowItWorks } from "@/memostack/components/sections/how-it-works";
import { WorkspaceModes } from "@/memostack/components/sections/workspace-modes";
import { UseCases } from "@/memostack/components/sections/use-cases";
import { FAQ } from "@/memostack/components/sections/faq";
import { FinalCTA } from "@/memostack/components/sections/final-cta";
import { MemoStackAuthModal } from "@/memostack/components/auth-modal";

export default function Home() {
  const [authMode, setAuthMode] = useState(() =>
    typeof window !== "undefined" && window.location.pathname === "/login" ? "login" : null
  );

  useEffect(() => {
    function onAuth(event) {
      setAuthMode(event.detail?.mode || "login");
    }

    window.addEventListener("memostack:auth", onAuth);

    if (window.location.pathname === "/login") {
      window.history.replaceState(null, "", "/");
    }

    return () => window.removeEventListener("memostack:auth", onAuth);
  }, []);

  return (
    <div className="memostack-page min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TechStrip />
        <ValueProps />
        <Pipeline />
        <HowItWorks />
        <WorkspaceModes />
        <Grounded />
        <UseCases />
        <FAQ />
        <FinalCTA />
      </main>
      <SiteFooter />
      {authMode && (
        <MemoStackAuthModal mode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </div>
  );
}
