import { Reveal } from "@/memostack/components/reveal";
import { HeadingGlow } from "@/memostack/components/heading-glow";
import { PainterlyBanner } from "@/memostack/components/painterly-banner";
import { PixelParticleField } from "@/memostack/components/pixel-particle-field";
import { ShineCtaButton } from "@/memostack/components/shine-cta-button";

export function FinalCTA() {
  return (
    <section id="cta" className="px-4 py-20 sm:py-28">
      <Reveal className="relative isolate mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:py-24">
        <PainterlyBanner src="/cta-global-campus-pixel.png" />
        <PixelParticleField
          className="hidden sm:block"
          colorClassName="bg-[#fff0cb]/22"
        />

        <div className="relative">
          <HeadingGlow className="left-1/2 top-1/2 h-36 w-96 -translate-x-1/2 -translate-y-1/2" warm />
          <h2 className="relative font-heading text-3xl font-medium tracking-normal text-balance text-white sm:text-5xl">
            Search the record.
            <br />
            <em className="italic">Keep the context.</em>
          </h2>
        </div>
        <p className="mx-auto mt-5 max-w-xl text-balance text-white/80 sm:text-lg">
          Turn ADRs, RFCs, postmortems, tickets, and notes into a searchable
          memory layer your team can verify. Ask the question, see the source,
          and move without chasing people for missing context.
        </p>
        <div className="mt-8 flex justify-center">
          <ShineCtaButton href="#auth-register">Request access</ShineCtaButton>
        </div>
      </Reveal>
    </section>
  );
}
