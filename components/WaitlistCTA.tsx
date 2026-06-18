import Reveal from "@/components/Reveal";
import WaitlistForm from "@/components/WaitlistForm";

/** CTA — "Go deep." headline + early-access offer + waitlist form. */
export default function WaitlistCTA() {
  return (
    <section
      id="cta"
      className="relative overflow-hidden px-gutter py-rhythm md:px-gutter-lg md:py-rhythm-lg"
    >
      <div className="dot-grid absolute inset-0" aria-hidden="true" />

      {/* Soft gold aura behind the headline */}
      <div
        aria-hidden="true"
        className="pulse-glow pointer-events-none absolute left-1/2 top-24 h-[280px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--gold-soft)_0%,transparent_65%)] opacity-20 blur-2xl"
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <Reveal>
          <h2 className="font-serif text-3xl text-ink md:text-2xl">Go deep.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-lg font-sans text-md leading-relaxed text-ink-soft">
            Hodos is now in open beta — free to try today. Join the list to
            follow the build and hear when accounts and sync arrive.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-10">
            <WaitlistForm />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
